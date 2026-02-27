/**
 * xlsx-loader.ts — Lazy-loads write-excel-file (browser subpath).
 *
 * Follows the same cached-promise singleton pattern as pdf-loader.ts.
 * No static imports — the library is code-split out of the initial
 * bundle and only fetched when the user triggers Excel export.
 */

export interface XlsxAPI {
  writeXlsxFile: typeof import('write-excel-file/browser').default
}

let cached: Promise<XlsxAPI> | null = null

export function loadXlsx(): Promise<XlsxAPI> {
  if (cached) return cached
  cached = (async () => {
    const mod = await import('write-excel-file/browser')
    return { writeXlsxFile: mod.default }
  })()
  return cached
}
