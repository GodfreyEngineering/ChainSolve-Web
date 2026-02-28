/**
 * marketplaceThemeService.ts — P117 marketplace theme CSS variables.
 *
 * Persists and applies CSS custom property overrides from marketplace theme
 * items.  Variables are set on `document.documentElement` so they take effect
 * immediately alongside the normal dark/light theme switching.
 *
 * Security:
 *   - Only CSS custom properties (keys must start with '--') are accepted.
 *   - Values are sanitised to reject '<' and 'javascript:' injection patterns.
 *
 * localStorage key: 'chainsolve.marketplace_theme'
 */

/** The shape of a marketplace theme item's payload field. */
export interface MarketplaceThemePayload {
  /**
   * Minimum engine contract version required for this theme's companion logic.
   * Typically 1 (or absent) for pure CSS variable themes.
   */
  minContractVersion?: number
  /** CSS custom property overrides, e.g. { '--primary': '#ff6b6b' }. */
  variables: Record<string, unknown>
}

/** What is persisted in localStorage. */
export interface InstalledMarketplaceTheme {
  itemId: string
  name: string
  /** Sanitised CSS variable map. */
  variables: Record<string, string>
}

const STORAGE_KEY = 'chainsolve.marketplace_theme'

/**
 * Validate and sanitise a raw CSS variable map from the item payload.
 *
 * Accepted: keys starting with '--', string values, no '<' or 'javascript:'.
 */
export function sanitizeThemeVariables(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith('--')) continue
    if (typeof v !== 'string') continue
    if (v.includes('<') || v.toLowerCase().includes('javascript:')) continue
    out[k] = v
  }
  return out
}

/** Return the currently installed marketplace theme, or null. */
export function getInstalledMarketplaceTheme(): InstalledMarketplaceTheme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as InstalledMarketplaceTheme
  } catch {
    return null
  }
}

function applyVariables(variables: Record<string, string>): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(variables)) {
    root.style.setProperty(key, value)
  }
}

function clearVariables(variables: Record<string, string>): void {
  const root = document.documentElement
  for (const key of Object.keys(variables)) {
    root.style.removeProperty(key)
  }
}

/**
 * Re-apply the persisted marketplace theme on app start-up.
 * Call this once during app initialisation (before first render).
 */
export function applyPersistedMarketplaceTheme(): void {
  const theme = getInstalledMarketplaceTheme()
  if (theme) applyVariables(theme.variables)
}

/**
 * Install a marketplace theme: persist and immediately apply its variables.
 * Replaces any previously installed marketplace theme.
 */
export function installMarketplaceTheme(
  itemId: string,
  name: string,
  variables: Record<string, string>,
): void {
  const existing = getInstalledMarketplaceTheme()
  if (existing) clearVariables(existing.variables)

  const theme: InstalledMarketplaceTheme = { itemId, name, variables }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme))
  } catch {
    // ignore storage-full / private-browsing
  }
  applyVariables(variables)
}

/**
 * Remove the installed marketplace theme and restore CSS defaults.
 */
export function uninstallMarketplaceTheme(): void {
  const existing = getInstalledMarketplaceTheme()
  if (existing) clearVariables(existing.variables)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
