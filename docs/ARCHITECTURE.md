# Architecture

```
Browser ──► Next.js 16 on Vercel ─────────────► Supabase
             │ public pages: cached reads        │ PostgREST (anon key, RLS)
             │   ('use cache' + cacheTag)         │
             │ admin pages + Server Actions ─────► │ PostgREST (user JWT, RLS)
             │   (cookie session, is_admin())     │ Auth (GoTrue)
             └ proxy.ts: session refresh ────────► │
Browser (admin) ── photo upload (user JWT) ──────► Storage bucket "product-images"
```

## Source layout

```
src/
  app/
    (site)/            public pages: home, models, products, about, contact (+ error/not-found)
    admin/(auth)/      login, forgot-password, reset-password, auth server actions
    admin/(panel)/     dashboard, products, models, categories, settings + server actions
    auth/confirm/      email-link landing (token_hash or PKCE code)
    sitemap.ts robots.ts opengraph-image.tsx icon.svg layout.tsx globals.css
  components/
    ui/        buttons, icons (inline SVG), primitives (badge, breadcrumbs, empty state, JSON-LD)
    site/      header, footer, brand, mobile menu, enquiry actions, visit section, diagram
    catalog/   product card/grid, model card, filters, results, gallery, product enquiry
    admin/     forms, product form, image manager, taxonomy manager, settings form, dialogs
  lib/
    data/catalog.ts   PUBLIC cached read layer (anon client)
    auth.ts           admin data-access layer (getUser + is_admin)
    supabase/         env, public (cookie-less), server (cookies), browser clients
    contact.ts        phone / WhatsApp / maps helpers (pure)
    validation.ts     zod schemas for every admin form
    seo.ts site.ts slug.ts catalog-params.ts image-compress.ts types.ts
  proxy.ts            (Next 16 name for middleware) — /admin & /auth only
supabase/migrations/  version-controlled SQL
scripts/              create-admin.mjs, local-stack/ (test-only)
tests/                unit/, integration/, e2e/
```

## Key decisions

1. **Cache Components and tag-based invalidation.** All public data functions use `'use cache'`, the `catalog` cacheLife profile (5-minute revalidate safety net) and `cacheTag('catalog' | 'settings')`. Every admin Server Action calls `updateTag(...)`, so changes appear on the site immediately. Pages prerender into a static shell. Search and filter results, which depend on query strings, stream inside `<Suspense>`.
2. **Two Supabase clients.** A cookie-less anon client is used inside cached functions; it can never leak a session into a shared cache. A cookie-bound server client is used for admin pages and actions.
3. **Database-enforced authorisation.** `public.is_admin()` checks the `admin_users` table. It is used by RLS policies and checked again in every action. The proxy only does an optimistic redirect.
4. **Direct-to-Storage uploads.** Photos go from the browser straight to Supabase Storage using the admin's own JWT. This shows real upload progress and avoids serverless request size limits. Storage RLS limits uploads to admins. A Server Action then records the image row after validating the path. If that fails, the file is removed so no orphan is left behind.
5. **In-browser image optimisation.** Photos are resized to ≤1600 px and saved as WebP (JPEG fallback). `next/image` then serves AVIF/WebP at responsive sizes.
6. **Few dependencies.** Runtime dependencies are next, react, @supabase/supabase-js, @supabase/ssr, zod and server-only. There is no UI kit, icon library or state library.
7. **Forms keep input on error.** Forms submit through `useActionState` without React's automatic reset, so validation errors never wipe what the owner typed.
8. **Progressive enhancement.** Catalogue search and filters are GET forms. The mobile menu degrades to a footer anchor while it streams in.
