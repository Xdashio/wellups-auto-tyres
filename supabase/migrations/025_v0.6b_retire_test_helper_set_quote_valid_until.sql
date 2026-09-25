-- 025: Retire test helper used for V0.6B certification
-- The test_set_quote_valid_until function allowed admin/manager to directly modify quote valid_until
-- for expiration simulation testing. It is not part of production business logic and should not remain
-- callable in production. This migration revokes execution and drops the function.

revoke all on function public.test_set_quote_valid_until(uuid, timestamptz) from authenticated, public, anon;

drop function if exists public.test_set_quote_valid_until(uuid, timestamptz);
