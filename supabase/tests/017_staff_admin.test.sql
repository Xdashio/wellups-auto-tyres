-- 017 acceptance: admin-managed staff provisioning without service_role.
-- Role simulation follows the repo pattern: SET ROLE + request.jwt.claims
-- GUC, exactly as PostgREST presents claims. All fixtures roll back with
-- the transaction. Count: 57.
begin;
select plan(57);

-- Fixtures: three staff (one per role) + one plain user, as in 016.
select lives_ok(
  $$insert into auth.users (id, email) values
     ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@test.local'),
     ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager@test.local'),
     ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier@test.local'),
     ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'plain@test.local');
   insert into app.staff_users (auth_user_id, role) values
     ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
     ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager'),
     ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier')$$,
  'fixtures inserted'
); -- 1

-- Structure: new objects exist.
select has_table('app', 'staff_invites', 'staff_invites table exists'); -- 2
select ok(
  (select relrowsecurity from pg_class
    where relname = 'staff_invites' and relnamespace = 'app'::regnamespace),
  'RLS enabled on staff_invites'
); -- 3
select has_function('public', 'admin_list_staff', array[]::text[], 'list RPC exists'); -- 4
select has_function('public', 'admin_invite_staff', array['text','text','text'], 'invite RPC exists'); -- 5
select has_function('public', 'admin_revoke_invite', array['uuid'], 'revoke RPC exists'); -- 6
select has_function('public', 'admin_set_staff_role', array['uuid','text'], 'set-role RPC exists'); -- 7
select has_function('public', 'admin_remove_staff', array['uuid'], 'remove RPC exists'); -- 8

-- Execute boundary: anon cannot reach any RPC; authenticated can (role
-- checked inside each body — fail closed, never fail open).
select ok(
  (select not has_function_privilege('anon', 'public.admin_list_staff()', 'execute')),
  'anon cannot execute list'
); -- 9
select ok(
  (select not has_function_privilege('anon', 'public.admin_invite_staff(text,text,text)', 'execute')),
  'anon cannot execute invite'
); -- 10
select ok(
  (select not has_function_privilege('anon', 'public.admin_revoke_invite(uuid)', 'execute')),
  'anon cannot execute revoke'
); -- 11
select ok(
  (select not has_function_privilege('anon', 'public.admin_set_staff_role(uuid,text)', 'execute')),
  'anon cannot execute set-role'
); -- 12
select ok(
  (select not has_function_privilege('anon', 'public.admin_remove_staff(uuid)', 'execute')),
  'anon cannot execute remove'
); -- 13
select ok(
  (select has_function_privilege('authenticated', 'public.admin_list_staff()', 'execute')),
  'authenticated can execute list (role checked inside)'
); -- 14
select ok(
  (select has_function_privilege('authenticated', 'public.admin_invite_staff(text,text,text)', 'execute')),
  'authenticated can execute invite (role checked inside)'
); -- 15
select ok(
  (select has_function_privilege('authenticated', 'public.admin_revoke_invite(uuid)', 'execute')),
  'authenticated can execute revoke (role checked inside)'
); -- 16
select ok(
  (select has_function_privilege('authenticated', 'public.admin_set_staff_role(uuid,text)', 'execute')),
  'authenticated can execute set-role (role checked inside)'
); -- 17
select ok(
  (select has_function_privilege('authenticated', 'public.admin_remove_staff(uuid)', 'execute')),
  'authenticated can execute remove (role checked inside)'
); -- 18

