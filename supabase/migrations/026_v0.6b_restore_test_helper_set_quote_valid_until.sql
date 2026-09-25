-- 026: Restore test helper set_quote_valid_until after premature retirement
-- Re-create function with same definition as 024 for certification tests
-- SECURITY DEFINER, admin/manager role check

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
