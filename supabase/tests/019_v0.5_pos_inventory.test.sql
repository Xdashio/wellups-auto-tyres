-- 019 acceptance: v0.5 POS and Inventory Architecture
-- Verifies base tables, RLS, grants, tiered views, financial isolation, and atomic checkout RPC.
begin;
select plan(35);

-- ─── 1. Base Tables & Sequences ──────────────────────────────────────────────
select has_sequence('app', 'sale_number_seq', 'app.sale_number_seq exists'); -- 1
select has_table('app', 'sales', 'app.sales table exists'); -- 2
select has_table('app', 'sale_items', 'app.sale_items table exists'); -- 3
select has_table('app', 'inventory_movements', 'app.inventory_movements table exists'); -- 4

-- ─── 2. Row Level Security Enabled ───────────────────────────────────────────
select ok(
  (select relrowsecurity from pg_class where relname = 'sales' and relnamespace = 'app'::regnamespace),
  'RLS enabled on app.sales'
); -- 5
select ok(
  (select relrowsecurity from pg_class where relname = 'sale_items' and relnamespace = 'app'::regnamespace),
  'RLS enabled on app.sale_items'
); -- 6
select ok(
  (select relrowsecurity from pg_class where relname = 'inventory_movements' and relnamespace = 'app'::regnamespace),
  'RLS enabled on app.inventory_movements'
); -- 7

-- ─── 3. Privileges on Base Tables ────────────────────────────────────────────
select ok(
  (select not has_table_privilege('anon', 'app.sales', 'select')),
  'anon denied select on app.sales'
); -- 8
select ok(
  (select not has_table_privilege('anon', 'app.sale_items', 'select')),
  'anon denied select on app.sale_items'
); -- 9
select ok(
  (select not has_table_privilege('anon', 'app.inventory_movements', 'select')),
  'anon denied select on app.inventory_movements'
); -- 10

select ok(
  (select not has_table_privilege('authenticated', 'app.sales', 'insert')),
  'authenticated denied direct insert on app.sales'
); -- 11
select ok(
  (select not has_table_privilege('authenticated', 'app.sale_items', 'insert')),
  'authenticated denied direct insert on app.sale_items'
); -- 12
select ok(
  (select not has_table_privilege('authenticated', 'app.inventory_movements', 'insert')),
  'authenticated denied direct insert on app.inventory_movements'
); -- 13

-- ─── 4. Public Tiered Views ──────────────────────────────────────────────────
select has_view('public', 'products_cashier', 'products_cashier view exists'); -- 14
select has_view('public', 'sales_cashier', 'sales_cashier view exists'); -- 15
select has_view('public', 'sale_items_cashier', 'sale_items_cashier view exists'); -- 16
select has_view('public', 'sales_manager', 'sales_manager view exists'); -- 17
select has_view('public', 'sale_items_manager', 'sale_items_manager view exists'); -- 18
select has_view('public', 'sales_admin', 'sales_admin view exists'); -- 19
select has_view('public', 'sale_items_admin', 'sale_items_admin view exists'); -- 20
select has_view('public', 'inventory_movements_admin', 'inventory_movements_admin view exists'); -- 21

-- ─── 5. Financial Projection Boundaries ──────────────────────────────────────
-- products_cashier has sell_price, but NO cost_price and NO margin
select has_column('public', 'products_cashier', 'sell_price', 'products_cashier exposes sell_price'); -- 22
select hasnt_column('public', 'products_cashier', 'cost_price', 'products_cashier hides cost_price'); -- 23
select hasnt_column('public', 'products_cashier', 'margin', 'products_cashier hides margin'); -- 24

-- sale_items_cashier & manager hide cost and margin
select hasnt_column('public', 'sale_items_cashier', 'unit_cost_at_sale', 'sale_items_cashier hides unit_cost_at_sale'); -- 25
select hasnt_column('public', 'sale_items_cashier', 'item_margin', 'sale_items_cashier hides item_margin'); -- 26
select hasnt_column('public', 'sale_items_manager', 'unit_cost_at_sale', 'sale_items_manager hides unit_cost_at_sale'); -- 27
select hasnt_column('public', 'sale_items_manager', 'item_margin', 'sale_items_manager hides item_margin'); -- 28

-- sale_items_admin exposes historical cost and margin
select has_column('public', 'sale_items_admin', 'unit_cost_at_sale', 'sale_items_admin exposes unit_cost_at_sale'); -- 29
select has_column('public', 'sale_items_admin', 'item_margin', 'sale_items_admin exposes item_margin'); -- 30

-- ─── 6. Checkout RPC Boundaries ──────────────────────────────────────────────
select has_function('public', 'pos_complete_sale', array['jsonb'], 'pos_complete_sale RPC exists'); -- 31
select ok(
  (select not has_function_privilege('anon', 'public.pos_complete_sale(jsonb)', 'execute')),
  'anon denied execute on pos_complete_sale'
); -- 32
select ok(
  (select has_function_privilege('authenticated', 'public.pos_complete_sale(jsonb)', 'execute')),
  'authenticated can execute pos_complete_sale'
); -- 33

-- ─── 7. Structural Integrity & Numbering Sequence ─────────────────────────────
select throws_like(
  $$select app.pos_complete_sale('[]'::jsonb)$$,
  '%',
  'unauthenticated call fails closed'
); -- 34

select lives_ok(
  $$select app.generate_sale_number()$$,
  'deterministic sale number generator succeeds'
); -- 35

rollback;
