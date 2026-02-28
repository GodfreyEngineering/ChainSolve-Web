# Organization Billing Separation

**Status**: Architecture document for Phase C (Enterprise v1.2)
**Relates to**: P121–P125 (org schema), P126–P130 (audit log)

---

## Overview

ChainSolve supports two billing models:

| Model | Who pays | `profiles.plan` | `projects.org_id` |
|-------|----------|-----------------|-------------------|
| **Individual** | A single user | `'free'` \| `'pro'` \| `'trial'` | `NULL` |
| **Organization** | An org (future) | org-level plan (see below) | non-null FK |

In Phase C v1.0 the org schema is in place but billing remains per-user.
A dedicated org plan (team / enterprise tier) is future work.

---

## Current Architecture

### Individual billing

- Each `profiles` row carries `plan`, `stripe_customer_id`, `current_period_end`.
- Stripe webhooks (`functions/api/stripe/webhook.ts`) update `profiles` directly.
- Entitlements (`src/lib/entitlements.ts`) derive capabilities from `profile.plan`.

### Organization ownership

- `organizations.owner_id` → the `profiles` row that pays (individual plan or
  future org Stripe customer).
- `projects.org_id` links org-owned projects. When `org_id` is set, the project
  is owned by the org; when `NULL` it is a personal project.
- `org_members` role values: `'owner'` | `'admin'` | `'member'`.

---

## Future: Org-Level Plan

When org billing lands, the suggested approach is:

### Option A — Separate Stripe customer per org (recommended)

1. Add `stripe_customer_id text` and `plan text` columns to `organizations`.
2. Stripe customer is created when the org owner upgrades; customer ID stored
   on `organizations`, **not** profiles.
3. Webhook routes `customer.subscription.updated` events to `organizations`
   rather than `profiles` when the customer ID matches an org record.
4. Entitlements: `resolveOrgPlan(orgId)` — check `organizations.plan` if
   `projects.org_id` is set, otherwise fall back to `profiles.plan`.

**Pros**: clean separation; individual plan unaffected when user joins an org.
**Cons**: each org needs its own Stripe customer.

### Option B — Owner's plan covers org members

The org owner's personal `profiles.plan` applies to all org members.

**Pros**: no new Stripe customer record needed for v1.
**Cons**: owner plan and org plan are entangled; cancellation affects everyone.

---

## RLS Considerations

Once org-level billing is added:

- `organizations` will need a SELECT policy that allows service-role reads
  (webhooks run as service_role and cannot use `auth.uid()`).
- The existing `orgs_member_select` policy is fine for UI reads.
- A new `SECURITY DEFINER` function may be needed for billing reads from
  Cloudflare Workers that bypass RLS.

---

## Migration Path

| Step | Migration | Description |
|------|-----------|-------------|
| P121 | `0027_orgs.sql` | Create `organizations` + `org_members` tables |
| P122 | `0028_projects_org_id.sql` | Add nullable `org_id` FK to `projects` |
| P123 | `0029_org_rls.sql` | RLS policies for both tables |
| Future | `XXXX_org_billing.sql` | Add `plan`, `stripe_customer_id` to `organizations` |
| Future | webhook update | Route Stripe events to org or user by customer ID |

---

## Privacy / Audit Notes

- Org member `user_id` values are UUIDs — never emails — in DB and in audit logs.
- Org billing events (subscription created/updated/deleted) MUST be logged to
  `stripe_events` with `object_id = org_id` for audit trail purposes.
- The audit log redaction guarantee (P128) applies: no PII in exported logs.

---

*Last updated: 2026-02-28*
