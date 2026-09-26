-- 029: V0.6C Payment Timeline Integration
-- Add payment event types to quote_messages and auto-generate events via triggers

-- 1. Extend event_type check constraint to allow payment events
-- Drop existing constraint and recreate with additional values
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'app.quote_messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%event_type%';
  
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE app.quote_messages DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE app.quote_messages ALTER COLUMN event_type DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE app.quote_messages
    ADD CONSTRAINT quote_messages_event_type_check
    CHECK (event_type IS NULL OR event_type IN (
      'quote_created',
      'quote_reviewed',
      'quote_priced',
      'quote_accepted',
      'quote_declined',
      'customer_message',
      'staff_message',
      'payment_submitted',
      'payment_verified',
      'payment_rejected'
    ));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 2. Helper function to insert system events
CREATE OR REPLACE FUNCTION app.log_quote_system_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_type text;
  v_metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'payment_submitted';
    v_metadata := jsonb_build_object(
      'payment_number', NEW.payment_number,
      'amount', NEW.amount,
      'payment_channel', NEW.payment_channel,
      'provider_reference', NEW.provider_reference,
      'status', NEW.status
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status THEN
      IF NEW.status = 'verified' THEN
        v_event_type := 'payment_verified';
      ELSIF NEW.status = 'rejected' THEN
        v_event_type := 'payment_rejected';
      ELSE
        RETURN NEW;
      END IF;
      v_metadata := jsonb_build_object(
        'payment_number', NEW.payment_number,
        'amount', NEW.amount,
        'payment_channel', NEW.payment_channel,
        'provider_reference', NEW.provider_reference,
        'status', NEW.status,
        'verified_by', NEW.verified_by,
        'verified_at', NEW.verified_at,
        'rejection_reason', NEW.rejection_reason
      );
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO app.quote_messages (
    quote_id,
    sender_type,
    sender_display_name,
    event_type,
    event_metadata
  ) VALUES (
    NEW.quote_id,
    'system',
    'Well Lups System',
    v_event_type,
    v_metadata
  );

  RETURN NEW;
END;
$$;

-- 3. Trigger on payments table
DROP TRIGGER IF EXISTS payments_timeline_trigger ON app.payments;
CREATE TRIGGER payments_timeline_trigger
AFTER INSERT OR UPDATE OF status ON app.payments
FOR EACH ROW
EXECUTE FUNCTION app.log_quote_system_event();

-- 4. Backfill events for existing payments
INSERT INTO app.quote_messages (quote_id, sender_type, sender_display_name, event_type, event_metadata)
SELECT DISTINCT ON (p.id)
  p.quote_id,
  'system',
  'Well Lups System',
  CASE 
    WHEN p.status = 'verified' THEN 'payment_verified'
    WHEN p.status = 'rejected' THEN 'payment_rejected'
    ELSE 'payment_submitted'
  END,
  jsonb_build_object(
    'payment_number', p.payment_number,
    'amount', p.amount,
    'payment_channel', p.payment_channel,
    'provider_reference', p.provider_reference,
    'status', p.status
  )
FROM app.payments p
LEFT JOIN app.quote_messages m ON m.quote_id = p.quote_id AND m.event_type IN ('payment_submitted','payment_verified','payment_rejected') AND (m.event_metadata->>'payment_number') = p.payment_number
WHERE m.id IS NULL;
