/**
 * csv-worker.ts — Web Worker for CSV parsing.
 *
 * Message protocol:
 *   IN  { mode: 'preview', text: string }
 *       → OUT { ok: true; mode: 'preview'; columns; previewRows; totalRows; sep; hasHeader }
 *
 *   IN  { mode: 'full', text: string, includeCols?: boolean[] }
 *       → OUT { progress: number }  (0-1, multiple times for large files)
 *       → OUT { ok: true; mode: 'full'; columns; rows }
 *         OR { ok: false; error: string }
 *
 * Legacy: { text: string } (no mode) → treated as 'full' with no column filter.
 */

import { parseCsv, previewCsv } from './csv-parse'

type InMessage =
  | { mode: 'preview'; text: string }
  | { mode: 'full'; text: string; includeCols?: boolean[] }
  | { text: string } // legacy

self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data
  try {
    if ('mode' in msg && msg.mode === 'preview') {
      const preview = previewCsv(msg.text)
      self.postMessage({ ok: true, mode: 'preview', ...preview })
      return
    }

    // Full parse (with optional includeCols)
    const text = msg.text
    const includeCols = 'mode' in msg && msg.mode === 'full' ? msg.includeCols : undefined

    const result = parseCsv(text, includeCols, (fraction) => {
      self.postMessage({ progress: fraction })
    })

    self.postMessage({ ok: true, mode: 'full', columns: result.columns, rows: result.rows })
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : 'CSV parse error',
    })
  }
}
