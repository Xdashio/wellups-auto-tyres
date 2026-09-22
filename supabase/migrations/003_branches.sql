-- 003: branches. v0.1 holds exactly one placeholder row (see seed);
-- every contact/location field stays nullable so "unconfirmed" is the schema default.
create table app.branches (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  address text,
  phone text,
  whatsapp text,
  opening_hours text,
  created_at timestamptz not null default now()
);

alter table app.branches enable row level security;
