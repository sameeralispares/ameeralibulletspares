# Cloudflare Workers Compatibility Audit

**Project:** S Ameer Ali Bullet Spare Parts  
**Stack:** Next.js 16.4.6 · React 19 · TypeScript · Tailwind 4 · Supabase · ImageKit (optional)  
**Date:** 2026-11-26  
**Scope:** Read-only inspection — no source code, dependencies, or config was modified.

---

## 1. Dependencies Inventory

### Production dependencies (7)

| Package | Version | Workers compatible? |
|---|---|---|
| `next` | 16.4.6 | Yes — via OpenNext or vinext adapter |
| `react` | 19.3.0 | Yes — runs on client, SSR handled by adapter |
| `react-dom` | 19.3.0 | Yes — same as above |
| `@supabase/ssr` | ^0.12.7 | Yes — uses `fetch`, cookies; no Node.js APIs |
| `@supabase/supabase-js` | ^2.119.0 | Yes — uses `fetch`; isomorphic |
| `server-only` | ^0.0.1 | Yes — build-time marker only |
| `zod` | ^4.6.7 | Yes — pure JS validation |

### Dev dependencies (9) — not shipped to production

`@playwright/test`, `@tailwindcss/turbopack`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `tailwindcss`, `typescript`, `vitest`

**Verdict:** All 7 production dependencies are Workers-compatible. The dependency tree is exceptionally lean — no native Node.js addons, no `node-gyp`, no C++ bindings.

---

## 2. Next.js Caching Features

### `'use cache'` + `cacheLife` + `cacheTag` usage

All in **`src/lib/data/catalog.ts`** — 8 cached functions:

| Function | cacheLife | cacheTag |
|---|---|---|
| `getBusinessSettings()` | `'catalog'` | `TAG_SETTINGS` |
| `getProducts()` | `'catalog'` | `TAG_CATALOG` |
| `getProductBySlug()` | `'catalog'` | `TAG_CATALOG` |
| `getProductById()` | `'catalog'` | `TAG_CATALOG` |
| `getCatalogPage()` | `'catalog'` | `TAG_CATALOG` |
| `getAllModels()` | `'catalog'` | `TAG_CATALOG` |
| `getModelProducts()` | `'catalog'` | `TAG_CATALOG` |
| `getModelBySlug()` | `'catalog'` | `TAG_CATALOG` |

### `cacheLife` profile (next.config.ts)

```ts
cacheLife: {
  catalog: { stale: 300, revalidate: 300, expire: 86400 },
}
```

### Cache invalidation

| API | Location | Usage |
|---|---|---|
| `updateTag()` | `src/app/admin/(panel)/actions.ts` | 18 calls across all admin mutations |
| `revalidatePath('/', 'layout')` | Same file + `/api/revalidate` | Full-site layout revalidation |
| `revalidateTag()` | `/api/revalidate` route | External cache-busting endpoint |

### PPR and streaming

| Feature | Location |
|---|---|
| `partialPrefetching: true` | `next.config.ts` line 31 |
| `cacheComponents: true` | `next.config.ts` line 30 |
| `connection()` | `src/lib/supabase/server.ts`, `src/app/(site)/products/[slug]/page.tsx` |
| `loading.tsx` | `src/app/(site)/products/`, `src/app/(site)/models/` |
| `<Suspense>` | 10 usages across site pages, header, admin |

### Cloudflare compatibility

- **OpenNext:** `'use cache'` (composable caching) is **listed as supported**. PPR is **supported**. ISR is **supported**. Response streaming is **supported**.
- **vinext:** `'use cache'`, `cacheTag`, `cacheLife`, and PPR are **not mentioned** in the official feature table. The compatibility dashboard should be checked. ISR and streaming are supported.

**Risk: MEDIUM (vinext) / LOW (OpenNext).** The heavy reliance on composable caching is fully covered by OpenNext. With vinext, you must verify `'use cache'` support before proceeding.

