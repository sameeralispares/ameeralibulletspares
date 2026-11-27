# Client information pending

Nothing below has been invented. Each item has a working fallback today, and the owner can fill most of them in from **Admin → Business details**. Once an item is filled in, the website starts showing it straight away.

| # | Item | Current behaviour (fallback) | Where to enter it | Owner action |
|---|---|---|---|---|
| 1 | **WhatsApp number** | Set to +91 96770 93315 (same as the landline). | Admin → Business details → WhatsApp number | Confirm that this number is on WhatsApp. |
| 2 | **Opening hours** | "Please call the shop to confirm opening hours before visiting." Not included in Google structured data. | Admin → Business details → Opening hours | Confirm the days and times. |
| 3 | **Final product categories** | 9 suggested categories exist. Customers only see a category once it contains a published product. | Admin → Categories | Check each one against the real stock, then rename, deactivate or add as needed. |
| 4 | **Product inventory** | 13 parts from the shop's trial parts list are published with availability "Contact to confirm". Most have no photos yet. | Admin → Products (edit, or Import CSV) | Confirm each part number, name, category and model against the real stock. Remove any part that is not genuine Royal Enfield. |
| 5 | **Product photographs** | A "Photo coming soon" placeholder is shown. | Product edit page → Add photos | Take real photos of the genuine parts. |
| 6 | **Business logo** | The shop's logo is in use (transparent PNG badge, from the uploaded artwork). | Developer replaces `public/brand/sameerali-badge.png` | Send a vector (SVG) version if one exists. Confirm the logo text "EST. 1978" (see note below). |
| 7 | **Business history / introduction** | A short factual introduction (genuine parts only, location). The "Our story" section is hidden. | Admin → Business details → About page | Write the shop's story. Do not mention a founding year unless it is confirmed. |
| 8 | **Google Maps URL** | Directions open a Google Maps search for the confirmed address. | Admin → Business details → Google Maps link | Open the shop in Google Maps → Share → Copy link. |
| 9 | **Google Business Profile access** | Not linked. | — | Grant the developer manager access, or confirm the profile details (see SEO_GUIDE.md). |
| 10 | Social media accounts | Hidden. | Admin → Business details → Social media | Only add accounts the shop actually owns. |
| 11 | Email address | Hidden. | Admin → Business details → Email | Optional. |
| 12 | Production domain | — | `NEXT_PUBLIC_SITE_URL` + Vercel domains | Choose and buy the domain. |
| 13 | Authorised-dealer status | The site makes **no** claim either way. | — | Only change the copy if the owner provides written confirmation. |
| 14 | Supabase / Vercel accounts | — | — | Create them, ideally owned by the business (see DEPLOYMENT.md). |
| 15 | **Model photographs** | Each model card shows an original drawing of that style of motorcycle. | Admin → Models → Upload | Optional. Upload photos the shop has taken itself. Do not use photos from the internet or from Royal Enfield's website — they are copyrighted. |
| 16 | **Vendor wording** | Vendor listings say "The same genuine Royal Enfield parts, bought in through one of the shop's other vendors. Price and availability can differ." | Developer updates the wording | Confirm this matches how the shop describes its vendor supply to customers. |
| 17 | **ImageKit account (optional)** | Not configured. Photos go to Supabase Storage; the admin panel shows ImageKit as "Not configured" and refuses uploads to it with that reason. | Hosting environment variables (see IMAGEKIT_SETUP.md) | Only needed if the shop wants ImageKit. Create the account, then send the URL endpoint and public key. The **private key** must be entered directly in the hosting dashboard, never shared in a message. |

## Note: "EST. 1978" on the logo

The logo artwork shows "EST. 1978". It is part of the image only. The website does not state a founding year anywhere. Do not add one, including in structured data, unless the owner confirms it in writing.

## Confirmed information already in use

- Name: S Ameer Ali Bullet Spare Parts
- Address: S Ameer Ali 25, Venkatachalan Naicken Street, Pudupet, Chennai-02
- Landline and WhatsApp: +91 96770 93315
- Genuine Royal Enfield spare parts only
- The 12 motorcycle model categories

## Ordering decision to confirm

The 12 models are shown in this order: Bullet, Classic, Electra, Thunderbird, Standard, Meteor 350, Hunter 350, Himalayan, Scram, Interceptor 650, Continental GT 650, Other / Newer Models. This groups related models and puts the catch-all category last. The owner can reorder them in **Admin → Models**.
