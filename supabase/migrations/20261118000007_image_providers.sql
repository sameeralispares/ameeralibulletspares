-- ---------------------------------------------------------------------------
-- Admin-controlled image storage provider: Supabase Storage or ImageKit.
--
-- Supabase remains the backend for the database, authentication and RLS. Only
-- the image FILE can live in either place. Every existing row keeps working
-- unchanged: all of them are 'supabase', and their public URL is still built
-- from storage_path at render time, so no URL is duplicated into the database
-- for them.
--
-- Safe to re-run: every object is created with "if not exists" or dropped
-- first, and no existing data is rewritten.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Per-image provider metadata
-- ---------------------------------------------------------------------------
alter table public.product_images
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists image_url        text,
  add column if not exists provider_file_id text,
  add column if not exists file_size        integer,
  add column if not exists mime_type        text;

comment on column public.product_images.storage_provider is
  'Where the file physically lives: supabase (Storage bucket) or imagekit (Media Library).';
comment on column public.product_images.image_url is
  'ImageKit delivery URL. Null for Supabase images, whose URL is built from storage_path.';
comment on column public.product_images.provider_file_id is
  'ImageKit fileId, needed to delete the file from the right provider. Null for Supabase.';

alter table public.product_images drop constraint if exists product_images_provider_check;
alter table public.product_images
  add constraint product_images_provider_check
  check (storage_provider in ('supabase', 'imagekit'));

-- The path shape differs per provider, so the original column-level check on
-- storage_path is replaced by one that branches on the provider rather than
-- being dropped. ImageKit returns a filePath with a leading slash.
alter table public.product_images drop constraint if exists product_images_storage_path_check;
alter table public.product_images
  add constraint product_images_storage_path_check
  check (
    case storage_provider
      when 'supabase' then storage_path ~ '^products/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'
      when 'imagekit' then storage_path ~ '^/?products/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'
      else false
    end
  );

-- An ImageKit image is only usable with its delivery URL and file id. A
-- Supabase image must carry neither: its URL comes from storage_path, and a
-- stray file id could otherwise send a delete to the wrong provider.
alter table public.product_images drop constraint if exists product_images_provider_fields_check;
-- Written with "is not null" first and a case expression rather than an OR of
-- comparisons: a NULL inside a check constraint counts as satisfied, so
-- `image_url ~ '...'` alone would let an ImageKit row through with no URL.
alter table public.product_images
  add constraint product_images_provider_fields_check
  check (
    case storage_provider
      when 'supabase' then image_url is null and provider_file_id is null
      when 'imagekit' then
        image_url is not null
        and provider_file_id is not null
        and image_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*/[^[:space:]]*$'
        and char_length(image_url) <= 600
        and char_length(provider_file_id) <= 120
      else false
    end
  );

alter table public.product_images drop constraint if exists product_images_file_size_check;
alter table public.product_images
  add constraint product_images_file_size_check
  check (file_size is null or (file_size > 0 and file_size <= 20971520));

alter table public.product_images drop constraint if exists product_images_mime_type_check;
alter table public.product_images
  add constraint product_images_mime_type_check
  check (mime_type is null or mime_type in ('image/webp', 'image/jpeg', 'image/png'));

-- ---------------------------------------------------------------------------
-- 2. Default provider for new uploads (one row table, admin editable)
-- ---------------------------------------------------------------------------
alter table public.business_settings
  add column if not exists default_image_provider text not null default 'supabase';

alter table public.business_settings drop constraint if exists business_settings_default_provider_check;
alter table public.business_settings
  add constraint business_settings_default_provider_check
  check (default_image_provider in ('supabase', 'imagekit'));

-- ---------------------------------------------------------------------------
-- 3. Cleanup queue for files that could not be deleted from their provider
--
-- A delete that fails at the provider must not strand the admin: the row is
-- removed from product_images and the file is recorded here with everything
-- needed to retry, so an orphaned file can still be found and removed later.
-- ---------------------------------------------------------------------------
create table if not exists public.image_cleanup_queue (
  id               uuid primary key default gen_random_uuid(),
  storage_provider text not null,
  storage_path     text not null,
  provider_file_id text,
  product_id       uuid,
  last_error       text,
  attempts         integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.image_cleanup_queue drop constraint if exists image_cleanup_queue_provider_check;
alter table public.image_cleanup_queue
  add constraint image_cleanup_queue_provider_check
  check (storage_provider in ('supabase', 'imagekit'));

alter table public.image_cleanup_queue drop constraint if exists image_cleanup_queue_attempts_check;
alter table public.image_cleanup_queue
  add constraint image_cleanup_queue_attempts_check
  check (attempts >= 1 and attempts <= 1000);

alter table public.image_cleanup_queue drop constraint if exists image_cleanup_queue_error_check;
alter table public.image_cleanup_queue
  add constraint image_cleanup_queue_error_check
  check (last_error is null or char_length(last_error) <= 500);

create index if not exists image_cleanup_queue_created_idx
  on public.image_cleanup_queue (created_at desc);

-- The product_id is deliberately not a foreign key: the product may already
-- be gone when the file still needs cleaning up.
comment on column public.image_cleanup_queue.product_id is
  'Product the file belonged to, if known. Not a foreign key: the product may be deleted already.';

alter table public.image_cleanup_queue enable row level security;
alter table public.image_cleanup_queue force row level security;

revoke all on table public.image_cleanup_queue from anon, authenticated;
grant select, insert, update, delete on table public.image_cleanup_queue to authenticated;

drop policy if exists "image_cleanup_queue: admin read" on public.image_cleanup_queue;
create policy "image_cleanup_queue: admin read"
  on public.image_cleanup_queue for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "image_cleanup_queue: admin insert" on public.image_cleanup_queue;
create policy "image_cleanup_queue: admin insert"
  on public.image_cleanup_queue for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "image_cleanup_queue: admin update" on public.image_cleanup_queue;
create policy "image_cleanup_queue: admin update"
  on public.image_cleanup_queue for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "image_cleanup_queue: admin delete" on public.image_cleanup_queue;
create policy "image_cleanup_queue: admin delete"
  on public.image_cleanup_queue for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 4. catalog_search also returns the provider and delivery URL, so listings
--    can render an image from either provider. Search behaviour is unchanged;
--    the return type changes, so the function is dropped and recreated.
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
  image_provider     text,
  image_url          text,
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
    img.storage_provider, img.image_url,
    count(*) over () as total_count
  from filtered f
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

grant execute on function public.catalog_search(text, text, text, public.product_availability, boolean, integer, integer)
  to anon, authenticated;
