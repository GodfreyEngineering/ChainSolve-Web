# Developer Account Setup

## Promoting an account to developer

Developer accounts bypass plan limits and unlock internal tooling. The `is_developer` flag lives on the `profiles` table.

### Manual promotion (Supabase SQL Editor)

Run this with **service_role** credentials (RLS prevents self-escalation):

```sql
UPDATE public.profiles
SET is_developer = true
WHERE email = 'your-email@example.com';
```

You must use the Supabase SQL Editor or connect with the service_role key. Normal client-side calls cannot modify `is_developer` due to RLS policies.

### Auto-flag trigger

The database trigger `fn_auto_developer_flag()` automatically sets `is_developer = true` for matching emails on signup. To extend the list of auto-flagged emails:

1. Open the Supabase SQL Editor
2. Modify the trigger function to include additional email patterns:

```sql
CREATE OR REPLACE FUNCTION public.fn_auto_developer_flag()
RETURNS trigger AS $$
BEGIN
  IF NEW.email IN (
    'dev@chainsolvex.com',
    'your-new-dev@example.com'
  ) THEN
    NEW.is_developer := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

3. The trigger fires on `INSERT` to `profiles`, so it only affects new signups. Existing accounts must be promoted manually.

## Verifying developer status

After promotion, the user must sign out and sign back in (or refresh the session) for the flag to take effect in the frontend. You can verify via:

```sql
SELECT id, email, is_developer FROM public.profiles WHERE email = 'your-email@example.com';
```
