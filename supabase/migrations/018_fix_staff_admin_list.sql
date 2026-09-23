-- 018: repair admin_list_staff result-type mismatch (live 42804).
--
-- Observed live defect: public.admin_list_staff() executes its role check
-- correctly (anon denied at the grant boundary, manager/cashier denied
-- in-body with 42501) but the admin call fails with:
--   42804 — structure of query does not match function result type
-- The deployed body therefore returns a row shape that does not match its
-- declared RETURNS TABLE. Root-cause class: the 017 body selects
-- auth.users.email (character varying(255) on hosted Supabase, text in the
-- local pgTAP shim) and relies on implicit UNION/assignment coercion; any
-- stale or partially-applied deployed variant of that body breaks the
-- rowtype check at runtime for the admin caller only.
--
-- This migration does NOT touch 015/016/017. It redefines ONLY
-- public.admin_list_staff() with:
--   - identical signature: admin_list_staff() — no arguments
--   - identical declared RETURNS TABLE (names, order, types)
--   - identical contract: SECURITY DEFINER, search_path = '',
--     admin-only in-body check (42501 fail-closed), active staff rows
--     (addressed by staff_id) + pending invites (addressed by invite_id,
--     case-insensitive anti-join), positional ORDER BY (OUT names are
--     plpgsql variables and cannot be used in a UNION ORDER BY by name)
--   - explicit casts on EVERY selected expression so the RETURN QUERY
--     output type is fixed at creation time and cannot drift with the
--     underlying column types (varchar vs text) ever again
--   - identical grants: execute revoked from public/anon, granted to
--     authenticated (the in-body role check remains the authorizer)
--
-- Safe to run once; re-running is a no-op replace with the same body.

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
  -- Every expression is cast explicitly to its RETURNS TABLE type so a
  -- varchar(255)/text drift in auth.users.email (or any future column
  -- change underneath) can never produced a 42804 rowtype mismatch again.
  return query
    select s.id::uuid,
           s.auth_user_id::uuid,
           u.email::text,
           s.role::text,
           s.display_name::text,
           'active'::text,
           s.created_at::timestamptz,
           null::uuid
    from app.staff_users s
    join auth.users u on u.id = s.auth_user_id
  union all
    select null::uuid,
           u.id::uuid,
           i.email::text,
           i.role::text,
           i.display_name::text,
           'invited'::text,
           i.created_at::timestamptz,
           i.id::uuid
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
