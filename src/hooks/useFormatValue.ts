/**
 * useFormatValue — locale-aware, preference-aware value formatter hook (SCI-02/05/07).
 *
 * Returns a stable formatting function that respects:
 * - Current i18n locale (decimal/thousands separator defaults).
 * - User preferences: display mode, decimal places, sig figs, separators.
 * - SCI-02: high-precision substitution for pi, e, phi, sqrt(2).
 *
 * Export paths (PDF, Excel, JSON) bypass this hook and call formatValue()
 * directly without a locale for locale-neutral machine output.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatValue } from '../engine/value'
import type { Value, FormatOptions } from '../engine/value'
import { usePreferencesStore } from '../stores/preferencesStore'
import { matchHighPrecisionConstant, formatHighPrecision } from '../lib/highPrecisionConstants'

export function useFormatValue(): (v: Value | undefined) => string {
  const { i18n } = useTranslation()
  const locale = i18n.language
  const prefs = usePreferencesStore()

  const highPrecisionLookup = useCallback(
    (n: number, decimalPlaces: number): string | null => {
      const c = matchHighPrecisionConstant(n)
      if (!c) return null
      const dp = decimalPlaces >= 0 ? decimalPlaces : 6
      return formatHighPrecision(c, Math.min(dp, 100))
    },
    [],
  )

  const opts: FormatOptions = {
    numberDisplayMode: prefs.numberDisplayMode,
    decimalPlaces: prefs.decimalPlaces,
    sigFigs: prefs.sigFigs,
    scientificNotationThreshold: prefs.scientificNotationThreshold,
    thousandsSeparator: prefs.thousandsSeparator,
    thousandsSeparatorChar: prefs.thousandsSeparatorChar,
    decimalSeparator: prefs.decimalSeparator,
    ...(prefs.highPrecisionConstants ? { highPrecisionLookup } : {}),
  }

  return useCallback(
    (v: Value | undefined) => formatValue(v, locale, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      locale,
      prefs.numberDisplayMode,
      prefs.decimalPlaces,
      prefs.sigFigs,
      prefs.scientificNotationThreshold,
      prefs.thousandsSeparator,
      prefs.thousandsSeparatorChar,
      prefs.decimalSeparator,
      prefs.highPrecisionConstants,
      highPrecisionLookup,
    ],
  )
}
