import { createClient } from '@supabase/supabase-js'

// Supabase JS v2 createClient() throws "supabaseUrl is required." when its first
// argument is falsy.  In CI (e2e smoke) the VITE_* env vars are not set, so we
// fall back to placeholder values that allow the module to load without throwing.
// Supabase network calls (auth session restore, etc.) will fail silently to the
// non-existent hostname — that is fine because smoke tests do not exercise auth.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
