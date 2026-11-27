-- ---------------------------------------------------------------------------
-- A part can now be held as OEM stock, as vendor stock, or as BOTH.
--
-- Every part is a genuine Royal Enfield part; this records which supply the
-- shop bought it through. Until now a part held from both supplies had to be
-- listed twice. It can now be one listing with two prices, and the customer
-- picks which one they want.
--
-- Where the prices live:
--   part_type = 'oem'    -> mrp / offer_price are the OEM prices
--   part_type = 'vendor' -> mrp / offer_price are the vendor prices
--   part_type = 'both'   -> mrp / offer_price are the OEM prices, and
--                           vendor_mrp / vendor_offer_price the vendor ones
--
-- Existing rows are untouched: they stay 'oem' or 'vendor' and keep working.
-- Safe to re-run.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The third option, and the vendor prices that go with it
-- ---------------------------------------------------------------------------
alter table public.products drop constraint if exists products_part_type_check;
alter table public.products
  add constraint products_part_type_check check (part_type in ('oem', 'vendor', 'both'));

comment on column public.products.part_type is
  'Which supply this part is held from: oem, vendor, or both. Every part is genuine; this is a sourcing record.';

alter table public.products
  add column if not exists vendor_mrp          numeric(10, 2),
  add column if not exists vendor_offer_price  numeric(10, 2);

comment on column public.products.vendor_mrp is
  'Vendor-stock MRP. Only used when part_type = both; otherwise the price lives in mrp.';

alter table public.products drop constraint if exists products_vendor_price_shape_check;
alter table public.products
  add constraint products_vendor_price_shape_check
  check (
    case
      -- Only a part held from both supplies carries a second price, so a
      -- single-supply part can never show a stale vendor price.
      when part_type = 'both' then true
      else vendor_mrp is null and vendor_offer_price is null
    end
  );

alter table public.products drop constraint if exists products_vendor_mrp_check;
alter table public.products
  add constraint products_vendor_mrp_check
  check (vendor_mrp is null or vendor_mrp >= 0);

alter table public.products drop constraint if exists products_vendor_offer_check;
alter table public.products
  add constraint products_vendor_offer_check
  check (
    vendor_offer_price is null
    or (vendor_offer_price >= 0 and vendor_mrp is not null and vendor_offer_price <= vendor_mrp)
  );

-- ---------------------------------------------------------------------------
-- 2. Counts: a part held from both supplies counts under each of them, so the
--    two tabs each show every part a customer could actually buy that way.
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
    count(distinct p.id) filter (where p.part_type in ('oem', 'both')),
    count(distinct p.id) filter (where p.part_type in ('vendor', 'both'))
  from public.product_model_compatibility pmc
  join public.products p on p.id = pmc.product_id and p.status = 'published'
  group by pmc.model_id
  union all
  select
    'category'::text,
    p.category_id,
    count(*),
    count(*) filter (where p.part_type in ('oem', 'both')),
    count(*) filter (where p.part_type in ('vendor', 'both'))
  from public.products p
  where p.status = 'published' and p.category_id is not null
  group by p.category_id;
$$;

grant execute on function public.published_counts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Search returns both prices and treats 'both' as matching either tab.
-- ---------------------------------------------------------------------------
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
  vendor_mrp         numeric,
  vendor_offer_price numeric,
  category_name      text,
  category_slug      text,
  image_path         text,
  image_alt          text,
  image_width        integer,
  image_height       integer,
  image_provider     text,
  image_url          text,
  total_count        bigint,
  all_total          bigint,
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
    -- Every filter except the supply, so the tab counts stay correct.
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
      count(*) as all_total,
      count(*) filter (where part_type in ('oem', 'both')) as oem_total,
      count(*) filter (where part_type in ('vendor', 'both')) as vendor_total
    from base
  ), filtered as (
    select * from base
    -- A part held from both supplies belongs in either tab.
    where p_part_type is null or part_type = p_part_type or part_type = 'both'
  )
  select
    f.id, f.name, f.slug::text, f.part_number, f.availability, f.is_featured,
    f.mrp, f.offer_price, f.part_type, f.vendor_mrp, f.vendor_offer_price,
    c.name, c.slug::text,
    img.storage_path, img.alt_text, img.width, img.height,
    img.storage_provider, img.image_url,
    count(*) over () as total_count,
    tc.all_total, tc.oem_total, tc.vendor_total
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
-- 4. Dashboard counts a both-supply part under each supply, for the same
--    reason as the tabs. The two numbers can therefore exceed the total.
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
    count(*) filter (where p.status <> 'archived' and p.part_type in ('oem', 'both')),
    count(*) filter (where p.status <> 'archived' and p.part_type in ('vendor', 'both'))
  from public.products p;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
