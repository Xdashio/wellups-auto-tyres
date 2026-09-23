-- 019: v0.5 Core POS and Inventory Implementation
--
-- Implements the documented v0.5 POS & Inventory architecture:
--   - Deterministic sale numbering sequence (SAL-YYYY-XXXXX)
--   - Base tables in unexposed app schema: app.sales, app.sale_items, app.inventory_movements
--   - Historical price and cost snapshotting on app.sale_items for accurate audit and margin
--   - Append-only inventory movement ledger tracking sale stock deductions
--   - Atomic checkout RPC public.pos_complete_sale with deterministic row locking (FOR UPDATE)
--   - Role-tiered projections (sales_cashier, sales_manager, sales_admin) preserving financial isolation
--   - Update products_cashier view to project sell_price while omitting cost_price and margin

-- ─── 1. Sale Number Sequence & Generator ─────────────────────────────────────

create sequence if not exists app.sale_number_seq start 1;

create or replace function app.generate_sale_number()
returns text
language plpgsql
as $$
declare
  v_seq bigint;
  v_year text;
begin
  select nextval('app.sale_number_seq') into v_seq;
  select to_char(now(), 'YYYY') into v_year;
  return 'SAL-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

-- ─── 2. Base Tables in `app` Schema ──────────────────────────────────────────

-- Sales header: captures immutable sale metadata and server-derived total.
create table if not exists app.sales (
  id uuid primary key default extensions.gen_random_uuid(),
  sale_number text not null unique default app.generate_sale_number(),
  branch_id uuid not null references app.branches (id) on delete restrict,
  cashier_id uuid not null references app.staff_users (id) on delete restrict,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status text not null default 'completed' check (status = 'completed'),
  created_at timestamptz not null default now()
);

create index if not exists sales_branch_id_idx on app.sales (branch_id);
create index if not exists sales_cashier_id_idx on app.sales (cashier_id);
create index if not exists sales_created_at_idx on app.sales (created_at desc);

