/**
 * rtl.ts — P148: RTL (right-to-left) language utilities.
 *
 * Provides a canonical list of RTL language codes and helpers for resolving
 * the `dir` attribute value.  Used by:
 *   - boot.ts      → sets dir="rtl/ltr" pre-paint (no FOUC)
 *   - i18n/config.ts → updates dir on language change
 *   - Tests        → verify RTL detection correctness
 *
 * Language codes follow BCP 47 two-letter ISO 639-1 form.
 * Arabic (ar) and Hebrew (he) are the primary RTL locales.
 * Persian (fa), Urdu (ur), Pashto (ps), Sindhi (sd) are also included for
 * completeness — translation files for these can be added incrementally.
 */

/** BCP 47 two-letter language codes that require right-to-left layout. */
export const RTL_LANGS: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd'])

/**
 * Returns true if the given BCP 47 language tag corresponds to an RTL script.
 * Accepts full tags like 'he-IL' — only the first two characters are checked.
 */
export function isRTL(lang: string): boolean {
  return RTL_LANGS.has(lang.toLowerCase().slice(0, 2))
}

/**
 * Returns the CSS `dir` attribute value for the given language tag.
 * Used to set `document.documentElement.dir` so the browser applies the
 * correct bidirectional text algorithm to the entire document.
 */
export function getDirection(lang: string): 'rtl' | 'ltr' {
  return isRTL(lang) ? 'rtl' : 'ltr'
}
