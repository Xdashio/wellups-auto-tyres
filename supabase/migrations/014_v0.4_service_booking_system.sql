-- 014: v0.4 Service Booking System Schema, RLS, Views, and Security Definer RPCs

-- 1. Create Booking Status Enum in unexposed app schema
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status' and typnamespace = 'app'::regnamespace) then
    create type app.booking_status as enum (
      'new',
      'under_review',
      'scheduled',
      'completed',
      'cancelled',
      'declined'
    );
  end if;
end
$$;

-- 2. Sequence & Sequential Booking Reference Generator: BK-YYYY-XXXXX
create sequence if not exists app.booking_number_seq start 1;

create or replace function app.generate_booking_number()
returns text
language plpgsql
as $$
declare
  v_seq bigint;
  v_year text;
begin
  select nextval('app.booking_number_seq') into v_seq;
  select to_char(now(), 'YYYY') into v_year;
  return 'BK-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

-- 3. Base Table: app.service_bookings
create table if not exists app.service_bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_number text not null unique default app.generate_booking_number(),
  branch_id uuid not null references app.branches(id) on delete restrict,
  service_id uuid not null references app.services(id) on delete restrict,
  customer_id uuid references auth.users(id) on delete set null,

  -- Customer Information
  customer_name text not null check (char_length(trim(customer_name)) > 0),
  customer_phone text not null check (char_length(trim(customer_phone)) > 0),
  customer_email text,

  -- Requested Schedule & Vehicle Information
  requested_date date not null,
  requested_time text not null check (requested_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  vehicle_fitment_id uuid references app.vehicle_fitments(id) on delete set null,
  vehicle_summary text,
  customer_notes text,

  -- Authoritative State Machine & Staff Execution
  status app.booking_status not null default 'new',
  scheduled_at timestamptz,
  staff_notes text,
  handled_by uuid references app.staff_users(id) on delete set null,
  responded_at timestamptz,

  -- Guest Access Bearer Token (strictly read-only)
  secret_token uuid not null default extensions.gen_random_uuid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Performance Indexes
create index if not exists service_bookings_branch_id_idx on app.service_bookings(branch_id);
create index if not exists service_bookings_service_id_idx on app.service_bookings(service_id);
create index if not exists service_bookings_customer_id_idx on app.service_bookings(customer_id);
create index if not exists service_bookings_status_idx on app.service_bookings(status);
create index if not exists service_bookings_booking_number_idx on app.service_bookings(booking_number);
create index if not exists service_bookings_requested_date_idx on app.service_bookings(requested_date);
create index if not exists service_bookings_scheduled_at_idx on app.service_bookings(scheduled_at);

-- 4. Enable RLS on app.service_bookings
alter table app.service_bookings enable row level security;

-- Policies on base table:
-- SELECT Policy: Staff (admin, manager, cashier) or matching authenticated customer
drop policy if exists service_bookings_staff_select on app.service_bookings;
create policy service_bookings_staff_select on app.service_bookings
  for select to authenticated
  using (
    (select app.request_role()) in ('admin', 'manager', 'cashier') or
    (customer_id is not null and customer_id = (select auth.uid()))
  );

-- Fail-closed staff update policy on base table (defense-in-depth behind RPC)
drop policy if exists service_bookings_staff_update on app.service_bookings;
create policy service_bookings_staff_update on app.service_bookings
  for update to authenticated
  using (
    (select app.request_role()) in ('admin', 'manager') or
    ((select app.request_role()) = 'cashier' and status = 'scheduled')
  )
  with check (
    (select app.request_role()) in ('admin', 'manager') or
    ((select app.request_role()) = 'cashier' and status = 'completed')
  );

-- Minimum underlying grants: NO direct INSERT or UPDATE for anon/authenticated
revoke all on app.service_bookings from public, anon, authenticated;
grant usage on schema app to anon, authenticated, postgres, service_role;
grant select on app.service_bookings to authenticated;
grant all on app.service_bookings to postgres, service_role;

-- 5. Projection Views (security_invoker = true)

-- Public / Customer Projection View
drop view if exists public.service_bookings_customer;
create view public.service_bookings_customer with (security_invoker = true) as
select
  b.id,
  b.booking_number,
  b.branch_id,
  b.service_id,
  s.name as service_name,
  b.requested_date,
  b.requested_time,
  b.vehicle_summary,
  b.customer_notes,
  b.status,
  b.scheduled_at,
  b.created_at,
  b.updated_at,
  b.customer_id
from app.service_bookings b
left join app.services s on s.id = b.service_id;

-- Staff Queue Projection View
drop view if exists public.service_bookings_staff;
create view public.service_bookings_staff with (security_invoker = true) as
select
  b.id,
  b.booking_number,
  b.branch_id,
  b.customer_id,
  b.customer_name,
  b.customer_phone,
  b.customer_email,
  b.service_id,
  s.name as service_name,
  b.requested_date,
  b.requested_time,
  b.vehicle_summary,
  b.customer_notes,
  b.status,
  b.scheduled_at,
  b.staff_notes,
  b.handled_by,
  b.responded_at,
  b.secret_token,
  b.created_at,
  b.updated_at
from app.service_bookings b
left join app.services s on s.id = b.service_id;

grant select on public.service_bookings_customer to authenticated;
grant select on public.service_bookings_staff to authenticated;

-- 6. RPC: Create Service Booking (Customer / Guest Submission)
create or replace function public.create_service_booking(
  p_service_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_requested_date date default null,
  p_requested_time text default null,
  p_vehicle_fitment_id uuid default null,
  p_vehicle_summary text default null,
  p_customer_notes text default null
)
returns table (
  id uuid,
  booking_number text,
  secret_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_id uuid;
  v_booking_number text;
  v_secret_token uuid;
  v_branch_id uuid;
  v_service_exists boolean;
begin
  -- Validate required inputs
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Customer name is required';
  end if;
  if p_customer_phone is null or length(trim(p_customer_phone)) = 0 then
    raise exception 'Customer phone number is required';
  end if;
  if p_requested_date is null then
    raise exception 'Requested date is required';
  end if;
  if p_requested_date < current_date then
    raise exception 'Requested date cannot be in the past';
  end if;
  if p_requested_time is null or not (p_requested_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
    raise exception 'Requested time is required and must be in 24-hour HH:MM format';
  end if;

  -- Derive operational branch server-side (single branch architecture)
  select b.id into v_branch_id from app.branches b limit 1;
  if v_branch_id is null then
    raise exception 'Operational branch configuration not found';
  end if;

  -- Validate service existence and availability using existing app.services schema
  select exists(
    select 1 from app.services s
    where s.id = p_service_id and s.is_available = true
  ) into v_service_exists;

  if not v_service_exists then
    raise exception 'Specified service is not available for booking';
  end if;

  -- Explicit customer_id = NULL in v0.4 (guest-capable, no customer account model)
  insert into app.service_bookings (
    branch_id,
    service_id,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    requested_date,
    requested_time,
    vehicle_fitment_id,
    vehicle_summary,
    customer_notes,
    status
  ) values (
    v_branch_id,
    p_service_id,
    null,
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(p_customer_email), ''),
    p_requested_date,
    trim(p_requested_time),
    p_vehicle_fitment_id,
    nullif(trim(p_vehicle_summary), ''),
    nullif(trim(p_customer_notes), ''),
    'new'
  )
  returning app.service_bookings.id, app.service_bookings.booking_number, app.service_bookings.secret_token
  into v_new_id, v_booking_number, v_secret_token;

  return query select v_new_id, v_booking_number, v_secret_token;
end;
$$;

revoke execute on function public.create_service_booking(
  uuid, text, text, text, date, text, uuid, text, text
) from public;
grant execute on function public.create_service_booking(
  uuid, text, text, text, date, text, uuid, text, text
) to anon, authenticated;

-- 7. RPC: Get Guest Booking (Read-Only Status Tracking by Secret Token)
create or replace function public.get_guest_booking(
  p_booking_id uuid,
  p_token uuid
)
returns table (
  id uuid,
  booking_number text,
  service_id uuid,
  service_name text,
  requested_date date,
  requested_time text,
  vehicle_summary text,
  customer_notes text,
  status app.booking_status,
  scheduled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    b.id,
    b.booking_number,
    b.service_id,
    s.name as service_name,
    b.requested_date,
    b.requested_time,
    b.vehicle_summary,
    b.customer_notes,
    b.status,
    b.scheduled_at,
    b.created_at,
    b.updated_at
  from app.service_bookings b
  left join app.services s on s.id = b.service_id
  where b.id = p_booking_id and b.secret_token = p_token;
$$;

revoke execute on function public.get_guest_booking(uuid, uuid) from public;
grant execute on function public.get_guest_booking(uuid, uuid) to anon, authenticated;

-- 8. RPC: Staff Manage Booking (Authoritative State Machine & Role Guardrails)
create or replace function public.staff_manage_booking(
  p_booking_id uuid,
  p_status app.booking_status,
  p_scheduled_at timestamptz default null,
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
  v_current_status app.booking_status;
begin
  -- 1. Extract authenticated role from JWT
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin', 'manager', 'cashier') then
    raise exception 'Forbidden: Only authenticated staff roles (admin, manager, cashier) are authorized to manage bookings';
  end if;

  -- 2. Fetch existing booking status
  select status
  into v_current_status
  from app.service_bookings
  where app.service_bookings.id = p_booking_id;

  if not found then
    raise exception 'Booking not found';
  end if;

  -- 3. Derive staff ID from app.staff_users
  select id into v_staff_id
  from app.staff_users
  where auth_user_id = (select auth.uid());

  -- 4. Role Guardrails and Authoritative State Machine
  if v_role = 'cashier' then
    -- Cashier is strictly restricted to scheduled -> completed
    if v_current_status != 'scheduled' or p_status != 'completed' then
      raise exception 'Forbidden: Cashiers are only authorized to transition bookings from scheduled to completed';
    end if;
    -- Cashier must NOT supply scheduled_at or staff_notes
    if p_scheduled_at is not null or (p_staff_notes is not null and length(trim(p_staff_notes)) > 0) then
      raise exception 'Forbidden: Cashiers cannot modify appointment schedule or staff notes';
    end if;

    update app.service_bookings
    set
      status = 'completed',
      handled_by = coalesce(v_staff_id, handled_by),
      responded_at = now(),
      updated_at = now()
    where id = p_booking_id;

    return true;

  elsif v_role in ('admin', 'manager') then
    -- Admin and Manager State Transitions with Strict Parameter Guardrails
    if v_current_status = 'new' then
      if p_status not in ('under_review', 'declined') then
        raise exception 'Invalid state transition from new to %: allowed targets are under_review or declined', p_status;
      end if;
      if p_scheduled_at is not null then
        raise exception 'p_scheduled_at must be null when transitioning from new to %', p_status;
      end if;

    elsif v_current_status = 'under_review' then
      if p_status not in ('scheduled', 'declined') then
        raise exception 'Invalid state transition from under_review to %: allowed targets are scheduled or declined', p_status;
      end if;
      if p_status = 'declined' and p_scheduled_at is not null then
        raise exception 'p_scheduled_at must be null when declining a booking';
      end if;
      if p_status = 'scheduled' then
        if p_scheduled_at is null then
          raise exception 'A valid scheduled_at timestamp is required when moving booking to scheduled';
        end if;
        if p_scheduled_at < now() then
          raise exception 'Confirmed scheduled_at appointment cannot be in the past';
        end if;
      end if;

    elsif v_current_status = 'scheduled' then
      if p_status not in ('completed', 'cancelled') then
        raise exception 'Invalid state transition from scheduled to %: allowed targets are completed or cancelled', p_status;
      end if;
      if p_scheduled_at is not null then
        raise exception 'p_scheduled_at must be null when transitioning from scheduled to %', p_status;
      end if;

    elsif v_current_status in ('completed', 'cancelled', 'declined') then
      raise exception 'Cannot transition booking in terminal status %', v_current_status;

    else
      raise exception 'Unknown booking status: %', v_current_status;
    end if;

    update app.service_bookings
    set
      status = p_status,
      scheduled_at = case
        when p_status = 'scheduled' then p_scheduled_at
        else scheduled_at
      end,
      staff_notes = coalesce(p_staff_notes, staff_notes),
      handled_by = coalesce(v_staff_id, handled_by),
      responded_at = now(),
      updated_at = now()
    where id = p_booking_id;

    return true;

  else
    raise exception 'Forbidden: Unauthorized role %', v_role;
  end if;
end;
$$;

revoke execute on function public.staff_manage_booking(uuid, app.booking_status, timestamptz, text) from public, anon;
grant execute on function public.staff_manage_booking(uuid, app.booking_status, timestamptz, text) to authenticated;