---

## 3. API Routes, Server Actions, and Middleware

### Route Handlers (2)

| Route | Method | Node.js APIs used |
|---|---|---|
| `src/app/api/revalidate/route.ts` | POST | `node:crypto` (timingSafeEqual), `Buffer` |
| `src/app/auth/confirm/route.ts` | GET | None — uses `@supabase/ssr`, `next/server` |

### Server Actions (2 files)

| File | Node.js APIs used |
|---|---|
| `src/app/admin/(auth)/actions.ts` | None |
| `src/app/admin/(panel)/actions.ts` | `Buffer.from()` (2 calls for image upload) |

### Middleware

**None.** No `middleware.ts` file exists at the project root or anywhere in `src/`. This is a positive finding — middleware on Workers has had the most compatibility issues historically.

### Cloudflare compatibility

- `node:crypto` including `timingSafeEqual` is **fully supported** on Workers with `nodejs_compat`.
- `Buffer` is **fully supported** on Workers with `nodejs_compat`.
- Both OpenNext and vinext support Route Handlers and Server Actions.

**Risk: NONE.** All Route Handler and Server Action code is Workers-compatible.

---

## 4. Node.js API Usage Audit

### Direct Node.js module imports

| File | Import | Usage |
|---|---|---|
| `src/app/opengraph-image.tsx` | `node:fs/promises` (`readFile`) | Reads badge PNG from `public/` at build/runtime |
| `src/app/opengraph-image.tsx` | `node:path` (`path.join`) | Constructs file path with `process.cwd()` |
| `src/app/api/revalidate/route.ts` | `node:crypto` | `crypto.timingSafeEqual()` for secret comparison |

### Node.js globals

| Global | Files | Workers support |
|---|---|---|
| `process.env` | 25+ references across config and lib files | **Supported** — Workers provides `process.env` |
| `Buffer.from()` | `actions.ts` (×2), `revalidate/route.ts` (×2), `imagekit.ts` (×1) | **Supported** with `nodejs_compat` |
| `process.cwd()` | `opengraph-image.tsx` only | **Potential issue** — see below |

### Critical finding: `opengraph-image.tsx`

This file uses `readFile(path.join(process.cwd(), 'public/brand/sameerali-badge.png'))` to load a PNG from the filesystem at runtime. On Workers:

- `node:fs` is **supported** (since compatibility date 2025-09-01) via a virtual filesystem.
- `node:path` is **supported**.
- However, `process.cwd()` returns `/` on Workers, and the file would need to be in the Worker's bundle at `/bundle/public/brand/sameerali-badge.png` or equivalent. The OpenNext and vinext adapters handle static asset bundling, so the path may need adjustment.
- `next/og` (`ImageResponse`) uses Satori internally, which is pure JS/WASM — Workers-compatible.

**Risk: LOW-MEDIUM.** The OG image file read may need a path adjustment depending on how the adapter bundles `public/` assets. This is a common pattern and both adapters typically handle it, but should be tested.

### No other Node.js-specific concerns

- No `child_process`, `net`, `http`, `https`, `os`, `worker_threads` imports.
- No native C++ addons or `.node` files.
- No `__dirname` or `__filename` usage.

---

## 5. Adapter Comparison: OpenNext vs vinext

### Overview

| Aspect | @opennextjs/cloudflare | vinext |
|---|---|---|
| **Approach** | Adapts `next build` output for Workers | Reimplements Next.js API surface on Vite |
| **Maturity** | In development since 2024, 1.0-beta released | Released Feb 2026, beta |
| **Cloudflare stance** | "Use for existing apps; migrate to vinext when ready" | "Recommended for new Next.js apps" |
| **Next.js version** | Next.js 14, 15, and 16 support | Next.js 16 (via API reimplementation) |
| **Build system** | Uses standard `next build` + Turbopack | Replaces Turbopack with Vite/Rolldown |

