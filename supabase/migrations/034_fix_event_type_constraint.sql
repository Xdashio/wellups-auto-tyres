-- 034: Ensure quote_messages event_type check constraint includes payment events
ALTER TABLE app.quote_messages DROP CONSTRAINT IF EXISTS quote_messages_event_type_check;
ALTER TABLE app.quote_messages ALTER COLUMN event_type DROP NOT NULL;
ALTER TABLE app.quote_messages ADD CONSTRAINT quote_messages_event_type_check CHECK (event_type IS NULL OR event_type IN (
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
