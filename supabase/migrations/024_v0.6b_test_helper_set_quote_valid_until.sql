-- 024: Test helper for V0.6B certification: allow admin/manager to set quote valid_until for expiration simulation
-- Forward-only, does not alter business logic. Used only in live certification tests.
-- SECURITY DEFINER to bypass RLS for test data manipulation.

create or replace function public.test_set_quote_valid_until(
  p_quote_id uuid,
  p_valid_until timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin', 'manager') then
    raise exception 'Forbidden: Only Admin and Manager roles can use test helper';
  end if;

  update app.quote_requests
  set valid_until = p_valid_until,
      updated_at = pg_catalog.now()
  where id = p_quote_id;

  if not found then
    raise exception 'Quote not found';
  end if;
end;
$$;

revoke all on function public.test_set_quote_valid_until(uuid, timestamptz) from public, anon;
grant execute on function public.test_set_quote_valid_until(uuid, timestamptz) to authenticated;
