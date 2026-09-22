-- 009: M4 security gate. RLS lives on base tables ONLY; no policy is created
-- on any view. Tiered views are projection + JWT-claim predicate boundaries.
--
-- Privilege model (PROMPT 003B): base tables stay in the unexposed `app`
-- schema, which the Data API cannot address. `authenticated` keeps the
-- MINIMUM underlying privileges the security_invoker views need to function
-- (SELECT on app.products; writes revoked, fail-closed). Direct base access
-- is prevented by the unexposed-schema boundary, never by revoking the
-- SELECT the invoker views depend on.

-- Single role reader: invoker context, so it always sees the caller's JWT.
create or replace function app.request_role() returns text
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'user_role', '');
$$;

revoke execute on function app.request_role() from public;
grant execute on function app.request_role() to authenticated;

-- products: reads for staff rows, no client writes in v0.1.
revoke all on app.products from anon;
revoke insert, update, delete on app.products from authenticated;
grant select on app.products to authenticated;

create policy products_staff_read on app.products
  for select to authenticated
  using ((select app.request_role()) in ('admin', 'manager', 'cashier'));

-- staff_users: each staff member reads only their own row; no client writes.
revoke all on app.staff_users from anon;
revoke insert, update, delete on app.staff_users from authenticated;
grant select on app.staff_users to authenticated;

create policy staff_users_self_read on app.staff_users
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

-- branches/categories/services: no client readers in v0.1, fail closed.
revoke all on app.branches from anon, authenticated;
revoke all on app.categories from anon, authenticated;
revoke all on app.services from anon, authenticated;

-- Tiered read views. security_invoker=true is mandatory: the base-table
-- grants above and the base-table RLS below are evaluated as the invoker.
create view public.products_cashier with (security_invoker = true) as
select id, branch_id, category_id, name, sku, brand, size_spec,
       stock_quantity, status, created_at
from app.products
where (select app.request_role()) = 'cashier';

create view public.products_manager with (security_invoker = true) as
select id, branch_id, category_id, name, sku, brand, size_spec,
       cost_price, sell_price, stock_quantity, status, created_at
from app.products
where (select app.request_role()) in ('manager', 'admin');

create view public.products_admin with (security_invoker = true) as
select id, branch_id, category_id, name, sku, brand, size_spec,
       cost_price, sell_price, margin, stock_quantity, status, created_at
from app.products
where (select app.request_role()) = 'admin';

grant select on public.products_cashier to authenticated;
grant select on public.products_manager to authenticated;
grant select on public.products_admin to authenticated;
