-- P112: Paid purchase flow — price_cents on marketplace_items,
-- Stripe Connect fields on profiles.

-- Allow items to carry a price (0 = free).
ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0
    CHECK (price_cents >= 0);

-- Track the author's connected Stripe account.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarded   BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
