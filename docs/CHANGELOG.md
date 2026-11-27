# Changelog

## Unreleased — shopper extras (version number unchanged)
- **Copy part number.** Each part page has a button that copies the part number, so a rider can quote it to the shop.
- **Share this part.** Opens the phone's share sheet with the part name, part number and page link. On devices without a share sheet it opens WhatsApp with the same message.
- **Can't find your part?** The parts catalogue ends with a WhatsApp prompt for parts that are not listed yet. It is hidden when WhatsApp is not configured.
- Tests: 4 new unit tests for the share and message helpers (127 unit tests in total).

## 0.1.9 — 2026-11-22 (instant loading states)
- Tapping **Shop by model** or **All parts** now shows the page immediately instead of a blank wait. The models page is served as a static page (instant), and the parts catalogue shows its header and a skeleton placeholder right away while the filtered results stream in. Added `loading.tsx` for both routes and fixed a malformed class in the catalogue skeleton.

## 0.1.8 — 2026-11-21 (password recovery, detail-page caching)
- **Password recovery fixed end to end.** The recovery email now links straight to `/auth/confirm` with a `token_hash`, which the app verifies with `verifyOtp` — so the link works even when opened on a different device or browser (the old PKCE `?code=` link needed a cookie from the same browser and failed otherwise). The `/auth/confirm` route now writes the session cookies onto the redirect response, so the admin lands on the reset page already signed in, sets a new password and is logged in. The PKCE `?code=` link is still accepted as a fallback. (Production: set the Supabase dashboard reset-password template and redirect URL per `DEPLOYMENT.md` sections 4–5.)
- **Product detail pages are now cached.** `getProductBySlug` moved from a per-request read to the shared `catalog` cache tag, so repeat views are served from cache (about 20ms) while any admin edit still shows immediately (the edit already busts the `catalog` tag). `/products` and `/products/[slug]` are now Partial Prerender routes. Full caching strategy and its limits are written up in `docs/CACHING.md`.
- **The All tab count is correct.** It now shows the true number of distinct parts; a part held from both supplies counts once there, but once in each of the OEM and Vendor tabs.
- Production migration plan for the three-way supply change written up in `docs/PRODUCTION_MIGRATION.md` (compatibility, ordering, data-loss risk, backup and rollback).
- Tests: 124 unit, 13 public e2e, 46 admin e2e all pass against a production build; the recovery and model-tab tests were made rerunnable and independent of the demo data.

## 0.1.7 — 2026-11-20 (three supply options, demo catalogue)
- Each part now takes one of **three supply options: OEM only, Vendor only, or Both**. Choosing Both shows a second set of boxes for **Vendor MRP** and **Vendor offer price** under the OEM ones. Each supply keeps its own price.
- On the website a part held from both supplies shows a choice of OEM or Vendor. The customer's pick sets the price shown and the stock added to the cart. OEM and vendor lines for the same part stay separate in the cart, and each order line names its supply.
- A supply the part does not stock now returns no price rather than the other supply's price, so a cart line can never carry the wrong price.
- Migration `20261120000009_both_supplies.sql`: `part_type` accepts `both`; `vendor_mrp` and `vendor_offer_price` added with a shape check (vendor prices only on Both parts); `catalog_search` returns an `all_total` alongside the OEM and vendor totals, so the All tab shows the true count of distinct parts (a Both part counts once there, but once in each supply tab).
- Demo catalogue for showing the site locally: 61 original parts across all nine categories and all twelve models, with a mix of OEM, Vendor and Both. Each part has an original drawn illustration (generated in code, not photographs), so no third-party photography is used. Run with `scripts/demo/seed.py`. This writes to the local stack only and must not be run against production.
- Tests: 124 unit tests (new supply-pricing and cart-line tests) and the public and admin browser suites updated for the demo data. The public suite passes 13 of 13 against a production build. The admin suite passes 29 of 30; the one failure is the password-recovery email flow, which is unchanged by this release (see TEST_REPORT).

## 0.1.6 — 2026-11-19 (pre-handover check)
- Favicon, Apple icon and app icon rebuilt from the shop logo. The whole badge is fitted inside the square — an earlier attempt cropped to the shield and clipped the lettering, so the icon read "OYAL ENFIELD SPARE SH". A 64px size was added to the .ico, and the Apple touch icon sits on the dark green of the client's own artwork, because iOS fills transparency with black.
- Deployment guide now names both storage buckets to check as Public (`product-images` and `brand-images`) and documents the optional ImageKit variables.
- CSV import template and the import screen now include the `type` column (oem / vendor).
- Corrected a stale database comment that still described the dropped "WhatsApp number must differ from the landline" rule, via a new migration rather than by editing an applied one.
- Full pre-handover audit: production build clean, 155 unit and integration tests and 60 browser tests passing, no console or page errors on any public page on desktop or phone, no broken links, no layout overflow, one h1 per page, every image has alt text, `npm audit` clean, and no secret reaches the browser bundle.

