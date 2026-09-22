-- 016: forward-only correction for defects identified in the GATE 011 audit
-- of migration 015 (which is already applied remotely and MUST NOT be
-- modified). Every statement below is additive or tightening:
--   (a) view-level write grants so the intended admin catalog writes work
--       through the security_invoker admin views (PostgREST enforces
--       privileges on the addressed view; base-table RLS remains the
--       authorization boundary, admin-only);
--   (b) a dedicated categories_admin view (015 granted base writes but
--       provided no admin view; writes must not ride the anon-readable
--       categories_public view);
--   (c) an admin bypass read policy on app.services so services_admin can
--       list disabled services (base services_public_read filters to
--       is_available = true);
--   (d) an admin predicate on branches_admin so the inactive M-Pesa number
--       is not visible to non-admin authenticated users;
--   (e) a narrowly scoped admin-only branch-settings RPC (DEFINER) with
--       server-side validation, so browser code never touches app.branches;
--   (f) removal of the lax direct-INSERT path on app.quote_requests so the
--       controlled SECURITY DEFINER RPC is the only creation path.
-- No anon grants are added anywhere. No base app tables are exposed.

-- ─── (a) view-level write grants for the admin catalog views ─────────────
-- Base-table RLS (products_admin_write / services_admin_write, admin-only
-- USING + WITH CHECK from 015) remains the real boundary; these grants only
-- let PostgREST address the view. Non-admin callers still fail closed on RLS.
-- Explicit revokes come FIRST: live probing showed anon holding SELECT on
-- staff/admin views whose migrations grant authenticated-only access
-- (consistent with an out-of-band blanket/default-privilege grant), so every
-- touched view is stripped for anon/public before the intended grant is made.
-- Revoking from the PUBLIC pseudo-role also strips authenticated, hence the
-- revoke-then-grant order in each section.
revoke all on public.products_admin from anon, public;
revoke all on public.services_admin from anon, public;
grant insert, update, delete on public.products_admin to authenticated;
grant insert, update, delete on public.services_admin to authenticated;

-- ─── (b) dedicated categories_admin view ──────────────────────────────────
drop view if exists public.categories_admin;
create view public.categories_admin with (security_invoker = true) as
select id, name, description
from app.categories
where (select app.request_role()) = 'admin';

revoke all on public.categories_admin from anon, public;
grant select, insert, update, delete on public.categories_admin to authenticated;

-- ─── (c) admin bypass read on app.services ────────────────────────────────
-- Without this, services_admin can never return disabled rows: the only base
-- SELECT policy (services_public_read) pre-filters is_available = true.
drop policy if exists services_admin_read on app.services;
create policy services_admin_read on app.services
  for select to authenticated
  using ((select app.request_role()) = 'admin');

-- ─── (d) admin predicate on branches_admin ────────────────────────────────
-- 015 relied on base RLS, but branches_public_read USING (true) passes every
-- authenticated caller and permissive policies combine with OR, so the view
-- leaked the inactive M-Pesa number. Match the products_admin pattern: the
-- view itself admits admins only.
drop view if exists public.branches_admin;
create view public.branches_admin with (security_invoker = true) as
select
  id, name, address, phone, whatsapp, opening_hours,
  mpesa_channel_type, mpesa_paybill_number, mpesa_till_number, mpesa_account_number
from app.branches
where (select app.request_role()) = 'admin';

revoke all on public.branches_admin from anon, public;
grant select on public.branches_admin to authenticated;

