-- ---------------------------------------------------------------------------
-- Which supply each part came from, plus a picture for each motorcycle model.
--
-- Every part the shop sells is a genuine Royal Enfield part. This is a supply
-- distinction, not a quality one: 'oem' is stock bought through the OEM
-- supply, 'vendor' is the same original part bought in through another vendor.
-- The shop records it to see which supply sells more.
--
-- When the shop holds the same part from both supplies they are two separate
-- listings, each with its own part number, photos, price and availability.
--
-- Every existing product becomes 'oem', so nothing is relabelled by accident.
--
-- Safe to re-run; no existing data is rewritten.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. OEM or vendor supply
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists part_type text not null default 'oem';

alter table public.products drop constraint if exists products_part_type_check;
alter table public.products
  add constraint products_part_type_check check (part_type in ('oem', 'vendor'));

comment on column public.products.part_type is
  'Which supply this stock came from: oem = OEM supply, vendor = bought in from another vendor. Both are genuine parts.';

create index if not exists products_part_type_idx on public.products (part_type, status);

-- ---------------------------------------------------------------------------
-- 2. A picture for each motorcycle model
--
-- Stored in the existing brand-images bucket under models/, so it is public to
-- read by exact URL and writable only by an admin. The website falls back to a
-- drawn illustration when no picture has been uploaded.
-- ---------------------------------------------------------------------------
alter table public.motorcycle_models
  add column if not exists image_path text;

alter table public.motorcycle_models drop constraint if exists motorcycle_models_image_path_check;
alter table public.motorcycle_models
  add constraint motorcycle_models_image_path_check
  check (image_path is null or image_path ~ '^models/[a-z0-9-]{8,64}\.(webp|jpg|png)$');

comment on column public.motorcycle_models.image_path is
  'Optional photo in the brand-images bucket (models/<uuid>.<ext>). Null means the drawn illustration is used.';

-- The upload policy allowed only the hero/ folder; model pictures need
-- models/ as well. Nothing else about the bucket changes.
drop policy if exists "brand-images: admin upload" on storage.objects;
create policy "brand-images: admin upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brand-images'
    and (select public.is_admin())
    and (storage.foldername(name))[1] in ('hero', 'models')
  );

-- ---------------------------------------------------------------------------
-- 3. Counts split by supply, for the "OEM / Vendor" tabs and the admin model
--    list. Return type changes, so the function is recreated.
-- ---------------------------------------------------------------------------
drop function if exists public.published_counts();