### Feature support comparison (for this project's needs)

| Feature used in project | OpenNext | vinext |
|---|---|---|
| App Router | ✅ | ✅ |
| React Server Components | ✅ | ✅ |
| Server Actions | ✅ | ✅ |
| Route Handlers | ✅ | ✅ |
| SSR + Streaming | ✅ | ✅ |
| ISR | ✅ | ✅ |
| PPR (`partialPrefetching`) | ✅ | ❓ Not documented |
| `'use cache'` / composable caching | ✅ | ❓ Not documented |
| `cacheLife` / `cacheTag` | ✅ (via composable caching) | ❓ Not documented |
| `updateTag()` / `revalidateTag()` | ✅ | ❓ Not documented |
| `connection()` from `next/server` | ✅ | ❓ Not documented |
| `next/image` (custom loader) | ✅ | ✅ (partial — needs Cloudflare Images) |
| `next/font/local` (localFont) | ✅ | ❓ Not documented |
| `next/og` (ImageResponse) | ✅ | ❓ Not documented |
| `next/after` | ✅ | ❓ Not documented |
| Middleware | ✅ (not Node.js middleware) | ✅ |
| `server-only` import | ✅ | ✅ |
| `cookies()` from `next/headers` | ✅ | ✅ |

### Recommendation

**OpenNext (`@opennextjs/cloudflare`) is the recommended adapter for this project.**

Reasons:
1. This project uses `'use cache'`, `cacheLife`, `cacheTag`, `updateTag`, `connection()`, PPR, and `localFont` extensively — all confirmed supported by OpenNext, but undocumented in vinext.
2. OpenNext preserves your existing `next build` pipeline, so the build output is identical to what works today on a Node.js server.
3. vinext is a Vite-based reimplementation that may not cover the full Next.js 16 API surface your project uses. The `npx vinext check` command would reveal gaps, but the documentation gaps are a risk signal.

---

## 6. Next.js 16.4.6 Version Compatibility

