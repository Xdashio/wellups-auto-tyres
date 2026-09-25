-- 022: V0.6B Fix — Server-Side Whitespace-Only Message Rejection
--
-- Context:
--   Migration 021 validated "Message cannot be empty" using pg_catalog.btrim(),
--   which by default trims ONLY SPACE characters. Inputs composed solely of
--   newlines / tabs / carriage returns (e.g. "   \n \t  ") therefore passed the
--   client and server checks and were persisted into app.quote_messages.
--
--   V0.6B requires that empty AND whitespace-only messages be rejected
--   authoritatively server-side. This migration:
--     1. Removes the whitespace-tolerant legacy column check.
--     2. Purges any whitespace-only rows previously persisted by the bug
--        (these carry no commercial content by definition).
--     3. Installs a strict CHECK requiring at least one non-whitespace char.
--     4. Re-issues the two send RPCs with collation-safe non-whitespace
--        validation ([^[:space:]]).

-- ─── 1. Drop the legacy whitespace-tolerant column check ───────────────────
-- The inline column check created in migration 021 is auto-named; locate it
-- precisely rather than assuming the auto-generated name.

do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_class r on r.oid = c.conrelid
  join pg_catalog.pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'app'
    and r.relname = 'quote_messages'
    and c.contype = 'c'
    and pg_catalog.pg_get_constraintdef(c.oid) like '%char_length%';

  if v_name is not null then
    execute format('alter table app.quote_messages drop constraint %I', v_name);
  end if;
end
$$;

-- ─── 2. Purge whitespace-only rows previously accepted by the bug ──────────
-- Corrective data repair: rows whose message_body contains NO non-whitespace
-- character hold no commercial content and were created by the validation
-- defect. Deletion is the administrative repair; normal roles still cannot
-- delete historical commercial messages.

delete from app.quote_messages
where message_body is not null and not (message_body ~ '[^[:space:]]');

-- ─── 3. Strict non-whitespace content check ────────────────────────────────

alter table app.quote_messages
  add constraint quote_messages_message_body_nonspace_check
  check (
    message_body is null or (
      message_body ~ '[^[:space:]]'
      and pg_catalog.char_length(message_body) <= 2000
    )
  );

-- ─── 4. Re-issue send RPCs with strict whitespace validation ───────────────

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
  -- 1. Validate message content (reject empty AND whitespace-only)
  if p_message is null or not (p_message ~ '[^[:space:]]') then
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

  -- 2. Validate message content (reject empty AND whitespace-only)
  if p_message is null or not (p_message ~ '[^[:space:]]') then
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