-- 032: Fix payment functions to reference offered_price instead of non-existent accepted_amount
CREATE OR REPLACE FUNCTION public.customer_submit_payment(
  p_quote_token text,
  p_provider_reference text,
  p_payer_phone text default null,
  p_payer_name text default null,
  p_payment_channel text default 'mpesa'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quote app.quote_requests%rowtype;
  v_acceptance record;
  v_required_amount numeric(12,2);
  v_payment_id uuid;
  v_norm_ref text;
BEGIN
  select qr.* into v_quote
  from app.quote_requests qr
  where qr.secret_token::text = p_quote_token;
  if not found then raise exception 'Invalid quote token'; end if;
  if v_quote.status <> 'accepted' then raise exception 'Quote not accepted'; end if;
  select * into v_acceptance from app.quote_acceptances qa where qa.quote_id = v_quote.id limit 1;
  if not found then raise exception 'No acceptance evidence'; end if;
  v_required_amount := v_acceptance.offered_price;
  v_norm_ref := upper(btrim(coalesce(p_provider_reference, '')));
  if v_norm_ref !~ '^[A-Z0-9]{10}$' then raise exception 'Provider reference must be 10 uppercase alphanumeric characters'; end if;
  if p_payment_channel not in ('mpesa','cash_at_branch','card_at_branch','bank_transfer') then raise exception 'Invalid payment channel'; end if;
  if exists (select 1 from app.payments where quote_id = v_quote.id and upper(btrim(coalesce(provider_reference,''))) = v_norm_ref and payment_channel = p_payment_channel and status in ('pending_verification','verified')) then raise exception 'Duplicate payment reference for this quote'; end if;
  insert into app.payments (payment_number, quote_id, branch_id, amount, currency, payment_channel, status, provider, provider_reference, payer_phone, payer_name)
  values (app.generate_payment_number(), v_quote.id, v_quote.branch_id, v_required_amount, 'KES', p_payment_channel, 'pending_verification', 'manual', v_norm_ref, nullif(btrim(coalesce(p_payer_phone,'')),''), nullif(btrim(coalesce(p_payer_name,'')),'')) returning id into v_payment_id;
  return v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_verify_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_payment app.payments%rowtype;
  v_acceptance record;
BEGIN
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin','manager') then raise exception 'Forbidden: Only Admin and Manager can verify payments'; end if;
  select * into v_payment from app.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status <> 'pending_verification' then raise exception 'Payment not pending verification'; end if;
  select offered_price into v_acceptance from app.quote_acceptances where quote_id = v_payment.quote_id limit 1;
  if not found then raise exception 'No acceptance evidence for quote'; end if;
  if v_payment.amount <> v_acceptance.offered_price then raise exception 'Payment amount mismatch'; end if;
  update app.payments set status = 'verified', verified_by = (select id from app.staff_users where email = (auth.jwt() ->> 'email')), verified_at = now(), updated_at = now() where id = p_payment_id;
END;
$$;
