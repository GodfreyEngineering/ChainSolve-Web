/**
 * rememberMe.ts — "Remember me" toggle persistence (E2-5).
 *
 * When "remember me" is unchecked, we register a `beforeunload` listener
 * that clears the Supabase auth tokens on browser close.  When checked
 * (the default), sessions persist across browser restarts.
 */

const REMEMBER_KEY = 'cs:remember_me'

/** Get the current remember-me preference (default: true). */
export function getRememberMe(): boolean {
  const stored = localStorage.getItem(REMEMBER_KEY)
  return stored !== 'false'
}

/** Set the remember-me preference. */
export function setRememberMe(remember: boolean): void {
  localStorage.setItem(REMEMBER_KEY, String(remember))
  if (remember) {
    window.removeEventListener('beforeunload', clearSupabaseSession)
  } else {
    window.addEventListener('beforeunload', clearSupabaseSession)
  }
}

/** Install the beforeunload listener if remember-me is false. Call on app init. */
export function initRememberMe(): void {
  if (!getRememberMe()) {
    window.addEventListener('beforeunload', clearSupabaseSession)
  }
}

function clearSupabaseSession(): void {
  // Remove Supabase auth keys from localStorage so the session won't persist.
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
      localStorage.removeItem(key)
    }
  }
}
