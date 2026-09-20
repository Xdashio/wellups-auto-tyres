-- 005: products. margin is a stored generated column (sell_price - cost_price);
-- field visibility is enforced by tiered views (M4), never by the base table.
-- No public price is rendered from this table; sell_price exists for internal
-- margin math and future accepted-quote population.
create table app.products (
  id uuid primary key default extensions.gen_random_uuid(),
  branch_id uuid not null references app.branches (id),
  category_id uuid references app.categories (id),
  name text not null,
  sku text not null unique,
  brand text,
  size_spec text,
  cost_price numeric(12, 2) not null check (cost_price >= 0),
  sell_price numeric(12, 2) not null check (sell_price >= 0),
  margin numeric(12, 2) generated always as (sell_price - cost_price) stored,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index products_branch_id_idx on app.products using btree (branch_id);
create index products_category_id_idx on app.products using btree (category_id);

alter table app.products enable row level security;
