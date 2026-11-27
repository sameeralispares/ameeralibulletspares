-- Local test stack bootstrap (NOT for production).
-- Recreates the parts of a hosted Supabase database that our migrations rely
-- on: roles, schemas, default privileges and the storage schema.
-- Run as a superuser on an EMPTY database before Supabase Auth migrations.

\set ON_ERROR_STOP on

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'local-authenticator';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login noinherit createrole password 'local-auth-admin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then
    create role supabase_storage_admin login noinherit password 'local-storage-admin';
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to supabase_storage_admin;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
alter role supabase_auth_admin set search_path = auth;

-- Supabase default privileges on the public schema
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage schema (subset matching hosted Supabase Storage)
-- ---------------------------------------------------------------------------
create schema if not exists storage authorization supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  owner_id         text,
  metadata         jsonb,
  path_tokens      text[] generated always as (string_to_array(name, '/')) stored,
  version          text,
  user_metadata    jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- Bucket metadata is readable (hosted Supabase exposes it via the API)
drop policy if exists "local: buckets readable" on storage.buckets;
create policy "local: buckets readable" on storage.buckets for select using (true);

-- Hosted Supabase Storage runs as the owner of the storage tables and switches
-- to the caller's role for each request; mirror that.
alter role supabase_storage_admin bypassrls;
grant all on storage.buckets, storage.objects to supabase_storage_admin;
