/**
 * csvParser.ts — Simple CSV → table data parser for UX-12 file drop support.
 *
 * Handles:
 * - Optional header row detection (non-numeric first cell → treat as header)
 * - Quoted values (strips leading/trailing quotes)
 * - Numeric and non-numeric cells (non-numeric → 0)
 * - Windows (CRLF) and Unix (LF) line endings
 */

export interface ParsedCSV {
  columns: string[]
  rows: number[][]
}

/**
 * Parse CSV text into columns + numeric rows for a Table Input block.
 * Non-numeric values in data rows are coerced to 0.
 * If the first row appears to be a header (any cell is non-numeric), it's used
 * for column labels; otherwise columns are named A, B, C…
 */
export function parseCSVToTableData(text: string): ParsedCSV {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { columns: ['A'], rows: [[0]] }
  }

  const splitLine = (line: string): string[] =>
    line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''))

  const firstCells = splitLine(lines[0])

  // Detect header: first line is a header if any cell is non-numeric
  const isHeader = firstCells.some((v) => v === '' || isNaN(Number(v)))

  let columns: string[]
  let dataLines: string[]

  if (isHeader) {
    columns = firstCells.map((v, i) => v || String.fromCharCode(65 + (i % 26)))
    dataLines = lines.slice(1)
  } else {
    columns = firstCells.map((_, i) => String.fromCharCode(65 + (i % 26)))
    dataLines = lines
  }

  if (dataLines.length === 0) {
    return { columns, rows: [columns.map(() => 0)] }
  }

  const rows = dataLines.map((line) => {
    const cells = splitLine(line)
    return columns.map((_, ci) => {
      const raw = cells[ci] ?? ''
      const n = Number(raw)
      return isNaN(n) ? 0 : n
    })
  })

  return { columns, rows }
}
