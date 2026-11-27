-- =============================================================================
-- Row Level Security, privileges and read functions
-- =============================================================================
-- Model:
--   * Anyone (anon) may READ published catalogue content, active models,
--     active categories and the public business settings.
--   * Only users listed in public.admin_users may WRITE anything.
--   * admin_users itself cannot be written through the API at all.
-- The admin check is done inside the database (public.is_admin()), so a
-- client-side "admin" flag can never grant access.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- is_admin(): SECURITY DEFINER so policies can consult admin_users without
-- exposing that table or recursing through its own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users au where au.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.admin_users                 enable row level security;
alter table public.motorcycle_models           enable row level security;
alter table public.product_categories          enable row level security;
alter table public.products                    enable row level security;
alter table public.product_images              enable row level security;
alter table public.product_model_compatibility enable row level security;
alter table public.business_settings           enable row level security;

-- Force RLS for table owners too (defence in depth; service_role still bypasses).
alter table public.admin_users                 force row level security;
alter table public.motorcycle_models           force row level security;
alter table public.product_categories          force row level security;
alter table public.products                    force row level security;
alter table public.product_images              force row level security;
alter table public.product_model_compatibility force row level security;
alter table public.business_settings           force row level security;

-- ---------------------------------------------------------------------------
-- Table privileges (Supabase grants broadly by default; tighten explicitly)
-- ---------------------------------------------------------------------------
revoke all on table
  public.admin_users, public.motorcycle_models, public.product_categories,
  public.products, public.product_images, public.product_model_compatibility,
  public.business_settings
from anon, authenticated;

grant select on table
  public.motorcycle_models, public.product_categories, public.products,
  public.product_images, public.product_model_compatibility, public.business_settings
to anon, authenticated;

grant insert, update, delete on table
  public.motorcycle_models, public.product_categories, public.products,
  public.product_images, public.product_model_compatibility
to authenticated;

grant update on table public.business_settings to authenticated;

-- An authenticated user may see only their own admin_users row (used to show
-- "not authorised" vs "admin" in the UI). No write privileges at all.
grant select on table public.admin_users to authenticated;

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------
create policy "admin_users: read own row"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- motorcycle_models
-- ---------------------------------------------------------------------------
create policy "models: public reads active"
  on public.motorcycle_models for select
  to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "models: admin insert"
  on public.motorcycle_models for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "models: admin update"
  on public.motorcycle_models for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "models: admin delete"
  on public.motorcycle_models for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- product_categories
-- ---------------------------------------------------------------------------
create policy "categories: public reads active"
  on public.product_categories for select
  to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "categories: admin insert"
  on public.product_categories for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "categories: admin update"
  on public.product_categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "categories: admin delete"
  on public.product_categories for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create policy "products: public reads published"
  on public.products for select
  to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

create policy "products: admin insert"
  on public.products for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "products: admin update"
  on public.products for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "products: admin delete"
  on public.products for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- product_images (visible only when the product is visible)
-- ---------------------------------------------------------------------------
create policy "product_images: public reads for published products"
  on public.product_images for select
  to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'published'
    )
  );

create policy "product_images: admin insert"
  on public.product_images for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "product_images: admin update"
  on public.product_images for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "product_images: admin delete"
  on public.product_images for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- product_model_compatibility
-- ---------------------------------------------------------------------------
create policy "compatibility: public reads for published products"
  on public.product_model_compatibility for select
  to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.products p
      where p.id = product_model_compatibility.product_id and p.status = 'published'
    )
  );

create policy "compatibility: admin insert"
  on public.product_model_compatibility for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "compatibility: admin delete"
  on public.product_model_compatibility for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- business_settings (whole row is public information by design)
-- ---------------------------------------------------------------------------
create policy "business_settings: public read"
  on public.business_settings for select
  to anon, authenticated
  using (true);

create policy "business_settings: admin update"
  on public.business_settings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Public read functions (SECURITY INVOKER — RLS still applies)
-- ---------------------------------------------------------------------------

-- Catalogue search with filters + pagination in one round trip.
-- Always restricted to published products, even for an admin caller, because
-- it powers the public website.
create or replace function public.catalog_search(
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

-- Published product counts per active model / category (real numbers only).
create or replace function public.published_counts()
returns table (kind text, ref_id uuid, product_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'model'::text, pmc.model_id, count(distinct p.id)
  from public.product_model_compatibility pmc
  join public.products p on p.id = pmc.product_id and p.status = 'published'
  group by pmc.model_id
  union all
  select 'category'::text, p.category_id, count(*)
  from public.products p
  where p.status = 'published' and p.category_id is not null
  group by p.category_id;
$$;

grant execute on function public.published_counts() to anon, authenticated;

-- Dashboard statistics: admin only, computed from real rows.
create or replace function public.admin_dashboard_stats()
returns table (
  published          bigint,
  draft_or_hidden    bigint,
  archived           bigint,
  available          bigint,
  out_of_stock       bigint,
  contact_to_confirm bigint,
  featured           bigint,
  without_images     bigint
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
    )
  from public.products p;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- Atomically replace a product's compatible models (admin only via RLS).
create or replace function public.set_product_models(p_product_id uuid, p_model_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  delete from public.product_model_compatibility
  where product_id = p_product_id
    and not (model_id = any (coalesce(p_model_ids, '{}')));

  insert into public.product_model_compatibility (product_id, model_id)
  select p_product_id, m
  from unnest(coalesce(p_model_ids, '{}')) as m
  on conflict do nothing;
end;
$$;

revoke all on function public.set_product_models(uuid, uuid[]) from public, anon;
grant execute on function public.set_product_models(uuid, uuid[]) to authenticated;

-- Reorder helper for models/categories/images: positions follow array order.
create or replace function public.reorder_rows(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if p_table = 'motorcycle_models' then
    update public.motorcycle_models t set sort_order = x.ord * 10
    from unnest(p_ids) with ordinality as x(id, ord) where t.id = x.id;
  elsif p_table = 'product_categories' then
    update public.product_categories t set sort_order = x.ord * 10
    from unnest(p_ids) with ordinality as x(id, ord) where t.id = x.id;
  elsif p_table = 'product_images' then
    update public.product_images t set sort_order = x.ord * 10
    from unnest(p_ids) with ordinality as x(id, ord) where t.id = x.id;
  else
    raise exception 'unsupported table %', p_table using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.reorder_rows(text, uuid[]) from public, anon;
grant execute on function public.reorder_rows(text, uuid[]) to authenticated;

-- Make a given image the single primary image for its product.
create or replace function public.set_primary_image(p_image_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select product_id into v_product from public.product_images where id = p_image_id;
  if v_product is null then
    raise exception 'image not found' using errcode = 'P0002';
  end if;

  update public.product_images set is_primary = false
  where product_id = v_product and is_primary and id <> p_image_id;
  update public.product_images set is_primary = true where id = p_image_id;
end;
$$;

revoke all on function public.set_primary_image(uuid) from public, anon;
grant execute on function public.set_primary_image(uuid) to authenticated;