-- Claim staging.
do $$ begin
  perform set_config('g017.claim_admin',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","app_metadata":{"user_role":"admin"}}', false);
  perform set_config('g017.claim_manager',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","app_metadata":{"user_role":"manager"}}', false);
  perform set_config('g017.claim_cashier',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","app_metadata":{"user_role":"cashier"}}', false);
  perform set_config('g017.claim_ghost_admin',
    '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","app_metadata":{"user_role":"admin"}}', false);
  perform set_config('g017.claim_admin_b',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","app_metadata":{"user_role":"admin"}}', false);
end $$;
select ok(true, 'role claims staged'); -- 19

-- Anon calls denied at the grant boundary.
set local role anon;
select throws_ok($$select * from public.admin_list_staff()$$,
  '42501', null, 'anon list denied'); -- 20
select throws_ok($$select public.admin_invite_staff('x@y.zz', 'cashier')$$,
  '42501', null, 'anon invite denied'); -- 21
select throws_ok($$select public.admin_revoke_invite('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'anon revoke denied'); -- 22
select throws_ok($$select public.admin_set_staff_role('11111111-1111-1111-1111-111111111111', 'cashier')$$,
  '42501', null, 'anon set-role denied'); -- 23
select throws_ok($$select public.admin_remove_staff('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'anon remove denied'); -- 24

-- Non-admin authenticated calls denied inside the body (fail-closed).
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', current_setting('g017.claim_manager'), true); end $$;
select throws_ok($$select * from public.admin_list_staff()$$,
  '42501', null, 'manager list denied'); -- 25
select throws_ok($$select public.admin_invite_staff('x@y.zz', 'cashier')$$,
  '42501', null, 'manager invite denied'); -- 26
select throws_ok($$select public.admin_revoke_invite('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'manager revoke denied'); -- 27
select throws_ok($$select public.admin_set_staff_role('11111111-1111-1111-1111-111111111111', 'cashier')$$,
  '42501', null, 'manager set-role denied'); -- 28
select throws_ok($$select public.admin_remove_staff('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'manager remove denied'); -- 29
do $$ begin perform set_config('request.jwt.claims', current_setting('g017.claim_cashier'), true); end $$;
select throws_ok($$select * from public.admin_list_staff()$$,
  '42501', null, 'cashier list denied'); -- 30
select throws_ok($$select public.admin_invite_staff('x@y.zz', 'cashier')$$,
  '42501', null, 'cashier invite denied'); -- 31

-- Admin roster shows the three fixture staff with their auth emails.
do $$ begin perform set_config('request.jwt.claims', current_setting('g017.claim_admin'), true); end $$;
select results_eq(
  $$select email from public.admin_list_staff() order by email$$,
  $$values ('admin@test.local'::text), ('cashier@test.local'), ('manager@test.local')$$,
  'admin roster lists fixture staff with emails'
); -- 32

-- Invite lifecycle: create, visible as invited, guards, revoke.
select lives_ok(
  $$select public.admin_invite_staff('newguy@test.local', 'cashier', 'New Guy')$$,
  'admin invite succeeds'
); -- 33
select results_eq(
  $$select status from public.admin_list_staff() where email = 'newguy@test.local'$$,
  $$values ('invited'::text)$$,
  'pending invite appears as invited'
); -- 34
select throws_ok(
  $$select public.admin_invite_staff('NEWGUY@test.local', 'cashier')$$,
  '22000', null, 'duplicate invite (case-insensitive) rejected'
); -- 35
select throws_ok(
  $$select public.admin_invite_staff('not-an-email', 'cashier')$$,
  '22000', null, 'malformed email rejected'
); -- 36
select throws_ok(
  $$select public.admin_invite_staff('other@test.local', 'owner')$$,
  '22000', null, 'unknown role rejected'
); -- 37
select throws_ok(
  $$select public.admin_invite_staff('admin@test.local', 'cashier')$$,
  '22000', null, 'inviting already-active staff rejected'
); -- 38
select lives_ok(
  $$select public.admin_revoke_invite(
    (select invite_id from public.admin_list_staff() where email = 'newguy@test.local'))$$,
  'admin revoke succeeds'
); -- 39
select is_empty(
  $$select * from public.admin_list_staff() where email = 'newguy@test.local'$$,
  'revoked invite leaves no trace'
); -- 40
select throws_ok(
  $$select public.admin_revoke_invite('11111111-1111-1111-1111-111111111111')$$,
  '02000', null, 'revoking a missing invite fails closed'
); -- 41

-- Role change: works, validates, never leaves zero admins.
select lives_ok(
  $$select public.admin_set_staff_role(
    (select staff_id from public.admin_list_staff() where email = 'cashier@test.local'),
    'manager')$$,
  'admin changes cashier to manager'
); -- 42
select results_eq(
  $$select role from public.admin_list_staff() where email = 'cashier@test.local'$$,
  $$values ('manager'::text)$$,
  'role change stored'
); -- 43
select throws_ok(
  $$select public.admin_set_staff_role(
    (select staff_id from public.admin_list_staff() where email = 'cashier@test.local'),
    'owner')$$,
  '22000', null, 'unknown role rejected on change'
); -- 44
select throws_ok(
  $$select public.admin_set_staff_role('11111111-1111-1111-1111-111111111111', 'cashier')$$,
  '02000', null, 'changing a missing record fails closed'
); -- 45
select throws_ok(
  $$select public.admin_set_staff_role(
    (select staff_id from public.admin_list_staff() where email = 'admin@test.local'),
    'cashier')$$,
  '42501', null, 'demoting the sole admin refused'
); -- 46
select lives_ok(
  $$select public.admin_set_staff_role(
    (select staff_id from public.admin_list_staff() where email = 'manager@test.local'),
    'admin')$$,
  'promoting a second admin succeeds'
); -- 47
select lives_ok(
  $$select public.admin_set_staff_role(
    (select staff_id from public.admin_list_staff() where email = 'admin@test.local'),
    'cashier')$$,
  'demoting the original admin succeeds once a second admin exists'
); -- 48

-- Removal: works for ordinary rows; self-removal and last-admin removal
-- are refused. Acting admin from here on is bbbbbbbb (promoted admin) via
-- a fresh admin claim — the aaaa actor just demoted itself.
do $$ begin perform set_config('request.jwt.claims', current_setting('g017.claim_admin_b'), true); end $$;
select lives_ok(
  $$select public.admin_remove_staff(
    (select staff_id from public.admin_list_staff() where email = 'admin@test.local'))$$,
  'admin removes a non-admin row'
); -- 49
select throws_ok(
  $$select public.admin_remove_staff(
    (select staff_id from public.admin_list_staff() where email = 'manager@test.local'))$$,
  '42501', null, 'self-removal refused'
); -- 50
do $$ begin perform set_config('request.jwt.claims', current_setting('g017.claim_ghost_admin'), true); end $$;
select throws_ok(
  $$select public.admin_remove_staff(
    (select staff_id from public.admin_list_staff() where email = 'manager@test.local'))$$,
  '42501', null, 'removing the last admin refused (non-self actor)'
); -- 51
do $$ begin perform set_config('request.jwt.claims', current_setting('g017.claim_admin'), true); end $$;

-- Hook consumes a pending grant exactly once on first token. The hook is
-- natively executable by supabase_auth_admin only, so the scratch runner
-- drops back to the session owner for these direct calls (claims GUCs
-- above still drive the in-body admin check for the invite RPC).
reset role;
select lives_ok(
  $$select public.admin_invite_staff('plain@test.local', 'manager')$$,
  'invite for the plain user succeeds'
); -- 52
select results_eq(
  $$select app.custom_access_token_hook('{"user_id":"dddddddd-dddd-dddd-dddd-dddddddddddd","claims":{"app_metadata":{}}}'::jsonb) -> 'claims' -> 'app_metadata' ->> 'user_role'$$,
  array['manager'::text],
  'hook issues the invited role on first token'
); -- 53
select results_eq(
  $$select role::text from app.staff_users where auth_user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  array['manager'::text],
  'invite consumed into a staff mapping'
); -- 54
select is_empty(
  $$select * from app.staff_invites where lower(email) = 'plain@test.local'$$,
  'consumed invite leaves no pending row'
); -- 55
select results_eq(
  $$select app.custom_access_token_hook('{"user_id":"dddddddd-dddd-dddd-dddd-dddddddddddd","claims":{"app_metadata":{}}}'::jsonb) -> 'claims' -> 'app_metadata' ->> 'user_role'$$,
  array['manager'::text],
  'second token still carries the role (idempotent)'
); -- 56

-- Hook regression: pre-existing staff mappings behave exactly as before.
select results_eq(
  $$select app.custom_access_token_hook('{"user_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","claims":{"app_metadata":{}}}'::jsonb) -> 'claims' -> 'app_metadata' ->> 'user_role'$$,
  array['admin'::text],
  'existing staff claim unaffected by the hook extension'
); -- 57

rollback;
