# Project Audit — S Ameer Ali Bullet Spare Parts

**Prepared by:** Sam Tech Builds (engineering)
**Audit date:** 2026-11-13
**Phase:** 0 — Environment audit

---

## 1. Environment findings

| Item | Finding |
|---|---|
| Working directory | `/home/claude` contained only tool/config dot-folders (`.cache`, `.config`, `.npm`, `.ssh` …). **No existing project, no `package.json`, no Git repository.** Nothing to preserve or overwrite. |
| Project folder | New folder created: `sameer-ali-spares/` |
| OS | Linux x86-64, 2 vCPU, 7.8 GB RAM |
| Node.js | v22.23.4 |
| npm | 10.9.9 (pnpm and yarn also present; npm chosen) |
| Git | 2.43.0, commit identity pre-configured, signed commits enabled. No remote configured — nothing will be pushed. |
| PostgreSQL | 16.15 installed locally (cluster was stopped; started for testing) |
| Docker | Client + daemon available, but **all container registries are blocked** (Docker Hub, public.ecr.aws return 403). The official Supabase local stack (`supabase start`) therefore cannot run. |
| GitHub release downloads | Reachable. PostgREST v12.2.3 and Supabase Auth (GoTrue) v2.180.0 Linux binaries downloaded successfully. |
| Browser for testing | `google-chrome` installed. Playwright's own browser download is blocked, so Playwright is driven via the system Chrome. |
| Existing env config | None. No `.env` files exist. No Supabase project credentials are available. |

## 2. Architecture decisions

The preferred stack can be used. No architecture change is required.

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.4.6** (App Router), React 19.3 | Latest stable at audit time. Next 16 has breaking changes vs older versions: Middleware is now `proxy.ts`, Cache Components (`'use cache'`, `cacheTag`, `updateTag`) is on by default. The bundled docs in `node_modules/next/dist/docs` were read before writing code. |
| Language | TypeScript (strict) | |
| Styling | Tailwind CSS 4.3 | Design tokens defined with `@theme` in `globals.css`. |
| Database | Supabase PostgreSQL | Version-controlled SQL migrations in `supabase/migrations/`. |
| Auth | Supabase Auth (email + password) | No public sign-up. Owner account created by the developer (documented). Admin role stored in `admin_users` table and checked server-side and in RLS. |
| Files | Supabase Storage, bucket `product-images` | Public-read bucket, admin-only writes enforced by storage RLS. Images are resized and re-encoded to WebP in the browser before upload; `next/image` serves responsive sizes. |
| Supabase client | `@supabase/supabase-js` + `@supabase/ssr` | Cookie-based sessions for the admin; a cookie-less anonymous client for cached public pages. |
| Validation | `zod` | Server-side validation of every admin mutation. |
| Testing | Vitest (unit), SQL RLS test script (pgTAP-style assertions in plain SQL), Playwright (browser, responsive) | |
| Deployment | Vercel (recommended) | Any Node host that supports Next.js 16 works. |

### Local test stack (replacement for blocked Docker images)

Because Docker images cannot be pulled, a local Supabase-compatible stack is assembled from real components:

- PostgreSQL 16 (local) with the Supabase roles (`anon`, `authenticated`, `service_role`, `authenticator`) recreated.
- **Real Supabase Auth (GoTrue)** binary — runs its own `auth` schema migrations.
- **Real PostgREST** binary — the same REST engine Supabase uses.
- A small local gateway that maps `/auth/v1`, `/rest/v1` and `/storage/v1` like the Supabase API gateway.
- Storage: see `docs/TEST_REPORT.md` for what was tested locally versus what must be verified on the hosted project.

This lets RLS policies, authentication and the app's real Supabase client code be tested end-to-end without fabricated credentials. Scripts live in `scripts/local-stack/`.

## 3. Dependencies (planned, kept minimal)

Runtime: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `server-only`.
Dev: `typescript`, `tailwindcss`, `eslint` + `eslint-config-next`, `vitest`, `@playwright/test`.

No UI kit, icon pack, animation library or state-management library. Icons are small inline SVG components.

## 4. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| No hosted Supabase project yet | Site cannot go live | Full setup guide in `docs/DEPLOYMENT.md`; all config via env placeholders. |
| Local stack differs slightly from hosted Supabase | A policy could behave differently | Same Postgres role model, real GoTrue + PostgREST; migrations must be re-run and smoke-tested on the hosted project (checklist in `DEPLOYMENT.md`). |
| Next.js 16 is newer than much public guidance | Wrong API usage | Bundled version-matched docs consulted; build + type checks enforce correctness. |
| Empty catalogue at launch | Thin pages, weak SEO | Good empty states; empty model pages are `noindex` until they have products; sitemap only lists real content. |
| WhatsApp number not confirmed | No WhatsApp enquiries | Button hidden until configured; landline call fallback shown. |
| Shop is not confirmed as an authorised Royal Enfield dealer | Legal/trademark risk | Copy says "genuine Royal Enfield spare parts" only; no dealership claim; no Royal Enfield logo or artwork; trademark disclaimer in footer. |
| Map location not verified | Wrong directions | Directions link uses the confirmed street address as a Google Maps search query until the owner supplies a verified Maps link. No coordinates are published. |

## 5. Required external accounts

1. **Supabase** project (free tier is sufficient to start) — URL, anon key, service-role key (server/scripts only).
2. **Vercel** (or other host) account for deployment.
3. **Domain name** + DNS access.
4. **Google Search Console** access for the domain.
5. **Google Business Profile** — owner's access to the shop's existing profile, if any.

## 6. Missing business information

Tracked in detail in `docs/CLIENT_INFORMATION_PENDING.md`:
WhatsApp number, opening hours, final product categories, product inventory, product photographs, logo, business history/introduction, verified Google Maps link, Google Business Profile access, social media accounts, production domain.

## 7. Phase outcome (updated at handover)

All phases 0–7 completed. See TEST_REPORT.md.

The environment is suitable. Phase 1 can begin.