-- ─── (e) admin-only branch settings RPC ───────────────────────────────────
-- Browser/client code must not issue direct writes against app.branches (or a
-- same-named public relation). This DEFINER function is the only write path:
-- admin role enforced inside the body, field whitelist, server-side
-- normalization + format validation. The record id is a row selector only;
-- it is never assigned from caller input.
create or replace function public.admin_update_branch_settings(
  p_branch_id uuid,
  p_name text,
  p_address text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_opening_hours text default null,
  p_mpesa_channel_type text default null,
  p_mpesa_paybill_number text default null,
  p_mpesa_till_number text default null,
  p_mpesa_account_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = '' as
$func$
declare
  v_name text;
  v_address text;
  v_phone text;
  v_whatsapp text;
  v_opening_hours text;
  v_channel text;
  v_paybill text;
  v_till text;
  v_account text;
  v_row jsonb;
begin
  if (select app.request_role()) is distinct from 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  -- Name: required, trimmed, bounded, no control characters.
  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' or char_length(v_name) < 2 or char_length(v_name) > 200 then
    raise exception 'branch name must be 2-200 characters' using errcode = '22000';
  end if;
  if v_name ~ '[[:cntrl:]]' then
    raise exception 'branch name contains invalid characters' using errcode = '22000';
  end if;

  -- Optional free-text fields: empty becomes NULL, bounded, no controls.
  v_address := nullif(btrim(coalesce(p_address, '')), '');
  v_phone := nullif(btrim(coalesce(p_phone, '')), '');
  v_whatsapp := nullif(btrim(coalesce(p_whatsapp, '')), '');
  v_opening_hours := nullif(btrim(coalesce(p_opening_hours, '')), '');
  if char_length(coalesce(v_address, '')) > 300
     or char_length(coalesce(v_phone, '')) > 32
     or char_length(coalesce(v_whatsapp, '')) > 32
     or char_length(coalesce(v_opening_hours, '')) > 300 then
    raise exception 'branch field exceeds maximum length' using errcode = '22000';
  end if;
  if coalesce(v_address, '') ~ '[[:cntrl:]]'
     or coalesce(v_phone, '') ~ '[[:cntrl:]]'
     or coalesce(v_whatsapp, '') ~ '[[:cntrl:]]'
     or coalesce(v_opening_hours, '') ~ '[[:cntrl:]]' then
    raise exception 'branch field contains invalid characters' using errcode = '22000';
  end if;

  -- M-Pesa channel: null or exactly one of the two supported channels.
  v_channel := nullif(btrim(coalesce(p_mpesa_channel_type, '')), '');
  if v_channel is not null and v_channel not in ('paybill', 'till') then
    raise exception 'mpesa channel must be paybill or till' using errcode = '22000';
  end if;

  -- M-Pesa numbers: Kenyan Paybill/Till numbers are 5-7 digits. Empty → NULL.
  v_paybill := nullif(btrim(coalesce(p_mpesa_paybill_number, '')), '');
  v_till := nullif(btrim(coalesce(p_mpesa_till_number, '')), '');
  v_account := nullif(btrim(coalesce(p_mpesa_account_number, '')), '');
  if v_paybill is not null and v_paybill !~ '^[0-9]{5,7}$' then
    raise exception 'mpesa paybill number must be 5-7 digits' using errcode = '22000';
  end if;
  if v_till is not null and v_till !~ '^[0-9]{5,7}$' then
    raise exception 'mpesa till number must be 5-7 digits' using errcode = '22000';
  end if;
  if v_account is not null
     and (v_account !~ '^[A-Za-z0-9 _.\-]{1,32}$') then
    raise exception 'mpesa account number is malformed' using errcode = '22000';
  end if;

  update app.branches
  set name = v_name,
      address = v_address,
      phone = v_phone,
      whatsapp = v_whatsapp,
      opening_hours = v_opening_hours,
      mpesa_channel_type = v_channel,
      mpesa_paybill_number = v_paybill,
      mpesa_till_number = v_till,
      mpesa_account_number = v_account
  where id = p_branch_id
  returning to_jsonb(branches) into v_row;

  if v_row is null then
    raise exception 'branch not found' using errcode = '02000';
  end if;

  return v_row;
end;
$func$;

revoke execute on function public.admin_update_branch_settings(
  uuid, text, text, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.admin_update_branch_settings(
  uuid, text, text, text, text, text, text, text, text, text)
  to authenticated;

-- ─── (f) quote direct-INSERT hardening ─────────────────────────────────────
-- The only legitimate guest creation path is the SECURITY DEFINER RPC
-- public.create_quote_request (which runs as the table owner and forces
-- status/quote_number/secret_token server-side). Remove the direct path:
-- drop the lax anon/authenticated INSERT policy and revoke the INSERT grant.
-- SELECT/UPDATE grants and the staff UPDATE policy are untouched, as are all
-- RPC grants.
drop policy if exists quote_requests_insert on app.quote_requests;
revoke insert on app.quote_requests from anon, authenticated;
