# Test report

**Date:** 2026-11-13 · **Build:** Next.js 16.4.6 production build (`next build && next start`) · **Browser:** Google Chrome (system), Playwright 1.56

Every result below was produced by executing the test in this environment. Nothing has been reported as passing without being run.

## Summary

| Suite | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | **PASS** (0 errors) |
| Lint | `npm run lint` | **PASS** (0 problems) |
| Production build | `npm run build` | **PASS**: 37 routes; public pages static or partially prerendered |
| Unit tests | `npm test` | **26 / 26 PASS** (includes 5 CSV import tests) |
| Database & storage security | `npm run test:integration` | **30 / 30 PASS** |
| Browser: public, admin, responsive | `npm run test:e2e` | **60 / 60 PASS**, full run on the production build (about 3 min); includes rupee price, festive banner and home image upload tests |
| Revalidation route (manual check) | `curl -X POST /api/revalidate` on the running build | **PASS**: 401 with no or wrong secret; 404 when `REVALIDATE_SECRET` is not set |
| Server errors during e2e run | `grep -c Error` on the server log | **0** |
| Secrets in build output | grep the service-role key in `.next/` | **not found** (anon key present, as expected) |
| Dependency audit | `npm audit --omit=dev` | **0** production vulnerabilities |

## Test environment ("local test stack")
Docker image registries are blocked in this environment, so `supabase start` could not run. Instead, a Supabase-compatible stack was assembled from real components:
- PostgreSQL 16 with Supabase's roles (`anon`, `authenticated`, `service_role`, `authenticator`), `auth` / `storage` / `extensions` schemas and default grants (`scripts/local-stack/bootstrap.sql`).
- The **official Supabase Auth (GoTrue) v2.180.0** binary, running its own migrations, with sign-up disabled. It sends real emails to a local SMTP sink.
- The **official PostgREST v12.2.3** binary (the REST engine behind Supabase).
- A test-only gateway (`scripts/local-stack/gateway.mjs`) mapping `/auth/v1`, `/rest/v1`, `/storage/v1`. Its storage emulator executes every write as the caller's database role with the caller's JWT claims, so **the storage RLS policies in the migrations are what allow or deny uploads**.

The project migrations were applied unchanged. The app ran with the real `@supabase/supabase-js` / `@supabase/ssr` code paths.

