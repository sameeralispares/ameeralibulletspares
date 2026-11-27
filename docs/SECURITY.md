# Security

## Model
- **Authentication:** Supabase Auth with email + password. Sign-up is disabled in the Supabase dashboard (see DEPLOYMENT.md) and the site has no registration page. Admins are created by the developer with `scripts/create-admin.mjs`, which uses the service role. Passwords are never hard-coded; the script prompts with hidden input.
- **Authorisation:** checked three times.
  1. `proxy.ts` refreshes the session and redirects signed-out visitors (optimistic only).
  2. Every admin page calls `requireAdmin()` and every Server Action calls `getAdminSession()`. Both verify the JWT with the Auth server (`getUser()`) **and** call `is_admin()` in the database.
  3. PostgreSQL RLS enforces the same rule for every query and storage operation, so even a stolen anon key or a non-admin user JWT cannot write.
- No client-side admin flag is trusted anywhere.
- **Service-role key:** only used by `scripts/create-admin.mjs` and tests. It is never imported by `src/`. It was verified to be absent from the production build output (see TEST_REPORT.md). Do not add it to Vercel; nothing in the app needs it.
- **Input validation:** zod schemas run server-side on every action. Database CHECK constraints, enums, a slug domain and FKs act as a second line of defence. Search text is length-limited and LIKE wildcards are escaped. The admin list search strips PostgREST filter syntax characters.
- **Uploads:** client checks (type and size), re-encoding (which strips EXIF/GPS), bucket limits (5 MB, webp/jpeg/png only), storage RLS (admin only, `products/` folder), server validation of the path, and orphan clean-up.
- **Redirects:** `next` parameters are limited to `/admin…` paths (`safeAdminPath`) to prevent open redirects.
- **Account enumeration:** login and password-reset responses are identical for known and unknown emails.
- **Headers:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS. `/admin` and `/auth` send `X-Robots-Tag: noindex`.
- **Personal data:** the site collects none from customers (no forms, accounts, analytics or cookies on public pages). The only personal data is the admin's email in Supabase Auth.
- **Secrets in Git:** `.env*` is ignored except `.env.example`, which contains placeholders only.

## Assumptions
1. The hosted Supabase project has **email sign-ups disabled** and a strong-password policy. If sign-up were left on, a stranger could create an account, but RLS would still give them no write access (this was tested with a non-admin user).
2. `business_settings` holds only public information. Never add private columns to it.
3. HTTPS is terminated by Vercel.
4. Supabase backups and Auth rate limits are configured on the hosted project.

## Recommendations
- Enable MFA (TOTP) for the owner in Supabase when convenient.
- Use a custom SMTP sender for Auth emails (see DEPLOYMENT.md).
- Review `admin_users` whenever staff change.
- `npm audit --omit=dev` reported 0 production vulnerabilities at handover. One moderate advisory (minimatch) affects dev tooling only.
