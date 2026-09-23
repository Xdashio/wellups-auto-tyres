-- 018 regression: admin_list_staff result-type contract (live 42804).
-- The 017 suite proves behavior on a scratch DB whose auth.users.email is
-- text; the live 42804 came from a deployed body whose RETURN QUERY shape
-- did not match RETURNS TABLE. These tests pin the contract itself —
-- OUT parameter names, order, and types — plus an admin end-to-end call,
-- so any future body edit that breaks the rowtype fails here first.
-- Fixtures roll back with the transaction. Count: 14.
begin;
select plan(14);

-- Fixtures: one admin + one pending invite with no auth user behind it
-- (covers the left-join NULL branch of the second UNION leg).
select lives_ok(
  $$insert into auth.users (id, email) values
     ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@test.local');
   insert into app.staff_users (auth_user_id, role, display_name) values
     ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', 'Admin');
   insert into app.staff_invites (email, role, display_name) values
     ('ghost@test.local', 'cashier', 'Ghost')$$,
  'fixtures inserted'
); -- 1

-- Exact OUT-parameter contract: 8 columns, fixed names/order/types.
select is(
  (select count(*)::int from information_schema.parameters
    where specific_schema = 'public'
      and specific_name in (select specific_name from information_schema.routines
        where routine_schema = 'public' and routine_name = 'admin_list_staff')
      and parameter_mode = 'OUT'),
  8,
  'admin_list_staff declares exactly 8 OUT columns'
); -- 2

select results_eq(
  $$select parameter_name::text, data_type::text from information_schema.parameters
   where specific_schema = 'public'
     and specific_name in (select specific_name from information_schema.routines
       where routine_schema = 'public' and routine_name = 'admin_list_staff')
     and parameter_mode = 'OUT'
   order by ordinal_position$$,
  $$values ('staff_id'::text, 'uuid'::text),
          ('auth_user_id', 'uuid'),
          ('email', 'text'),
          ('role', 'text'),
          ('display_name', 'text'),
          ('status', 'text'),
          ('created_at', 'timestamp with time zone'),
          ('invite_id', 'uuid')$$,
  'OUT columns match the declared roster contract in order'
); -- 3

-- Function properties preserved by 018.
select results_eq(
  $$select security_type::text from information_schema.routines
   where routine_schema = 'public' and routine_name = 'admin_list_staff'$$,
  $$values ('DEFINER'::text)$$,
  'still SECURITY DEFINER'
); -- 4
select ok(
  (select not has_function_privilege('anon', 'public.admin_list_staff()', 'execute')),
  'anon still cannot execute'
); -- 5
select ok(
  (select has_function_privilege('authenticated', 'public.admin_list_staff()', 'execute')),
  'authenticated can execute (role checked inside)'
); -- 6

-- Claim staging.
do $$ begin
  perform set_config('g018.claim_admin',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","app_metadata":{"user_role":"admin"}}', false);
  perform set_config('g018.claim_manager',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","app_metadata":{"user_role":"manager"}}', false);
end $$;
select ok(true, 'role claims staged'); -- 7

-- Denials hold before and independently of the rowtype fix.
set local role anon;
select throws_ok($$select * from public.admin_list_staff()$$,
  '42501', null, 'anon list denied'); -- 8
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g018.claim_manager'), true); end $$;
select throws_ok($$select * from public.admin_list_staff()$$,
  '42501', null, 'manager list denied'); -- 9

-- The exact defect: the admin call must execute and return the 8-column
-- roster shape. A body/returns mismatch raises 42804 here instead.
do $$ begin perform set_config('request.jwt.claims', current_setting('g018.claim_admin'), true); end $$;
select lives_ok(
  $$select * from public.admin_list_staff()$$,
  'admin roster call executes (no 42804 rowtype mismatch)'
); -- 10
select results_eq(
  $$select email, status from public.admin_list_staff() order by email$$,
  $$values ('admin@test.local'::text, 'active'::text),
          ('ghost@test.local'::text, 'invited'::text)$$,
  'admin roster returns active staff + pending invite'
); -- 11
select results_eq(
  $$select pg_typeof(staff_id)::text, pg_typeof(auth_user_id)::text,
           pg_typeof(email)::text, pg_typeof(role)::text,
           pg_typeof(display_name)::text, pg_typeof(status)::text,
           pg_typeof(created_at)::text, pg_typeof(invite_id)::text
   from public.admin_list_staff() limit 1$$,
  $$values ('uuid'::text, 'uuid'::text, 'text'::text, 'text'::text,
            'text'::text, 'text'::text,
            'timestamp with time zone'::text, 'uuid'::text)$$,
  'returned column types match the declared contract'
); -- 12
select ok(
  (select staff_id is not null and invite_id is null
   from public.admin_list_staff() where email = 'admin@test.local'),
  'active row addressed by staff_id, invite_id NULL'
); -- 13
select ok(
  (select staff_id is null and invite_id is not null
   from public.admin_list_staff() where email = 'ghost@test.local'),
  'invite row addressed by invite_id, staff_id NULL'
); -- 14

rollback;