## 0.1.5 — 2026-11-19 (OEM and vendor supply, model pictures, parts by model in the admin)
- Every part now records **which supply the shop bought it through: OEM or Vendor**. Both are genuine Royal Enfield parts — this is a sourcing record, not a quality one, so the shop can see which supply sells more. When the shop holds the same part from both supplies it is listed twice, each with its own part number, photos, price and stock.
- Customers get **All parts / OEM / Vendor** tabs with live counts on every model page and on the catalogue, and a neutral badge on each part. Every listing still says "Genuine Royal Enfield part", whichever supply it came from; the vendor tab explains that it is the same genuine part bought in through another vendor, and that price and availability can differ.
- The WhatsApp order message names the supply of each line, e.g. `Clutch plate set (part no. CP-350-VENDOR) [Vendor] × 2`, so the shop picks the right stock.
- Model cards now carry a picture. Twelve original line drawings (classic, cruiser, street, adventure, café racer, parallel twin) are drawn in code and matched to each model; no manufacturer photography is used, since that is copyrighted. The owner can upload a real photograph per model under Admin → Models, which replaces the drawing, and can switch back with one button.
- Admin: a "Parts and pictures by model" gallery mirroring the customer's "Shop by model", with OEM/vendor counts per model and a link straight to those parts; the products list gains a model filter, a supply filter and a badge per row; the product form has a required supply choice; the dashboard counts both supplies; the CSV import understands a `type` column (oem/direct/company, vendor/supplier/outside).
- Migration `20261119000008_part_types_and_model_images.sql`: `products.part_type` (existing rows become OEM), `motorcycle_models.image_path` with a path check, the brand-images upload policy widened from `hero/` to `hero/` and `models/`, `published_counts` and `admin_dashboard_stats` split by supply, and `catalog_search` gains a supply filter plus OEM/vendor totals so a tab can show the count of the tab you are not on. Safe to re-run; no existing data rewritten.
- Tests: 155 unit and integration, 60 browser, all passing.

## 0.1.4 — 2026-11-18 (admin-controlled image storage provider)
- Admin chooses where each new product photo is stored: Supabase Storage or ImageKit. A segmented picker sits above the photo gallery; the saved default lives in Business details → Image storage, and an admin can override it for a single upload without changing the default.
- Supabase uploads are unchanged: straight from the browser to the existing bucket, with the progress bar and the existing storage policies. ImageKit uploads go through the website server, which holds `IMAGEKIT_PRIVATE_KEY`; the key is never sent to the browser (verified by building with a canary value and grepping the client bundles).
- Every photo records its provider, and a provider-independent resolver (`src/lib/image-source.ts`) gives every page its image URL, so no page knows where a photo lives. Supabase photos still build their URL from the storage path — no URL is duplicated into the database for them.
- Deletes are routed by the provider recorded on the row, never the other one. A delete the provider refuses still removes the photo from the website and records the leftover file, with a count and a Retry cleanup button under Image storage. An ImageKit upload whose database insert fails is deleted again, so no orphan is left. A failed upload never falls back to the other provider; the error names the provider.
- Image storage settings show live, server-side connection checks for both providers (Connected / Not configured / Problem), the per-provider upload limits, which environment variables are missing, and storage usage only when a provider returns it — otherwise "Usage unavailable". No key material is ever displayed.
- Migration `20261118000007_image_providers.sql`: adds `storage_provider`, `image_url`, `provider_file_id`, `file_size`, `mime_type` to `product_images` (existing rows become `supabase`); adds `default_image_provider` to `business_settings`; adds the admin-only `image_cleanup_queue` table; recreates `catalog_search` to return the provider and delivery URL. Safe to re-run and preserves all existing records.
- Fixed while writing the migration: a check constraint written as an OR of comparisons let an ImageKit row through with no URL or file id, because a NULL inside a check constraint counts as satisfied. Rewritten NULL-safely with a `case` expression.
- `next/image` loader now also adds resizing and `f-auto` to ImageKit delivery URLs; `remotePatterns` allows only the configured ImageKit host; server action body limit raised to 6 MB for server-side uploads.
- Setup instructions: `docs/IMAGEKIT_SETUP.md`.
- Tests: 135 unit and integration, 53 browser, all passing.

