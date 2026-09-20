-- M3 acceptance: hook writes app_metadata.user_role from app.staff_users.role
-- for Admin/Manager/Cashier, leaves non-staff claims untouched, and reflects
-- a role change on the next invocation (the token-refresh story).
begin;
select plan(8);

select lives_ok(
  $$insert into auth.users (id, email) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@test.local'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager@test.local'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier@test.local'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'plain@test.local')$$,
  'test auth users created'
);

select lives_ok(
  $$insert into app.staff_users (auth_user_id, role, display_name) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', 'Test Admin'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager', 'Test Manager'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier', 'Test Cashier')$$,
  'test staff rows created'
);

select results_eq(
  $$select app.custom_access_token_hook('{"user_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","claims":{"app_metadata":{}}}'::jsonb) -> 'claims' -> 'app_metadata' ->> 'user_role'$$,
  array['admin'::text],
  'admin claim issued'
);
select results_eq(
  $$select app.custom_access_token_hook('{"user_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","claims":{"app_metadata":{}}}'::jsonb) -> 'claims' -> 'app_metadata' ->> 'user_role'$$,
  array['manager'::text],
  'manager claim issued'
);
select results_eq(
  $$select app.custom_access_token_hook('{"user_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","claims":{"app_metadata":{}}}'::jsonb) -> 'claims' -> 'app_metadata' ->> 'user_role'$$,
  array['cashier'::text],
  'cashier claim issued'
);
select ok(
  (select app.custom_access_token_hook('{"user_id":"dddddddd-dddd-dddd-dddd-dddddddddddd","claims":{"app_metadata":{}}}'::jsonb) -> 'claims' -> 'app_metadata' ? 'user_role') = false,
  'non-staff token carries no user_role claim'
);
select lives_ok(
  $$update app.staff_users set role = 'manager'
    where auth_user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  'cashier demoted to manager (simulates admin role change)'
);
select results_eq(
  $$select app.custom_access_token_hook('{"user_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","claims":{"app_metadata":{}}}'::jsonb) -> 'claims' -> 'app_metadata' ->> 'user_role'$$,
  array['manager'::text],
  'role change is reflected on next invocation (token refresh)'
);

select * from finish();
rollback;