## Unit tests (tests/unit/logic.test.ts)
Covered: E.164 phone formatting; WhatsApp number normalisation; landline-as-WhatsApp guard; enquiry message wording from the brief; URL encoding of special characters; no link when the number is missing or invalid; Maps link (verified URL preferred, documented search fallback, `javascript:` rejected); slugify and slug validation; catalogue param sanitising and URL building; product, settings and taxonomy validation (positive and negative cases); image path restrictions (path traversal, other product's folder, GIF); resize maths; open-redirect protection.

## Database & storage security (tests/integration/database-security.test.ts)

| Test | Result |
|---|---|
| public visitor (anon) — reads all 12 confirmed active models | PASS |
| public visitor (anon) — reads the public business settings with only confirmed values | PASS |
| public visitor (anon) — sees only published products | PASS |
| public visitor (anon) — cannot see images or compatibility rows of unpublished products | PASS |
| public visitor (anon) — cannot read admin_users | PASS |
| public visitor (anon) — cannot write any catalogue table | PASS |
| public visitor (anon) — cannot call admin-only functions | PASS |
| public visitor (anon) — cannot sign up for an account | PASS |
| catalog_search() — returns only published products, with primary image | PASS |
| catalog_search() — filters by model, category and availability | PASS |
| catalog_search() — treats % and _ in the search text literally | PASS |
| catalog_search() — caps page size at 60 | PASS |
| signed-in user who is NOT an admin — cannot write catalogue tables | PASS |
| signed-in user who is NOT an admin — updates and deletes silently affect zero rows | PASS |
| signed-in user who is NOT an admin — cannot see unpublished products | PASS |
| signed-in user who is NOT an admin — cannot make itself an admin | PASS |
| signed-in user who is NOT an admin — cannot run admin functions | PASS |
| signed-in user who is NOT an admin — cannot upload or delete product images in storage | PASS |
| admin account — is recognised as admin by the database | PASS |
| admin account — sees unpublished products | PASS |
| admin account — creates, updates, publishes and deletes a product | PASS |
| admin account — replaces compatible models atomically | PASS |
| admin account — rejects duplicate slugs and invalid values | PASS |
| admin account — keeps a single primary image per product | PASS |
| admin account — manages models: add, deactivate (hidden from public), reorder | PASS |
| admin account — updates business settings with validation | PASS |
| admin account — cannot grant admin rights through the API | PASS |
| admin account — gets real dashboard statistics | PASS |
| admin account — uploads, publicly serves and deletes a product image in storage | PASS |
| admin account — anonymous visitors cannot list the image bucket | PASS |

## Browser tests (tests/e2e)

| Project | Test | Result |
|---|---|---|
| public | homepage communicates what, where and how to enquire | PASS |
| public | main navigation reaches every page without dead links | PASS |
| public | every internal link on key pages returns a page (no 404s) | PASS |
| public | model catalogue lists 12 models and model pages handle empty catalogue | PASS |
| public | unknown pages show a helpful not-found page that is not indexed | PASS |
| public | contact page shows confirmed details and a validated Maps destination | PASS |
| public | SEO: unique titles, descriptions and canonicals; valid JSON-LD without invented data | PASS |
| public | robots.txt and sitemap.xml | PASS |
| public | images have alt text and buttons have accessible names | PASS |
| public | mobile menu opens, traps focus and closes with Escape | PASS |
| public | search works from the catalogue page and shows a useful empty state | PASS |
| admin | unauthenticated visitors are redirected away from every admin page | PASS |
| admin | admin pages and API carry noindex | PASS |
| admin | login rejects a wrong password with a generic message and keeps the email | PASS |
| admin | a signed-in user who is not an admin is refused | PASS |
| admin | admin can sign in, sees real dashboard numbers, and signs out | PASS |
| admin | categories: add a new category | PASS |
| admin | product: validation errors keep the typed values | PASS |
| admin | product: create as draft with category and compatible models | PASS |
| admin | photos: upload multiple, reject bad files, set main photo, reorder, describe | PASS |
| admin | publish and verify the public product page | PASS |
| admin | public browsing: homepage featured, model page, category filter, search, availability filter | PASS |
| admin | quick availability change in the list is reflected on the website | PASS |
| admin | settings: WhatsApp validation, landline guard, and enquiry links | PASS |
| admin | models: reorder and deactivate/reactivate | PASS |
| admin | archive hides from the website; restore; then delete removes product and photos | PASS |
| admin | password recovery: email link lets the admin set a new password | PASS |
| responsive | public pages at 360x800 | PASS |
| responsive | admin pages at 360x800 | PASS |
| responsive | public pages at 375x812 | PASS |
| responsive | admin pages at 375x812 | PASS |
| responsive | public pages at 390x844 | PASS |
| responsive | admin pages at 390x844 | PASS |
| responsive | public pages at 430x932 | PASS |
| responsive | admin pages at 430x932 | PASS |
| responsive | public pages at 768x1024 | PASS |
| responsive | admin pages at 768x1024 | PASS |
| responsive | public pages at 1366x768 | PASS |
| responsive | admin pages at 1366x768 | PASS |
| responsive | public pages at 1440x900 | PASS |
| responsive | admin pages at 1440x900 | PASS |

The responsive tests visited 8 public pages and 7 admin pages at **360×800, 375×812, 390×844, 430×932, 768×1024, 1366×768 and 1440×900**. They asserted **no horizontal overflow** and **no interactive control under 40 px tall** (inline text links are exempt, per WCAG 2.5.8). On phones, they also checked that the product enquiry bar sits within the first screen. Evidence screenshots are saved in `test-results/responsive/` (360, 768 and 1440 widths).

## Defects found by testing and fixed

| Defect | Found by | Fix |
|---|---|---|
| Admin inputs given a `className` lost all base styles, so the URL-name and description fields were invisible | admin e2e (category add) | `TextInput` / `TextArea` / `SelectInput` now merge classes |
| Mobile menu panel didn't show: `backdrop-filter` on the header became the containing block for the fixed panel | public e2e (mobile menu) | Solid header background |
| React 19 reset forms after a validation error, wiping the owner's typing | review + e2e "validation keeps values" | Submit through `useActionState` without the automatic reset |
| Unknown product slugs returned 500: `usePathname` outside `<Suspense>` | e2e + server log | Mobile menu wrapped in Suspense with a working fallback link |
| Auth clock reads during background prerender of admin routes (log errors) | server log | `connection()` before creating the cookie client |
| Touch targets under 40 px (footer phone link, breadcrumbs, product category link) | responsive e2e | Larger tap areas |
| Brand subtitle wrapped onto two lines at 360–390 px | screenshot review | Shorter subtitle below 400 px |
| Storage emulator SQL parameter typing; wrong expectation in the `%` search test | integration | Fixed |

## Known limitations / not verified here
1. **Hosted Supabase not tested.** No credentials were available. Re-run `npm run test:integration` against a staging project before launch (DEPLOYMENT.md §1.8). Hosted Storage behaviour such as CDN caching and image transforms was emulated, not exercised.
2. **Unknown product or model URLs return HTTP 200 with a `noindex` not-found page** rather than 404. This is because page content streams after the static shell (Partial Prerendering). Google treats it as not indexable. Completely unknown paths do return 404.
3. **Lighthouse / Core Web Vitals** were not measured. Lighthouse needs network access that is blocked here. Run PageSpeed Insights after deployment.
4. **Real devices:** layouts were tested in Chrome device emulation, not on physical iOS/Android phones. The WhatsApp deep link was verified by URL format, not by opening WhatsApp. HEIC uploads depend on the browser (iOS Safari converts them to JPEG).
5. **Upload progress** uses XHR straight to Storage. Large uploads on slow networks have not been tested.
6. Screen-reader testing (NVDA / VoiceOver) was not performed. Automated checks cover alt text, accessible names, labels, focus trap and Escape.

## How to re-run
```bash
npm run stack:start                       # local test stack (or point env at a staging project)
set -a; . /opt/localstack/local.env; set +a
npm run typecheck && npm run lint && npm test && npm run test:integration
NEXT_PUBLIC_SITE_URL=http://localhost:3000 ALLOW_LOCAL_SUPABASE_IMAGES=1 SITE_ENV=production npm run build
NEXT_PUBLIC_SITE_URL=http://localhost:3000 ALLOW_LOCAL_SUPABASE_IMAGES=1 SITE_ENV=production npm start &
CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
```

## Run of 2026-11-20 — three supply options and demo catalogue

- **Typecheck and lint:** `tsc --noEmit` and `eslint src` clean.
- **Unit tests:** 124 of 124 pass (`tests/unit`), including new tests for the three supply options, supply-keyed cart lines, and supply pricing (a supply the part does not stock never returns the other supply's price).
- **Public browser suite:** 13 of 13 pass against a production build, with the 61-part demo catalogue loaded. Two checks that assumed an empty catalogue now follow the data: the model page empty state, and whether a model appears in the sitemap.
- **Admin browser suite:** 29 of 30 pass, including the supply-choice, OEM/vendor tab, WhatsApp order-line and image-storage tests. One fails: **password recovery** (`tests/e2e/admin.spec.ts`, "email link lets the admin set a new password"). The recovery link redirects the browser to `/admin/login?error=link_invalid`. This flow is authentication code that this release does not change, so it is recorded here rather than fixed in this release. Check the recovery link and the local auth redirect settings before handover.
- **Test harness:** the settings reset calls the site revalidate route, which only answers when `REVALIDATE_SECRET` is set on the server as well as the test runner. Run the production server on port 3000 with the same secret, because the local auth redirect points at `localhost:3000`.


## Run of 2026-11-21 — pre-handover regression (all green)

Against a clean production build (`next build` + `next start` on port 3000) with the local stack:

- **Typecheck:** `tsc --noEmit` clean.
- **Lint:** `eslint src tests` clean.
- **Unit:** 124 / 124 pass.
- **Public e2e:** 13 / 13 pass.
- **Admin e2e:** 46 / 46 pass — including password recovery (request → verify → set new password → log in with it → restore), mobile navigation, OEM / Vendor / Both supply scenarios, the model OEM/Vendor tab filter, catalogue, product detail, rupee pricing, cart → WhatsApp, image upload and settings.
- **Production build:** exits 0. `/products` and `/products/[slug]` build as Partial Prerender (`◐`) with the 5-minute `catalog` cache profile.

Fixes since the previous report:
- Password recovery now passes (was the one failure): token_hash recovery template + session cookies bound to the confirm redirect. The test uses a run-unique new password and restores the original via the admin API, so it is rerunnable even if a run is interrupted.
- The model OEM/Vendor tab test now creates its own throwaway model, so its exact OEM(1)/Vendor(1) counts no longer depend on the demo catalogue.

Environment notes for reproducing:
- Run the production server on port 3000 (the local auth Site URL is `http://localhost:3000`) with `REVALIDATE_SECRET` set on the server as well as the test runner (the settings reset calls `/api/revalidate`).
- The local stack sets a `token_hash` recovery email template (served to GoTrue over HTTP by the gateway) and relaxes `GOTRUE_SMTP_MAX_FREQUENCY` for back-to-back test emails. These are local-only; production uses the Supabase dashboard.
