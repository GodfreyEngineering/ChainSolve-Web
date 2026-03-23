import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'
import type { Database } from './database.types'

// env.ts runs validateClientEnv() on import — placeholder credentials are
// rejected in production builds before we reach this point.

const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder'

export const supabase = createClient<Database>(
  SUPABASE_URL || PLACEHOLDER_URL,
  SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

// BUG-07: Graceful session expiry recovery.
// When the refresh token is invalid/expired, sign out and redirect to login
// with a ?session_expired=true flag so the login page can show a friendly message.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    import('../main').then(({ getPostHogInstance }) => {
      getPostHogInstance()?.identify(session.user.id, {
        email: session.user.email,
        created_at: session.user.created_at,
      })
    })
  }
  if (event === 'SIGNED_OUT') {
    import('../main').then(({ getPostHogInstance }) => {
      getPostHogInstance()?.reset()
    })
  }
  if ((event as string) === 'TOKEN_REFRESH_FAILED') {
    // Only redirect if we're not already on an auth page
    const path = window.location.pathname
    const isAuthPage = path === '/login' || path === '/signup' || path === '/reset-password'
    if (!isAuthPage) {
      supabase.auth.signOut().finally(() => {
        window.location.href = '/login?session_expired=true'
      })
    }
  }
})
