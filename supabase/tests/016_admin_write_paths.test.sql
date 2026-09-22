-- GATE 012 acceptance: migration 016 corrections. Role simulation follows the
-- repo pattern: SET ROLE + request.jwt.claims GUC, exactly as PostgREST
-- presents claims. All fixtures roll back with the transaction.
begin;
select plan(43);

-- Fixtures.
select lives_ok(
  $$insert into auth.users (id, email) values
     ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@test.local'),
     ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager@test.local'),
     ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier@test.local'),
     ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'customer@test.local');
   insert into app.staff_users (auth_user_id, role) values
     ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
     ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager'),
     ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier');
   insert into app.branches (id, name)
     values ('11111111-1111-1111-1111-111111111111', 'pgTAP 016 Branch');
   insert into app.categories (id, name)
     values ('22222222-2222-2222-2222-222222222222', 'pgTAP 016 Category');
   insert into app.products (id, branch_id, category_id, name, sku, cost_price, sell_price, stock_quantity)
     values ('33333333-3333-3333-3333-333333333333',
             '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
             'Probe Tyre', 'SKU-016', 10000, 13500, 4);
   insert into app.services (id, name, is_available) values
     ('44444444-4444-4444-4444-444444444444', 'Probe Available Service', true),
     ('55555555-5555-5555-5555-555555555555', 'Probe Disabled Service', false)$$,
  'fixtures inserted'
);

-- Structure: new objects exist, lax quote INSERT policy is gone.
select has_view('public', 'categories_admin', 'categories_admin view exists');
select ok(
  (select count(*) = 1 from pg_policies
    where schemaname = 'app' and tablename = 'services' and policyname = 'services_admin_read'),
  'services_admin_read policy exists'
);
select is_empty(
  $$select policyname from pg_policies where schemaname = 'app' and tablename = 'quote_requests' and policyname = 'quote_requests_insert'$$,
  'lax quote_requests_insert policy is gone'
);
select has_function('public', 'admin_update_branch_settings',
  array['uuid','text','text','text','text','text','text','text','text','text'],
  'branch settings RPC exists');
select ok(
  (select not has_function_privilege('anon',
    'public.admin_update_branch_settings(uuid,text,text,text,text,text,text,text,text,text)', 'execute')),
  'anon cannot execute branch settings RPC'
);
select ok(
  (select has_function_privilege('authenticated',
    'public.admin_update_branch_settings(uuid,text,text,text,text,text,text,text,text,text)', 'execute')),
  'authenticated can execute branch settings RPC (role checked inside)'
);

