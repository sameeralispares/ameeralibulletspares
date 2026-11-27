# Deployment & handover

Do not deploy publicly until the client has confirmed the domain. The site works with only confirmed information, but the owner should add at least a few genuine products before launch.

## 1. Supabase project
1. Create a project at supabase.com. Region: **Mumbai (ap-south-1)** for Chennai visitors. Ideally the business email owns the account.
2. **Apply migrations** in order (`supabase/migrations/*.sql`), either:
   - with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - via the SQL Editor: paste and run each file in filename order.
3. Auth → Providers → Email: keep enabled, **turn OFF "Allow new users to sign up"**, and set the minimum password length to 12.
4. Auth → URL Configuration: Site URL = `https://<domain>`. Add `https://<domain>/auth/confirm` to Redirect URLs. Optionally add a preview URL as well.
5. Auth → Email Templates → **Reset password**: change the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/admin/reset-password`
   so the link works even when opened on a different device or browser. The default PKCE link also works if it is opened in the same browser.
6. Auth → SMTP: configure a custom SMTP sender (e.g. Resend, Brevo or Zoho). The built-in sender is heavily rate-limited.
7. Storage: the migrations create two buckets. Check that **both are Public** (public read by exact URL; only an admin can upload):
   - `product-images` — product photos.
   - `brand-images` — the home page picture (`hero/`) and the motorcycle model pictures (`models/`).
8. **Smoke-test the security policies on the hosted project.** With staging credentials and two test accounts:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
   TEST_ADMIN_EMAIL=… TEST_ADMIN_PASSWORD=… TEST_USER_EMAIL=… TEST_USER_PASSWORD=… \
   npm run test:integration
   ```
   Use a staging project if possible. The tests create and delete records tagged `-t<timestamp>`.

## 2. Create the owner's admin account
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> \
  node scripts/create-admin.mjs owner@shop-email.com
```
Enter the password at the hidden prompt (12+ characters) and give it to the owner in person. They can change it any time with "Forgot password". To grant access to an existing user, run the same command. To revoke access, delete the user's row from `admin_users`.

## 3. Vercel
1. Import the Git repository. The framework is detected as Next.js. Node 20.9+ (22 recommended).
2. Environment variables (Production):

| Variable | Value | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<domain>` (no trailing slash) | no |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key | no (RLS-protected) |
| `SITE_ENV` | `production` (Production only; leave unset on Preview so it isn't indexed) | no |

Do **not** add `SUPABASE_SERVICE_ROLE_KEY`; nothing in the app needs it. Never set `ALLOW_LOCAL_SUPABASE_IMAGES`.

3. Deploy. Visit `/`, `/models`, `/admin/login`, `/sitemap.xml` and `/robots.txt`.

## 4. Domain
Vercel → Project → Domains → add `www.<domain>` and `<domain>`, redirecting one to the other. Set the DNS records Vercel shows (A / CNAME). Then update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL, and redeploy.

## 5. After launch
- Google Search Console and Google Business Profile: see SEO_GUIDE.md.
- The owner fills in Business details: WhatsApp, hours, Maps link.

## Backups & maintenance
- Supabase Pro includes daily backups (with point-in-time recovery as an add-on). On the free plan, export regularly: `supabase db dump -f backup.sql`, plus a copy of the Storage bucket.
- Free-tier Supabase projects pause after a week of inactivity. Use the Pro plan for a live business site, or keep it active.
- Update dependencies monthly (`npm outdated`, `npm audit --omit=dev`), then run `npm run typecheck && npm run lint && npm test && npm run build`.
- Schema changes go in a **new** migration file. Never edit applied migrations.

## Optional: ImageKit

The site stores and serves images from Supabase Storage out of the box and
needs no ImageKit account. If the shop wants ImageKit as a second storage
option, follow `IMAGEKIT_SETUP.md`: it needs `IMAGEKIT_PRIVATE_KEY`,
`IMAGEKIT_URL_ENDPOINT` and `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` in the hosting
environment. Leave them unset and the admin panel simply shows ImageKit as
"Not configured" and refuses uploads to it, with that reason.

The private key is a secret: enter it in the hosting dashboard only. Never put
it in the repository, in a chat message, or in any `NEXT_PUBLIC_` variable.

## Optional: revalidation secret
Set `REVALIDATE_SECRET` (24+ random characters) in Vercel → Environment Variables for Production only if an outside system needs to clear the website cache. The admin panel never needs it. Without it, `POST /api/revalidate` is disabled (404). Generate it with `openssl rand -hex 32` and never commit it.

## Local test stack (developers)
`npm run stack:start` builds a Supabase-compatible stack from PostgreSQL 16 plus the official Supabase Auth and PostgREST binaries in `/opt/localstack`, with a test-only gateway and storage emulator. It writes test credentials to `/opt/localstack/local.env`, outside the repository. See TEST_REPORT.md. The hosted Supabase CLI stack (`supabase start`, which needs Docker) is an equally good alternative where Docker images can be pulled.
