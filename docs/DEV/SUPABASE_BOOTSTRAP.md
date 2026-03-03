# Supabase Bootstrap — Fresh Project Setup

How to set up a brand-new Supabase project for ChainSolve.

## Prerequisites

- A Supabase project (create at https://supabase.com/dashboard)
- Access to the project's SQL Editor or `supabase` CLI
- Service-role key (for edge functions / server-side operations)

## Steps

### 1. Run the baseline migration

Open the Supabase SQL Editor and run the contents of:

```
supabase/migrations/0001_baseline_schema.sql
```

Or use the CLI:

```bash
supabase db push
```

This single migration creates all tables, functions, triggers, RLS policies,
indexes, and storage buckets required for ChainSolve.

### 2. Set environment secrets

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

For edge functions (Cloudflare Pages Functions), set in `.dev.vars`:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. Configure auth providers

In the Supabase Dashboard under Authentication > Providers:

- Enable **Email** (with email confirmation as desired)
- Enable any OAuth providers (Google, GitHub, etc.)

### 4. Verify

Start the dev server and confirm:

```bash
npm run dev
```

- Sign-up creates a profile row (check `profiles` table)
- Sign-in works and RLS grants access to user's own data
- Storage upload to `projects` bucket succeeds for authenticated users

## Notes

- **Iterative migrations** (0002–0054) are archived in `supabase/migrations_archive/`
  and should NOT be run on fresh projects. They are kept for reference only.
- **Developer/admin roles** must be set manually via service_role SQL:
  ```sql
  UPDATE profiles SET is_developer = true WHERE email = 'your@email.com';
  ```
- **Storage buckets** are created by the baseline migration. If they already
  exist (e.g. from the Supabase dashboard), the `ON CONFLICT DO NOTHING`
  clause ensures idempotency.
