# Admin guide — for the shop owner

Everything works from your phone. Open **yourwebsite.com/admin** and sign in with the email and password you were given.

## Signing in and out
- Forgot your password? Tap **Forgot your password?**, enter your email, and open the link in the email. Then choose a new password (at least 12 characters).
- Tap **Sign out** (top right) when you are finished, especially on a shared device.

## The menu
On a phone, the menu is at the bottom of the screen: **Home · Products · Models · Categories · Settings**.

## Add a product
1. **Products → Add product.**
2. **Part name**: the name customers would search for, e.g. "Clutch plate set".
3. **Genuine part number**: only if you have the real Royal Enfield number.
4. **Category** and **Description**: plain facts only.
5. **Fits these motorcycles**: tick every model the part fits.
6. **Availability**: Available / Out of Stock / Contact to Confirm.
7. Leave **Status** as **Draft** for now and tap **Create product**.
8. On the next screen, tap **Add photos**. Choose photos from your gallery or take new ones. You can pick several at once. They are made smaller automatically.
9. Tap **Make main** on the best photo. Use the ▲ ▼ arrows to change the order. Type a short description under each photo (this helps Google).

> **OEM, Vendor or Both.** Every part must say which supply the shop buys it
> through. Choose one of three:
> - **OEM only** — bought through the OEM supply. Enter one MRP and offer price.
> - **Vendor only** — bought in from one of your other vendors. Enter one MRP and offer price.
> - **Both** — the shop holds the same part from both supplies. Enter the OEM
>   MRP and offer price, then a second box appears for the **Vendor MRP** and
>   **Vendor offer price**. A customer picks OEM or Vendor, and sees that
>   supply's price.
>
> All three are genuine Royal Enfield parts. The choice only records where the
> stock came from, so you can see which supply sells more. Customers see an
> OEM / Vendor tab on each model page and a label on every part, and every
> listing still says it is a genuine Royal Enfield part.

> **Where photos are stored.** Above the photos there is a choice: **Supabase
> Storage** or **ImageKit**. Supabase Storage is the normal choice and needs
> nothing extra. ImageKit only works once its keys have been added by the
> developer; until then it is marked "Not set up" and an upload to it will
> fail and tell you so — it never quietly puts the photo somewhere else.
> Changing the choice here affects only the next photo you upload. To change
> it for good, use **Business details → Image storage**. Photos you have
> already uploaded are never moved.
10. Change **Status** to **Published** and tap **Save changes**. The part is now on the website.

## Update availability quickly
In **Products**, change the coloured box next to any product. It saves straight away. The ☆ star marks a product as **Featured** on the homepage.

## Hide, archive or delete
- **Hidden**: temporarily off the website (set it in Status).
- **Archive**: retired, but kept for your records. You can restore it.
- **Delete permanently**: removes the product and its photos for ever. You will be asked to confirm.

## Import many parts at once (CSV)
On **Products**, choose **Import CSV**. Download the template first, fill one part per row, then upload the file. The importer:
- never overwrites a part that already exists (matched by part number); it skips it and tells you;
- reports each row with a problem, so you can fix the file and upload again;
- accepts up to 500 rows per file.
Imported parts are published with availability "Contact to confirm". Check photos and details afterwards.

## Models and categories
- **Models**: add new Royal Enfield models, rename them, change their order with ▲ ▼, or untick **Active** to hide one.
- **Categories**: the starting list was only a suggestion. Rename, add or deactivate categories to match your shop. A category appears on the website only when it contains a published product.

## Business details (Settings)
- **WhatsApp number**: the shop's WhatsApp *mobile* number with +91. Once saved, every product page gets an "Enquire on WhatsApp" button with the product name already filled in. Leave it blank to show "Call" buttons instead.
- **Opening hours**, **Google Maps link** and **social media**: fill these in only when they are correct. Blank fields are hidden on the website.
- **About page**: write your shop's story in your own words.

Everything here is public, so never type passwords or private notes into Settings.

## Good habits
- Use real photos of the genuine part, against a plain background, in good light.
- Keep availability up to date.
- Never add duplicate or aftermarket parts. The website promises genuine parts only.

## Pictures for each motorcycle model

Go to **Models**. Each motorcycle has a card with a drawing of that style of
bike, how many genuine and vendor parts are listed for it, and a **View parts**
link.

- **Upload** replaces the drawing with your own photograph. Take the photo
  yourself in the shop. Do not download pictures from the internet or from
  Royal Enfield's website: those belong to someone else and the shop could be
  asked to pay for using them.
- **Use drawing** puts the drawing back and deletes the photo.
- Photos are made smaller automatically before they are sent.
