/**
 * useFormatValue — locale-aware value formatter hook.
 *
 * Returns a stable formatting function that uses the current i18n locale
 * so scalar numbers respect the user's language (decimal separator, grouping).
 *
 * Export paths (PDF, Excel, JSON) bypass this hook and call formatValue()
 * directly without a locale to produce locale-neutral machine output.
 */
import { useTranslation } from 'react-i18next'
import { formatValue } from '../engine/value'
import type { Value } from '../engine/value'

export function useFormatValue(): (v: Value | undefined) => string {
  const { i18n } = useTranslation()
  const locale = i18n.language
  return (v: Value | undefined) => formatValue(v, locale)
}
