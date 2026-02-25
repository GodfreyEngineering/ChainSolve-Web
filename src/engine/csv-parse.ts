/**
 * csv-parse.ts — Lightweight CSV parser.
 *
 * Pure function, no DOM dependencies. Used by the Web Worker and tests.
 *
 * Features:
 * - Auto-detects separator (comma, semicolon, tab)
 * - First row → column headers
 * - Handles quoted fields (RFC 4180 basics)
 * - Non-numeric cells → NaN
 */

export interface CsvResult {
  columns: string[]
  rows: number[][]
}

/** Detect the most likely column separator from the first few lines. */
function detectSeparator(text: string): string {
  const sample = text.slice(0, 4096)
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  for (const ch of sample) {
    if (ch in counts) counts[ch]++
  }
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

/** Split a single CSV line respecting quoted fields. */
function splitLine(line: string, sep: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuote = true
    } else if (ch === sep) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

export function parseCsv(text: string): CsvResult {
  const sep = detectSeparator(text)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { columns: [], rows: [] }
  }

  const columns = splitLine(lines[0], sep).map((h) => h.trim())
  const rows: number[][] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = splitLine(lines[i], sep)
    const row = fields.map((f) => {
      const trimmed = f.trim()
      if (trimmed === '') return NaN
      const n = Number(trimmed)
      return n
    })
    // Pad or trim to match column count
    while (row.length < columns.length) row.push(NaN)
    if (row.length > columns.length) row.length = columns.length
    rows.push(row)
  }

  return { columns, rows }
}
