-- 017: admin-managed staff provisioning WITHOUT the service_role key.
--
-- Context: roles are derived at token-issue time from app.staff_users via
-- app.custom_access_token_hook (008) — there is intentionally no
-- service_role key anywhere in app code, so the Supabase Admin API
-- (user invites, user listing) is unavailable to this project. This
-- migration adds admin-gated management paths that work within that
-- constraint; auth-user creation itself stays manual via the Supabase
-- Dashboard (Authentication -> Add user) until a service-role decision is
-- made. The Admin UI (app/admin/staff) documents that manual step.
--
-- New objects (nothing existing is altered or dropped; no data touched):
--   app.staff_invites .............. pending email+role grants, consumed by
--                                     the hook on the invitee's first token
--   public.admin_list_staff() ...... admin-only roster: active staff_users
--                                     rows (with auth email) + pending invites
--   public.admin_invite_staff() .... admin-only pending-grant creation
--   public.admin_revoke_invite() ... admin-only pending-grant revocation
--   public.admin_set_staff_role() .. admin-only role change (refuses to
--                                     leave zero admins)
--   public.admin_remove_staff() .... admin-only deactivation = delete the
--                                     role mapping (refuses self-removal and
--                                     removing the last admin)
-- app.custom_access_token_hook is REPLACED with an extended body: the
-- original staff_users lookup and claim logic are byte-identical; a new
-- branch consumes a pending invite (matched case-insensitively on the
-- auth user's email) only when no staff row exists yet. Live sessions
-- cannot be revoked without the Admin API: deactivation takes effect on
-- next token refresh, and urgent cases must additionally ban the user via
-- the Dashboard (documented in the Admin UI, not silently assumed).
--
-- All RPCs are SECURITY DEFINER with in-body admin checks (016 pattern)
-- and fail closed (42501) on ambiguous states.

-- ─── pending role grants ────────────────────────────────────────────────
create table app.staff_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null,
  role app.staff_role not null,
  display_name text,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One pending grant per email (case-insensitive); re-inviting is an error,
-- never a silent duplicate.
create unique index staff_invites_email_uniq on app.staff_invites (lower(email));

alter table app.staff_invites enable row level security;

-- No direct client access at all: no policies, grants revoked below. The
-- DEFINER RPCs below are the only read/write path (they run as the table
-- owner and bypass RLS; the admin role is enforced inside each body).
revoke all on app.staff_invites from anon, authenticated, public;

-- ─── hook extension: consume a pending invite on first token ────────────
create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
-- VOLATILE (changed from 008's stable): the invite-consumption branch
-- below writes (staff_users insert + invite delete). Postgres forbids
-- writes in stable functions; per-token issuance calls this once, so no
-- planning regression. The pre-existing staff lookup path is untouched.
volatile
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role app.staff_role;
  v_invite app.staff_invites%rowtype;
  v_claims jsonb;
begin
  v_user_id := nullif(event ->> 'user_id', '')::uuid;

  select s.role into v_role
  from app.staff_users s
  where s.auth_user_id = v_user_id;

  -- No staff row yet: a pending grant for this auth user's email (matched
  -- case-insensitively, since the Dashboard and the admin may differ in
  -- case) becomes the role mapping exactly once. The invite is deleted only
  -- after the mapping verifiably exists, so a concurrent first login can
  -- never lose the grant (unique constraint + ON CONFLICT guard the race).
  if v_role is null and v_user_id is not null then
    select i.* into v_invite
    from app.staff_invites i
    where lower(i.email) = lower((select u.email from auth.users u where u.id = v_user_id));

    if found then
      insert into app.staff_users (auth_user_id, role, display_name)
        values (v_user_id, v_invite.role, v_invite.display_name)
        on conflict (auth_user_id) do nothing;

      select s.role into v_role
      from app.staff_users s
      where s.auth_user_id = v_user_id;

      if v_role is not null then
        delete from app.staff_invites where id = v_invite.id;
      end if;
    end if;
  end if;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  if v_role is not null then
    v_claims := jsonb_set(
      v_claims,
      '{app_metadata,user_role}',
      to_jsonb(v_role),
      true
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims, true);
end;
$$;

-- Grants on the hook are unchanged (supabase_auth_admin only); restate for
-- auditability after the replace.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
    revoke execute on function app.custom_access_token_hook(jsonb) from public, anon, authenticated;
  end if;
end
$$;

-- ─── roster: active mappings + pending grants, admin only ───────────────
create or replace function public.admin_list_staff()
returns table (
  staff_id uuid,
  auth_user_id uuid,
  email text,
  role text,
  display_name text,
  status text,
  created_at timestamptz,
  -- Invite rows carry their pending-grant id (needed to revoke); active
  -- staff rows carry NULL here and are addressed by staff_id instead.
  invite_id uuid
)
language plpgsql
security definer
stable
set search_path = '' as
$func$
begin
  if (select app.request_role()) is distinct from 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  -- Only ever staff and invitees: auth.users is joined, never dumped.
  return query
    select s.id, s.auth_user_id, u.email,
           s.role::text, s.display_name, 'active'::text, s.created_at,
           null::uuid
    from app.staff_users s
    join auth.users u on u.id = s.auth_user_id
  union all
    select null::uuid, u.id, i.email,
           i.role::text, i.display_name, 'invited'::text, i.created_at,
           i.id
    from app.staff_invites i
    left join auth.users u on lower(u.email) = lower(i.email)
    where not exists (
      select 1 from app.staff_users s2
      join auth.users u2 on u2.id = s2.auth_user_id
      where lower(u2.email) = lower(i.email)
    )
  -- Positional ORDER BY: the OUT parameter names (status, email) are also
  -- plpgsql variables, which a UNION ORDER BY cannot resolve by name.
  order by 6, 3;
end;
$func$;

revoke execute on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

-- ─── pending-grant creation, admin only ────────────────────────────────
create or replace function public.admin_invite_staff(
  p_email text,
  p_role text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = '' as
$func$
declare
  v_email text;
  v_role app.staff_role;
  v_display_name text;
  v_row jsonb;
begin
  if (select app.request_role()) is distinct from 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  -- Email: trimmed, bounded, single @, no spaces or control characters.
  -- Shape check only — the real account is created via the Dashboard.
  v_email := btrim(coalesce(p_email, ''));
  if v_email = '' or char_length(v_email) > 254
     or v_email ~ '[[:cntrl:] ]'
     or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'invalid email address' using errcode = '22000';
  end if;

  if p_role is null or btrim(p_role) not in ('admin', 'manager', 'cashier') then
    raise exception 'role must be admin, manager, or cashier' using errcode = '22000';
  end if;
  v_role := btrim(p_role)::app.staff_role;

  v_display_name := nullif(btrim(coalesce(p_display_name, '')), '');
  if v_display_name is not null
     and (char_length(v_display_name) > 200 or v_display_name ~ '[[:cntrl:]]') then
    raise exception 'display name is malformed' using errcode = '22000';
  end if;

  -- Already active staff: point at role change instead of double-granting.
  if exists (
    select 1 from app.staff_users s
    join auth.users u on u.id = s.auth_user_id
    where lower(u.email) = lower(v_email)
  ) then
    raise exception 'that email is already active staff — change its role instead of inviting' using errcode = '22000';
  end if;

  if exists (select 1 from app.staff_invites i where lower(i.email) = lower(v_email)) then
    raise exception 'an invite is already pending for that email' using errcode = '22000';
  end if;

  insert into app.staff_invites (email, role, display_name, invited_by)
    values (v_email, v_role, v_display_name, (select auth.uid()))
    returning to_jsonb(staff_invites) into v_row;

  return v_row;
end;
$func$;

revoke execute on function public.admin_invite_staff(text, text, text) from public, anon;
grant execute on function public.admin_invite_staff(text, text, text) to authenticated;

-- ─── pending-grant revocation, admin only ──────────────────────────────
create or replace function public.admin_revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as
$func$
begin
  if (select app.request_role()) is distinct from 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  delete from app.staff_invites where id = p_invite_id;
  if not found then
    raise exception 'invite not found' using errcode = '02000';
  end if;
end;
$func$;

revoke execute on function public.admin_revoke_invite(uuid) from public, anon;
grant execute on function public.admin_revoke_invite(uuid) to authenticated;

-- ─── role change, admin only; never leave zero admins ──────────────────
create or replace function public.admin_set_staff_role(
  p_staff_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = '' as
$func$
declare
  v_role app.staff_role;
  v_row app.staff_users%rowtype;
  v_admin_count integer;
begin
  if (select app.request_role()) is distinct from 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_role is null or btrim(p_role) not in ('admin', 'manager', 'cashier') then
    raise exception 'role must be admin, manager, or cashier' using errcode = '22000';
  end if;
  v_role := btrim(p_role)::app.staff_role;

  select * into v_row from app.staff_users where id = p_staff_id;
  if not found then
    raise exception 'staff record not found' using errcode = '02000';
  end if;

  -- Same role: no-op success (idempotent re-runs change nothing).
  if v_row.role = v_role then
    return to_jsonb(v_row);
  end if;

  -- Demoting an admin must never leave zero admins.
  if v_row.role = 'admin' and v_role <> 'admin' then
    select count(*) into v_admin_count from app.staff_users where role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'cannot demote the last admin' using errcode = '42501';
    end if;
  end if;

  update app.staff_users set role = v_role where id = p_staff_id
    returning * into v_row;

  return to_jsonb(v_row);
end;
$func$;

revoke execute on function public.admin_set_staff_role(uuid, text) from public, anon;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;

-- ─── deactivation = delete the role mapping, admin only ────────────────
-- The claim disappears on the user's next token refresh. Live sessions are
-- NOT revoked here (impossible without the Admin API); urgent cases must
-- additionally ban the user via Dashboard -> Authentication.
create or replace function public.admin_remove_staff(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as
$func$
declare
  v_row app.staff_users%rowtype;
  v_admin_count integer;
begin
  if (select app.request_role()) is distinct from 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  select * into v_row from app.staff_users where id = p_staff_id;
  if not found then
    raise exception 'staff record not found' using errcode = '02000';
  end if;

  -- Lockout protection: an admin can never remove their own mapping through
  -- this path (use direct SQL for the truly exceptional case).
  if v_row.auth_user_id = (select auth.uid()) then
    raise exception 'cannot remove your own staff record' using errcode = '42501';
  end if;

  if v_row.role = 'admin' then
    select count(*) into v_admin_count from app.staff_users where role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'cannot remove the last admin' using errcode = '42501';
    end if;
  end if;

  delete from app.staff_users where id = p_staff_id;
end;
$func$;

revoke execute on function public.admin_remove_staff(uuid) from public, anon;
grant execute on function public.admin_remove_staff(uuid) to authenticated;
