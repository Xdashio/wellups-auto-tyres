-- SEED DATA — DEVELOPMENT/TEST ONLY. NEVER apply this file to a production
-- project. Every row here is placeholder content for exercising the schema:
-- the branch carries no address/phone/WhatsApp/hours (all NULL), product and
-- service names carry the mandatory `SEED ` prefix (enforced by
-- tests/seed_hygiene.test.ts), and no statistics or claims are made.
-- Production data loading uses supabase/production/ (retire script +
-- placeholder template) — see supabase/production/README.md.
-- Safe to re-run: inserts use fixed UUIDs with ON CONFLICT DO NOTHING.
-- Staff accounts are NOT seeded here (they require real Supabase Auth users);
-- see seed_staff.sql, which refuses to run until real auth user IDs are supplied.

-- One branch, placeholder name only, unconfirmed contact fields NULL.
insert into app.branches (id, name, address, phone, whatsapp, opening_hours)
values ('10000000-0000-0000-0000-000000000001', 'Industrial Area', null, null, null, null)
on conflict (id) do nothing;

insert into app.categories (id, name, description) values
  ('20000000-0000-0000-0000-000000000001', 'Tyres', 'SEED placeholder category'),
  ('20000000-0000-0000-0000-000000000002', 'Alloy Wheels', 'SEED placeholder category'),
  ('20000000-0000-0000-0000-000000000003', 'Batteries', 'SEED placeholder category'),
  ('20000000-0000-0000-0000-000000000004', 'Brake Parts', 'SEED placeholder category'),
  ('20000000-0000-0000-0000-000000000005', 'Filters', 'SEED placeholder category'),
  ('20000000-0000-0000-0000-000000000006', 'Engine Oil & Fluids', 'SEED placeholder category')
on conflict (id) do nothing;

insert into app.products
  (id, branch_id, category_id, name, sku, brand, size_spec, cost_price, sell_price, stock_quantity)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SEED All-Terrain Tyre 265/65R17', 'SEED-TYR-001', 'SEED Brand A', '265/65R17', 12000, 15500, 12),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SEED Highway Tyre 205/55R16', 'SEED-TYR-002', 'SEED Brand B', '205/55R16', 8500, 11000, 20),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SEED Mud-Terrain Tyre 31x10.5R15', 'SEED-TYR-003', 'SEED Brand C', '31x10.5R15', 14000, 18000, 8),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SEED City Tyre 175/65R14', 'SEED-TYR-004', 'SEED Brand A', '175/65R14', 6000, 7800, 30),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SEED Performance Tyre 225/45R18', 'SEED-TYR-005', 'SEED Brand D', '225/45R18', 16000, 20500, 6),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SEED Van Tyre 195R15C', 'SEED-TYR-006', 'SEED Brand B', '195R15C', 9000, 11500, 15),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'SEED Alloy Wheel 16in 5x114.3', 'SEED-WHL-001', 'SEED Brand E', '16in 5x114.3', 18000, 23000, 10),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'SEED Steel Wheel 15in 6x139.7', 'SEED-WHL-002', 'SEED Brand E', '15in 6x139.7', 7000, 9500, 18),
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'SEED Car Battery 12V 70Ah', 'SEED-BAT-001', 'SEED Brand F', '12V 70Ah', 11000, 14000, 14),
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'SEED Truck Battery 12V 100Ah', 'SEED-BAT-002', 'SEED Brand F', '12V 100Ah', 15000, 19000, 9),
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'SEED Front Brake Pad Set', 'SEED-BRK-001', 'SEED Brand G', 'Front axle set', 4500, 6000, 25),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'SEED Brake Disc Pair 280mm', 'SEED-BRK-002', 'SEED Brand G', '280mm pair', 8000, 10500, 11),
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 'SEED Oil Filter Spin-On', 'SEED-FLT-001', 'SEED Brand H', 'Spin-on', 800, 1200, 50),
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 'SEED Air Filter Panel', 'SEED-FLT-002', 'SEED Brand H', 'Panel', 1200, 1800, 40),
  ('30000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006', 'SEED Synthetic Oil 5W-30 4L', 'SEED-OIL-001', 'SEED Brand I', '5W-30 4L', 5500, 7200, 22)
on conflict (id) do nothing;

-- Services carry no price field by design (quote/inspection pricing).
insert into app.services (id, name, description, vehicle_types, is_available) values
  ('40000000-0000-0000-0000-000000000001', 'SEED Tyre Fitting', 'SEED placeholder service', '{Sedan,SUV,Pickup}', true),
  ('40000000-0000-0000-0000-000000000002', 'SEED Wheel Alignment', 'SEED placeholder service', '{Sedan,SUV,Pickup,Van}', true),
  ('40000000-0000-0000-0000-000000000003', 'SEED Wheel Balancing', 'SEED placeholder service', '{Sedan,SUV,Pickup,Van}', true),
  ('40000000-0000-0000-0000-000000000004', 'SEED Brake Service', 'SEED placeholder service', '{Sedan,SUV,Pickup}', true),
  ('40000000-0000-0000-0000-000000000005', 'SEED Oil Change', 'SEED placeholder service', '{Sedan,SUV,Pickup,Van}', true),
  ('40000000-0000-0000-0000-000000000006', 'SEED Battery Check & Replacement', 'SEED placeholder service', '{Sedan,SUV,Pickup,Van}', true),
  ('40000000-0000-0000-0000-000000000007', 'SEED Puncture Repair', 'SEED placeholder service', '{Sedan,SUV,Pickup,Van,Motorcycle}', true),
  ('40000000-0000-0000-0000-000000000008', 'SEED Suspension Inspection', 'SEED placeholder service', '{Sedan,SUV,Pickup}', true)
on conflict (id) do nothing;
