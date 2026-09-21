-- 013: v0.3 Quote System Security Hardening & Dedicated RPC Architecture

-- 1. Move get_guest_quote to public schema
drop function if exists app.get_guest_quote(uuid, uuid);
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
  quantity int,
  customer_notes text,
  status app.quote_status,
  offered_price numeric(12,2),
  valid_until timestamptz,
  created_at timestamptz,
  updated_at timestamptz
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
      when q.status = 'quoted' and q.valid_until is not null and q.valid_until < now() then 'expired'::app.quote_status
      else q.status
    end as status,
    q.offered_price,
    q.valid_until,
    q.created_at,
    q.updated_at
  from app.quote_requests q
  left join app.products p on p.id = q.product_id
  left join app.services s on s.id = q.service_id
  where q.id = p_quote_id and q.secret_token = p_token;
$$;

grant execute on function public.get_guest_quote(uuid, uuid) to anon, authenticated;

-- 2. Dedicated RPC for Guest & Customer Quote Creation
create or replace function public.create_quote_request(
  p_branch_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_item_type app.quote_item_type default 'product',
  p_product_id uuid default null,
  p_service_id uuid default null,
  p_vehicle_fitment_id uuid default null,
  p_vehicle_summary text default null,
  p_quantity int default 1,
  p_customer_notes text default null
)
returns table (
  id uuid,
  quote_number text,
  secret_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_id uuid;
  v_quote_number text;
  v_secret_token uuid;
  v_customer_id uuid;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Customer name is required';
  end if;
  if p_customer_phone is null or length(trim(p_customer_phone)) = 0 then
    raise exception 'Customer phone number is required';
  end if;

  v_customer_id := (select auth.uid());

  insert into app.quote_requests (
    branch_id,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    item_type,
    product_id,
    service_id,
    vehicle_fitment_id,
    vehicle_summary,
    quantity,
    customer_notes,
    status
  ) values (
    p_branch_id,
    v_customer_id,
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(p_customer_email), ''),
    p_item_type,
    p_product_id,
    p_service_id,
    p_vehicle_fitment_id,
    nullif(trim(p_vehicle_summary), ''),
    greatest(coalesce(p_quantity, 1), 1),
    nullif(trim(p_customer_notes), ''),
    'new'
  )
  returning app.quote_requests.id, app.quote_requests.quote_number, app.quote_requests.secret_token
  into v_new_id, v_quote_number, v_secret_token;

  return query select v_new_id, v_quote_number, v_secret_token;
end;
$$;

grant execute on function public.create_quote_request(uuid, text, text, text, app.quote_item_type, uuid, uuid, uuid, text, int, text) to anon, authenticated;

-- 3. Dedicated RPC for Customer Response (Accept / Decline ONLY)
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
  if v_quote.valid_until is not null and v_quote.valid_until < now() then
    raise exception 'Quote has expired and can no longer be accepted';
  end if;

  -- Execute ONLY status transition (ZERO capability to mutate offered_price or staff fields)
  update app.quote_requests
  set status = v_new_status, updated_at = now()
  where id = p_quote_id;

  return true;
end;
$$;

grant execute on function public.customer_respond_to_quote(uuid, text, uuid) to anon, authenticated;

-- 4. Dedicated RPC for Staff Pricing & Response (Admin and Manager ONLY)
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
  -- Allowed staff transitions:
  -- new -> under_review
  -- under_review -> quoted
  -- quoted -> quoted (revising price/notes while remaining in quoted status)
  if v_current_status = 'new' then
    if p_status != 'under_review' then
      raise exception 'Invalid state transition from new to %: quotes must be moved to under_review before pricing', p_status;
    end if;
  elsif v_current_status = 'under_review' then
    if p_status != 'quoted' then
      raise exception 'Invalid state transition from under_review to %', p_status;
    end if;
  elsif v_current_status = 'quoted' then
    if p_status != 'quoted' then
      raise exception 'Invalid state transition from quoted to %: staff cannot directly transition quoted quotes to %', p_status, p_status;
    end if;
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
    responded_at = case when p_status = 'quoted' then now() else responded_at end,
    updated_at = now()
  where id = p_quote_id;

  return true;
end;
$$;

revoke execute on function public.staff_respond_to_quote(uuid, app.quote_status, numeric, timestamptz, text) from public, anon;
grant execute on function public.staff_respond_to_quote(uuid, app.quote_status, numeric, timestamptz, text) to authenticated;

-- 5. Hardened RLS Policies on app.quote_requests
-- Grant USAGE on unexposed schema app so SECURITY DEFINER functions function properly
grant usage on schema app to anon, authenticated, postgres, service_role;
grant insert, select, update on app.quote_requests to anon, authenticated, postgres, service_role;

-- Fail-closed staff update policy: Admin and Manager ONLY (Cashier is strictly read-only)
drop policy if exists quote_requests_staff_update on app.quote_requests;
create policy quote_requests_staff_update on app.quote_requests
  for update to authenticated
  using ((select app.request_role()) in ('admin', 'manager'))
  with check ((select app.request_role()) in ('admin', 'manager'));
