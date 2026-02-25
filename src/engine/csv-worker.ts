/**
 * csv-worker.ts — Web Worker for CSV parsing.
 *
 * Receives { text: string } via postMessage, parses with parseCsv(),
 * and responds with { ok: true, columns, rows } or { ok: false, error }.
 *
 * Used via: new Worker(new URL('./csv-worker.ts', import.meta.url), { type: 'module' })
 */

import { parseCsv } from './csv-parse'

self.onmessage = (e: MessageEvent<{ text: string }>) => {
  try {
    const result = parseCsv(e.data.text)
    self.postMessage({ ok: true, columns: result.columns, rows: result.rows })
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : 'CSV parse error',
    })
  }
}
