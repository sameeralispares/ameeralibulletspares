# SEO guide

> No ranking can be guaranteed. This site provides a strong technical and local foundation. Rankings then depend on genuine products, photos, reviews and a consistent Google Business Profile.

## Implemented
- **Unique titles and descriptions** per page (checked by an automated test). Model and product pages build theirs from real data. The owner can override a product's Google title and description in the admin.
- **Canonical URLs** on every page. Filter and pagination URLs canonicalise to `/products`.
- **sitemap.xml** lists static pages, model pages *with* published parts, and every published product with `lastModified`. Filter URLs, admin pages and empty pages are excluded.
- **robots.txt** allows the site, disallows `/admin` and `/auth/`, and points to the sitemap. When `SITE_ENV` is not `production`, it disallows everything so preview deployments are never indexed.
- **Indexing rules:** empty model pages are `noindex,follow` until they have a published part, which avoids thin pages. Unknown URLs get a noindex not-found page. Admin pages send `X-Robots-Tag: noindex`.
- **Structured data (JSON-LD)**, built only from confirmed data:
  - `AutoPartsStore` (LocalBusiness subtype): name, URL, telephone, PostalAddress, `hasMap` and `sameAs` only when configured, area served Chennai. **No** geo coordinates, ratings, reviews, price range or opening hours.
  - `Product` on part pages: name, description, images, sku/mpn (genuine part number), category, brand, compatible models (`isAccessoryOrSparePartFor`). **No offers or price**, because the shop does not publish prices. Google may therefore not show product rich results; this is intentional and honest.
  - `BreadcrumbList`, matching the visible breadcrumbs.
- **Semantic HTML:** one `h1` per page (tested), landmarks, breadcrumbs, descriptive alt text (owner-editable per photo, falling back to the product name).
- **Performance:** static shells with streamed results, responsive AVIF/WebP images, self-hosted fonts with `font-display: swap`, no third-party scripts, about 1.1 MB of total JS chunks across all routes (each page loads a subset).
- **Local keywords** appear naturally in titles and copy: "Royal Enfield spare parts Chennai", "Pudupet", "Egmore", "Venkatachalan Naicken Street" and the model names. No keyword stuffing and no doorway pages.

## Content tips for the owner
1. Use the real part name customers search for, plus the genuine part number.
2. Tick every compatible model. Model pages become indexable once they contain parts.
3. Add 2–4 clear photos per part and write a short photo description.
4. Keep availability up to date. It affects trust more than anything else.

## Google Business Profile (GBP) checklist
1. Claim or verify the profile for "S Ameer Ali Bullet Spare Parts" at business.google.com.
2. **NAP consistency:** name, address and phone must match the website exactly: *S Ameer Ali Bullet Spare Parts*, *25, Venkatachalan Naicken Street, Pudupet, Chennai-02*, *+91 96770 93315*.
3. Primary category: "Motorcycle parts store" (or the closest available). Add the website URL.
4. Check the map pin is on the actual shop. Then copy the profile's Share link into **Admin → Business details → Google Maps link**.
5. Enter accurate opening hours (and holiday hours). Put the same hours in the admin.
6. Upload genuine photos: shop front, counter, real parts. No stock or Royal Enfield marketing images.
7. Reviews: ask satisfied customers to leave an honest review (a QR code at the counter helps). **Never** offer discounts or gifts for reviews, never write reviews yourself, and reply politely to all reviews, including negative ones.
8. Post occasional updates, e.g. newly arrived genuine parts.

## Google Search Console setup
1. Go to search.google.com/search-console → **Add property** → *Domain* property (recommended) → add the TXT record at your DNS provider and verify. Alternatively, use a URL-prefix property with the HTML-tag method; the tag can be added via `metadata.verification` in `src/app/layout.tsx`.
2. **Sitemaps** → submit `https://<your-domain>/sitemap.xml`.
3. **URL Inspection** → inspect the homepage → *Request indexing*. Repeat for key model pages once they have parts.
4. Monitor **Pages** (indexing), **Performance** (queries such as "royal enfield spare parts chennai"), **Core Web Vitals** and **Enhancements** (breadcrumbs).
5. Check monthly. Fix anything flagged under *Not indexed → Error*.
