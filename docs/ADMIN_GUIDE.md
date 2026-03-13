# ChainSolve Admin Guide

This document explains how to manage developer accounts, override user plans, and handle common billing issues.

## Granting developer access

Developers get all features unlocked (no limits) and access to admin/metrics pages.

### Option A: Via Supabase dashboard

1. Open Supabase dashboard > Table Editor > `profiles`
2. Find the user by email (search in `auth.users` first to get their `id`)
3. Set `is_developer = true` on their profile row
4. The user's effective plan immediately becomes `developer` on next page load

### Option B: Via SQL

```sql
UPDATE public.profiles
SET is_developer = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'new-dev@chainsolve.co.uk'
);
```

### Option C: Via admin panel (7.08)

1. Navigate to `/admin/metrics`
2. Search for the user by email or display name
3. In the user detail panel, select **developer** from the plan dropdown
4. Click **Override plan** — this sets both `plan = 'developer'` and `is_developer = true`

### Email fallback

Emails listed in `DEVELOPER_EMAILS` in `src/lib/entitlements.ts` are treated as developers on the client side even if the DB flag is missing. Currently:
- `ben.godfrey@chainsolve.co.uk`

Add new emails to this set for immediate client-side access. The DB flag should still be set for server-side consistency.

## Overriding user plans

Use the admin panel (`/admin/metrics` > User Management) or SQL:

```sql
-- Set a user to pro (e.g. for customer support resolution)
UPDATE public.profiles SET plan = 'pro' WHERE id = '<user-uuid>';

-- Set a user to student
UPDATE public.profiles SET plan = 'student', is_student = true WHERE id = '<user-uuid>';
```

Valid plans: `free`, `trialing`, `pro`, `student`, `enterprise`, `developer`

**Important:** Overriding to `pro` or `enterprise` does NOT create a Stripe subscription. The user will have features but no recurring billing. Use this for support credits, bug bounties, or internal testing.

## Managing billing issues

### User can't access pro features after payment

1. Check Stripe dashboard for the customer/subscription status
2. In Supabase, verify `profiles.stripe_subscription_id` matches the active subscription
3. Check `profiles.plan` — it should be `pro` or `trialing`
4. If mismatched, update the plan manually via admin panel or SQL
5. The `stripe_events` table shows all webhook events — check for failed deliveries

### Subscription stuck in past_due

1. Check Stripe for failed payment attempts
2. Contact the user about updating their payment method
3. If resolved, Stripe webhooks will automatically update the plan

### Refund requests

Refunds are processed via the Stripe dashboard. After refunding:
1. Stripe fires `customer.subscription.deleted` webhook
2. The webhook handler sets `plan = 'canceled'` automatically
3. No manual DB update needed

## Disabling a user account

Via admin panel: search user > click **Disable**. This bans the user via Supabase auth (876,000 hour ban = ~100 years). Their existing sessions are invalidated.

To re-enable: click **Enable**.

Via SQL:
```sql
-- Supabase Admin API is preferred; direct DB update as last resort:
UPDATE auth.users SET banned_until = NULL WHERE id = '<user-uuid>';
```

## Triggering password reset

Via admin panel: search user > click **Send password reset**. Supabase sends the reset email to the user's registered email address.

## Audit trail

All admin actions are logged to the `audit_log` table with:
- `event_type`: `admin_user_search`, `admin_override_plan`, `admin_reset_password`, `admin_toggle_disabled`
- `user_id`: the admin who performed the action
- `object_id`: the target user ID
- `metadata`: action details (new plan, etc.)

Query recent admin actions:
```sql
SELECT * FROM audit_log
WHERE event_type LIKE 'admin_%'
ORDER BY created_at DESC
LIMIT 50;
```

## Access control

Admin features require one of:
- `profiles.is_admin = true` — moderator/admin access
- `profiles.is_developer = true` — full developer access (superset of admin)

Both flags can be set via Supabase dashboard or SQL. The admin panel itself (`/admin/metrics`) checks these flags server-side.
