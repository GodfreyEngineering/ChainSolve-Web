# Stripe Connect — Marketplace Architecture

_Status: stub (P111). Full implementation: P112 (purchase flow), P113 (gating UI)._

---

## Overview

ChainSolve Marketplace uses **Stripe Connect** (Express accounts) to enable
verified authors to receive payment for premium marketplace items. ChainSolve
acts as the **platform** and takes a percentage cut; the author's connected
Stripe account receives the remainder.

---

## Account types

| Role | Stripe entity |
|---|---|
| ChainSolve platform | Stripe platform account |
| Marketplace author | Stripe Express connected account |
| Buyer | Stripe customer (ephemeral, no stored card) |

---

## Seller onboarding flow

```
Author dashboard
  → "Connect Stripe" button
    → POST /api/stripe/connect/onboard   (edge function)
      → stripe.accountLinks.create(...)
        → redirect to Stripe hosted onboarding
          → Stripe redirects back to /marketplace/author?stripe=success|refresh
```

1. Edge function calls `stripe.accounts.create({ type: 'express', ... })` and
   stores the resulting `stripe_account_id` on the `profiles` row.
2. `stripe.accountLinks.create()` returns a one-time onboarding URL.
3. After completion, `stripe.accounts.retrieve()` confirms `details_submitted`.
4. `profiles.stripe_onboarded` is set to `true` via webhook (or polling).

---

## Purchase flow (P112)

```
Item detail page
  → "Buy" button
    → POST /api/stripe/checkout              (edge function)
      → stripe.checkout.sessions.create(...)
        → Stripe Checkout (hosted page)
          → success: redirect to /marketplace/purchase-success?session_id=...
          → webhook: checkout.session.completed
            → record row in marketplace_purchases
            → increment marketplace_items.downloads_count
```

### Checkout session parameters

```ts
{
  mode: 'payment',
  payment_intent_data: {
    application_fee_amount: Math.round(price_cents * PLATFORM_FEE_RATE),
    transfer_data: { destination: author_stripe_account_id },
  },
  line_items: [{ price_data: { ... }, quantity: 1 }],
  success_url: `${origin}/marketplace/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:  `${origin}/marketplace/items/${itemId}`,
}
```

`PLATFORM_FEE_RATE` = 0.15 (15 %). Stored in a server-side constant, never
exposed to the client.

---

## Webhook events handled

| Event | Handler |
|---|---|
| `checkout.session.completed` | record purchase, increment downloads |
| `account.updated` | sync `stripe_onboarded` flag |

All webhook handlers verify `stripe.webhooks.constructEvent(...)` with the
`STRIPE_WEBHOOK_SECRET` environment variable.

---

## Database changes (future migrations)

```sql
-- Already present (migration 0018):
--   marketplace_items: price_cents INTEGER NOT NULL DEFAULT 0
--   marketplace_purchases: ...

-- Planned for P112:
ALTER TABLE public.profiles
  ADD COLUMN stripe_account_id TEXT,
  ADD COLUMN stripe_onboarded  BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## Environment variables

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Platform secret key (server-side only) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PUBLISHABLE_KEY` | Exposed to client via `VITE_STRIPE_PUBLISHABLE_KEY` |

---

## Security constraints

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are **never** exposed to the
  browser bundle or included in any client-side code.
- All Stripe API calls happen in Cloudflare Workers edge functions (`functions/`).
- The `src/lib/stripeConnectService.ts` module contains **client-side stubs**
  that call internal edge function endpoints; it never calls the Stripe API
  directly.
- CSP: `connect-src` already permits `https://api.stripe.com` and
  `frame-src` permits `https://js.stripe.com`.

---

## Open questions (to resolve before P112)

- [ ] Item pricing model: fixed price set at item creation, or configurable?
- [ ] Free items with `price_cents = 0` bypass Stripe entirely (use existing
  `recordInstall` path).
- [ ] Refund policy / partial refunds out of scope for v0.