- OpenNext explicitly targets Next.js 14, 15, and the latest 16 releases. The Adapter API was stabilized in Next.js 16.2 (March 2026).
- Next.js 16.4.6 is a recent patch release and should be fully compatible.
- The `nodejs_compat` flag (required by OpenNext's `wrangler.toml`) is enabled by default for compatibility dates of 2026-08-04 or later.

**Risk: NONE.** Next.js 16.4.6 is within the supported range.

---

## 7. Required Code Modifications

### Must change (blockers)

| # | File | Change | Reason |
|---|---|---|---|
| 1 | `src/app/robots.ts` | Replace `process.env.VERCEL_ENV` fallback with a Cloudflare-compatible check | `VERCEL_ENV` does not exist on Workers. Use `SITE_ENV` exclusively or add a `CF_PAGES` / custom env check. |

### Should change (recommended)

| # | File | Change | Reason |
|---|---|---|---|
| 2 | `src/app/opengraph-image.tsx` | Test OG image generation on Workers; may need to adjust the `process.cwd()` file path or inline the image as a base64 import | `process.cwd()` returns `/` on Workers; the asset path may differ from Node.js. |
| 3 | `next.config.ts` | Remove `turbopack` config block when using OpenNext | OpenNext uses standard `next build`, not `next dev --turbopack`. The `turbopack` block is dev-only and harmless, but should be verified. |

### No change needed

| Item | Why |
|---|---|
| `node:crypto` in revalidate route | Fully supported on Workers |
| `Buffer.from()` everywhere | Fully supported on Workers |
| `@supabase/ssr` cookie handling | Uses standard Web APIs |
| `server-only` imports | Build-time marker, no runtime impact |
| `zod` validation | Pure JS, no Node.js dependencies |
| All `'use cache'` functions | Supported by OpenNext adapter |
| Custom image loader (`imagekit-loader.ts`) | Custom loaders work on Workers |

---

## 8. Supabase Connectivity

### Auth (cookie-based)

- Uses `@supabase/ssr` with `createServerClient` — reads/writes cookies via `next/headers`.
- No middleware-based auth (no `middleware.ts`), so the auth cookie pattern is straightforward.
- Supabase auth endpoints are accessed via HTTPS `fetch` — Workers handles this natively.
- `connection()` is called before `cookies()` to ensure request-time evaluation.

### Database (Postgres via PostgREST)

- All database access goes through the Supabase JS client, which uses `fetch` internally to call the PostgREST API.
- No direct TCP/Postgres connections (no `pg`, `postgres`, or `drizzle` driver).
- RLS policies are enforced server-side by Supabase; no Workers-side changes needed.
- RPCs (`rpc('upsert_product', ...)`) work identically via `fetch`.

### Storage

- File uploads in `actions.ts` use `supabase.storage.from('product-images').upload()` — this is a `fetch`-based REST call.
- `Buffer.from(await file.arrayBuffer())` is used to convert uploaded files — `Buffer` is Workers-compatible.

### Connectivity

- Supabase is accessed via HTTPS from Workers. Workers have no issue making outbound HTTPS requests to `*.supabase.co`.
- No connection pooling or persistent TCP connections are needed.

**Risk: NONE.** The entire Supabase integration (auth, database, storage) uses `fetch`-based REST calls, which are Workers-native.

---

## 9. ImageKit Integration

- **Private key usage:** `imageKitAuthHeader()` in `src/lib/imagekit.ts` uses `Buffer.from()` for Base64 encoding — Workers-compatible.
- **Server-side credentials:** `src/lib/imagekit-server.ts` reads `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` from `process.env` — Workers-compatible.
- **Custom image loader:** `src/lib/imagekit-loader.ts` transforms URLs at build time / edge — no Node.js APIs, fully compatible.
- **Upload flow:** Server Actions call ImageKit's Upload API via `fetch` — Workers-native.
- **`server-only` guard:** Prevents private key from reaching the client — works identically on Workers.

**Risk: NONE.** ImageKit integration is entirely `fetch` and `Buffer`-based.

---

## 10. Environment Variables and Secrets

### Current environment variables

| Variable | Type | Workers equivalent |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `wrangler.toml` `[vars]` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | `wrangler.toml` `[vars]` |
| `NEXT_PUBLIC_SITE_URL` | Public | `wrangler.toml` `[vars]` |
| `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | Public | `wrangler.toml` `[vars]` |
| `IMAGEKIT_PRIVATE_KEY` | Secret | `wrangler secret put` |
| `IMAGEKIT_URL_ENDPOINT` | Server | `wrangler.toml` `[vars]` |
| `REVALIDATE_SECRET` | Secret | `wrangler secret put` |
| `SITE_ENV` | Server | `wrangler.toml` `[vars]` |
| `AUTH_DEBUG` | Server (optional) | `wrangler.toml` `[vars]` |
| `ALLOW_LOCAL_SUPABASE_IMAGES` | Dev only | Not needed in production |
| `VERCEL_ENV` | Vercel-specific | **Remove/replace** — does not exist on Workers |

### Secrets management

- **Cloudflare Workers secrets** are set via `wrangler secret put <NAME>` and are encrypted at rest.
- Secrets are available as `process.env.<NAME>` in the Worker runtime.
- `NEXT_PUBLIC_*` variables are inlined at build time by Next.js and work identically.

**Risk: LOW.** One env var (`VERCEL_ENV`) needs replacement. All secrets can be managed via Wrangler.

---

## 11. Caching, Image Optimization, and Runtime Limitations

### Data caching

- OpenNext provides a **cache handler** that maps Next.js ISR/data cache to Cloudflare's KV or cache API.
- `'use cache'` functions with `cacheLife('catalog')` and `cacheTag()` will use this handler.
- `updateTag()` and `revalidateTag()` for on-demand revalidation are supported.

### Image optimization

- This project uses a **custom image loader** (`imagekit-loader.ts`), so Next.js's built-in image optimization is not invoked at runtime.
- Images are served directly from ImageKit CDN (or Supabase Storage as fallback).
- No Cloudflare Images subscription is needed because optimization is handled by ImageKit.
- `next/image` with a custom loader works on Workers — the component is client-side, and the loader just transforms URLs.

### Runtime limitations to be aware of

| Limitation | Impact on this project |
|---|---|
| **10ms CPU time (Free plan)** | SSR pages with database queries may exceed this. Paid plan allows 30s default, up to 5 min. |
| **128 MB memory** | Should be sufficient — no heavy computation or large in-memory datasets. |
| **100,000 requests/day (Free plan)** | Adequate for a spare parts catalog with moderate traffic. |
| **No persistent filesystem** | Not an issue — project uses Supabase Storage, not local files. OG image reads from bundle. |
| **Cold starts** | V8 isolates start in <5ms, far faster than Node.js container cold starts. |
| **6 MB Server Action body limit** | Your `next.config.ts` sets `bodySizeLimit: '6mb'`. Workers Free plan allows up to 100 MB request bodies. Compatible. |

---

## 12. Deployment Cost Estimate

### Traffic assumptions (spare parts catalog)

- ~500–2,000 page views/day initially
- ~10–50 admin operations/day
- Static assets (CSS, JS, fonts, images) served from CDN — **free and unlimited**

### Free plan ($0/month)

| Resource | Limit | Estimated usage | Fits? |
|---|---|---|---|
| Worker requests | 100,000/day | 500–2,000/day | ✅ Easily |
| CPU time | 10ms/request | ~5–8ms typical SSR | ⚠️ Tight for complex pages |
| Memory | 128 MB | ~40–60 MB typical | ✅ |
| KV reads | 100,000/day | ~1,000–5,000/day (cache) | ✅ |
| KV writes | 1,000/day | ~10–100/day (cache updates) | ✅ |
| Static assets | Unlimited | All CSS/JS/fonts/public | ✅ Free |

**Free plan verdict:** Likely viable for initial launch. The 10ms CPU limit per request is the main risk — if SSR pages with Supabase queries take longer, some requests may fail. Monitor closely.

### Paid plan ($5/month)

| Resource | Included | Overage | Estimated cost |
|---|---|---|---|
| Subscription | — | $5.00/month | $5.00 |
| Requests | 10M/month | +$0.30/million | $0 (well under 10M) |
| CPU time | 30s default | $0.02/million ms | ~$0.01 |
| KV reads | 10M/month | +$0.50/million | $0 |
| KV writes | 1M/month | +$5.00/million | $0 |

**Paid plan estimated total: ~$5/month**

This is comparable to Vercel's free tier but with more generous request limits and no bandwidth charges.

### Additional costs (if applicable)

| Service | Cost | Needed? |
|---|---|---|
| Cloudflare Images (optimization) | $5/month + $1/100K transformations | **No** — using ImageKit custom loader |
| Custom domain | Free (Cloudflare DNS) | Yes — free |
| SSL certificate | Free (Cloudflare) | Yes — free |

---

## Summary: Blockers and Risks

### Blockers (must fix before deployment)

| # | Severity | Item | Fix |
|---|---|---|---|
| B1 | Low | `VERCEL_ENV` reference in `robots.ts` | Set `SITE_ENV=production` in `wrangler.toml` and rely on that exclusively |

### Risks (should address)

| # | Severity | Item | Mitigation |
|---|---|---|---|
| R1 | Medium | OG image file read via `process.cwd()` | Test on Workers; may need to inline the badge as a static import or adjust the path |
| R2 | Medium | 10ms CPU limit on Free plan | Start on Paid ($5/month) or monitor Free plan for 1027 errors |
| R3 | Low | vinext doesn't document `'use cache'` support | Use OpenNext adapter instead (recommended) |

### No issues found

- All 7 production dependencies are Workers-compatible
- `node:crypto`, `Buffer`, `node:fs`, `node:path` are all supported on Workers
- Supabase auth, database, and storage work over `fetch` — no TCP driver
- ImageKit integration is `fetch`-based with `Buffer` for Base64
- No middleware to worry about
- Server Actions and Route Handlers are fully supported
- PPR, streaming, ISR, composable caching all supported by OpenNext

---

## Recommended Deployment Approach

### Adapter: `@opennextjs/cloudflare` (OpenNext)

### Steps to deploy

1. **Install adapter:**
   ```bash
   npm i @opennextjs/cloudflare@latest
   npm i -D wrangler@latest
   ```

2. **Create `wrangler.toml`:**
   ```toml
   name = "sameer-ali-spares"
   compatibility_date = "2026-08-25"
   compatibility_flags = ["nodejs_compat"]

   [assets]
   directory = ".open-next/assets"
   binding = "ASSETS"

   [observability]
   enabled = true

   [vars]
   NEXT_PUBLIC_SUPABASE_URL = "https://<project>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY = "<anon-key>"
   NEXT_PUBLIC_SITE_URL = "https://sameeralispareparts.com"
   NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/<account>"
   IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/<account>"
   SITE_ENV = "production"
   ```

3. **Set secrets:**
   ```bash
   wrangler secret put IMAGEKIT_PRIVATE_KEY
   wrangler secret put REVALIDATE_SECRET
   ```

4. **Create `open-next.config.ts`:**
   ```ts
   import { defineCloudflareConfig } from "@opennextjs/cloudflare";
   export default defineCloudflareConfig();
   ```

5. **Add deploy scripts to `package.json`:**
   ```json
   {
     "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
     "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
   }
   ```

6. **Fix blocker B1:** Update `robots.ts` to use `SITE_ENV` exclusively.

7. **Test OG image (R1):** Run `npm run preview` and verify `/opengraph-image` renders correctly.

8. **Deploy:** `npm run deploy`

---

## Production Testing Checklist

### Pre-deployment

- [ ] `SITE_ENV=production` set in `wrangler.toml`
- [ ] All secrets configured via `wrangler secret put`
- [ ] `robots.ts` updated to remove `VERCEL_ENV` fallback
- [ ] `open-next.config.ts` created
- [ ] `wrangler.toml` created with correct bindings
- [ ] Local preview works (`opennextjs-cloudflare preview`)

### Post-deployment smoke tests

- [ ] Home page renders with correct layout and images
- [ ] Product catalog page loads with filters working
- [ ] Individual product page renders (SSR + streaming)
- [ ] Product images load via ImageKit CDN
- [ ] OG image generates correctly (`/opengraph-image`)
- [ ] Admin login works (cookie-based auth)
- [ ] Admin can create/edit/delete products (Server Actions)
- [ ] Admin image upload works (Supabase Storage + optional ImageKit)
- [ ] Business settings update works
- [ ] Cache invalidation works (edit product → public page updates)
- [ ] `/api/revalidate` endpoint works with correct secret
- [ ] `/auth/confirm` password reset flow works
- [ ] WhatsApp links and share functionality work
- [ ] Robots.txt shows correct production rules
- [ ] Sitemap.xml generates correctly
- [ ] Security headers present (CSP, HSTS, X-Frame-Options)
- [ ] Mobile responsiveness intact
- [ ] No 1027 errors in Cloudflare dashboard (CPU limit)
- [ ] Response times acceptable (<500ms for SSR pages)

### Performance monitoring

- [ ] Enable Cloudflare Workers Observability
- [ ] Monitor CPU time per request (target: <10ms for Free, <30s for Paid)
- [ ] Monitor error rates in Cloudflare dashboard
- [ ] Set up Cloudflare alerting for elevated error rates