## 0.1.3 — 2026-11-18 (cart and WhatsApp orders, ImageKit delivery, address, favicon, image compression)
- Cart: "Add to cart" on product pages and cards. The cart is kept in the visitor's browser. A cart icon in the header shows the item count.
- Order flow: Cart → Your details (name and mobile required; address, motorcycle and note optional) → review with the exact message → "Confirm and send on WhatsApp" opens WhatsApp to the shop with the order and details. Nothing is stored on the server.
- ImageKit delivery: product and home page photos are served through ImageKit when `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` is set (web proxy in front of the Supabase bucket, resize + auto format). Without it, nothing changes. Uploads still go to Supabase Storage.
- Home page image is compressed in the browser before upload (about 1024px, transparency kept).
- Shop address updated to 25, Venkatachalan Naicken Street, Pudupet, Chennai-02 (migration 20261118000006). Postal code 600002 kept.
- Favicon, Apple icon and favicon.ico generated from the shop logo.
- Fix: home page changes (festive banner, hero, number) now refresh the statically rendered home page immediately.
- Fix: home page image upload sends raw bytes, so it works with every Storage server.
- Tests: 72 unit and integration tests, 47 browser tests (new: cart and order flow, pricing, hero upload, favicon, address), all passing.

## 0.1.2 — 2026-11-17 (shop number, WhatsApp, rupee prices, festive offers, home image)
- Shop number is now +91 96770 93315 for the landline and WhatsApp everywhere on the site, including the error page, contact page and social share image. WhatsApp uses wa.me/919677093315.
- Header: the phone button is replaced by a WhatsApp icon placed after the search icon. It opens a pre-filled WhatsApp message.
- Prices in Indian rupees: MRP and an optional offer price per part (Admin → Products). Parts without an MRP show "Price on enquiry".
- Festive offer (Admin → Business details): switch on, add a banner text, choose a percentage or a rupee amount. Parts with an MRP are discounted, and a banner shows on the home page. A part's own offer price takes precedence.
- Home page image: the large picture beside the heading can be replaced from Admin → Business details, without touching other images. Stored in a new public bucket, `brand-images`. Until an image is uploaded, the shop logo is shown.
- Migration `20261117000005_pricing_branding.sql`: product price columns, festive settings, hero image path, brand-images bucket and policies, the new number, and the updated catalogue search function (now returns prices).
- Removed the rule that WhatsApp must differ from the landline (the shop uses one number for both).
- Fixed: the home page image upload failed when the file was sent as a browser File object; it now sends the raw bytes, which works with every Storage server.
- Tests: 72 unit and integration (incl. 26 pricing tests), 44 browser (incl. new price, festive banner and home image upload tests), all passing.

## 0.1.1 — 2026-11-13 (logo, shop parts list, CSV import)
- Added the shop logo: transparent badge used in the header, hero, footer, favicon, Apple icon, Open Graph image and LocalBusiness structured data. The original file is kept in `docs/client-logo-original.jpg`.
- Added 13 genuine parts from the shop's parts list (`data/shop-parts-2026-11.csv`). They are published with availability "Contact to confirm" and need the owner's review before launch.
- Added CSV import in Admin → Products → Import CSV, with a template (`public/templates/products-import-template.csv`). The import never overwrites an existing part number; it reports row-level errors and accepts up to 500 rows.
- Added `POST /api/revalidate` for out-of-band edits. It needs `REVALIDATE_SECRET` (24+ characters). It returns 404 when the secret is not set and 401 for a missing or wrong secret.
- Product grid shows two columns on phones.
- Fixed: archived products stayed cached on the public product page. Product lookup is now per-request, and the page reads the live status.
- Tests: 26 unit, 30 database security, 42 browser (public, admin, responsive) all passing across repeated runs.
- Not taken from the trial data: its `.env` file, its inquiries and its database file.

## 0.1.0 — 2026-11-13 (initial build, not yet deployed)
- Phase 0: environment audit (`PROJECT_AUDIT.md`).
- Phase 1: Next.js 16 / TypeScript / Tailwind 4 foundation, design tokens, self-hosted fonts, typographic brand mark.
- Phase 2: Supabase migrations (schema, RLS, storage policies, confirmed seed data), admin auth, protected routes, password recovery, local Supabase-compatible test stack.
- Phase 3: public site — home, models, model pages, catalogue with search and filters, product pages with gallery, about, contact, WhatsApp enquiry with call fallback.
- Phase 4: admin — dashboard, product CRUD, multi-photo upload with optimisation and progress, models, categories, business details.
- Phase 5: metadata, canonicals, sitemap, robots, JSON-LD (AutoPartsStore, Product, BreadcrumbList), OG image, accessibility.
- Phase 6: QA — 21 unit, 30 database security and 41 browser tests passing; fixes: input className merge bug, fixed-position mobile menu inside a blurred header, small touch targets, prerender of auth clock reads, Suspense around `usePathname`.
- Phase 7: deployment, SEO, security and admin documentation.
