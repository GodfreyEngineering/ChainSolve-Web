-- 0019_invoice_payment_tracking: track invoice payment failures for dunning (16.60)
--
-- Adds subscription_payment_failed_at to profiles so that invoice.payment_failed
-- webhook events can be recorded and used to trigger dunning emails.
-- Cleared to NULL when invoice.paid fires.

SET search_path = public;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_payment_failed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN profiles.subscription_payment_failed_at IS
  'Set when Stripe fires invoice.payment_failed; cleared on invoice.paid. '
  'Used to trigger dunning emails and display payment-failure warnings in the UI.';
