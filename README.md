# S Ameer Ali Bullet Spare Parts — website & catalogue admin

Mobile-first website and owner-managed product catalogue for **S Ameer Ali Bullet Spare Parts**, Venkatachalan Naicken Street, Pudupet, Chennai — genuine Royal Enfield spare parts.

Built by **Sam Tech Builds**.

## What it does

**Customers** can browse genuine parts by motorcycle model or category, search by name or part number, filter by availability, view photos and compatibility, then enquire on WhatsApp (once the number is configured) or call the shop.

**The shop owner** signs in at `/admin` (on a phone or a computer) to add, edit, publish, hide, archive or delete products. The owner can also upload and order photos, set availability, mark featured parts, and manage models, categories and business details.

No prices, checkout or payments, by design.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS 4, self-hosted Barlow fonts |
| Backend | Supabase: PostgreSQL + Row Level Security, Auth, Storage |
| Tests | Vitest (unit + database security), Playwright (browser, responsive) |
| Hosting | Vercel (recommended) |

## Quick start (development)

```bash
npm install
cp .env.example .env.local      # fill in your Supabase project values
# apply supabase/migrations/*.sql to your Supabase project (see docs/DEPLOYMENT.md)
node scripts/create-admin.mjs owner@example.com   # creates the owner login
npm run dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | Static checks |
| `npm test` | Unit tests |
| `npm run test:integration` | Database/RLS/storage security tests (needs a test stack) |
| `npm run test:e2e` | Browser tests (needs a running build + test stack) |
| `npm run stack:start` / `stack:reset` / `stack:stop` | Local Supabase-compatible test stack |
| `npm run create-admin -- <email>` | Create or promote an admin account |

## Documentation

| File | Contents |
|---|---|
| [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md) | Environment audit and key decisions |
| [docs/PROJECT_SPECIFICATION.md](docs/PROJECT_SPECIFICATION.md) | What was built, page by page |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code is organised, caching, data flow |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Tables, constraints, functions, RLS |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and assumptions |
| [docs/SEO_GUIDE.md](docs/SEO_GUIDE.md) | Technical SEO, Google Business Profile, Search Console |
| [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | Test results with evidence |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase, Vercel, domain, env vars, first admin |
| [docs/ADMIN_USER_GUIDE.md](docs/ADMIN_USER_GUIDE.md) | Plain-language guide for the shop owner |
| [docs/CLIENT_INFORMATION_PENDING.md](docs/CLIENT_INFORMATION_PENDING.md) | Details still needed from the client |
| [docs/IMAGEKIT_SETUP.md](docs/IMAGEKIT_SETUP.md) | Optional ImageKit storage: keys, setup, behaviour |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Change history |
