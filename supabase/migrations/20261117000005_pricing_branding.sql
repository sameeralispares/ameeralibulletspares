-- =============================================================================
-- Pricing (Indian rupees), festive offers, replaceable hero image,
-- and the shop's new number (+91 96770 93315) for landline and WhatsApp.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Product prices, in rupees (INR). MRP is the printed price; offer_price is an
-- optional special price for one part. Both are optional and never invented.
-- ---------------------------------------------------------------------------
alter table public.products
  add column mrp numeric(10,2) check (mrp is null or (mrp > 0 and mrp < 10000000)),
  add column offer_price numeric(10,2) check (offer_price is null or (offer_price > 0 and offer_price < 10000000)),
  add constraint products_offer_not_above_mrp check (offer_price is null or mrp is null or offer_price <= mrp);

-- ---------------------------------------------------------------------------
-- Site-wide festive offer and the replaceable hero image.
-- ---------------------------------------------------------------------------
alter table public.business_settings
  add column hero_image_path text
    check (hero_image_path is null or hero_image_path ~ '^hero/[a-z0-9-]{8,64}\.(webp|jpg|png)$'),
  add column festive_active boolean not null default false,
  add column festive_label text check (festive_label is null or char_length(festive_label) <= 80),
  add column festive_discount_type text not null default 'percent' check (festive_discount_type in ('percent', 'amount')),
  add column festive_discount_value numeric(10,2) not null default 0 check (festive_discount_value >= 0),
  add constraint festive_percent_range check (festive_discount_type <> 'percent' or festive_discount_value <= 90);

-- The shop's confirmed number is used for both the landline and WhatsApp.
update public.business_settings
  set landline = '+91 96770 93315',
      whatsapp_number = '919677093315'
  where id = 1;

-- ---------------------------------------------------------------------------
-- Storage: a public bucket for the one hero image. Same rules as product photos:
-- anyone can read a file by its exact URL, only admins can change it, and
-- nobody (including anonymous visitors) can list the bucket.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-images', 'brand-images', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "brand-images: admin read/list"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'brand-images' and (select public.is_admin()));

create policy "brand-images: admin upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brand-images'
    and (select public.is_admin())
    and (storage.foldername(name))[1] = 'hero'
  );

create policy "brand-images: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'brand-images' and (select public.is_admin()))
  with check (bucket_id = 'brand-images' and (select public.is_admin()));

create policy "brand-images: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'brand-images' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- catalog_search now also returns the MRP and offer price (return type changes,
-- so the function is dropped and recreated with identical search behaviour).
-- ---------------------------------------------------------------------------
drop function if exists public.catalog_search(text, text, text, public.product_availability, boolean, integer, integer);

create function public.catalog_search(
  p_query        text default null,
  p_model        text default null,
  p_category     text default null,
  p_availability public.product_availability default null,
  p_featured     boolean default null,
  p_limit        integer default 24,
  p_offset       integer default 0
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
  category_name      text,
  category_slug      text,
  image_path         text,
  image_alt          text,
  image_width        integer,
  image_height       integer,
  total_count        bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select nullif(btrim(p_query), '') as term
  ), filtered as (
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
  )
  select
    f.id, f.name, f.slug::text, f.part_number, f.availability, f.is_featured,
    f.mrp, f.offer_price,
    c.name, c.slug::text,
    img.storage_path, img.alt_text, img.width, img.height,
    count(*) over () as total_count
  from filtered f
  left join public.product_categories c on c.id = f.category_id and c.is_active
  left join lateral (
    select pi.storage_path, pi.alt_text, pi.width, pi.height
    from public.product_images pi
    where pi.product_id = f.id
    order by pi.is_primary desc, pi.sort_order, pi.created_at
    limit 1
  ) img on true
  order by f.is_featured desc, f.published_at desc nulls last, f.name
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.catalog_search(text, text, text, public.product_availability, boolean, integer, integer)
  to anon, authenticated;
