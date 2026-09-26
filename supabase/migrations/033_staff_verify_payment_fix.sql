-- 033: Fix staff_verify_payment to use auth.uid() instead of email lookup
CREATE OR REPLACE FUNCTION public.staff_verify_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_staff_id uuid;
  v_payment app.payments%rowtype;
  v_acceptance record;
BEGIN
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin','manager') then
    raise exception 'Forbidden: Only Admin and Manager can verify payments';
  end if;
  select id into v_staff_id from app.staff_users where auth_user_id = (select auth.uid()) limit 1;
  if not found then
    raise exception 'Staff user not found';
  end if;
  select * into v_payment from app.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'pending_verification' then
    raise exception 'Payment not pending verification';
  end if;
  select offered_price into v_acceptance from app.quote_acceptances where quote_id = v_payment.quote_id limit 1;
  if not found then
    raise exception 'No acceptance evidence for quote';
  end if;
  if v_payment.amount <> v_acceptance.offered_price then
    raise exception 'Payment amount mismatch';
  end if;
  update app.payments set status = 'verified', verified_by = v_staff_id, verified_at = now(), updated_at = now() where id = p_payment_id;
END;
$$;
