-- 001: application schema + client-role safety.
-- Base tables live in `app`, which is never exposed through the Data API.
-- Supabase projects already provide anon/authenticated/service_role;
-- the DO block only fills the gap on fresh local test databases.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists app;

create extension if not exists pgcrypto with schema extensions;
