/**
 * Cookie consent helpers — shared between main.tsx (boot-time check)
 * and CookieConsent.tsx (banner component).
 */

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
}
