# Caching strategy

How the public website stays fast while still showing the shop's latest
changes straight away.

## The shape of it

The site uses Next.js Cache Components (`cacheComponents: true`). Two layers:

1. **Static page shells.** Pages that take no filters — the home page,
   `/models`, `/about`, `/contact` — are prerendered to static HTML and served
   with `s-maxage=300`. These are CDN-cacheable and the fastest to serve.

2. **A cached public data layer.** Every public read in
   `src/lib/data/catalog.ts` is a `'use cache'` function with a cache life of
   `catalog` (5-minute revalidation) and a cache tag:
   - `getBusinessSettings` → tag `settings`
   - `searchCatalog`, `getModels`, `getCategoriesInUse`, `getProductBySlug`,
     `getRelatedProducts`, `catalogTypeCounts` → tag `catalog`

   The database is queried once per distinct set of arguments and the result is
   reused until the tag is busted or the 5 minutes lapse. The Supabase client
   behind these reads (`createPublicClient`) is cookie-less and anonymous, so
   the cache is never keyed to a visitor and never holds visitor data.

## Why `/products` is not a static page

`/products` (and `/models/[slug]`) are **Partial Prerender** routes (marked
`◐` in the build): the header and layout are prerendered, and the results
block streams in. It reads the filters (`?q=`, `?model=`, `?category=`,
`?availability=`, `?part_type=`, `?page=`), so the rendered HTML differs per
visitor and cannot be one shared static page — its HTTP response is therefore
`no-store`. That is expected and correct.

What makes it fast is the layer underneath: the filter combinations all run
through the cached `searchCatalog`, so repeat visits with the same filters do
no database work. Warm render times are about 30ms for `/products` and about
20ms for a product page, versus a fresh database round-trip each time before.

Product detail pages (`/products/[slug]`) were previously read fresh on every
request. They are now cached under the `catalog` tag as well, so repeat views
are served from cache and an admin edit still shows immediately (below).

## Keeping it fresh — tag invalidation

Every admin action that changes public content calls `updateTag(...)` after it
writes, so the website updates immediately rather than waiting out the
5-minute window. In `src/app/admin/(panel)/actions.ts`:

| Admin action | Invalidates |
| --- | --- |
| Create / edit / delete a product | `updateTag('catalog')` |
| Quick availability / stock change | `updateTag('catalog')` |
| Add / remove / reorder / set-primary / alt-text a product image | `updateTag('catalog')` |
| Add / edit / reorder a category or model | `updateTag('catalog')` |
| Import products (when any created) | `updateTag('catalog')` |
| Save settings, hero image, default image provider | `updateTag('settings')` + `revalidatePath('/', 'layout')` |
| Upload / remove a model image | `updateTag('catalog')` + `revalidatePath('/', 'layout')` |

Because `getProductBySlug` and `searchCatalog` share the `catalog` tag, a
single product edit refreshes both the catalogue and that product's own page.
Status and slug changes also call `revalidatePath('/products/<slug>')` as a
belt-and-braces drop of the rendered route.

## What is deliberately not cached

- **Cart and order details.** The cart lives in the browser
  (`localStorage`), and the order page reads it client-side. Nothing
  visitor-specific is ever rendered through the cached data layer or stored in
  a shared cache.
- **The admin panel.** All `/admin` routes are dynamic and read the signed-in
  session; none are cached.

## Limitations

- A change written **straight to the database** (for example the demo seed
  script, or a manual SQL edit) does **not** bust any tag, so the site can
  show it stale for up to 5 minutes. Changes made through the admin panel are
  immediate. After a direct database change, either wait out the 5 minutes or
  POST to `/api/revalidate` with the revalidate secret.
- `/products` cannot be a single CDN-cached page because it is filterable; its
  speed comes from the cached data layer, not from an HTTP cache. If the shop
  ever needs the unfiltered catalogue to be a full static page, it would have
  to be split into its own route that takes no search parameters.
- The 5-minute `catalog` cache life is a safety net, not the primary
  mechanism; invalidation is driven by the admin actions above.
