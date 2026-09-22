-- M4 acceptance: tiered-view matrix. Distinguishes field absence (42703),
-- zero-row tier denial (is_empty + Admin positive control), and grant
-- denial (42501). Claims are injected exactly as PostgREST would present
-- them: SET ROLE authenticated + request.jwt.claims.
begin;
select plan(18);

-- Fixtures (rolled back with the transaction).
select lives_ok(
  $$insert into auth.users (id, email) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@test.local'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager@test.local'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier@test.local');
   insert into app.staff_users (auth_user_id, role) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier');
   insert into app.branches (id, name)
    values ('11111111-1111-1111-1111-111111111111', 'pgTAP Test Branch');
   insert into app.categories (id, name)
    values ('22222222-2222-2222-2222-222222222222', 'pgTAP Test Category');
   insert into app.products (branch_id, category_id, name, sku, cost_price, sell_price, stock_quantity)
    values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
            'Probe Tyre', 'SKU-PROBE', 10000, 13500, 4)$$,
  'fixtures inserted'
);

-- Structure: views exist, are invokers, carry no RLS policies of their own.
select has_view('public', 'products_cashier', 'cashier view exists');
select has_view('public', 'products_manager', 'manager view exists');
select has_view('public', 'products_admin', 'admin view exists');
select is(
  (select array_to_string(array_agg(relname::text order by relname::text), ',') from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'v'
      and relname like 'products\_%' and reloptions = array['security_invoker=true']),
  'products_admin,products_cashier,products_manager,products_public',
  'all tiered + public product views are security_invoker with no view policies'
);
select is_empty(
  $$select policyname from pg_policies where schemaname = 'public' and tablename like 'products\_%'$$,
  'no RLS policy exists on any tiered view'
);

-- Admin tier: both sensitive fields visible (positive control for denials below).
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","app_metadata":{"user_role":"admin"}}', true); end $$;
select is(
  (select array_agg(sku || '|' || cost_price::text || '|' || margin::text)::text from public.products_admin where sku = 'SKU-PROBE'),
  '{SKU-PROBE|10000.00|3500.00}',
  'admin sees cost_price and margin'
);

-- Manager tier: cost visible, margin field absent.
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","app_metadata":{"user_role":"manager"}}', true); end $$;
select is(
  (select array_agg(sku || '|' || cost_price::text)::text from public.products_manager where sku = 'SKU-PROBE'),
  '{SKU-PROBE|10000.00}',
  'manager sees cost_price'
);
select throws_ok(
  $$select margin from public.products_manager$$,
  '42703', null,
  'margin field is absent from the manager view'
);
select is_empty(
  $$select * from public.products_admin$$,
  'manager reading the admin view gets zero rows'
);

-- Cashier tier: both sensitive fields absent.
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","app_metadata":{"user_role":"cashier"}}', true); end $$;
select is(
  (select array_agg(sku)::text from public.products_cashier where sku = 'SKU-PROBE'),
  '{SKU-PROBE}',
  'cashier sees operational rows'
);
select throws_ok(
  $$select cost_price from public.products_cashier$$,
  '42703', null,
  'cost_price field is absent from the cashier view'
);
select throws_ok(
  $$select margin from public.products_cashier$$,
  '42703', null,
  'margin field is absent from the cashier view'
);
select is_empty(
  $$select * from public.products_manager$$,
  'cashier reading the manager view gets zero rows'
);
select is_empty(
  $$select * from public.products_admin$$,
  'cashier reading the admin view gets zero rows'
);

-- Anon: no grants on any staff view.
set local role anon;
select throws_ok(
  $$select * from public.products_cashier$$,
  '42501', null,
  'anon is denied on the cashier view'
);
select throws_ok(
  $$select * from public.products_manager$$,
  '42501', null,
  'anon is denied on the manager view'
);
select throws_ok(
  $$select * from public.products_admin$$,
  '42501', null,
  'anon is denied on the admin view'
);

select * from finish();
rollback;
