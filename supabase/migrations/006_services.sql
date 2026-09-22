-- 006: services. Deliberately NO price field: services are priced per quote/inspection.
create table app.services (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  description text,
  vehicle_types text[] not null default '{}',
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

alter table app.services enable row level security;
