-- 021: V0.6B In-App Quote Conversation & Commercial Audit Timeline
--
-- Implements:
--   1. app.quote_messages — single append-only ledger for conversation + audit events
--   2. RLS + privilege lockdown: immutable, no direct client writes
--   3. public.get_quote_messages() — guest token-gated retrieval
--   4. public.send_quote_message() — customer message via token
--   5. public.staff_send_quote_message() — authenticated staff message
--   6. public.staff_get_quote_messages() — staff retrieval (no token needed)
--   7. System event injection into existing RPCs:
--      - create_quote_request → quote_created
--      - staff_respond_to_quote → quote_reviewed / quote_priced
--      - customer_respond_to_quote → quote_accepted / quote_declined

-- ─── 1. Base Table: app.quote_messages ──────────────────────────────────────

create table if not exists app.quote_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  quote_id uuid not null references app.quote_requests(id) on delete cascade,

  -- Sender classification
  sender_type text not null check (sender_type in ('customer', 'staff', 'system')),
  staff_id uuid references app.staff_users(id) on delete set null,
  sender_display_name text not null,

  -- Message content (nullable for system events that use event_type only)
  message_body text check (
    message_body is null or (
      pg_catalog.char_length(pg_catalog.btrim(message_body)) > 0
      and pg_catalog.char_length(message_body) <= 2000
    )
  ),

  -- Commercial audit event marker (null for regular chat messages)
  event_type text check (event_type is null or event_type in (
    'quote_created',
    'quote_reviewed',
    'quote_priced',
    'quote_accepted',
    'quote_declined',
    'customer_message',
    'staff_message'
  )),
  event_metadata jsonb default null,

  created_at timestamptz not null default pg_catalog.now()
);

-- Ensure either message_body or event_type is present
alter table app.quote_messages
  add constraint quote_messages_content_check
  check (message_body is not null or event_type is not null);

-- Performance indexes
create index if not exists quote_messages_quote_id_created_at_idx
  on app.quote_messages(quote_id, created_at asc);

create index if not exists quote_messages_event_type_idx
  on app.quote_messages(event_type)
  where event_type is not null;

-- ─── 2. Row Level Security & Immutability ───────────────────────────────────

alter table app.quote_messages enable row level security;

-- Revoke ALL direct mutations from all client roles
revoke all on app.quote_messages from anon, public;
revoke insert, update, delete on app.quote_messages from authenticated;
grant select on app.quote_messages to authenticated;

-- Staff can SELECT messages for quotes they are authorized to see
drop policy if exists quote_messages_staff_select on app.quote_messages;
create policy quote_messages_staff_select on app.quote_messages
  for select to authenticated
  using (
    (select app.request_role()) in ('admin', 'manager', 'cashier')
  );

-- Explicit deny: no UPDATE or DELETE policies exist, making the table append-only
-- All writes go through SECURITY DEFINER RPCs

-- ─── 3. RPC: Get Quote Messages (Guest Token-Gated) ────────────────────────

