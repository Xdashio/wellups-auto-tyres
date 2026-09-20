-- SEED STAFF TEMPLATE — manual step, never auto-applied.
-- 1. Create three development users (Admin, Manager, Cashier) in the Supabase
--    dashboard (Auth -> Users). Do NOT use real credentials.
-- 2. Replace the placeholder UUIDs below with the real auth.users ids.
-- 3. Run this file once against the project. It refuses to run unedited:
--    the all-zero UUIDs below violate the auth.users foreign key by design.
insert into app.staff_users (auth_user_id, role, display_name) values
  ('00000000-0000-0000-0000-000000000000', 'admin', 'SEED Test Admin'),
  ('00000000-0000-0000-0000-000000000000', 'manager', 'SEED Test Manager'),
  ('00000000-0000-0000-0000-000000000000', 'cashier', 'SEED Test Cashier');
