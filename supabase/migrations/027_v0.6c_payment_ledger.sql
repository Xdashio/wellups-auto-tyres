-- 027: V0.6C Payment Ledger + Manual Payment Verification
-- Forward-only migration. No alterations to historical migrations.
-- Payment ledger for accepted quotes. Manual verification only, 100% payment required.

create table if not exists app.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text unique not null,
  quote_id uuid not null references app.quote_requests(id) on delete cascade,
  branch_id uuid not null references app.branches(id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'KES',
  payment_channel text not null check (payment_channel in ('mpesa','cash_at_branch','card_at_branch','bank_transfer')),
  status text not null check (status in ('pending_verification','verified','rejected','cancelled')) default 'pending_verification',
  provider text not null default 'manual',
  provider_reference text,
  payer_phone text,
  payer_name text,
  verified_by uuid references app.staff_users(id),
  verified_at timestamptz,
  rejection_reason text,
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payment number generator
create or replace function app.generate_payment_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_num bigint;
begin
  select nextval('app.payment_number_seq') into v_num;
  return 'PAY-' || lpad(v_num::text, 8, '0');
end;
$$;

-- Sequence for payment numbers
create sequence if not exists app.payment_number_seq start 1;

-- Unique constraint: normalized provider reference cannot be reused for active payments
-- create unique index if not exists app.payments_provider_ref_channel_unique
-- on app.payments (upper(nullif(btrim(provider_reference), '')), payment_channel)
-- where provider_reference is not null and status in ('pending_verification','verified');


-- RLS
alter table app.payments enable row level security;

-- Policies: deny direct access via API, all access via RPCs
-- Allow staff read via security definer RPCs, no direct policies for anon/auth
create policy payments_no_direct_select on app.payments for select using (false);
create policy payments_no_direct_insert on app.payments for insert with check (false);
create policy payments_no_direct_update on app.payments for update using (false);
create policy payments_no_direct_delete on app.payments for delete using (false);

-- Updated at trigger
create or replace function app.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payments_updated_at on app.payments;
create trigger payments_updated_at
before update on app.payments
for each row execute function app.set_updated_at();

-- Customer submit payment
create or replace function public.customer_submit_payment(
  p_quote_token text,
  p_provider_reference text,
  p_payer_phone text default null,
  p_payer_name text default null,
  p_payment_channel text default 'mpesa'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote app.quote_requests%rowtype;
  v_acceptance record;
  v_required_amount numeric(12,2);
  v_payment_id uuid;
  v_norm_ref text;
begin
  -- Resolve quote via token
  select qr.* into v_quote
  from app.quote_requests qr
  where qr.token = p_quote_token;

  if not found then
    raise exception 'Invalid quote token';
  end if;

  -- Quote must be accepted
  if v_quote.status <> 'accepted' then
    raise exception 'Quote not accepted';
  end if;

  -- Must have acceptance evidence
  select * into v_acceptance
  from app.quote_acceptances qa
  where qa.quote_id = v_quote.id
  limit 1;

  if not found then
    raise exception 'No acceptance evidence';
  end if;

  -- Required amount from acceptance snapshot
  v_required_amount := v_acceptance.accepted_amount;

  -- Normalize reference
  v_norm_ref := upper(btrim(coalesce(p_provider_reference, '')));

  if v_norm_ref !~ '^[A-Z0-9]{10}$' then
    raise exception 'Provider reference must be 10 uppercase alphanumeric characters';
  end if;

  -- Payment channel validation
  if p_payment_channel not in ('mpesa','cash_at_branch','card_at_branch','bank_transfer') then
    raise exception 'Invalid payment channel';
  end if;

  -- Idempotency: check for existing payment with same normalized reference for this quote
  if exists (
    select 1 from app.payments
    where quote_id = v_quote.id
      and upper(btrim(coalesce(provider_reference,''))) = v_norm_ref
      and payment_channel = p_payment_channel
      and status in ('pending_verification','verified')
  ) then
    raise exception 'Duplicate payment reference for this quote';
  end if;

  -- Create payment with amount derived from acceptance
  insert into app.payments (
    payment_number,
    quote_id,
    branch_id,
    amount,
    currency,
    payment_channel,
    status,
    provider,
    provider_reference,
    payer_phone,
    payer_name
  ) values (
    app.generate_payment_number(),
    v_quote.id,
    v_quote.branch_id,
    v_required_amount,
    'KES',
    p_payment_channel,
    'pending_verification',
    'manual',
    v_norm_ref,
    nullif(btrim(coalesce(p_payer_phone,'')), ''),
    nullif(btrim(coalesce(p_payer_name,'')), '')
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.customer_submit_payment(text, text, text, text, text) from public, anon;
grant execute on function public.customer_submit_payment(text, text, text, text, text) to authenticated;

-- Customer get payments for quote
create or replace function public.customer_get_quote_payments(p_quote_token text)
returns table (
  id uuid,
  payment_number text,
  amount numeric,
  currency text,
  payment_channel text,
  status text,
  provider_reference text,
  payer_phone text,
  payer_name text,
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select p.id, p.payment_number, p.amount, p.currency, p.payment_channel, p.status,
         p.provider_reference, p.payer_phone, p.payer_name, p.verified_by, p.verified_at,
         p.rejection_reason, p.created_at
  from app.payments p
  join app.quote_requests qr on qr.id = p.quote_id
  where qr.token = p_quote_token;
end;
$$;

revoke all on function public.customer_get_quote_payments(text) from public, anon;
grant execute on function public.customer_get_quote_payments(text) to authenticated;

-- Staff get payment queue
create or replace function public.staff_get_payment_queue()
returns table (
  id uuid,
  payment_number text,
  quote_number text,
  customer_name text,
  customer_phone text,
  amount numeric,
  currency text,
  payment_channel text,
  provider_reference text,
  status text,
  created_at timestamptz,
  branch_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin','manager') then
    raise exception 'Forbidden: Only Admin and Manager can view payment queue';
  end if;

  return query
  select p.id, p.payment_number, qr.quote_number, qr.customer_name, qr.customer_phone,
         p.amount, p.currency, p.payment_channel, p.provider_reference, p.status,
         p.created_at, b.name
  from app.payments p
  join app.quote_requests qr on qr.id = p.quote_id
  join app.branches b on b.id = p.branch_id
  order by p.created_at desc;
end;
$$;

revoke all on function public.staff_get_payment_queue() from public, anon;
grant execute on function public.staff_get_payment_queue() to authenticated;

-- Staff verify payment
create or replace function public.staff_verify_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_payment app.payments%rowtype;
  v_acceptance record;
begin
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin','manager') then
    raise exception 'Forbidden: Only Admin and Manager can verify payments';
  end if;

  select * into v_payment from app.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status <> 'pending_verification' then
    raise exception 'Payment not pending verification';
  end if;

  -- Verify amount matches acceptance
  select accepted_amount into v_acceptance from app.quote_acceptances where quote_id = v_payment.quote_id limit 1;
  if not found then
    raise exception 'No acceptance evidence for quote';
  end if;

  if v_payment.amount <> v_acceptance.accepted_amount then
    raise exception 'Payment amount mismatch';
  end if;

  -- Get staff user id
  update app.payments
  set status = 'verified',
      verified_by = (select id from app.staff_users where email = (auth.jwt() ->> 'email')),
      verified_at = now(),
      updated_at = now()
  where id = p_payment_id;
end;
$$;

revoke all on function public.staff_verify_payment(uuid) from public, anon;
grant execute on function public.staff_verify_payment(uuid) to authenticated;

-- Staff reject payment
create or replace function public.staff_reject_payment(p_payment_id uuid, p_rejection_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin','manager') then
    raise exception 'Forbidden: Only Admin and Manager can reject payments';
  end if;

  if btrim(coalesce(p_rejection_reason,'')) = '' then
    raise exception 'Rejection reason required';
  end if;

  update app.payments
  set status = 'rejected',
      rejection_reason = btrim(p_rejection_reason),
      verified_by = (select id from app.staff_users where email = (auth.jwt() ->> 'email')),
      verified_at = now(),
      updated_at = now()
  where id = p_payment_id
    and status = 'pending_verification';

  if not found then
    raise exception 'Payment not found or not pending';
  end if;
end;
$$;

revoke all on function public.staff_reject_payment(uuid, text) from public, anon;
grant execute on function public.staff_reject_payment(uuid, text) to authenticated;

-- Note: typo coalescoes above needs fix, will correct
