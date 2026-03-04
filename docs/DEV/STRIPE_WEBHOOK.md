# Stripe Webhook — Deployment & Troubleshooting

## Correct endpoint URL

```
POST https://app.chainsolve.co.uk/api/stripe/webhook
```

The handler is a **Cloudflare Pages Function** at
`functions/api/stripe/webhook.ts`.  It is NOT a Supabase Edge Function —
there is no `supabase/functions/` directory in this project.

### Health check

```bash
curl https://app.chainsolve.co.uk/api/stripe/webhook
# → { "ok": true, "handler": "stripe-webhook" }
```

A 200 response confirms the route is deployed and reachable.

## Required environment variables (Cloudflare Pages)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | API key for the Stripe SDK |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` signing secret for HMAC verification |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS) |
| `STRIPE_PRICE_ID_ENT_10_MONTHLY` | (optional) Enterprise 10-seat monthly price ID |
| `STRIPE_PRICE_ID_ENT_10_ANNUAL` | (optional) Enterprise 10-seat annual price ID |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY` | (optional) Enterprise unlimited monthly price ID |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL` | (optional) Enterprise unlimited annual price ID |

## Configuring the Stripe Dashboard

1. Go to **Stripe Dashboard → Developers → Webhooks**.
2. Set the endpoint URL to:
   ```
   https://app.chainsolve.co.uk/api/stripe/webhook
   ```
3. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret (`whsec_…`) into Cloudflare Pages env as
   `STRIPE_WEBHOOK_SECRET`.

## Common failure: 404 on webhook delivery

**Symptom**: Stripe event log shows repeated 404 responses.

**Root cause**: The webhook URL in Stripe Dashboard points to the wrong host.
A previous configuration used the Supabase Edge Function URL
(`https://<project>.supabase.co/functions/v1/stripe-webhook`), which does not
exist — this project uses Cloudflare Pages Functions exclusively.

**Fix**: Update the endpoint URL in the Stripe Dashboard to
`https://app.chainsolve.co.uk/api/stripe/webhook`.

## Local testing with Stripe CLI

```bash
# Forward Stripe events to local dev server
stripe listen --forward-to http://localhost:8788/api/stripe/webhook
# In a separate terminal, trigger a test event
stripe trigger checkout.session.completed
```

The `stripe listen` command prints a temporary signing secret — set it as
`STRIPE_WEBHOOK_SECRET` in your `.dev.vars` file.

## Handler behaviour

- **Signature verification**: HMAC-SHA256 via `constructEventAsync` with
  SubtleCrypto (Web Crypto API, required in Cloudflare runtime).
- **Idempotency**: Stripe event ID is the primary key in `stripe_events` —
  duplicate deliveries are safely upserted.
- **Subscription events**: Updates `profiles.plan`, `stripe_customer_id`,
  `stripe_subscription_id`, and `current_period_end`.
- **Enterprise detection**: Checks `metadata.plan_tier` and price ID against
  configured enterprise price IDs.
- **Checkout completed**: Handles marketplace purchases — upserts into
  `marketplace_purchases` and increments download count.
