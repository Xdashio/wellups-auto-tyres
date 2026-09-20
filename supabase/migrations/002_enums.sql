-- 002: application role enum. No Owner role exists by design.
do $$ begin
  create type app.staff_role as enum ('admin', 'manager', 'cashier');
exception when duplicate_object then null;
end $$;
