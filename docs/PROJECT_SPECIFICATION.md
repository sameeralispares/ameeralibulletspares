# Project specification — as built

## Customer journey
Open website → **Shop by model** → model page lists that model's parts → open part → check compatibility and availability → **Enquire on WhatsApp** (or **Call to check** until WhatsApp is configured).

## Public pages

| Route | Contents | Indexing |
|---|---|---|
| `/` | Hero (what, where, how to enquire); trust strip; model picker (12 models); short introduction + genuine-only message; categories in use; featured parts (falls back to latest, then to an empty state); "Why S Ameer Ali" (four factual points); visit/contact block. | index |
| `/models` | All active models as name-plate tiles with real published counts. | index |
| `/models/[slug]` | Model header, search + category/availability filters, product grid, empty state with enquiry. Includes `/models/other-newer-models`. | index once ≥1 published part; `noindex,follow` while empty |
| `/products` | Search (name, part number, category name), model/category/availability filters, active-filter chips, clear all, pagination (24/page). | index (filter URLs canonicalise to `/products`) |
| `/products/[slug]` | Swipeable gallery, category, name, part number, availability badge, compatible models (linked), enquiry panel with optional "which motorcycle?" picker, description, related parts, sticky mobile enquiry bar, Product + Breadcrumb JSON-LD. | index |
| `/about` | Owner-written introduction/history (hidden until provided), factual default text, how to buy. | index |
| `/contact` | Address, landline, hours or "call to confirm", Google Maps directions, WhatsApp/call, LocalBusiness JSON-LD. | index |
| `/sitemap.xml`, `/robots.txt`, `/opengraph-image`, `/icon.svg` | SEO assets | — |

Search and filters use a plain GET form, so they also work without JavaScript. When JavaScript is available, they update instantly.

### Availability
The three values are **Available**, **Out of Stock** and **Contact to Confirm**. They are always read from the database. New products default to *Contact to Confirm*.

### WhatsApp enquiries
- The number is configured in Admin → Business details and stored in the `business_settings` table. It is validated, normalised to international digits, and rejected if it matches the landline.
- The product message follows the brief: "Hello, I am enquiring about [Product] (part no. X) for [Model]. Is this genuine part currently available?" The model is included if the part fits exactly one model, or if the customer picks one.
- The link is a URL-encoded `https://wa.me/<digits>?text=…`, opened in a new tab with `rel="noopener noreferrer"`. Phones open the WhatsApp app.
- If the WhatsApp number is not set or is invalid, no WhatsApp link is rendered anywhere. A call button to the landline is shown instead.

## Admin (`/admin`)

| Area | Features |
|---|---|
| Sign in | Email + password, generic error messages, keeps the typed email, "forgot password" email link, set a new password. No public sign-up. |
| Dashboard | Live counts: published, draft/hidden, available, out of stock, need confirmation, featured. To-do list for missing WhatsApp number, hours, Maps link and photos. |
| Products | Search; filter by status and availability; one-tap availability change; featured star; edit; pagination. |
| Product editor | Name, auto URL name, genuine part number, category, description, compatible models (multi-select), availability, status (Draft / Published / Hidden / Archived), featured, Google title and description. Validation keeps the typed values. |
| Photos | Upload several at once (gallery or camera); type and size checks; in-browser resize to ≤1600 px WebP/JPEG; progress bar per file; set main photo; move up/down; description (alt text); remove with confirmation. |
| Remove | Archive (reversible) or delete permanently (deletes the photos too). Both ask for confirmation. |
| Models / Categories | Add, rename, change URL name, description, activate/deactivate, reorder. |
| Business details | Name, address, landline, WhatsApp, hours, email, Maps link, social links, About text. Blank means "not confirmed", which hides the item on the website. |

The admin is mobile-first, with a bottom tab bar on phones and a sticky save button.
