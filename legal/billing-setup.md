# Stripe Billing Setup Checklist (Items 16.58, 16.62, 16.63)

## 16.58 — Billing Descriptor

**ACTION REQUIRED before launch.**

The billing descriptor is what appears on customers' bank and credit card statements.
A clear descriptor prevents chargebacks from confused customers.

### Recommended descriptor

```
CHAINSOLVE*PRO          (for Pro subscriptions)
CHAINSOLVE*ENT          (for Enterprise subscriptions)
```

The asterisk (`*`) is the standard separator. Most banks show the full string; some
truncate to 22 characters.

### How to configure

1. Log in to **https://dashboard.stripe.com**
2. Go to **Settings → Business settings → Public business information**
3. Set **Statement descriptor** to: `CHAINSOLVE`
4. Set **Shortened descriptor** (for mobile statements): `CHAINSOLVE`
5. Click Save

For subscription-level customisation (different descriptor per product):
1. Go to **Products → [Product] → Edit**
2. Set the **Statement descriptor** field on the product

This overrides the account-level descriptor for charges from that product.

---

## 16.62 — Pricing Page Accuracy

### Verified price table (as of 2026-03-17)

| Plan | Billing | Display price | Stripe Price ID env var | Annual equivalent |
| --- | --- | --- | --- | --- |
| Pro | Monthly | £10/mo | `STRIPE_PRICE_ID_PRO_MONTHLY` | £120/yr |
| Pro | Annual | £96/yr | `STRIPE_PRICE_ID_PRO_ANNUAL` | £8/mo × 12 = **20% saving** ✓ |
| Enterprise (10 seats) | Monthly | £80/mo | `STRIPE_PRICE_ID_ENT_10_MONTHLY` | £960/yr |
| Enterprise (10 seats) | Annual | £768/yr | `STRIPE_PRICE_ID_ENT_10_ANNUAL` | £64/mo × 12 = **20% saving** ✓ |

**Annual savings are mathematically correct** at exactly 20%.

### Verification steps before launch

1. Open the Stripe dashboard → **Products → Prices**
2. For each price listed above, confirm:
   - The currency is GBP (£)
   - The amount matches the displayed price:
     - Pro Monthly → £10.00 recurring/month
     - Pro Annual → £96.00 recurring/year
     - Enterprise 10 Monthly → £80.00 recurring/month (× 10 quantity = £800/mo total)
     - Enterprise 10 Annual → £768.00 recurring/year (× 10 quantity = £7,680/yr total)
   - The interval (`month` / `year`) matches the label
3. Set the correct Stripe Price IDs in Cloudflare Pages environment variables:
   - `STRIPE_PRICE_ID_PRO_MONTHLY`
   - `STRIPE_PRICE_ID_PRO_ANNUAL`
   - `STRIPE_PRICE_ID_ENT_10_MONTHLY`
   - `STRIPE_PRICE_ID_ENT_10_ANNUAL`

### Per-seat vs flat-rate note

Enterprise plans use `quantity` in the checkout session:
- `ent_10_monthly` / `ent_10_annual` → `quantity: 10`
- `ent_unlimited_monthly` / `ent_unlimited_annual` → `quantity: 1` (flat rate)

If you switch to per-seat pricing, update `PLAN_CONFIGS` in
`functions/api/stripe/create-checkout-session.ts`.

---

## 16.63 — VAT / Tax Readiness

### Current implementation

`create-checkout-session.ts` now includes:

```typescript
billing_address_collection: 'required',  // collect address for tax calculation
automatic_tax: { enabled: true },         // Stripe Tax calculates VAT automatically
customer_update: { address: 'auto', name: 'auto' },  // keep address current
```

This is live in code. **Stripe Tax must be activated in the dashboard** for rates to apply.

### Activating Stripe Tax

1. Go to **https://dashboard.stripe.com → Tax → Overview**
2. Click **Get started with Stripe Tax**
3. Enter your business address (UK)
4. Stripe will automatically identify your tax obligations
5. Add tax registrations:
   - UK: add your VAT number when you register for VAT
   - EU: add individual country registrations or use OSS

Until you are VAT-registered, Stripe Tax will still collect billing addresses but will
not apply tax. This is the correct behaviour for a pre-VAT-registration business.

### When to register for UK VAT

UK VAT registration is compulsory when your taxable turnover exceeds **£90,000** in
any rolling 12-month period (threshold as of April 2024). Register at
**https://www.gov.uk/register-for-vat**.

At registration, you will need to:
1. Obtain a VAT number (format: `GB xxxxxxxxx`)
2. Add it to Stripe Tax (dashboard → Tax → Registrations → Add)
3. Update the Privacy Policy and legal documents with the VAT number
4. Verify that Stripe invoices include all required elements under HMRC rules:
   - Supplier name, address, VAT number
   - Customer name, address
   - Invoice date and unique number
   - Description of services
   - Net amount, VAT rate (20%), VAT amount, gross total

### Invoice format (Stripe automatic invoicing)

Stripe generates compliant invoices automatically when `automatic_tax` is enabled.
Verify by:
1. Creating a test subscription in Stripe test mode
2. Downloading the invoice PDF
3. Confirming all required fields are present

### EU/international considerations

For EU customers (B2C), UK businesses post-Brexit are generally not required to charge
EU VAT on digital services unless turnover to any single EU country exceeds that country's
VAT registration threshold (typically €10,000/yr across all EU). At launch scale this
threshold is unlikely to be reached. Stripe Tax handles EU VAT automatically once
the relevant registrations are added.
