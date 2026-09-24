-- 020: v0.6A Quote Acceptance Snapshot & 7-Day Validity Enforcement
--
-- Implements V0.6A Quote Portal Foundation & Acceptance Evidence:
--   1. Immutable acceptance evidence ledger: app.quote_acceptances
--   2. RLS & security_invoker view public.quote_acceptances_staff
--   3. Dedicated RPC public.get_quote_acceptance for guest verification
--   4. Extend public.get_guest_quote to project accepted_at
--   5. Hardened public.customer_respond_to_quote: writes immutable acceptance
--      snapshot capturing offered_price, item_name, quantity, vehicle context,
--      validity, and token fingerprint WITHOUT exposing secret token
--   6. Hardened public.staff_respond_to_quote: strictly enforces server-side
--      quote validity ceiling (valid_until <= now() + 7 days, no past dates)

-- ─── 1. Base Table: app.quote_acceptances ───────────────────────────────────

create table if not exists app.quote_acceptances (
  id uuid primary key default extensions.gen_random_uuid(),
  quote_id uuid not null unique references app.quote_requests(id) on delete restrict,
  quote_number text not null,

  -- Commercial snapshot at acceptance time
  offered_price numeric(12, 2) not null check (offered_price >= 0),
  currency text not null default 'KES',
  item_type app.quote_item_type not null,
  item_name text not null,
  product_id uuid references app.products(id) on delete set null,
  service_id uuid references app.services(id) on delete set null,
  quantity integer not null check (quantity > 0),
  vehicle_fitment_id uuid references app.vehicle_fitments(id) on delete set null,
  vehicle_summary text,
  customer_notes text,
  valid_until timestamptz not null,

  -- Acceptance evidence & audit
  accepted_at timestamptz not null default pg_catalog.now(),
  acceptance_mechanism text not null check (acceptance_mechanism in ('guest_token', 'authenticated_user')),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  token_fingerprint text not null,

  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists quote_acceptances_quote_id_idx on app.quote_acceptances(quote_id);

-- ─── 2. Row Level Security on Base Table ─────────────────────────────────────

alter table app.quote_acceptances enable row level security;

-- Deny all direct table mutations; only staff can SELECT via security_invoker views
revoke all on app.quote_acceptances from anon, public;
revoke insert, update, delete on app.quote_acceptances from authenticated;
grant select on app.quote_acceptances to authenticated;

drop policy if exists quote_acceptances_staff_select on app.quote_acceptances;
create policy quote_acceptances_staff_select on app.quote_acceptances
  for select to authenticated
  using ((select app.request_role()) in ('admin', 'manager', 'cashier'));

-- ─── 3. Staff Projection View ───────────────────────────────────────────────

drop view if exists public.quote_acceptances_staff;
create view public.quote_acceptances_staff with (security_invoker = true) as
select
  a.id,
  a.quote_id,
  a.quote_number,
  a.offered_price,
  a.currency,
  a.item_type,
  a.item_name,
  a.product_id,
  a.service_id,
  a.quantity,
  a.vehicle_fitment_id,
  a.vehicle_summary,
  a.customer_notes,
  a.valid_until,
  a.accepted_at,
  a.acceptance_mechanism,
  a.customer_name,
  a.customer_phone,
  a.customer_email,
  a.token_fingerprint,
  a.created_at
from app.quote_acceptances a;

revoke all on public.quote_acceptances_staff from anon, public;
grant select on public.quote_acceptances_staff to authenticated;

-- ─── 4. RPC: Get Quote Acceptance Evidence (Guest Token Verified) ───────────

drop function if exists public.get_quote_acceptance(uuid, uuid);

create or replace function public.get_quote_acceptance(p_quote_id uuid, p_token uuid)
returns table (
  id uuid,
  quote_id uuid,
  quote_number text,
  offered_price numeric(12, 2),
  currency text,
  item_type app.quote_item_type,
  item_name text,
  quantity integer,
  vehicle_summary text,
  customer_notes text,
  valid_until timestamptz,
  accepted_at timestamptz,
  acceptance_mechanism text,
  customer_name text,
  customer_phone text,
  customer_email text,
  token_fingerprint text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    a.id,
    a.quote_id,
    a.quote_number,
    a.offered_price,
    a.currency,
    a.item_type,
    a.item_name,
    a.quantity,
    a.vehicle_summary,
    a.customer_notes,
    a.valid_until,
    a.accepted_at,
    a.acceptance_mechanism,
    a.customer_name,
    a.customer_phone,
    a.customer_email,
    a.token_fingerprint
  from app.quote_acceptances a
  join app.quote_requests q on q.id = a.quote_id
  where a.quote_id = p_quote_id and q.secret_token = p_token;
$$;

revoke all on function public.get_quote_acceptance(uuid, uuid) from public;
grant execute on function public.get_quote_acceptance(uuid, uuid) to anon, authenticated;

-- ─── 5. RPC: Get Guest Quote (Extended with accepted_at) ─────────────────────

drop function if exists public.get_guest_quote(uuid, uuid);

create or replace function public.get_guest_quote(p_quote_id uuid, p_token uuid)
returns table (
  id uuid,
  quote_number text,
  customer_name text,
  customer_phone text,
  customer_email text,
  item_type app.quote_item_type,
  product_name text,
  service_name text,
  vehicle_summary text,
  quantity integer,
  customer_notes text,
  status app.quote_status,
  offered_price numeric(12, 2),
  valid_until timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  accepted_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    q.id,
    q.quote_number,
    q.customer_name,
    q.customer_phone,
    q.customer_email,
    q.item_type,
    p.name as product_name,
    s.name as service_name,
    q.vehicle_summary,
    q.quantity,
    q.customer_notes,
    case
      when q.status = 'quoted' and q.valid_until is not null and q.valid_until < pg_catalog.now() then 'expired'::app.quote_status
      else q.status
    end as status,
    q.offered_price,
    q.valid_until,
    q.created_at,
    q.updated_at,
    a.accepted_at
  from app.quote_requests q
  left join app.products p on p.id = q.product_id
  left join app.services s on s.id = q.service_id
  left join app.quote_acceptances a on a.quote_id = q.id
  where q.id = p_quote_id and q.secret_token = p_token;
$$;

grant execute on function public.get_guest_quote(uuid, uuid) to anon, authenticated;

-- ─── 6. Hardened Customer Response RPC with Acceptance Snapshot ──────────────

create or replace function public.customer_respond_to_quote(
  p_quote_id uuid,
  p_action text,
  p_token uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote app.quote_requests%rowtype;
  v_user_id uuid;
  v_new_status app.quote_status;
  v_item_name text;
  v_mech text;
  v_fingerprint text;
begin
  if p_action not in ('accept', 'decline') then
    raise exception 'Invalid action. Must be accept or decline.';
  end if;

  v_new_status := case when p_action = 'accept' then 'accepted'::app.quote_status else 'declined'::app.quote_status end;
  v_user_id := (select auth.uid());

  select * into v_quote from app.quote_requests where app.quote_requests.id = p_quote_id;

  if not found then
    raise exception 'Quote not found';
  end if;

  -- Validate authorization: must be logged-in customer OR match secret_token
  if not (
    (v_user_id is not null and v_quote.customer_id = v_user_id) or
    (p_token is not null and v_quote.secret_token = p_token)
  ) then
    raise exception 'Unauthorized to respond to this quote';
  end if;

  -- Validate current status is 'quoted'
  if v_quote.status != 'quoted' then
    raise exception 'Quote cannot be updated in its current status';
  end if;

  -- Validate expiration
  if v_quote.valid_until is not null and v_quote.valid_until < pg_catalog.now() then
    raise exception 'Quote has expired and can no longer be accepted';
  end if;

  -- If accepting, atomically record immutable commercial acceptance evidence
  if p_action = 'accept' then
    if v_quote.offered_price is null or v_quote.offered_price < 0 then
      raise exception 'Cannot accept quote without a valid agreed price';
    end if;

    if v_quote.valid_until is null then
      raise exception 'Cannot accept quote without a valid expiration date';
    end if;

    -- Resolve item title snapshot
    if v_quote.product_id is not null then
      select name into v_item_name from app.products where id = v_quote.product_id;
    elsif v_quote.service_id is not null then
      select name into v_item_name from app.services where id = v_quote.service_id;
    end if;
    v_item_name := coalesce(v_item_name, 'Custom Inquiry');

    -- Derive acceptance authorization mechanism
    v_mech := case
      when v_user_id is not null and v_quote.customer_id = v_user_id then 'authenticated_user'
      else 'guest_token'
    end;

    -- Cryptographic SHA-256 fingerprint of secret token context WITHOUT exposing bearer token
    v_fingerprint := pg_catalog.encode(extensions.digest(v_quote.secret_token::text, 'sha256'), 'hex');

    -- Insert immutable acceptance evidence record
    insert into app.quote_acceptances (
      quote_id,
      quote_number,
      offered_price,
      currency,
      item_type,
      item_name,
      product_id,
      service_id,
      quantity,
      vehicle_fitment_id,
      vehicle_summary,
      customer_notes,
      valid_until,
      accepted_at,
      acceptance_mechanism,
      customer_name,
      customer_phone,
      customer_email,
      token_fingerprint
    ) values (
      v_quote.id,
      v_quote.quote_number,
      v_quote.offered_price,
      'KES',
      v_quote.item_type,
      v_item_name,
      v_quote.product_id,
      v_quote.service_id,
      v_quote.quantity,
      v_quote.vehicle_fitment_id,
      v_quote.vehicle_summary,
      v_quote.customer_notes,
      v_quote.valid_until,
      pg_catalog.now(),
      v_mech,
      v_quote.customer_name,
      v_quote.customer_phone,
      v_quote.customer_email,
      v_fingerprint
    );
  end if;

  -- Execute state transition (ZERO capability to mutate offered_price or staff fields)
  update app.quote_requests
  set status = v_new_status, updated_at = pg_catalog.now()
  where id = p_quote_id;

  return true;
end;
$$;

grant execute on function public.customer_respond_to_quote(uuid, text, uuid) to anon, authenticated;

-- ─── 7. Hardened Staff Response RPC with 7-Day Validity Ceiling ───────────────

create or replace function public.staff_respond_to_quote(
  p_quote_id uuid,
  p_status app.quote_status,
  p_offered_price numeric default null,
  p_valid_until timestamptz default null,
  p_staff_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_staff_id uuid;
  v_current_status app.quote_status;
begin
  -- 1. Strictly enforce Admin and Manager role requirement. Cashiers and anon are strictly forbidden.
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin', 'manager') then
    raise exception 'Forbidden: Only Admin and Manager roles are authorized to manage quote pricing';
  end if;

  -- 2. Fetch current quote status
  select status into v_current_status
  from app.quote_requests
  where id = p_quote_id;

  if not found then
    raise exception 'Quote not found';
  end if;

  -- 3. Authoritative State-Machine Validation:
  -- Allowed staff transitions ONLY:
  -- new -> under_review
  -- under_review -> quoted
  -- ALL other transitions, including quoted -> quoted, quoted -> under_review, terminal states, etc. are strictly FORBIDDEN.
  if v_current_status = 'new' then
    if p_status != 'under_review' then
      raise exception 'Invalid state transition from new to %: quotes must be moved to under_review before pricing', p_status;
    end if;
  elsif v_current_status = 'under_review' then
    if p_status != 'quoted' then
      raise exception 'Invalid state transition from under_review to %', p_status;
    end if;

    -- Enforce pricing constraints
    if p_offered_price is null or p_offered_price <= 0 then
      raise exception 'A valid offered price (> 0) is required to quote this request';
    end if;

    -- Enforce 7-day validity constraint (LOCKED BUSINESS DECISION)
    if p_valid_until is null then
      raise exception 'Quote validity timestamp (valid_until) is required';
    end if;

    if p_valid_until < pg_catalog.now() then
      raise exception 'Quote validity timestamp cannot be in the past';
    end if;

    if p_valid_until > (pg_catalog.now() + interval '7 days') then
      raise exception 'Quote validity cannot exceed 7 calendar days from issuance';
    end if;

  elsif v_current_status = 'quoted' then
    raise exception 'Invalid state transition: quote is already in quoted status and cannot be modified by staff';
  else
    raise exception 'Cannot transition quote in status %: quote is in a terminal or customer-managed state', v_current_status;
  end if;

  -- 4. Derive staff id from auth.uid()
  select id into v_staff_id from app.staff_users where auth_user_id = (select auth.uid());

  -- 5. Execute state transition and update fields
  update app.quote_requests
  set
    status = p_status,
    offered_price = coalesce(p_offered_price, offered_price),
    valid_until = coalesce(p_valid_until, valid_until),
    staff_notes = coalesce(p_staff_notes, staff_notes),
    responded_by = coalesce(v_staff_id, responded_by),
    responded_at = case when p_status = 'quoted' then pg_catalog.now() else responded_at end,
    updated_at = pg_catalog.now()
  where id = p_quote_id;

  return true;
end;
$$;

revoke execute on function public.staff_respond_to_quote(uuid, app.quote_status, numeric, timestamptz, text) from public, anon;
grant execute on function public.staff_respond_to_quote(uuid, app.quote_status, numeric, timestamptz, text) to authenticated;
