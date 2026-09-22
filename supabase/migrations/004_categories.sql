-- 004: categories, shared taxonomy across products and services.
create table app.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

alter table app.categories enable row level security;
