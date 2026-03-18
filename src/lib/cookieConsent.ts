/**
 * Cookie consent helpers — shared between main.tsx (boot-time check)
 * and CookieConsent.tsx (banner component).
 *
 * 16.80: When the user is authenticated, recordCookieConsentAudit() logs
 * the consent choice to the user_consents table for GDPR evidence.
 */

import { supabase } from './supabase'

const LS_KEY = 'cs:cookie-consent'

export type CookieConsentChoice = 'accepted' | 'declined' | null

export function getCookieConsent(): CookieConsentChoice {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'accepted' || v === 'declined') return v
    return null
  } catch {
    return null
  }
}

export function setCookieConsent(choice: 'accepted' | 'declined'): void {
  try {
    localStorage.setItem(LS_KEY, choice)
  } catch {
    // localStorage unavailable
  }
  // 16.80: Record analytics consent to GDPR audit log (best-effort, fire-and-forget)
  recordCookieConsentAudit(choice).catch(() => {})
}

/** Append cookie consent choice to the GDPR user_consents audit table. */
async function recordCookieConsentAudit(choice: 'accepted' | 'declined'): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.from('user_consents').insert({
    user_id: user?.id ?? null,
    consent_type: 'cookie_analytics',
    granted: choice === 'accepted',
  })
}