-- Claim staging (session GUCs read back by the role-simulation blocks below).
do $$ begin
  perform set_config('g012.claim_admin',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","app_metadata":{"user_role":"admin"}}', false);
  perform set_config('g012.claim_manager',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","app_metadata":{"user_role":"manager"}}', false);
  perform set_config('g012.claim_cashier',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","app_metadata":{"user_role":"cashier"}}', false);
  perform set_config('g012.claim_customer',
    '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd"}', false);
end $$;
select ok(true, 'role claims staged');

-- Admin product write path works through the view.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_admin'), true); end $$;
select lives_ok(
  $$insert into public.products_admin (branch_id, category_id, name, sku, cost_price, sell_price, stock_quantity, status)
    values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
            'Admin Probe', 'SKU-016-ADMIN', 5000, 7000, 2, 'active')$$,
  'admin product create succeeds'
);
select lives_ok(
  $$update public.products_admin set stock_quantity = 9 where sku = 'SKU-016-ADMIN'$$,
  'admin product update succeeds'
);
select results_eq(
  $$select stock_quantity::text from public.products_admin where sku = 'SKU-016-ADMIN'$$,
  $$values ('9'::text)$$,
  'admin product update stored'
);
select lives_ok(
  $$delete from public.products_admin where sku = 'SKU-016-ADMIN'$$,
  'admin product delete succeeds'
);
select is_empty(
  $$select * from public.products_admin where sku = 'SKU-016-ADMIN'$$,
  'admin product delete removed the row'
);

-- Non-admin product writes denied.
set local role anon;
select throws_ok(
  $$insert into public.products_admin (branch_id, name, sku, cost_price, sell_price, stock_quantity)
    values ('11111111-1111-1111-1111-111111111111', 'Anon Probe', 'SKU-016-ANON', 1, 2, 1)$$,
  '42501', null, 'anon product create denied'
);
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_manager'), true); end $$;
select throws_ok(
  $$insert into public.products_admin (branch_id, name, sku, cost_price, sell_price, stock_quantity)
    values ('11111111-1111-1111-1111-111111111111', 'Manager Probe', 'SKU-016-MGR', 1, 2, 1)$$,
  '42501', null, 'manager product create denied'
);
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_cashier'), true); end $$;
select lives_ok(
  $$update public.products_admin set stock_quantity = 1 where sku = 'SKU-016'$$,
  'cashier product update statement runs'
);
select results_eq(
  $$select stock_quantity::text from app.products where sku = 'SKU-016'$$,
  $$values ('4'::text)$$,
  'cashier product update changed nothing (RLS fail-closed, zero rows)'
);

-- Services admin read: admin sees the disabled service, public does not.
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_admin'), true); end $$;
select results_eq(
  $$select name from public.services_admin where id = '55555555-5555-5555-5555-555555555555'$$,
  $$values ('Probe Disabled Service'::text)$$,
  'admin sees disabled service'
);
set local role anon;
select is_empty(
  $$select * from public.services_public where id = '55555555-5555-5555-5555-555555555555'$$,
  'public does not see disabled service'
);
select throws_ok(
  $$select * from public.services_admin$$,
  '42501', null, 'anon denied on services_admin (fail-closed grant)'
);

-- Services admin write path.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_admin'), true); end $$;
select lives_ok(
  $$insert into public.services_admin (name, is_available) values ('Admin Probe Service', true)$$,
  'admin service create succeeds'
);
select lives_ok(
  $$update public.services_admin set is_available = false where name = 'Admin Probe Service'$$,
  'admin service update succeeds'
);
select results_eq(
  $$select is_available::text from public.services_admin where name = 'Admin Probe Service'$$,
  $$values ('false'::text)$$,
  'admin service update stored'
);
select lives_ok(
  $$delete from public.services_admin where name = 'Admin Probe Service'$$,
  'admin service delete succeeds'
);
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_cashier'), true); end $$;
select throws_ok(
  $$insert into public.services_admin (name) values ('Cashier Probe Service')$$,
  '42501', null, 'cashier service create denied'
);

-- Categories admin path.
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_admin'), true); end $$;
select lives_ok(
  $$insert into public.categories_admin (name) values ('Admin Probe Category')$$,
  'admin category create succeeds'
);
set local role anon;
select throws_ok(
  $$insert into public.categories_admin (name) values ('Anon Probe Category')$$,
  '42501', null, 'anon category create denied'
);

select ok(
  (select not has_table_privilege('anon', 'public.branches_admin', 'SELECT')),
  'anon holds no SELECT on branches_admin'
);
select ok(
  (select not has_table_privilege('anon', 'public.products_admin', 'SELECT')),
  'anon holds no SELECT on products_admin'
);
select ok(
  (select not has_table_privilege('anon', 'public.services_admin', 'SELECT')),
  'anon holds no SELECT on services_admin'
);

-- branches_admin visibility matrix.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_admin'), true); end $$;
select results_eq(
  $$select name from public.branches_admin where id = '11111111-1111-1111-1111-111111111111'$$,
  $$values ('pgTAP 016 Branch'::text)$$,
  'admin reads branches_admin (seed-independent fixture check)'
);
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_manager'), true); end $$;
select is_empty(
  $$select * from public.branches_admin$$,
  'manager sees nothing through branches_admin'
);
set local role anon;
select throws_ok(
  $$select * from public.branches_admin$$,
  '42501', null, 'anon denied on branches_admin (fail-closed grant)'
);

-- Branch RPC: non-admin denied, admin succeeds with normalization.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_manager'), true); end $$;
select throws_ok(
  $$select public.admin_update_branch_settings('11111111-1111-1111-1111-111111111111', 'Hacked')$$,
  '42501', null, 'manager branch RPC denied'
);
set local role anon;
select throws_ok(
  $$select public.admin_update_branch_settings('11111111-1111-1111-1111-111111111111', 'Hacked')$$,
  '42501', null, 'anon branch RPC denied'
);
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_admin'), true); end $$;
select throws_ok(
  $$select public.admin_update_branch_settings('11111111-1111-1111-1111-111111111111', 'pgTAP 016 Branch',
    null, null, null, null, 'momo', null, null, null)$$,
  '22000', null, 'bad mpesa channel rejected'
);
select throws_ok(
  $$select public.admin_update_branch_settings('11111111-1111-1111-1111-111111111111', 'pgTAP 016 Branch',
    null, null, null, null, 'till', null, 'abc', null)$$,
  '22000', null, 'malformed till number rejected'
);
select lives_ok(
  $$select public.admin_update_branch_settings('11111111-1111-1111-1111-111111111111', '  pgTAP 016 Branch  ',
    null, null, null, null, 'till', null, '  123456 ', null)$$,
  'admin branch update succeeds with normalization'
);
select results_eq(
  $$select (name || '|' || coalesce(mpesa_channel_type, '-') || '|' || coalesce(mpesa_till_number, '-')) from app.branches
    where id = '11111111-1111-1111-1111-111111111111'$$,
  $$values ('pgTAP 016 Branch|till|123456'::text)$$,
  'branch row trimmed and stored'
);

-- Quote direct-INSERT hardening: RPC is the only creation path.
set local role anon;
select throws_ok(
  $$insert into app.quote_requests (branch_id, customer_name, customer_phone)
    values ('11111111-1111-1111-1111-111111111111', 'Probe', '0700000000')$$,
  '42501', null, 'anon direct quote INSERT denied'
);
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_customer'), true); end $$;
select throws_ok(
  $$insert into app.quote_requests (branch_id, customer_name, customer_phone, status, offered_price)
    values ('11111111-1111-1111-1111-111111111111', 'Probe', '0700000000', 'quoted', 1)$$,
  '42501', null, 'customer direct quote INSERT denied'
);
set local role anon;
select lives_ok(
  $$select public.create_quote_request('11111111-1111-1111-1111-111111111111', 'Probe Guest', '0700000000')$$,
  'guest create_quote_request still works'
);
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g012.claim_admin'), true); end $$;
select results_eq(
  $$select status::text || '|' || coalesce(offered_price::text, '-') from app.quote_requests
    where customer_name = 'Probe Guest'$$,
  $$values ('new|-'::text)$$,
  'RPC forces server-controlled status, no injected pricing'
);

rollback;
