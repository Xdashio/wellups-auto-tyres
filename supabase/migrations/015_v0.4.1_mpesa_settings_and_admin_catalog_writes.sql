-- 015: two things needed so nothing about the live business has to be hardcoded
-- while we wait on client data:
--   (a) M-Pesa channel becomes a branch setting (paybill/till + number + which
--       one is currently active), editable from Admin Settings, same pattern
--       as the existing contact fields.
--   (b) Admin gets write access to the product/service catalog. v0.1 revoked
--       all client writes to app.products/app.services deliberately (no catalog
--       UI existed yet); this migration adds an admin-only write policy so the
--       catalog can be populated/edited from the app once real data arrives,
--       instead of being seeded by hand.

alter table app.branches
  add column mpesa_channel_type text check (mpesa_channel_type in ('paybill', 'till')),
  add column mpesa_paybill_number text,
  add column mpesa_till_number text,
  add column mpesa_account_number text; -- paybill account number, if applicable

-- Refresh the public projection to include the active channel + its number only
-- (never both numbers at once — mirrors the "single active channel" business rule).
drop view if exists public.branches_public;
create view public.branches_public with (security_invoker = true) as
select
  id, name, address, phone, whatsapp, opening_hours,
  mpesa_channel_type,
  case mpesa_channel_type
    when 'paybill' then mpesa_paybill_number
    when 'till' then mpesa_till_number
    else null
  end as mpesa_active_number,
  mpesa_account_number
from app.branches;

grant select on public.branches_public to anon, authenticated;

-- Admin-only read of the RAW branch record (both M-Pesa numbers, not just the
-- active one) so the settings form can switch channels without losing the
-- inactive number. app.branches has no base-table select grant at all (v0.1
-- revoked it), so this view needs its own row-level read policy.
create policy branches_admin_read on app.branches
  for select to authenticated
  using ((select app.request_role()) = 'admin');

grant select on app.branches to authenticated;

drop view if exists public.branches_admin;
create view public.branches_admin with (security_invoker = true) as
select
  id, name, address, phone, whatsapp, opening_hours,
  mpesa_channel_type, mpesa_paybill_number, mpesa_till_number, mpesa_account_number
from app.branches;

grant select on public.branches_admin to authenticated;

-- Admin-only catalog writes (products)
grant insert, update, delete on app.products to authenticated;

create policy products_admin_write on app.products
  for all to authenticated
  using ((select app.request_role()) = 'admin')
  with check ((select app.request_role()) = 'admin');

-- Admin-only catalog writes (services). services_public filters to
-- is_available = true, which would hide disabled services from the admin
-- list and make them impossible to re-enable — so admin gets its own
-- unfiltered read/write view, same pattern as products_admin.
grant insert, update, delete on app.services to authenticated;

create policy services_admin_write on app.services
  for all to authenticated
  using ((select app.request_role()) = 'admin')
  with check ((select app.request_role()) = 'admin');

drop view if exists public.services_admin;
create view public.services_admin with (security_invoker = true) as
select id, name, description, vehicle_types, is_available, created_at
from app.services
where (select app.request_role()) = 'admin';

grant select on public.services_admin to authenticated;

-- Categories: admin can also manage categories (products reference them),
-- previously fail-closed with no writer at all.
grant insert, update, delete on app.categories to authenticated;

create policy categories_admin_write on app.categories
  for all to authenticated
  using ((select app.request_role()) = 'admin')
  with check ((select app.request_role()) = 'admin');
