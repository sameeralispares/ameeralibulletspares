# Database schema

Migrations (apply in order): `supabase/migrations/`

| File | Purpose |
|---|---|
| `20261113000001_initial_schema.sql` | Enums, slug domain, tables, indexes, triggers |
| `20261113000002_security_and_rls.sql` | RLS, privileges, `is_admin()`, read and admin functions |
| `20261113000003_storage.sql` | `product-images` bucket + storage policies |
| `20261113000004_seed_reference_data.sql` | 12 confirmed models, 9 *suggested* categories, confirmed business settings. **No products.** |

## Tables

**admin_users**: `user_id` (PK, FK auth.users, cascade), `role` (`owner`/`editor`), `created_at`. Written only by SQL or the service role (`scripts/create-admin.mjs`).

**motorcycle_models** / **product_categories**: `id` uuid PK, `name` (unique case-insensitive, 1–80 chars), `slug` (unique, slug domain), `description` (≤600), `sort_order`, `is_active`, timestamps.

**products**: `id`, `name` (2–140), `slug` (unique), `part_number` (≤60, never invented), `description` (≤5000), `category_id` (FK, set null), `availability` enum (`available` | `out_of_stock` | `contact_to_confirm`, default the last), `status` enum (`draft` | `published` | `hidden` | `archived`, default draft), `is_featured`, `seo_title` (≤70), `seo_description` (≤170), `published_at` (set automatically on first publish), timestamps.
Indexes: status, category, partial featured, partial published_at, trigram GIN on name and part_number.

**product_images**: `id`, `product_id` (FK cascade), `storage_path` (unique, must match `products/<uuid>/<file>`), `alt_text`, `width`, `height`, `sort_order`, `is_primary` (partial unique index: at most one per product).

**product_model_compatibility**: (`product_id`, `model_id`) composite PK, both FK cascade, index on model_id. Many-to-many.

**business_settings**: a single row (`id = 1`, check constraint) with **public** fields only: name, address, landline, whatsapp_number (digits, `^[1-9][0-9]{9,14}$`), email, opening_hours, google_maps_url / social URLs (must be https), about_intro, about_history. NULL means "not confirmed" and is hidden.

The `slug` domain only allows `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1–120 chars.

## Functions

| Function | Security | Purpose |
|---|---|---|
| `is_admin()` | definer, stable | Is `auth.uid()` in admin_users? |
| `catalog_search(q, model, category, availability, featured, limit, offset)` | invoker | Published-only search with filters, primary image and total count. LIKE wildcards are escaped; page size capped at 60. |
| `published_counts()` | invoker | Real published counts per model and category |
| `admin_dashboard_stats()` | invoker + admin check | Dashboard numbers |
| `set_product_models(product, uuid[])` | invoker + admin check | Atomic compatibility replace |
| `reorder_rows(table, uuid[])` | invoker + admin check | Whitelisted tables only |
| `set_primary_image(image)` | invoker + admin check | Single primary image |

## RLS summary

| Table | anon / authenticated read | write |
|---|---|---|
| products | `status = 'published'` or admin | admin |
| product_images, product_model_compatibility | only rows of published products, or admin | admin |
| motorcycle_models, product_categories | `is_active` or admin | admin |
| business_settings | everyone (public fields only) | admin (update only) |
| admin_users | own row (authenticated only) | nobody via API |
| storage.objects (product-images) | public file URLs; **listing** admin only | admin, inside `products/` |

RLS is **forced** on every table. Table privileges are also explicitly revoked and re-granted, so the database does not rely on Supabase's broad default grants.
