-- catalog.template.sql — TEMPLATE ONLY. This file is intentionally NOT valid
-- SQL: every value is an <ANGLE_BRACKET> placeholder and execution fails
-- loudly until each one is replaced with business-supplied data.
--
-- HOW TO USE (see supabase/production/README.md):
--   1. Copy this file; never load the template itself.
--   2. Replace EVERY <...> with Simon-supplied values. No realistic fakes.
--   3. Resolve <REAL_BRANCH_NAME> to the live branch row created via Admin
--      Settings (the lookup below fails loudly if the branch is missing).
--   4. Upserts are by natural key (sku / name): re-running updates
--      price/stock/availability in place, never duplicates.
--   5. Run inside a transaction; verify public views afterwards.
--
-- Replace <REAL_BRANCH_NAME> with the exact live branch name first.

-- Bind all catalog rows to the single operational branch (NOT NULL FK).
-- Fails loudly if the real branch row does not exist yet.
do $$
declare
  v_branch_id uuid;
begin
  select id into strict v_branch_id
  from app.branches
  where name = '<REAL_BRANCH_NAME>';
end $$;

-- Example product row (duplicate per real product; delete these examples
-- only by replacing them with real rows — never commit realistic fakes):
insert into app.products
  (branch_id, category_id, name, sku, brand, size_spec,
   cost_price, sell_price, stock_quantity, status)
values
  ((select id from app.branches where name = '<REAL_BRANCH_NAME>'),
   (select id from app.categories where name = '<REAL_CATEGORY_NAME>'),
   '<REAL_PRODUCT_NAME>', '<REAL_SKU>', '<REAL_BRAND>', '<REAL_SIZE_SPEC>',
   <REAL_COST_PRICE>, <REAL_SELL_PRICE>, <REAL_STOCK_QUANTITY>, '<REAL_STATUS>')
on conflict (sku) do update set
  branch_id = excluded.branch_id,
  category_id = excluded.category_id,
  name = excluded.name,
  brand = excluded.brand,
  size_spec = excluded.size_spec,
  cost_price = excluded.cost_price,
  sell_price = excluded.sell_price,
  stock_quantity = excluded.stock_quantity,
  status = excluded.status;

-- <REAL_STATUS> must be one of: active, in_stock, low_stock, out_of_stock.
-- 'discontinued' is reserved for retired rows (see retire-seed-catalog.sql).

-- Example service row (services are global; no branch_id by design).
-- services.name has no UNIQUE constraint, so the upsert is an explicit
-- UPDATE-then-INSERT pair (idempotent; re-runs change nothing).
update app.services
set description = '<REAL_SERVICE_DESCRIPTION>',
    vehicle_types = '{<REAL_VEHICLE_TYPE_1>,<REAL_VEHICLE_TYPE_2>}',
    is_available = true
where name = '<REAL_SERVICE_NAME>';

insert into app.services (name, description, vehicle_types, is_available)
select '<REAL_SERVICE_NAME>', '<REAL_SERVICE_DESCRIPTION>',
       '{<REAL_VEHICLE_TYPE_1>,<REAL_VEHICLE_TYPE_2>}', true
where not exists (select 1 from app.services where name = '<REAL_SERVICE_NAME>');
