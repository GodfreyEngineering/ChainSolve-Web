/**
 * csv-parse.ts — Lightweight CSV parser.
 *
 * Pure function, no DOM dependencies. Used by the Web Worker and tests.
 *
 * Features:
 * - Auto-detects separator (comma, semicolon, tab, pipe)
 * - Auto-detects header row (if first row is all non-numeric text)
 * - Handles quoted fields (RFC 4180 basics)
 * - Non-numeric cells → NaN
 * - Preview mode: returns first N raw string rows without numeric conversion
 * - Full parse: optional per-column include/exclude filter
 */

export interface CsvResult {
  columns: string[]
  rows: number[][]
}

export interface CsvPreview {
  /** Detected column headers (or generated A, B, C…). */
  columns: string[]
  /** First up to 5 raw (string) rows of data (excluding header row). */
  previewRows: string[][]
  /** Total data row count (excluding header). */
  totalRows: number
  /** Detected delimiter character. */
  sep: string
  /** Whether first row was detected as a header row. */
  hasHeader: boolean
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Detect the most likely column separator from the first few lines. */
export function detectSeparator(text: string): string {
  const sample = text.slice(0, 4096)
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 }
  for (const ch of sample) {
    if (ch in counts) counts[ch]++
  }
  // Prefer tab (TSV), then pipe, then semicolon, then comma
  const tab = counts['\t']
  const pipe = counts['|']
  const semi = counts[';']
  const comma = counts[',']
  const max = Math.max(tab, pipe, semi, comma)
  if (max === 0) return ','
  if (tab === max) return '\t'
  if (pipe === max) return '|'
  if (semi === max) return ';'
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

/** Detect whether the first row is a header (any cell is non-numeric). */
function isHeaderRow(cells: string[]): boolean {
  return cells.some((v) => {
    const trimmed = v.trim()
    return trimmed !== '' && isNaN(Number(trimmed))
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Preview: return column names + first N raw string rows + metadata.
 * Does not convert to numbers — caller sees real cell text.
 */
export function previewCsv(text: string, maxPreviewRows = 5): CsvPreview {
  const sep = detectSeparator(text)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { columns: ['A'], previewRows: [], totalRows: 0, sep, hasHeader: false }
  }

  const firstCells = splitLine(lines[0], sep).map((v) => v.trim())
  const hasHeader = isHeaderRow(firstCells)

  let columns: string[]
  let dataStart: number
  if (hasHeader) {
    columns = firstCells.map((v, i) => v || String.fromCharCode(65 + (i % 26)))
    dataStart = 1
  } else {
    columns = firstCells.map((_, i) => String.fromCharCode(65 + (i % 26)))
    dataStart = 0
  }

  const totalRows = lines.length - dataStart
  const previewLines = lines.slice(dataStart, dataStart + maxPreviewRows)
  const previewRows = previewLines.map((line) => {
    const cells = splitLine(line, sep).map((v) => v.trim())
    // Pad or trim to column count
    while (cells.length < columns.length) cells.push('')
    return cells.slice(0, columns.length)
  })

  return { columns, previewRows, totalRows, sep, hasHeader }
}

/**
 * Full parse: convert all data rows to numeric, optionally excluding columns.
 *
 * @param text        Raw CSV/TSV text.
 * @param includeCols Per-column boolean mask; if undefined, all columns included.
 * @param onProgress  Optional callback called with fraction 0-1 during parse.
 */
export function parseCsv(
  text: string,
  includeCols?: boolean[],
  onProgress?: (fraction: number) => void,
): CsvResult {
  const sep = detectSeparator(text)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { columns: [], rows: [] }
  }

  const firstCells = splitLine(lines[0], sep).map((v) => v.trim())
  const hasHeader = isHeaderRow(firstCells)

  let allColumns: string[]
  let dataStart: number
  if (hasHeader) {
    allColumns = firstCells.map((v, i) => v || String.fromCharCode(65 + (i % 26)))
    dataStart = 1
  } else {
    allColumns = firstCells.map((_, i) => String.fromCharCode(65 + (i % 26)))
    dataStart = 0
  }

  // Apply column inclusion filter
  const include = includeCols ?? allColumns.map(() => true)
  const colIndices = allColumns.map((_, i) => i).filter((i) => include[i] ?? true)
  const columns = colIndices.map((i) => allColumns[i])

  const rows: number[][] = []
  const total = lines.length - dataStart

  for (let li = dataStart; li < lines.length; li++) {
    const fields = splitLine(lines[li], sep)
    const row = colIndices.map((ci) => {
      const trimmed = (fields[ci] ?? '').trim()
      if (trimmed === '') return NaN
      return Number(trimmed)
    })
    rows.push(row)

    if (onProgress && li % 1000 === 0) {
      onProgress((li - dataStart) / total)
    }
  }

  return { columns, rows }
}