create function public.published_counts()
returns table (kind text, ref_id uuid, product_count bigint, oem_count bigint, vendor_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    'model'::text,
    pmc.model_id,
    count(distinct p.id),
    count(distinct p.id) filter (where p.part_type = 'oem'),
    count(distinct p.id) filter (where p.part_type = 'vendor')
  from public.product_model_compatibility pmc
  join public.products p on p.id = pmc.product_id and p.status = 'published'
  group by pmc.model_id
  union all
  select
    'category'::text,
    p.category_id,
    count(*),
    count(*) filter (where p.part_type = 'oem'),
    count(*) filter (where p.part_type = 'vendor')
  from public.products p
  where p.status = 'published' and p.category_id is not null
  group by p.category_id;
$$;

grant execute on function public.published_counts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. catalog_search can filter by part type and returns it. Search behaviour
--    is otherwise unchanged; the signature and return type change, so the
--    function is dropped and recreated.
-- ---------------------------------------------------------------------------
drop function if exists public.catalog_search(text, text, text, public.product_availability, boolean, integer, integer);
-- Also the new signature, so this migration can be re-run safely.
drop function if exists public.catalog_search(text, text, text, public.product_availability, boolean, integer, integer, text);

create function public.catalog_search(
  p_query        text default null,
  p_model        text default null,
  p_category     text default null,
  p_availability public.product_availability default null,
  p_featured     boolean default null,
  p_limit        integer default 24,
  p_offset       integer default 0,
  p_part_type    text default null
)
returns table (
  id                 uuid,
  name               text,
  slug               text,
  part_number        text,
  availability       public.product_availability,
  is_featured        boolean,
  mrp                numeric,
  offer_price        numeric,
  part_type          text,
  category_name      text,
  category_slug      text,
  image_path         text,
  image_alt          text,
  image_width        integer,
  image_height       integer,
  image_provider     text,
  image_url          text,
  total_count        bigint,
  -- OEM / vendor totals for the same filters, ignoring p_part_type, so the
  -- tabs can show a count for the tab you are not on.
  oem_total          bigint,
  vendor_total       bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select nullif(btrim(p_query), '') as term
  ), base as (
    -- Every filter except the part type, so the tab counts stay correct.
    select p.*
    from public.products p
    cross join q
    left join public.product_categories c on c.id = p.category_id
    where p.status = 'published'
      and (
        q.term is null
        or p.name ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or p.part_number ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or c.name ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
      and (p_category is null or (c.slug = p_category and c.is_active))
      and (p_availability is null or p.availability = p_availability)
      and (p_featured is null or p.is_featured = p_featured)
      and (
        p_model is null or exists (
          select 1
          from public.product_model_compatibility pmc
          join public.motorcycle_models m on m.id = pmc.model_id
          where pmc.product_id = p.id and m.slug = p_model and m.is_active
        )
      )
  ), type_counts as (
    select
      count(*) filter (where part_type = 'oem') as oem_total,
      count(*) filter (where part_type = 'vendor') as vendor_total
    from base
  ), filtered as (
    select * from base
    where p_part_type is null or part_type = p_part_type
  )
  select
    f.id, f.name, f.slug::text, f.part_number, f.availability, f.is_featured,
    f.mrp, f.offer_price, f.part_type,
    c.name, c.slug::text,
    img.storage_path, img.alt_text, img.width, img.height,
    img.storage_provider, img.image_url,
    count(*) over () as total_count,
    tc.oem_total, tc.vendor_total
  from filtered f
  cross join type_counts tc
  left join public.product_categories c on c.id = f.category_id and c.is_active
  left join lateral (
    select pi.storage_path, pi.alt_text, pi.width, pi.height, pi.storage_provider, pi.image_url
    from public.product_images pi
    where pi.product_id = f.id
    order by pi.is_primary desc, pi.sort_order, pi.created_at
    limit 1
  ) img on true
  order by f.is_featured desc, f.published_at desc nulls last, f.name
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.catalog_search(text, text, text, public.product_availability, boolean, integer, integer, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The admin dashboard also counts OEM and vendor stock. The existing
--    columns and their meanings are unchanged; two are appended, so the
--    function is dropped and recreated.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_dashboard_stats();

create function public.admin_dashboard_stats()
returns table (
  published          bigint,
  draft_or_hidden    bigint,
  archived           bigint,
  available          bigint,
  out_of_stock       bigint,
  contact_to_confirm bigint,
  featured           bigint,
  without_images     bigint,
  oem                bigint,
  vendor             bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where p.status = 'published'),
    count(*) filter (where p.status in ('draft', 'hidden')),
    count(*) filter (where p.status = 'archived'),
    count(*) filter (where p.status <> 'archived' and p.availability = 'available'),
    count(*) filter (where p.status <> 'archived' and p.availability = 'out_of_stock'),
    count(*) filter (where p.status <> 'archived' and p.availability = 'contact_to_confirm'),
    count(*) filter (where p.status <> 'archived' and p.is_featured),
    count(*) filter (
      where p.status <> 'archived'
        and not exists (select 1 from public.product_images pi where pi.product_id = p.id)
    ),
    count(*) filter (where p.status <> 'archived' and p.part_type = 'oem'),
    count(*) filter (where p.status <> 'archived' and p.part_type = 'vendor')
  from public.products p;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Correct a stale column comment. The original schema required the WhatsApp
--    number to differ from the landline; that rule was dropped in 0.1.2 when
--    the shop moved to a single mobile number for both.
-- ---------------------------------------------------------------------------
comment on column public.business_settings.whatsapp_number is
  'International format digits only, e.g. 919XXXXXXXXX. May be the same as the landline. NULL hides WhatsApp buttons.';
