-- 012: v0.3 Quote System Schema, RLS, Functions, and Projection Views

-- 1. Create Quote Enum Types (in unexposed `app` schema)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_item_type' and typnamespace = 'app'::regnamespace) then
    create type app.quote_item_type as enum ('product', 'service', 'custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_status' and typnamespace = 'app'::regnamespace) then
    create type app.quote_status as enum ('new', 'under_review', 'quoted', 'accepted', 'declined', 'expired');
  end if;
end
$$;

-- 2. Create Quote Sequence for Quote Numbers
create sequence if not exists app.quote_number_seq start 1;

-- Function to generate sequential quote number e.g. QT-2026-00001
create or replace function app.generate_quote_number()
returns text
language plpgsql
as $$
declare
  v_seq bigint;
  v_year text;
begin
  select nextval('app.quote_number_seq') into v_seq;
  select to_char(now(), 'YYYY') into v_year;
  return 'QT-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

-- 3. Base Table: app.quote_requests
create table if not exists app.quote_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  quote_number text not null unique default app.generate_quote_number(),
  branch_id uuid not null references app.branches(id) on delete restrict,
  customer_id uuid references auth.users(id) on delete set null,
  
  -- Contact Details
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  
  -- Item & Vehicle Details
  item_type app.quote_item_type not null,
  product_id uuid references app.products(id) on delete set null,
  service_id uuid references app.services(id) on delete set null,
  vehicle_fitment_id uuid references app.vehicle_fitments(id) on delete set null,
  vehicle_summary text,
  quantity int not null default 1 check (quantity > 0),
  customer_notes text,
  
  -- Staff Response & Pricing
  status app.quote_status not null default 'new',
  offered_price numeric(12,2) check (offered_price >= 0),
  valid_until timestamptz,
  staff_notes text,
  responded_by uuid references app.staff_users(id) on delete set null,
  responded_at timestamptz,
  
  -- Security Token for Guest Access
  secret_token uuid not null default extensions.gen_random_uuid(),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists quote_requests_customer_id_idx on app.quote_requests(customer_id);
create index if not exists quote_requests_status_idx on app.quote_requests(status);
create index if not exists quote_requests_quote_number_idx on app.quote_requests(quote_number);

-- 4. Enable RLS on app.quote_requests
alter table app.quote_requests enable row level security;

-- 5. RLS Policies for app.quote_requests
drop policy if exists quote_requests_insert on app.quote_requests;
create policy quote_requests_insert on app.quote_requests
  for insert to anon, authenticated
  with check (
    customer_name is not null and char_length(trim(customer_name)) > 0 and
    customer_phone is not null and char_length(trim(customer_phone)) > 0
  );

drop policy if exists quote_requests_staff_select on app.quote_requests;
create policy quote_requests_staff_select on app.quote_requests
  for select to authenticated
  using (
    (select app.request_role()) in ('admin', 'manager', 'cashier') or
    customer_id = (select auth.uid())
  );

drop policy if exists quote_requests_staff_update on app.quote_requests;
create policy quote_requests_staff_update on app.quote_requests
  for update to authenticated
  using (
    (select app.request_role()) in ('admin', 'manager', 'cashier') or
    (customer_id = (select auth.uid()) and status = 'quoted')
  )
  with check (
    (select app.request_role()) in ('admin', 'manager', 'cashier') or
    (customer_id = (select auth.uid()) and status in ('accepted', 'declined'))
  );

-- Revoke all permissions on base table from anon and authenticated (except specific grants)
revoke all on app.quote_requests from anon, authenticated;
grant insert, select, update on app.quote_requests to anon, authenticated;

-- 6. RPC Function for Guest Quote Retrieval by Secret Token
create or replace function app.get_guest_quote(p_quote_id uuid, p_token uuid)
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
    q.status,
    q.offered_price,
    q.valid_until,
    q.created_at,
    q.updated_at
  from app.quote_requests q
  left join app.products p on p.id = q.product_id
  left join app.services s on s.id = q.service_id
  where q.id = p_quote_id and q.secret_token = p_token;
$$;

grant execute on function app.get_guest_quote(uuid, uuid) to anon, authenticated;

-- 7. Projection Views (security_invoker = true)

-- Public / Customer Quote View
drop view if exists public.quote_requests_customer;
create view public.quote_requests_customer with (security_invoker = true) as
select
  q.id,
  q.quote_number,
  q.item_type,
  q.product_id,
  p.name as product_name,
  p.sku as product_sku,
  p.brand as product_brand,
  p.size_spec as product_size_spec,
  q.service_id,
  s.name as service_name,
  q.vehicle_summary,
  q.quantity,
  q.customer_notes,
  q.status,
  q.offered_price,
  q.valid_until,
  q.created_at,
  q.updated_at,
  q.customer_id
from app.quote_requests q
left join app.products p on p.id = q.product_id
left join app.services s on s.id = q.service_id;

-- Staff Quote Queue View
drop view if exists public.quote_requests_staff;
create view public.quote_requests_staff with (security_invoker = true) as
select
  q.id,
  q.quote_number,
  q.branch_id,
  q.customer_id,
  q.customer_name,
  q.customer_phone,
  q.customer_email,
  q.item_type,
  q.product_id,
  p.name as product_name,
  p.sku as product_sku,
  p.brand as product_brand,
  p.size_spec as product_size_spec,
  q.service_id,
  s.name as service_name,
  q.vehicle_summary,
  q.quantity,
  q.customer_notes,
  q.status,
  q.offered_price,
  q.valid_until,
  q.staff_notes,
  q.responded_by,
  q.responded_at,
  q.secret_token,
  q.created_at,
  q.updated_at
from app.quote_requests q
left join app.products p on p.id = q.product_id
left join app.services s on s.id = q.service_id;

grant select on public.quote_requests_customer to anon, authenticated;
grant select on public.quote_requests_staff to authenticated;
