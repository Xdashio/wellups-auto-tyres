-- 028: V0.6C Payment duplicate reference database protection
-- Forward-only migration to enforce DB-level uniqueness for normalized provider references
-- for payments that are pending_verification or verified.

-- Create functional unique index on normalized provider reference + channel
-- We use a generated column approach via expression index.
-- This prevents reuse of the same M-Pesa reference for active payments.

create unique index if not exists payments_provider_ref_channel_unique
on app.payments (upper(btrim(coalesce(provider_reference, ''))), payment_channel)
where provider_reference is not null and status in ('pending_verification','verified');

-- Optional: also prevent duplicate payment number collisions across branches, already unique
