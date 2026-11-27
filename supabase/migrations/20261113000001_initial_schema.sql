-- =============================================================================
-- S Ameer Ali Bullet Spare Parts — initial schema
-- =============================================================================
-- Tables:
--   admin_users                 who may manage the catalogue (checked by RLS)
--   motorcycle_models           Bullet, Classic, … (editable)
--   product_categories          configurable part categories
--   products                    the catalogue (no prices by design)
--   product_images              photos stored in Supabase Storage
--   product_model_compatibility many-to-many products <-> models
--   business_settings           single row of PUBLIC business information
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.product_availability as enum (
  'available',
  'out_of_stock',
  'contact_to_confirm'
);

create type public.product_status as enum (
  'draft',      -- being prepared, never public
  'published',  -- visible on the website
  'hidden',     -- temporarily removed from the website
  'archived'    -- retired; kept for records
);

create type public.admin_role as enum ('owner', 'editor');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Slugs: lowercase letters, digits and single hyphens.
create domain public.slug as text
  check (value ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(value) between 1 and 120);

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.admin_role not null default 'owner',
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Accounts allowed to manage the catalogue. Rows are added only by the developer with SQL / service role — never from the website.';

-- ---------------------------------------------------------------------------
-- motorcycle_models
-- ---------------------------------------------------------------------------
create table public.motorcycle_models (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  slug        public.slug not null unique,
  description text check (description is null or char_length(description) <= 600),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index motorcycle_models_name_key on public.motorcycle_models (lower(name));
create index motorcycle_models_active_sort_idx on public.motorcycle_models (is_active, sort_order);

create trigger motorcycle_models_updated_at
  before update on public.motorcycle_models
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_categories
-- ---------------------------------------------------------------------------
create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  slug        public.slug not null unique,
  description text check (description is null or char_length(description) <= 600),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index product_categories_name_key on public.product_categories (lower(name));
create index product_categories_active_sort_idx on public.product_categories (is_active, sort_order);

create trigger product_categories_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 2 and 140),
  slug            public.slug not null unique,
  part_number     text check (part_number is null or char_length(part_number) <= 60),
  description     text check (description is null or char_length(description) <= 5000),
  category_id     uuid references public.product_categories (id) on delete set null,
  availability    public.product_availability not null default 'contact_to_confirm',
  status          public.product_status not null default 'draft',
  is_featured     boolean not null default false,
  seo_title       text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 170),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.products.part_number is
  'Genuine Royal Enfield part number, if the owner supplies it. Never invented.';

create index products_status_idx on public.products (status);
create index products_category_idx on public.products (category_id);
create index products_featured_idx on public.products (is_featured) where is_featured;
create index products_published_at_idx on public.products (published_at desc) where status = 'published';
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_part_number_trgm_idx on public.products using gin (part_number extensions.gin_trgm_ops);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Keep published_at meaningful: set it the first time a product is published.
create or replace function public.products_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger products_published_at
  before insert or update of status on public.products
  for each row execute function public.products_set_published_at();

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^products/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  alt_text     text check (alt_text is null or char_length(alt_text) <= 200),
  width        integer check (width is null or width > 0),
  height       integer check (height is null or height > 0),
  sort_order   integer not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);
-- At most one primary image per product.
create unique index product_images_one_primary_idx
  on public.product_images (product_id) where is_primary;

-- ---------------------------------------------------------------------------
-- product_model_compatibility
-- ---------------------------------------------------------------------------
create table public.product_model_compatibility (
  product_id uuid not null references public.products (id) on delete cascade,
  model_id   uuid not null references public.motorcycle_models (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, model_id)
);

create index product_model_compatibility_model_idx
  on public.product_model_compatibility (model_id);

-- ---------------------------------------------------------------------------
-- business_settings (single row, PUBLIC information only)
-- ---------------------------------------------------------------------------
-- Every column here is readable by anyone. NEVER store passwords, API keys
-- or private notes in this table. A NULL value means "not confirmed yet" and
-- is never shown on the website.
create table public.business_settings (
  id               smallint primary key default 1 check (id = 1),
  business_name    text not null check (char_length(btrim(business_name)) between 2 and 120),
  address          text check (address is null or char_length(address) <= 300),
  landline         text check (landline is null or landline ~ '^[0-9 +()-]{6,20}$'),
  whatsapp_number  text check (whatsapp_number is null or whatsapp_number ~ '^[1-9][0-9]{9,14}$'),
  email            text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  opening_hours    text check (opening_hours is null or char_length(opening_hours) <= 500),
  google_maps_url  text check (google_maps_url is null or google_maps_url ~ '^https://'),
  facebook_url     text check (facebook_url is null or facebook_url ~ '^https://'),
  instagram_url    text check (instagram_url is null or instagram_url ~ '^https://'),
  youtube_url      text check (youtube_url is null or youtube_url ~ '^https://'),
  about_intro      text check (about_intro is null or char_length(about_intro) <= 2000),
  about_history    text check (about_history is null or char_length(about_history) <= 5000),
  updated_at       timestamptz not null default now()
);

comment on column public.business_settings.whatsapp_number is
  'International format digits only, e.g. 919XXXXXXXXX. Must NOT be the landline. NULL hides WhatsApp buttons.';

create trigger business_settings_updated_at
  before update on public.business_settings
  for each row execute function public.set_updated_at();