create or replace function public.get_quote_messages(
  p_quote_id uuid,
  p_token uuid
)
returns table (
  id uuid,
  quote_id uuid,
  sender_type text,
  sender_display_name text,
  message_body text,
  event_type text,
  event_metadata jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    m.id,
    m.quote_id,
    m.sender_type,
    m.sender_display_name,
    m.message_body,
    m.event_type,
    m.event_metadata,
    m.created_at
  from app.quote_messages m
  join app.quote_requests q on q.id = m.quote_id
  where m.quote_id = p_quote_id
    and q.secret_token = p_token
  order by m.created_at asc;
$$;

revoke all on function public.get_quote_messages(uuid, uuid) from public;
grant execute on function public.get_quote_messages(uuid, uuid) to anon, authenticated;

-- ─── 4. RPC: Staff Get Quote Messages (Authenticated, No Token) ─────────────

create or replace function public.staff_get_quote_messages(
  p_quote_id uuid
)
returns table (
  id uuid,
  quote_id uuid,
  sender_type text,
  staff_id uuid,
  sender_display_name text,
  message_body text,
  event_type text,
  event_metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_role text;
begin
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin', 'manager', 'cashier') then
    raise exception 'Forbidden: staff role required' using errcode = '42501';
  end if;

  -- Verify quote exists
  if not exists (select 1 from app.quote_requests where app.quote_requests.id = p_quote_id) then
    raise exception 'Quote not found';
  end if;

  return query
    select
      m.id,
      m.quote_id,
      m.sender_type,
      m.staff_id,
      m.sender_display_name,
      m.message_body,
      m.event_type,
      m.event_metadata,
      m.created_at
    from app.quote_messages m
    where m.quote_id = p_quote_id
    order by m.created_at asc;
end;
$$;

revoke all on function public.staff_get_quote_messages(uuid) from public, anon;
grant execute on function public.staff_get_quote_messages(uuid) to authenticated;

-- ─── 5. RPC: Customer Send Message (Token-Gated) ────────────────────────────

create or replace function public.send_quote_message(
  p_quote_id uuid,
  p_token uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote app.quote_requests%rowtype;
  v_msg_id uuid;
begin
  -- 1. Validate message content
  if p_message is null or pg_catalog.char_length(pg_catalog.btrim(p_message)) = 0 then
    raise exception 'Message cannot be empty';
  end if;
  if pg_catalog.char_length(p_message) > 2000 then
    raise exception 'Message exceeds maximum length of 2000 characters';
  end if;

  -- 2. Validate token and fetch quote
  select * into v_quote
  from app.quote_requests
  where app.quote_requests.id = p_quote_id
    and app.quote_requests.secret_token = p_token;

  if not found then
    raise exception 'Invalid quote or token';
  end if;

  -- 3. Only allow messaging on active quotes (not expired/declined)
  if v_quote.status in ('declined') then
    raise exception 'Cannot send messages on a declined quote';
  end if;

  -- Check dynamic expiry
  if v_quote.status = 'quoted' and v_quote.valid_until is not null and v_quote.valid_until < pg_catalog.now() then
    raise exception 'Cannot send messages on an expired quote';
  end if;

  -- 4. Insert customer message
  insert into app.quote_messages (
    quote_id,
    sender_type,
    sender_display_name,
    message_body,
    event_type,
    created_at
  ) values (
    p_quote_id,
    'customer',
    v_quote.customer_name,
    p_message,
    'customer_message',
    pg_catalog.now()
  )
  returning app.quote_messages.id into v_msg_id;

  return v_msg_id;
end;
$$;

revoke all on function public.send_quote_message(uuid, uuid, text) from public;
grant execute on function public.send_quote_message(uuid, uuid, text) to anon, authenticated;

-- ─── 6. RPC: Staff Send Message (Authenticated) ────────────────────────────

create or replace function public.staff_send_quote_message(
  p_quote_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_staff_id uuid;
  v_staff_name text;
  v_quote_exists boolean;
  v_msg_id uuid;
begin
  -- 1. Enforce staff role
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin', 'manager') then
    raise exception 'Forbidden: Only Admin and Manager roles can send quote messages' using errcode = '42501';
  end if;

  -- 2. Validate message content
  if p_message is null or pg_catalog.char_length(pg_catalog.btrim(p_message)) = 0 then
    raise exception 'Message cannot be empty';
  end if;
  if pg_catalog.char_length(p_message) > 2000 then
    raise exception 'Message exceeds maximum length of 2000 characters';
  end if;

  -- 3. Verify quote exists
  select exists(select 1 from app.quote_requests where app.quote_requests.id = p_quote_id) into v_quote_exists;
  if not v_quote_exists then
    raise exception 'Quote not found';
  end if;

  -- 4. Derive staff identity
  select s.id, s.display_name into v_staff_id, v_staff_name
  from app.staff_users s
  where s.auth_user_id = (select auth.uid());

  if v_staff_id is null then
    raise exception 'Staff user not found';
  end if;

  -- 5. Insert staff message
  insert into app.quote_messages (
    quote_id,
    sender_type,
    staff_id,
    sender_display_name,
    message_body,
    event_type,
    created_at
  ) values (
    p_quote_id,
    'staff',
    v_staff_id,
    coalesce(v_staff_name, 'Staff'),
    p_message,
    'staff_message',
    pg_catalog.now()
  )
  returning app.quote_messages.id into v_msg_id;

  return v_msg_id;
end;
$$;

revoke all on function public.staff_send_quote_message(uuid, text) from public, anon;
grant execute on function public.staff_send_quote_message(uuid, text) to authenticated;

-- ─── 7. Augment existing RPCs with system event generation ──────────────────

-- 7a. Augment create_quote_request to emit quote_created event
-- We re-create the function to add the event insert atomically

create or replace function public.create_quote_request(
  p_branch_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_item_type app.quote_item_type default 'product',
  p_product_id uuid default null,
  p_service_id uuid default null,
  p_vehicle_fitment_id uuid default null,
  p_vehicle_summary text default null,
  p_quantity integer default 1,
  p_customer_notes text default null
)
returns table(id uuid, quote_number text, secret_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_quote_number text;
  v_secret_token uuid;
begin
  -- Validate required fields
  if p_customer_name is null or pg_catalog.char_length(pg_catalog.btrim(p_customer_name)) = 0 then
    raise exception 'Customer name is required';
  end if;
  if p_customer_phone is null or pg_catalog.char_length(pg_catalog.btrim(p_customer_phone)) = 0 then
    raise exception 'Customer phone is required';
  end if;

  -- Generate quote number
  v_quote_number := app.generate_quote_number();
  v_secret_token := extensions.gen_random_uuid();
  v_id := extensions.gen_random_uuid();

  -- Insert the quote request
  insert into app.quote_requests (
    id, quote_number, branch_id,
    customer_id, customer_name, customer_phone, customer_email,
    item_type, product_id, service_id,
    vehicle_fitment_id, vehicle_summary,
    quantity, customer_notes,
    status, secret_token,
    created_at, updated_at
  ) values (
    v_id, v_quote_number, p_branch_id,
    (select auth.uid()), p_customer_name, p_customer_phone, p_customer_email,
    p_item_type, p_product_id, p_service_id,
    p_vehicle_fitment_id, p_vehicle_summary,
    coalesce(p_quantity, 1), p_customer_notes,
    'new', v_secret_token,
    pg_catalog.now(), pg_catalog.now()
  );

  -- Emit system event: quote_created
  insert into app.quote_messages (
    quote_id, sender_type, sender_display_name,
    message_body, event_type, event_metadata, created_at
  ) values (
    v_id, 'system', 'System',
    'Quote request created',
    'quote_created',
    pg_catalog.jsonb_build_object(
      'quote_number', v_quote_number,
      'customer_name', p_customer_name
    ),
    pg_catalog.now()
  );

  return query select v_id, v_quote_number, v_secret_token;
end;
$$;

grant execute on function public.create_quote_request(uuid, text, text, text, app.quote_item_type, uuid, uuid, uuid, text, integer, text) to anon, authenticated;

-- 7b. Augment staff_respond_to_quote to emit quote_reviewed / quote_priced events

create or replace function public.staff_respond_to_quote(
  p_quote_id uuid,
  p_status app.quote_status,
  p_offered_price numeric default null,
  p_valid_until timestamptz default null,
  p_staff_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_staff_id uuid;
  v_staff_name text;
  v_current_status app.quote_status;
begin
  -- 1. Strictly enforce Admin and Manager role requirement
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') into v_role;
  if v_role not in ('admin', 'manager') then
    raise exception 'Forbidden: Only Admin and Manager roles are authorized to manage quote pricing';
  end if;

  -- 2. Fetch current quote status
  select status into v_current_status
  from app.quote_requests
  where app.quote_requests.id = p_quote_id;

  if not found then
    raise exception 'Quote not found';
  end if;

  -- 3. Authoritative State-Machine Validation
  if v_current_status = 'new' then
    if p_status != 'under_review' then
      raise exception 'Invalid state transition from new to %: quotes must be moved to under_review before pricing', p_status;
    end if;
  elsif v_current_status = 'under_review' then
    if p_status != 'quoted' then
      raise exception 'Invalid state transition from under_review to %', p_status;
    end if;

    if p_offered_price is null or p_offered_price <= 0 then
      raise exception 'A valid offered price (> 0) is required to quote this request';
    end if;

    if p_valid_until is null then
      raise exception 'Quote validity timestamp (valid_until) is required';
    end if;

    if p_valid_until < pg_catalog.now() then
      raise exception 'Quote validity timestamp cannot be in the past';
    end if;

    if p_valid_until > (pg_catalog.now() + interval '7 days') then
      raise exception 'Quote validity cannot exceed 7 calendar days from issuance';
    end if;

  elsif v_current_status = 'quoted' then
    raise exception 'Invalid state transition: quote is already in quoted status and cannot be modified by staff';
  else
    raise exception 'Cannot transition quote in status %: quote is in a terminal or customer-managed state', v_current_status;
  end if;

  -- 4. Derive staff identity
  select s.id, s.display_name into v_staff_id, v_staff_name
  from app.staff_users s
  where s.auth_user_id = (select auth.uid());

  -- 5. Execute state transition
  update app.quote_requests
  set
    status = p_status,
    offered_price = coalesce(p_offered_price, offered_price),
    valid_until = coalesce(p_valid_until, valid_until),
    staff_notes = coalesce(p_staff_notes, staff_notes),
    responded_by = coalesce(v_staff_id, responded_by),
    responded_at = case when p_status = 'quoted' then pg_catalog.now() else responded_at end,
    updated_at = pg_catalog.now()
  where app.quote_requests.id = p_quote_id;

  -- 6. Emit system event
  if p_status = 'under_review' then
    insert into app.quote_messages (
      quote_id, sender_type, staff_id, sender_display_name,
      message_body, event_type, event_metadata, created_at
    ) values (
      p_quote_id, 'system', v_staff_id, 'System',
      'Quote moved to review',
      'quote_reviewed',
      pg_catalog.jsonb_build_object('staff_name', coalesce(v_staff_name, 'Staff')),
      pg_catalog.now()
    );
  elsif p_status = 'quoted' then
    insert into app.quote_messages (
      quote_id, sender_type, staff_id, sender_display_name,
      message_body, event_type, event_metadata, created_at
    ) values (
      p_quote_id, 'system', v_staff_id, 'System',
      'Quotation issued',
      'quote_priced',
      pg_catalog.jsonb_build_object(
        'staff_name', coalesce(v_staff_name, 'Staff'),
        'offered_price', p_offered_price,
        'valid_until', p_valid_until
      ),
      pg_catalog.now()
    );
  end if;

  return true;
end;
$$;

revoke execute on function public.staff_respond_to_quote(uuid, app.quote_status, numeric, timestamptz, text) from public, anon;
grant execute on function public.staff_respond_to_quote(uuid, app.quote_status, numeric, timestamptz, text) to authenticated;

-- 7c. Augment customer_respond_to_quote to emit quote_accepted / quote_declined events

create or replace function public.customer_respond_to_quote(
  p_quote_id uuid,
  p_action text,
  p_token uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote app.quote_requests%rowtype;
  v_user_id uuid;
  v_new_status app.quote_status;
  v_item_name text;
  v_mech text;
  v_fingerprint text;
begin
  if p_action not in ('accept', 'decline') then
    raise exception 'Invalid action. Must be accept or decline.';
  end if;

  v_new_status := case when p_action = 'accept' then 'accepted'::app.quote_status else 'declined'::app.quote_status end;
  v_user_id := (select auth.uid());

  select * into v_quote from app.quote_requests where app.quote_requests.id = p_quote_id;

  if not found then
    raise exception 'Quote not found';
  end if;

  -- Validate authorization
  if not (
    (v_user_id is not null and v_quote.customer_id = v_user_id) or
    (p_token is not null and v_quote.secret_token = p_token)
  ) then
    raise exception 'Unauthorized to respond to this quote';
  end if;

  -- Validate current status is 'quoted'
  if v_quote.status != 'quoted' then
    raise exception 'Quote cannot be updated in its current status';
  end if;

  -- Validate expiration
  if v_quote.valid_until is not null and v_quote.valid_until < pg_catalog.now() then
    raise exception 'Quote has expired and can no longer be accepted';
  end if;

  -- If accepting, atomically record immutable commercial acceptance evidence
  if p_action = 'accept' then
    if v_quote.offered_price is null or v_quote.offered_price < 0 then
      raise exception 'Cannot accept quote without a valid agreed price';
    end if;

    if v_quote.valid_until is null then
      raise exception 'Cannot accept quote without a valid expiration date';
    end if;

    -- Resolve item title snapshot
    if v_quote.product_id is not null then
      select name into v_item_name from app.products where app.products.id = v_quote.product_id;
    elsif v_quote.service_id is not null then
      select name into v_item_name from app.services where app.services.id = v_quote.service_id;
    end if;
    v_item_name := coalesce(v_item_name, 'Custom Inquiry');

    v_mech := case
      when v_user_id is not null and v_quote.customer_id = v_user_id then 'authenticated_user'
      else 'guest_token'
    end;

    v_fingerprint := pg_catalog.encode(extensions.digest(v_quote.secret_token::text, 'sha256'), 'hex');

    insert into app.quote_acceptances (
      quote_id, quote_number, offered_price, currency,
      item_type, item_name, product_id, service_id,
      quantity, vehicle_fitment_id, vehicle_summary,
      customer_notes, valid_until, accepted_at,
      acceptance_mechanism, customer_name, customer_phone,
      customer_email, token_fingerprint
    ) values (
      v_quote.id, v_quote.quote_number, v_quote.offered_price, 'KES',
      v_quote.item_type, v_item_name, v_quote.product_id, v_quote.service_id,
      v_quote.quantity, v_quote.vehicle_fitment_id, v_quote.vehicle_summary,
      v_quote.customer_notes, v_quote.valid_until, pg_catalog.now(),
      v_mech, v_quote.customer_name, v_quote.customer_phone,
      v_quote.customer_email, v_fingerprint
    );
  end if;

  -- Execute state transition
  update app.quote_requests
  set status = v_new_status, updated_at = pg_catalog.now()
  where app.quote_requests.id = p_quote_id;

  -- Emit system event
  insert into app.quote_messages (
    quote_id, sender_type, sender_display_name,
    message_body, event_type, event_metadata, created_at
  ) values (
    p_quote_id, 'system', 'System',
    case when p_action = 'accept' then 'Quote accepted by customer'
         else 'Quote declined by customer' end,
    case when p_action = 'accept' then 'quote_accepted' else 'quote_declined' end,
    pg_catalog.jsonb_build_object(
      'customer_name', v_quote.customer_name,
      'offered_price', v_quote.offered_price
    ),
    pg_catalog.now()
  );

  return true;
end;
$$;

grant execute on function public.customer_respond_to_quote(uuid, text, uuid) to anon, authenticated;

-- ─── 8. Verify Grants ──────────────────────────────────────────────────────

-- Ensure app schema usage is granted (idempotent)
grant usage on schema app to anon, authenticated, postgres, service_role;

-- Insert privilege on quote_messages is ONLY available to postgres/service_role
-- (used internally by SECURITY DEFINER functions running as the function owner)
grant insert, select on app.quote_messages to postgres, service_role;
