# Production migration plan — three-way supply (migration 000009)

This covers putting `20261120000009_both_supplies.sql` (and the migrations
before it) onto a **production** Supabase project. Nothing here has been run
against production yet.

> Do not apply any migration to production without the owner's approval, and
> never run the demo seed script (`scripts/demo/seed.py`) against production —
> it inserts 61 sample parts and is for the local stack only.

## 1. Current state

- There is **no production Supabase project yet**. All nine migrations
  (`20261113000001` … `20261120000009`) have only been applied locally.
- So there are two possible situations on the day:
  - **Fresh project** (expected): apply all nine migrations in filename order.
    This is the normal first deploy — see `DEPLOYMENT.md` section 1.
  - **Existing project already at 000008**: apply only `000009`.

The rest of this document is about `000009` specifically, since it is the one
that changes an existing schema.

## 2. What 000009 does

Additive and backward-compatible:

1. Widens the `products.part_type` check from `('oem','vendor')` to
   `('oem','vendor','both')`.
2. Adds two **nullable** columns: `vendor_mrp`, `vendor_offer_price`
   (`numeric(10,2)`).
3. Adds three check constraints: vendor prices are allowed only when
   `part_type = 'both'`; `vendor_mrp >= 0`; `vendor_offer_price` between 0 and
   `vendor_mrp`.
4. Replaces three functions — `published_counts()`, `catalog_search(...)`,
   `admin_dashboard_stats()` — to report OEM/vendor/both counts and return the
   vendor price columns. `catalog_search` gains one parameter and its old
   7-argument signature is dropped.

The file is idempotent (`drop … if exists`, `add column if not exists`) and
safe to re-run.

## 3. Compatibility with existing records

- Existing rows keep `part_type = 'oem'` or `'vendor'` and are untouched. The
  two new columns are `NULL` on every existing row, which the "vendor prices
  only on both" constraint allows.
- No row needs back-filling. No existing value changes.
- **Application/database version coupling:** `catalog_search`'s signature
  changes (7 → 8 arguments), so the new app and this migration must ship
  together. Apply the migration **before or at the same time** as deploying the
  new app build. If the old app is still live when the migration lands, its
  `catalog_search` calls fail until the new build is up — keep the gap short,
  or apply during the deploy.

## 4. Ordering

Filename order is the apply order, and it is already correct:

```
20261113000001_initial_schema.sql
20261113000002_security_and_rls.sql
20261113000003_storage.sql
20261113000004_seed_reference_data.sql
20261117000005_pricing_branding.sql
20261118000006_address.sql
20261118000007_image_providers.sql
20261119000008_part_types_and_model_images.sql
20261120000009_both_supplies.sql   ← this one, last
```

`supabase db push` applies them in this order. If pasting into the SQL editor,
run them top to bottom. Never edit an already-applied migration; any further
change goes in a new file.

## 5. Pre-flight (on an existing project only)

Before applying 000009, confirm the project is at 000008:

```sql
-- part_type should currently allow only oem/vendor
select pg_get_constraintdef(oid) from pg_constraint
where conname = 'products_part_type_check';
-- the vendor columns should NOT exist yet
select column_name from information_schema.columns
where table_name = 'products' and column_name like 'vendor_%';
-- catalog_search should currently take 7 arguments
select pg_get_function_identity_arguments(oid) from pg_proc
where proname = 'catalog_search';
```

## 6. Data-loss risk

- **Applying 000009: none.** It only adds nullable columns and widens a
  constraint. No drop of data, no type narrowing, no back-fill.
- The only destructive action in the file is `drop function` on the three
  functions, immediately recreated in the same transaction — no data is held in
  functions.

## 7. Backup

Take a backup immediately before applying, regardless of plan tier:

```bash
supabase db dump -f pre-000009-$(date +%F).sql          # schema + data
# plus a copy of the Storage buckets if photos already exist
```

On Supabase Pro, confirm the automatic daily backup ran, and enable
point-in-time recovery if the owner wants minute-level restore.

## 8. Rollback

**Preferred:** restore the pre-000009 backup from step 7 (or use point-in-time
recovery to just before the apply). This is the reliable path, because 000009
replaces functions whose previous definitions must otherwise be restored by
hand.

**Manual down-migration** (only if a backup restore is not possible):

1. **First convert any `both` rows** — the old constraint will reject them:
   ```sql
   -- Decide per row which supply to keep. Simplest: keep OEM, drop vendor price.
   update public.products set part_type = 'oem',
          vendor_mrp = null, vendor_offer_price = null
   where part_type = 'both';
   ```
   (At the time of writing the local database has 28 `both` rows; production
   will have however many the owner has created. Converting them **loses the
   vendor price** on those parts — hence backup-restore is preferred.)
2. Drop the new constraints and columns:
   ```sql
   alter table public.products
     drop constraint if exists products_vendor_price_shape_check,
     drop constraint if exists products_vendor_mrp_check,
     drop constraint if exists products_vendor_offer_check,
     drop constraint if exists products_part_type_check;
   alter table public.products
     add constraint products_part_type_check check (part_type in ('oem','vendor')),
     drop column if exists vendor_mrp,
     drop column if exists vendor_offer_price;
   ```
3. Restore the three prior functions by re-running their definitions from
   `supabase/migrations/20261119000008_part_types_and_model_images.sql`
   (`published_counts`, `catalog_search`, `admin_dashboard_stats`). Then
   `notify pgrst, 'reload schema';`.
4. Redeploy the previous app build.

## 9. Verify after applying

```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'products_part_type_check';
-- expect: CHECK (part_type = ANY (ARRAY['oem','vendor','both']))
select * from public.published_counts();
```

Then in the admin panel: create one `Both` product with an OEM and a vendor
price, confirm the website shows the OEM/Vendor choice and the right price,
and delete the test product.
