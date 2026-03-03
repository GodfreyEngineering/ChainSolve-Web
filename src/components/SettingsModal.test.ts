/**
 * Unit tests for the Settings window split (J2-1).
 *
 * Validates that the context, provider, and modal correctly separate
 * Account Settings from App Settings.
 */
import { describe, it, expect } from 'vitest'

describe('SettingsModalContext', () => {
  it('exports isAccountTab that classifies tabs correctly', async () => {
    const { isAccountTab } = await import('../contexts/SettingsModalContext')
    expect(isAccountTab('profile')).toBe(true)
    expect(isAccountTab('billing')).toBe(true)
    expect(isAccountTab('security')).toBe(true)
    expect(isAccountTab('preferences')).toBe(false)
  })

  it('exports AccountTab and AppTab types (via SettingsTab union)', async () => {
    const mod = await import('../contexts/SettingsModalContext')
    expect(typeof mod.useSettingsModal).toBe('function')
    expect(typeof mod.isAccountTab).toBe('function')
  })
})

describe('SettingsModalProvider', () => {
  it('exports two separate window IDs', async () => {
    const mod = await import('./SettingsModalProvider')
    expect(mod.ACCOUNT_SETTINGS_WINDOW_ID).toBe('account-settings')
    expect(mod.APP_SETTINGS_WINDOW_ID).toBe('app-settings')
    expect(mod.ACCOUNT_SETTINGS_WINDOW_ID).not.toBe(mod.APP_SETTINGS_WINDOW_ID)
  })

  it('maintains backward-compat SETTINGS_WINDOW_ID alias', async () => {
    const mod = await import('./SettingsModalProvider')
    expect(mod.SETTINGS_WINDOW_ID).toBe(mod.ACCOUNT_SETTINGS_WINDOW_ID)
  })
})

describe('Settings i18n keys', () => {
  it('en.json has accountTitle and appTitle', async () => {
    const en = (await import('../i18n/locales/en.json')).default
    const settings = en.settings as Record<string, string>
    expect(settings.accountTitle).toBeTruthy()
    expect(settings.appTitle).toBeTruthy()
  })

  it('all locales have accountTitle and appTitle', async () => {
    const locales = ['de', 'fr', 'es', 'it', 'he'] as const
    for (const locale of locales) {
      const mod = await import(`../i18n/locales/${locale}.json`)
      const json = mod.default as Record<string, Record<string, string>>
      expect(json.settings?.accountTitle, `${locale} missing accountTitle`).toBeTruthy()
      expect(json.settings?.appTitle, `${locale} missing appTitle`).toBeTruthy()
    }
  })
})
