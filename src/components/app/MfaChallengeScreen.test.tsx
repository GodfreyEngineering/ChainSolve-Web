/**
 * Unit tests for MfaChallengeScreen (J1-4).
 */
import { describe, it, expect } from 'vitest'

describe('MfaChallengeScreen module', () => {
  it('exports MfaChallengeScreen component', async () => {
    const mod = await import('./MfaChallengeScreen')
    expect(typeof mod.MfaChallengeScreen).toBe('function')
  })
})

describe('MFA i18n keys', () => {
  it('en.json has all required mfa keys', async () => {
    const en = (await import('../../i18n/locales/en.json')).default
    const mfa = en.mfa as Record<string, string>
    expect(mfa).toBeDefined()
    const required = [
      'challengeTitle',
      'challengeSub',
      'challengeBody',
      'verifyError',
      'backToLogin',
      'setupTitle',
      'setupDesc',
      'skipForNow',
      'setupSuccess',
      'continue',
    ]
    for (const key of required) {
      expect(mfa[key], `missing mfa.${key}`).toBeTruthy()
    }
  })

  it('all locales have mfa section', async () => {
    const locales = ['de', 'fr', 'es', 'it', 'he'] as const
    for (const locale of locales) {
      const mod = await import(`../../i18n/locales/${locale}.json`)
      const json = mod.default as Record<string, unknown>
      expect(json.mfa, `${locale}.json missing mfa section`).toBeDefined()
    }
  })
})
