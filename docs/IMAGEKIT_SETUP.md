# ImageKit setup

The website stores product photos in **Supabase Storage** by default and works
completely without ImageKit. ImageKit is optional: once it is configured, the
shop owner can choose, per upload, where each new photo is stored.

Nothing here changes existing photos. Photos already in Supabase Storage stay
there and keep working, whatever is configured later.

---

## 1. What the shop needs

An ImageKit account (imagekit.io). The free plan is enough to start.

From the ImageKit dashboard → **Developer options → API keys**, three values
are needed:

| Value | Secret? | Used for |
|---|---|---|
| URL endpoint, e.g. `https://ik.imagekit.io/your-id` | No — it appears inside every image URL | Delivering images |
| Public key | No | Reserved for future browser-side uploads; not required today |
| Private key | **Yes** | Uploading and deleting files from the website server |

The private key must never be shared in a chat message, a screenshot, a
repository, or anything named `NEXT_PUBLIC_…`. Only the hosting provider's
environment variables should hold it.

---

## 2. Environment variables

Set these where the site is hosted (Vercel or Netlify → Project → Environment
variables), for Production and Preview:

```
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id
IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxxxxxxxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxxxxxxxxxx
```

Notes:

- `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` is read in the browser so images can be
  resized and converted to modern formats. It is not a secret.
- `IMAGEKIT_URL_ENDPOINT` is the same value for the server. If it is left out,
  the public one is used.
- `IMAGEKIT_PRIVATE_KEY` is read **only** on the server. Leave it out and
  ImageKit stays switched off: the admin panel says "Not configured" and
  uploads to ImageKit are refused with that reason, rather than silently
  going somewhere else.
- A new deployment is needed after changing these.

---

## 3. Optional: serve Supabase photos through ImageKit too

Photos stored in Supabase can also be *delivered* through ImageKit's network,
without moving the files. In ImageKit, add an external storage / web proxy
origin pointing at:

```
https://<your-supabase-project>.supabase.co
```

and attach it to the URL endpoint. With that in place, a Supabase photo URL is
rewritten to the ImageKit endpoint automatically (resizing and `f-auto`
format). Without it, Supabase photos are served straight from Supabase, which
is also fine.

---

## 4. Checking it works

1. Sign in to the admin panel and open **Business details → Image storage**.
2. Each provider shows a live status, checked on the server at that moment:
   - **Connected** — ready to use.
   - **Not configured** — the variables above are missing; the panel names
     which ones.
   - **Problem** — the keys are set but ImageKit refused or could not be
     reached. The message says which, without ever showing a key.
3. Storage usage is shown only when ImageKit's API returns it for that
   account. Otherwise it reads **Usage unavailable** — no figure is invented.
4. Set the default provider and save.
5. Open any product and upload a photo. The picker above the gallery shows
   where that photo will go; the badge on the uploaded photo shows where it
   actually went.

---

## 5. How uploads and deletes behave

- **Supabase** uploads go straight from the browser to the Supabase bucket, as
  before, with a progress bar and the existing storage policies.
- **ImageKit** uploads go through the website server, which holds the private
  key. The browser never sees it. Files land in `products/<product id>/` to
  match the Supabase layout.
- Each photo records its provider. A delete is always sent to the provider that
  holds the file, never to the other one.
- If the provider refuses a delete, the photo is still removed from the website
  and the leftover file is recorded. **Business details → Image storage →
  Leftover files** shows the count and a **Retry cleanup** button.
- If an upload succeeds at ImageKit but the database record fails, the uploaded
  file is deleted again, so no orphan is left.
- A failed upload never falls back to the other provider. The error names the
  provider that failed and the admin can choose the other one.

---

## 6. Limitations

- The home page hero image always uses Supabase Storage. The provider choice
  applies to product photos.
- ImageKit's media library is not browsed from the admin panel; photos are
  managed through the product pages.
- Switching the default provider does not move existing photos. Moving photos
  between providers would need a separate migration, which has not been built.
