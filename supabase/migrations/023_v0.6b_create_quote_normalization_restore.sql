-- 023: V0.6B — Restore V0.6A create_quote_request normalization regressed by 021
-- Forward-only fix. Preserves V0.6B system event emission, restores trim/nullif/greatest.
-- DO NOT edit 021. This migration re-creates public.create_quote_request with normalized inputs.

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
  v_customer_name text;
  v_customer_phone text;
  v_customer_email text;
  v_vehicle_summary text;
  v_customer_notes text;
  v_quantity int;
begin
  -- Validate required fields with normalized checks
  if p_customer_name is null or pg_catalog.char_length(pg_catalog.btrim(p_customer_name)) = 0 then
    raise exception 'Customer name is required';
  end if;
  if p_customer_phone is null or pg_catalog.char_length(pg_catalog.btrim(p_customer_phone)) = 0 then
    raise exception 'Customer phone number is required';
  end if;

  -- Normalize inputs
  v_customer_name := pg_catalog.btrim(p_customer_name);
  v_customer_phone := pg_catalog.btrim(p_customer_phone);
  v_customer_email := nullif(pg_catalog.btrim(coalesce(p_customer_email, '')), '');
  v_vehicle_summary := nullif(pg_catalog.btrim(coalesce(p_vehicle_summary, '')), '');
  v_customer_notes := nullif(pg_catalog.btrim(coalesce(p_customer_notes, '')), '');
  v_quantity := greatest(coalesce(p_quantity, 1), 1);

  -- Generate identifiers
  v_quote_number := app.generate_quote_number();
  v_secret_token := extensions.gen_random_uuid();
  v_id := extensions.gen_random_uuid();

  -- Insert the quote request with normalized values
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
    (select auth.uid()), v_customer_name, v_customer_phone, v_customer_email,
    p_item_type, p_product_id, p_service_id,
    p_vehicle_fitment_id, v_vehicle_summary,
    v_quantity, v_customer_notes,
    'new', v_secret_token,
    pg_catalog.now(), pg_catalog.now()
  );

  -- Emit system event: quote_created  — V0.6B audit trail
  insert into app.quote_messages (
    quote_id, sender_type, sender_display_name,
    message_body, event_type, event_metadata, created_at
  ) values (
    v_id, 'system', 'System',
    'Quote request created',
    'quote_created',
    pg_catalog.jsonb_build_object(
      'quote_number', v_quote_number,
      'customer_name', v_customer_name
    ),
    pg_catalog.now()
  );

  return query select v_id, v_quote_number, v_secret_token;
end;
$$;

revoke all on function public.create_quote_request(uuid, text, text, text, app.quote_item_type, uuid, uuid, uuid, text, integer, text) from public;
grant execute on function public.create_quote_request(uuid, text, text, text, app.quote_item_type, uuid, uuid, uuid, text, integer, text) to anon, authenticated;
