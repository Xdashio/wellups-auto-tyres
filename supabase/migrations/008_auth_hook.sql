-- 008: custom access-token hook. Single request-time role source.
-- Wiring (dashboard, Auth -> Hooks -> Custom Access Token): app.custom_access_token_hook.
-- The hook is SECURITY DEFINER by necessity: it runs during token issuance as
-- supabase_auth_admin and must read app.staff_users regardless of the caller's
-- row policies. This is safe because (a) search_path is pinned to '' with all
-- names schema-qualified, (b) the function lives in the unexposed `app` schema
-- so it is not callable through the Data API, and (c) execute is granted only
-- to supabase_auth_admin. No other definer functions exist in v0.1.
-- Required Auth setting: access-token (JWT) expiry TTL, default 3600s, recorded in
-- docs and the deployment checklist. Urgent demotions additionally require admin
-- session revocation (forced sign-off); the hook alone cannot invalidate live tokens.
create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_role app.staff_role;
  v_claims jsonb;
begin
  select s.role into v_role
  from app.staff_users s
  where s.auth_user_id = nullif(event ->> 'user_id', '')::uuid;

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

-- Supabase executes hooks as supabase_auth_admin; absent locally, grant conditionally.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
    revoke execute on function app.custom_access_token_hook(jsonb) from public, anon, authenticated;
  end if;
end
$$;