-- Sale line items: snapshots authoritative price and cost at sale time.
create table if not exists app.sale_items (
  id uuid primary key default extensions.gen_random_uuid(),
  sale_id uuid not null references app.sales (id) on delete cascade,
  product_id uuid not null references app.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_at_sale numeric(12, 2) not null check (unit_price_at_sale >= 0),
  unit_cost_at_sale numeric(12, 2) not null check (unit_cost_at_sale >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint sale_items_line_total_check check (line_total = quantity * unit_price_at_sale)
);

create index if not exists sale_items_sale_id_idx on app.sale_items (sale_id);
create index if not exists sale_items_product_id_idx on app.sale_items (product_id);

-- Append-only inventory movements ledger: tracks stock deductions per sale.
create table if not exists app.inventory_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  branch_id uuid not null references app.branches (id) on delete restrict,
  product_id uuid not null references app.products (id) on delete restrict,
  reference_type text not null check (reference_type = 'sale'),
  reference_id uuid not null references app.sales (id) on delete cascade,
  quantity_change integer not null check (quantity_change < 0),
  balance_after integer not null check (balance_after >= 0),
  created_by uuid not null references app.staff_users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists inv_movements_product_id_idx on app.inventory_movements (product_id, created_at desc);
create index if not exists inv_movements_reference_id_idx on app.inventory_movements (reference_id);

-- ─── 3. Row-Level Security on Base Tables ─────────────────────────────────────

alter table app.sales enable row level security;
alter table app.sale_items enable row level security;
alter table app.inventory_movements enable row level security;

-- Base-table access is denied to anon completely.
revoke all on app.sales from anon, public;
revoke all on app.sale_items from anon, public;
revoke all on app.inventory_movements from anon, public;

-- Authenticated staff can SELECT via security_invoker views; direct mutations are revoked.
revoke insert, update, delete on app.sales from authenticated;
revoke insert, update, delete on app.sale_items from authenticated;
revoke insert, update, delete on app.inventory_movements from authenticated;
grant select on app.sales to authenticated;
grant select on app.sale_items to authenticated;
grant select on app.inventory_movements to authenticated;

-- Policies on app.sales:
-- Admin sees all sales.
-- Manager sees sales for their assigned branch.
-- Cashier sees sales they processed.
create policy sales_admin_select on app.sales
  for select to authenticated
  using ((select app.request_role()) = 'admin');

create policy sales_manager_select on app.sales
  for select to authenticated
  using (
    (select app.request_role()) = 'manager'
    and branch_id in (
      select u.branch_id from app.staff_users u where u.auth_user_id = (select auth.uid())
    )
  );

create policy sales_cashier_select on app.sales
  for select to authenticated
  using (
    (select app.request_role()) = 'cashier'
    and cashier_id in (
      select u.id from app.staff_users u where u.auth_user_id = (select auth.uid())
    )
  );

-- Policies on app.sale_items:
create policy sale_items_admin_select on app.sale_items
  for select to authenticated
  using ((select app.request_role()) = 'admin');

create policy sale_items_manager_select on app.sale_items
  for select to authenticated
  using (
    (select app.request_role()) = 'manager'
    and sale_id in (
      select s.id from app.sales s
      join app.staff_users u on u.branch_id = s.branch_id
      where u.auth_user_id = (select auth.uid())
    )
  );

create policy sale_items_cashier_select on app.sale_items
  for select to authenticated
  using (
    (select app.request_role()) = 'cashier'
    and sale_id in (
      select s.id from app.sales s
      join app.staff_users u on u.id = s.cashier_id
      where u.auth_user_id = (select auth.uid())
    )
  );

-- Policies on app.inventory_movements:
create policy inv_movements_admin_select on app.inventory_movements
  for select to authenticated
  using ((select app.request_role()) = 'admin');

create policy inv_movements_manager_select on app.inventory_movements
  for select to authenticated
  using (
    (select app.request_role()) = 'manager'
    and branch_id in (
      select u.branch_id from app.staff_users u where u.auth_user_id = (select auth.uid())
    )
  );

create policy inv_movements_cashier_select on app.inventory_movements
  for select to authenticated
  using (
    (select app.request_role()) = 'cashier'
    and created_by in (
      select u.id from app.staff_users u where u.auth_user_id = (select auth.uid())
    )
  );

-- ─── 4. Tiered Security-Invoker Projection Views ──────────────────────────────

-- Update products_cashier to include sell_price and admit all staff roles.
drop view if exists public.products_cashier;
create view public.products_cashier with (security_invoker = true) as
select id, branch_id, category_id, name, sku, brand, size_spec,
       sell_price, stock_quantity, status, created_at
from app.products
where (select app.request_role()) in ('cashier', 'manager', 'admin');

revoke all on public.products_cashier from anon, public;
grant select on public.products_cashier to authenticated;

-- Cashier sales view (no cost, no margin)
drop view if exists public.sales_cashier;
create view public.sales_cashier with (security_invoker = true) as
select id, sale_number, branch_id, cashier_id, total_amount, status, created_at
from app.sales
where (select app.request_role()) in ('cashier', 'manager', 'admin');

drop view if exists public.sale_items_cashier;
create view public.sale_items_cashier with (security_invoker = true) as
select id, sale_id, product_id, quantity, unit_price_at_sale, line_total, created_at
from app.sale_items
where (select app.request_role()) in ('cashier', 'manager', 'admin');

revoke all on public.sales_cashier from anon, public;
revoke all on public.sale_items_cashier from anon, public;
grant select on public.sales_cashier to authenticated;
grant select on public.sale_items_cashier to authenticated;

-- Manager sales view (branch sales revenue, no item cost, no item margin)
drop view if exists public.sales_manager;
create view public.sales_manager with (security_invoker = true) as
select id, sale_number, branch_id, cashier_id, total_amount, status, created_at
from app.sales
where (select app.request_role()) in ('manager', 'admin');

drop view if exists public.sale_items_manager;
create view public.sale_items_manager with (security_invoker = true) as
select id, sale_id, product_id, quantity, unit_price_at_sale, line_total, created_at
from app.sale_items
where (select app.request_role()) in ('manager', 'admin');

revoke all on public.sales_manager from anon, public;
revoke all on public.sale_items_manager from anon, public;
grant select on public.sales_manager to authenticated;
grant select on public.sale_items_manager to authenticated;

-- Admin sales view (full audit including historical cost and computed historical margin)
drop view if exists public.sales_admin;
create view public.sales_admin with (security_invoker = true) as
select id, sale_number, branch_id, cashier_id, total_amount, status, created_at
from app.sales
where (select app.request_role()) = 'admin';

drop view if exists public.sale_items_admin;
create view public.sale_items_admin with (security_invoker = true) as
select id, sale_id, product_id, quantity, unit_price_at_sale, unit_cost_at_sale, line_total,
       ((unit_price_at_sale - unit_cost_at_sale) * quantity)::numeric(12, 2) as item_margin,
       created_at
from app.sale_items
where (select app.request_role()) = 'admin';

drop view if exists public.inventory_movements_admin;
create view public.inventory_movements_admin with (security_invoker = true) as
select id, branch_id, product_id, reference_type, reference_id,
       quantity_change, balance_after, created_by, created_at
from app.inventory_movements
where (select app.request_role()) in ('manager', 'admin');

revoke all on public.sales_admin from anon, public;
revoke all on public.sale_items_admin from anon, public;
revoke all on public.inventory_movements_admin from anon, public;
grant select on public.sales_admin to authenticated;
grant select on public.sale_items_admin to authenticated;
grant select on public.inventory_movements_admin to authenticated;

-- ─── 5. Atomic Checkout RPC ──────────────────────────────────────────────────

create or replace function public.pos_complete_sale(
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_auth_uid uuid;
  v_staff_id uuid;
  v_staff_branch_id uuid;
  v_staff_role text;
  v_staff_status text;
  v_sale_id uuid;
  v_sale_number text;
  v_total_amount numeric(12, 2) := 0;
  v_item record;
  v_prod record;
  v_new_stock integer;
  v_line_total numeric(12, 2);
  v_items_count integer := 0;
  v_item_rows jsonb := '[]'::jsonb;
begin
  -- 1. Caller Authentication & Staff Verification
  v_auth_uid := auth.uid();
  if v_auth_uid is null then
    raise exception 'forbidden: authenticated session required' using errcode = '42501';
  end if;

  select id, branch_id, role::text, status
  into v_staff_id, v_staff_branch_id, v_staff_role, v_staff_status
  from app.staff_users
  where auth_user_id = v_auth_uid;

  if v_staff_id is null or v_staff_status <> 'active' then
    raise exception 'forbidden: active staff user required' using errcode = '42501';
  end if;

  if v_staff_role not in ('cashier', 'manager', 'admin') then
    raise exception 'forbidden: staff role not authorized for POS' using errcode = '42501';
  end if;

  -- 2. Validate Cart Payload Structure
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid payload: p_items must be a non-empty array' using errcode = '22023';
  end if;

  -- 3. Lock Product Rows in Deterministic Ascending UUID Order (Deadlock Prevention)
  -- Creates a temporary aggregated item table to normalize duplicate product entries.
  drop table if exists temp_pos_cart_items;
  create temporary table temp_pos_cart_items on commit drop as
  select
    (item->>'product_id')::uuid as product_id,
    sum((item->>'quantity')::integer)::integer as quantity
  from jsonb_array_elements(p_items) as item
  group by (item->>'product_id')::uuid;

  -- Validate item counts and quantities
  select count(*) into v_items_count from temp_pos_cart_items;
  if v_items_count = 0 then
    raise exception 'invalid payload: no valid items in cart' using errcode = '22023';
  end if;

  if exists (select 1 from temp_pos_cart_items where quantity <= 0 or quantity > 10000) then
    raise exception 'invalid quantity: quantities must be integers between 1 and 10000' using errcode = '22023';
  end if;

  -- 4. Verify Product Existence, Branch Confinement, and Stock Availability
  for v_prod in
    select
      p.id,
      p.branch_id,
      p.name,
      p.sku,
      p.sell_price,
      p.cost_price,
      p.stock_quantity,
      c.quantity as requested_qty
    from app.products p
    join temp_pos_cart_items c on c.product_id = p.id
    order by p.id asc
    for update of p
  loop
    -- Branch safety check
    if v_prod.branch_id <> v_staff_branch_id then
      raise exception 'cross-branch sale rejected: product % belongs to a different branch', v_prod.sku
        using errcode = '42501';
    end if;

    -- Stock sufficiency check
    if v_prod.stock_quantity < v_prod.requested_qty then
      raise exception 'insufficient stock for product %: requested %, available %',
        v_prod.sku, v_prod.requested_qty, v_prod.stock_quantity
        using errcode = '23514';
    end if;

    -- Accumulate total amount
    v_line_total := (v_prod.requested_qty * v_prod.sell_price)::numeric(12, 2);
    v_total_amount := (v_total_amount + v_line_total)::numeric(12, 2);
  end loop;

  -- Verify all requested products were found and locked
  if (select count(*) from temp_pos_cart_items) <> (
    select count(*) from app.products p join temp_pos_cart_items c on c.product_id = p.id
  ) then
    raise exception 'one or more products not found in branch catalogue' using errcode = 'P0002';
  end if;

  -- 5. Create Sale Header
  v_sale_number := app.generate_sale_number();
  insert into app.sales (
    sale_number,
    branch_id,
    cashier_id,
    total_amount,
    status
  ) values (
    v_sale_number,
    v_staff_branch_id,
    v_staff_id,
    v_total_amount,
    'completed'
  ) returning id into v_sale_id;

  -- 6. Insert Sale Items, Decrement Product Stock, Append Inventory Movements
  for v_prod in
    select
      p.id,
      p.name,
      p.sku,
      p.sell_price,
      p.cost_price,
      p.stock_quantity,
      c.quantity as requested_qty
    from app.products p
    join temp_pos_cart_items c on c.product_id = p.id
    order by p.id asc
  loop
    v_line_total := (v_prod.requested_qty * v_prod.sell_price)::numeric(12, 2);

    -- Insert immutable line item snapshot
    insert into app.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price_at_sale,
      unit_cost_at_sale,
      line_total
    ) values (
      v_sale_id,
      v_prod.id,
      v_prod.requested_qty,
      v_prod.sell_price,
      v_prod.cost_price,
      v_line_total
    );

    -- Deduct stock atomically
    update app.products
    set stock_quantity = stock_quantity - v_prod.requested_qty
    where id = v_prod.id
    returning stock_quantity into v_new_stock;

    -- Append audit ledger entry
    insert into app.inventory_movements (
      branch_id,
      product_id,
      reference_type,
      reference_id,
      quantity_change,
      balance_after,
      created_by
    ) values (
      v_staff_branch_id,
      v_prod.id,
      'sale',
      v_sale_id,
      -v_prod.requested_qty,
      v_new_stock,
      v_staff_id
    );

    -- Add to receipt item return array
    v_item_rows := v_item_rows || jsonb_build_object(
      'product_id', v_prod.id,
      'name', v_prod.name,
      'sku', v_prod.sku,
      'quantity', v_prod.requested_qty,
      'unit_price', v_prod.sell_price,
      'line_total', v_line_total
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'total_amount', v_total_amount,
    'items', v_item_rows,
    'created_at', now()
  );
end;
$$;

revoke all on function public.pos_complete_sale(jsonb) from public, anon;
grant execute on function public.pos_complete_sale(jsonb) to authenticated;
