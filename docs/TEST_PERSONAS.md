# Test Persona Bootstrap

> How to create reproducible test accounts for manual QA and E2E testing.

---

## Prerequisites

- Supabase project running (local via `npx supabase start` or hosted)
- Access to the Supabase Dashboard or SQL editor
- SMTP configured (or use Supabase's built-in inbucket for local dev)

---

## 1. Create Test Users via Supabase Auth

### Option A: Dashboard UI

1. Open Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email/password for each persona (see table below)
4. Confirm the email via Dashboard or inbucket

### Option B: SQL (local dev only)

> **Warning**: These SQL statements bypass email verification and should only
> be used in local development. Never run against a production database.

```sql
-- Create auth users (Supabase auth schema)
-- The profiles trigger will auto-create matching profile rows.

-- Free test user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'aaaaaaaa-0001-4000-a000-000000000001',
  'free@test.chainsolve.local',
  crypt('TestPassword1!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Free User"}',
  'authenticated', 'authenticated'
);

-- Pro test user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'aaaaaaaa-0002-4000-a000-000000000002',
  'pro@test.chainsolve.local',
  crypt('TestPassword1!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Pro User"}',
  'authenticated', 'authenticated'
);

-- Enterprise test user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'aaaaaaaa-0003-4000-a000-000000000003',
  'enterprise@test.chainsolve.local',
  crypt('TestPassword1!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Enterprise User"}',
  'authenticated', 'authenticated'
);

-- Developer account
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'aaaaaaaa-0004-4000-a000-000000000004',
  'dev@test.chainsolve.local',
  crypt('TestPassword1!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Developer"}',
  'authenticated', 'authenticated'
);

-- Admin account (E2-6)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'aaaaaaaa-0005-4000-a000-000000000005',
  'admin@test.chainsolve.local',
  crypt('TestPassword1!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User"}',
  'authenticated', 'authenticated'
);

-- Moderator account (E10-1)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'aaaaaaaa-0006-4000-a000-000000000006',
  'mod@test.chainsolve.local',
  crypt('TestPassword1!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Moderator"}',
  'authenticated', 'authenticated'
);
```

---

## 2. Set Plan Status

After users are created, the profiles trigger sets them to `free` by default.
Upgrade specific users:

```sql
-- Pro user
UPDATE profiles
SET plan = 'pro',
    stripe_customer_id = 'cus_test_pro_001',
    stripe_subscription_id = 'sub_test_pro_001',
    current_period_end = now() + interval '30 days'
WHERE id = 'aaaaaaaa-0002-4000-a000-000000000002';

-- Enterprise user (uses 'pro' plan status — enterprise is TS-side only for now)
UPDATE profiles
SET plan = 'pro',
    stripe_customer_id = 'cus_test_ent_001',
    stripe_subscription_id = 'sub_test_ent_001',
    current_period_end = now() + interval '365 days'
WHERE id = 'aaaaaaaa-0003-4000-a000-000000000003';

-- Developer account (E2-6: is_developer bypasses plan restrictions)
UPDATE profiles
SET plan = 'free',
    is_developer = true
WHERE id = 'aaaaaaaa-0004-4000-a000-000000000004';

-- Admin account (E2-6: is_admin bypasses plan restrictions)
UPDATE profiles
SET plan = 'free',
    is_admin = true
WHERE id = 'aaaaaaaa-0005-4000-a000-000000000005';

-- Moderator account (comment moderation privileges)
UPDATE profiles
SET plan = 'free',
    is_moderator = true
WHERE id = 'aaaaaaaa-0006-4000-a000-000000000006';
```

---

## 3. Set Up Enterprise Org

Create an organization and add the enterprise user as owner:

```sql
-- Create org
INSERT INTO organizations (id, name, owner_id)
VALUES (
  'bbbbbbbb-0001-4000-b000-000000000001',
  'Acme Engineering',
  'aaaaaaaa-0003-4000-a000-000000000003'
);

-- Add enterprise user as owner
INSERT INTO org_members (org_id, user_id, role)
VALUES (
  'bbbbbbbb-0001-4000-b000-000000000001',
  'aaaaaaaa-0003-4000-a000-000000000003',
  'owner'
);

-- Set org policy flags (Explore enabled, installs allowed)
UPDATE organizations
SET policy_explore_enabled = true,
    policy_installs_allowed = true
WHERE id = 'bbbbbbbb-0001-4000-b000-000000000001';
```

---

## 4. Test Persona Reference

| Persona | Email | Password | Plan | Flags | Org | Purpose |
|---------|-------|----------|------|-------|-----|---------|
| Free | `free@test.chainsolve.local` | `TestPassword1!` | free | — | — | Verify gating: 1 project, 2 canvases, no export |
| Pro | `pro@test.chainsolve.local` | `TestPassword1!` | pro | — | — | Verify all features unlocked |
| Enterprise | `enterprise@test.chainsolve.local` | `TestPassword1!` | pro | — | Acme Engineering | Verify org policy, Explore access |
| Developer | `dev@test.chainsolve.local` | `TestPassword1!` | free | `is_developer` | — | Enterprise features via role, diagnostics, admin tools |
| Admin | `admin@test.chainsolve.local` | `TestPassword1!` | free | `is_admin` | — | Enterprise features via role, moderation + admin panels |
| Moderator | `mod@test.chainsolve.local` | `TestPassword1!` | free | `is_moderator` | — | Comment moderation, flagged content management |

### What to Test per Persona

**Free user**:
- Can create 1 project, 2 canvases max
- Export buttons show upgrade prompt
- CSV import blocked
- Vector/plot/group blocks show Pro badge
- Explore: can browse but cannot install block packs/themes

**Pro user**:
- Unlimited projects and canvases
- All exports work (PDF, Excel, JSON)
- CSV import works (up to 50 MB)
- All block types available
- Explore: can install any item

**Enterprise user**:
- Same as Pro plus org membership visible
- Org policy flags respected (Explore access, install permissions)
- Audit log entries generated
- Projects can be scoped to org

**Developer** (`is_developer = true`):
- All Pro/Enterprise features unlocked via `resolveEffectivePlan` (E2-6)
- Plan shows as `free` in DB but effective plan is `enterprise`
- Diagnostics page accessible (`/diagnostics`)
- Admin tools available (when E3-1 is implemented)
- Environment info visible in About window

**Admin** (`is_admin = true`):
- All Pro/Enterprise features unlocked via `resolveEffectivePlan` (E2-6)
- Moderation tools + admin panels
- Can view and manage flagged comments
- Can resolve/dismiss avatar reports

**Moderator** (`is_moderator = true`):
- Free plan (no feature upgrades)
- Can view flagged comments via RLS
- Can unflag, delete, or update any comment
- Can delete any comment on any item
- Cannot access admin panels (no `is_admin` flag)

---

## 5. Cleanup

To remove all test data and start fresh:

```sql
-- Delete in dependency order (cascades handle most cleanup)
DELETE FROM profiles WHERE id IN (
  'aaaaaaaa-0001-4000-a000-000000000001',
  'aaaaaaaa-0002-4000-a000-000000000002',
  'aaaaaaaa-0003-4000-a000-000000000003',
  'aaaaaaaa-0004-4000-a000-000000000004',
  'aaaaaaaa-0005-4000-a000-000000000005',
  'aaaaaaaa-0006-4000-a000-000000000006'
);

DELETE FROM organizations WHERE id = 'bbbbbbbb-0001-4000-b000-000000000001';

-- Auth users (if profiles cascade didn't clean up)
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-0001-4000-a000-000000000001',
  'aaaaaaaa-0002-4000-a000-000000000002',
  'aaaaaaaa-0003-4000-a000-000000000003',
  'aaaaaaaa-0004-4000-a000-000000000004',
  'aaaaaaaa-0005-4000-a000-000000000005',
  'aaaaaaaa-0006-4000-a000-000000000006'
);
```

---

## 6. Notes

- The `enterprise` plan status exists in TypeScript (`src/lib/entitlements.ts`) but has not yet been added to the PostgreSQL `plan_status` enum. Enterprise users currently use `pro` plan with org membership to distinguish them.
- Developer and admin accounts use `plan = 'free'` in the DB — `resolveEffectivePlan()` (E2-6) returns `enterprise` when `is_developer` or `is_admin` is true. This ensures the role flags are the sole authority for elevated access, not the plan column.
- Moderator accounts use `is_moderator = true` for comment/avatar moderation. This flag does NOT grant plan upgrades — moderators on `free` plan still see free-tier limits on their own content.
- Test passwords use `TestPassword1!` — never use these credentials in production.
- The `.local` email domain ensures test emails cannot leak to real inboxes.
- All test user UUIDs use the `aaaaaaaa-000X` pattern for easy identification and cleanup.
