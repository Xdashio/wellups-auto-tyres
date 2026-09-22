-- 010: v0.2 public catalog projections & normalized vehicle fitment hierarchy.

-- 1. Vehicle Hierarchy Base Tables (in unexposed `app` schema)
create table if not exists app.vehicle_makes (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  country_origin text,
  created_at timestamptz not null default now()
);

create table if not exists app.vehicle_models (
  id uuid primary key default extensions.gen_random_uuid(),
  make_id uuid not null references app.vehicle_makes(id) on delete cascade,
  name text not null,
  body_type text,
  created_at timestamptz not null default now(),
  unique (make_id, name)
);

create table if not exists app.vehicle_trims (
  id uuid primary key default extensions.gen_random_uuid(),
  model_id uuid not null references app.vehicle_models(id) on delete cascade,
  name text not null,
  year_start int not null,
  year_end int,
  created_at timestamptz not null default now()
);

create table if not exists app.vehicle_fitments (
  id uuid primary key default extensions.gen_random_uuid(),
  trim_id uuid not null references app.vehicle_trims(id) on delete cascade,
  tyre_size_spec text not null,
  fitment_type text not null default 'standard',
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists vehicle_models_make_id_idx on app.vehicle_models(make_id);
create index if not exists vehicle_trims_model_id_idx on app.vehicle_trims(model_id);
create index if not exists vehicle_fitments_trim_id_idx on app.vehicle_fitments(trim_id);
create index if not exists vehicle_fitments_tyre_size_idx on app.vehicle_fitments(tyre_size_spec);

-- Enable RLS on vehicle base tables
alter table app.vehicle_makes enable row level security;
alter table app.vehicle_models enable row level security;
alter table app.vehicle_trims enable row level security;
alter table app.vehicle_fitments enable row level security;

-- Fail-closed RLS policies for invoker views
create policy vehicle_makes_read on app.vehicle_makes for select to anon, authenticated using (true);
create policy vehicle_models_read on app.vehicle_models for select to anon, authenticated using (true);
create policy vehicle_trims_read on app.vehicle_trims for select to anon, authenticated using (true);
create policy vehicle_fitments_read on app.vehicle_fitments for select to anon, authenticated using (true);

-- Revoke write privileges from client roles on vehicle tables
revoke all on app.vehicle_makes from anon, authenticated;
revoke all on app.vehicle_models from anon, authenticated;
revoke all on app.vehicle_trims from anon, authenticated;
revoke all on app.vehicle_fitments from anon, authenticated;

grant select on app.vehicle_makes to anon, authenticated;
grant select on app.vehicle_models to anon, authenticated;
grant select on app.vehicle_trims to anon, authenticated;
grant select on app.vehicle_fitments to anon, authenticated;

-- 2. Public Base Table Policies for Products, Services, Categories, Branches
drop policy if exists products_public_read on app.products;
create policy products_public_read on app.products
  for select to anon, authenticated
  using (status != 'discontinued');

drop policy if exists services_public_read on app.services;
create policy services_public_read on app.services
  for select to anon, authenticated
  using (is_available = true);

drop policy if exists categories_public_read on app.categories;
create policy categories_public_read on app.categories
  for select to anon, authenticated
  using (true);

drop policy if exists branches_public_read on app.branches;
create policy branches_public_read on app.branches
  for select to anon, authenticated
  using (true);

-- Grants on unexposed base lookup tables for invoker views
grant select on app.products to anon, authenticated;
grant select on app.categories to anon, authenticated;
grant select on app.services to anon, authenticated;
grant select on app.branches to anon, authenticated;

-- 3. Public Projection Views (security_invoker = true)

-- Public Products View: NO sell_price, NO cost_price, NO margin, NO stock_quantity
drop view if exists public.products_public;
create view public.products_public with (security_invoker = true) as
select id, branch_id, category_id, name, sku, brand, size_spec,
       status, created_at
from app.products
where status != 'discontinued';

-- Public Categories View
drop view if exists public.categories_public;
create view public.categories_public with (security_invoker = true) as
select id, name, description
from app.categories;

-- Public Services View
drop view if exists public.services_public;
create view public.services_public with (security_invoker = true) as
select id, name, description, vehicle_types, is_available
from app.services
where is_available = true;

-- Public Branches View
drop view if exists public.branches_public;
create view public.branches_public with (security_invoker = true) as
select id, name, address, phone, whatsapp, opening_hours
from app.branches;

-- Public Vehicle Fitments View
drop view if exists public.vehicle_fitments_public;
create view public.vehicle_fitments_public with (security_invoker = true) as
select
  f.id as fitment_id,
  m.id as make_id,
  m.name as make_name,
  mo.id as model_id,
  mo.name as model_name,
  t.id as trim_id,
  t.name as trim_name,
  t.year_start,
  t.year_end,
  f.tyre_size_spec,
  f.fitment_type,
  f.is_verified
from app.vehicle_fitments f
join app.vehicle_trims t on t.id = f.trim_id
join app.vehicle_models mo on mo.id = t.model_id
join app.vehicle_makes m on m.id = mo.make_id
where f.is_verified = true;

-- Explicit Public View Grants
grant select on public.products_public to anon, authenticated;
grant select on public.categories_public to anon, authenticated;
grant select on public.services_public to anon, authenticated;
grant select on public.branches_public to anon, authenticated;
grant select on public.vehicle_fitments_public to anon, authenticated;
