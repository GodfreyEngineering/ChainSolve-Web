import { createClient } from '@supabase/supabase-js'

const _url = import.meta.env.VITE_SUPABASE_URL
const _key = import.meta.env.VITE_SUPABASE_ANON_KEY

const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder'

// In production builds (import.meta.env.PROD === true), reject missing or
// placeholder credentials immediately so boot.ts surfaces CONFIG_INVALID
// instead of silently making requests to a non-existent Supabase host.
//
// VITE_IS_CI_BUILD is set only in the node_checks CI build step, which uses
// placeholder credentials intentionally so e2e smoke tests can boot the app
// without real auth.  It MUST NOT be set in the deploy job — that job must
// always supply real credentials from GitHub Secrets.
if (import.meta.env.PROD && !import.meta.env.VITE_IS_CI_BUILD) {
  if (!_url || _url === PLACEHOLDER_URL) {
    throw new Error(
      '[CONFIG_INVALID] VITE_SUPABASE_URL is missing or still set to the placeholder ' +
        'value. Set the real Supabase project URL in GitHub Secrets ' +
        '(Settings → Secrets → Actions → VITE_SUPABASE_URL) and redeploy.',
    )
  }
  if (!_key || _key === PLACEHOLDER_KEY) {
    throw new Error(
      '[CONFIG_INVALID] VITE_SUPABASE_ANON_KEY is missing or still set to the placeholder ' +
        'value. Set the real Supabase anon key in GitHub Secrets ' +
        '(Settings → Secrets → Actions → VITE_SUPABASE_ANON_KEY) and redeploy.',
    )
  }
}

// Non-production builds (dev server, CI smoke) fall back to placeholder values
// so the app loads without a local .env file.  Supabase calls fail silently to
// the non-existent host — that is fine for dev and CI smoke tests.
export const supabase = createClient(_url ?? PLACEHOLDER_URL, _key ?? PLACEHOLDER_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
