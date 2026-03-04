/**
 * Unit tests for the Settings window split (J2-1) + V2-002 regression.
 *
 * Validates that the context, provider, and modal correctly separate
 * Account Settings from App Settings.
 *
 * V2-002: Also verifies the windowed SettingsModal does NOT depend on
 * react-router-dom hooks (useNavigate, useSearchParams), preventing
 * the "useNavigate() outside Router" crash that affected the old
 * full-page Settings component.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

// ── V2-002 regression: SettingsModal must not use Router hooks ──────────────

describe('V2-002: SettingsModal Router-independence', () => {
  it('SettingsModal.tsx does not import from react-router-dom', () => {
    const src = readFileSync(resolve(__dirname, 'SettingsModal.tsx'), 'utf-8')
    expect(src).not.toContain('react-router-dom')
  })

  it('SettingsModalProvider.tsx does not import from react-router-dom', () => {
    const src = readFileSync(resolve(__dirname, 'SettingsModalProvider.tsx'), 'utf-8')
    expect(src).not.toContain('react-router-dom')
  })

  it('dead full-page Settings.tsx has been removed (V2-002)', async () => {
    // The old src/pages/Settings.tsx used useNavigate outside Router context.
    // It was deleted as dead code; ensure it stays deleted.
    const exists = await import('node:fs').then((fs) => {
      try {
        fs.accessSync(resolve(__dirname, '../pages/Settings.tsx'))
        return true
      } catch {
        return false
      }
    })
    expect(exists).toBe(false)
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
