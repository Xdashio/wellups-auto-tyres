-- 007: staff_users maps Supabase Auth users to application roles.
-- Application roles are JWT claims, not Postgres roles: no role named
-- admin/manager/cashier is ever created at the database level.
create table app.staff_users (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  role app.staff_role not null,
  display_name text,
  created_at timestamptz not null default now()
);

create index staff_users_auth_user_id_idx on app.staff_users using btree (auth_user_id);

alter table app.staff_users enable row level security;
