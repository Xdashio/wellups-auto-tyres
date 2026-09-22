-- 011: Configurable Branch Settings RLS & Public Projection Policies

-- 1. Grant update on app.branches to authenticated users
grant update on app.branches to authenticated;

-- 2. Admin-only update policy on app.branches
drop policy if exists branches_admin_update on app.branches;
create policy branches_admin_update on app.branches
  for update to authenticated
  using ((select app.request_role()) = 'admin')
  with check ((select app.request_role()) = 'admin');

-- 3. Verify public projection view
drop view if exists public.branches_public;
create view public.branches_public with (security_invoker = true) as
select id, name, address, phone, whatsapp, opening_hours
from app.branches;

grant select on public.branches_public to anon, authenticated;
