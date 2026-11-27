-- Runs after Supabase Auth has created the auth schema.
-- Adds helpers that hosted Supabase provides but GoTrue migrations may not.
\set ON_ERROR_STOP on

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;
grant select on auth.users to service_role;
