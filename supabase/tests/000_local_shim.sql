-- LOCAL-TEST SHIM ONLY. Never applied to Supabase: hosted projects provide
-- auth.users, auth.jwt() and auth.uid() natively. This file recreates their
-- observable contract on a vanilla Postgres test database so migrations and
-- pgTAP tests can run without Docker or a hosted project.
-- Load order: shim -> migrations -> tests. The shim is tracked so CI is reproducible,
-- but it must never be moved into supabase/migrations/.
create schema if not exists auth;
-- Supabase provides the extensions schema natively; recreate it locally.
create schema if not exists extensions;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

-- Mirrors Supabase auth.jwt(): reads the request JWT claims GUC populated by
-- PostgREST. Tests set it via set_config('request.jwt.claims', '<json>', true).
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

-- Supabase grants these natively; recreate the grants locally.
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
