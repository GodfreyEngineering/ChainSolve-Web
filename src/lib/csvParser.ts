/**
 * csvParser.ts — CSV + NumPy .npy → table data parsers for file drop support.
 *
 * CSV handles:
 * - Optional header row detection (non-numeric first cell → treat as header)
 * - Quoted values (strips leading/trailing quotes)
 * - Numeric and non-numeric cells (non-numeric → 0)
 * - Windows (CRLF) and Unix (LF) line endings
 *
 * NumPy .npy (4.10): parses v1/v2 format for float32/float64 1D/2D arrays.
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

/**
 * 4.10: Parse NumPy .npy ArrayBuffer into ParsedCSV format.
 * Supports float32, float64, int8, int16, int32, int64 dtypes.
 * Handles 1D arrays (→ single column) and 2D arrays (→ columns by index).
 * Returns null if the format is unsupported.
 */
export function parseNpyToTableData(buf: ArrayBuffer): ParsedCSV | null {
  const bytes = new Uint8Array(buf)
  // Magic: \x93NUMPY
  if (
    bytes[0] !== 0x93 ||
    bytes[1] !== 0x4e ||
    bytes[2] !== 0x55 ||
    bytes[3] !== 0x4d ||
    bytes[4] !== 0x50 ||
    bytes[5] !== 0x59
  )
    return null

  const majorVer = bytes[6]
  // Header length: 2 bytes LE for v1, 4 bytes LE for v2/v3
  let headerLen: number
  let dataOffset: number
  if (majorVer === 1) {
    const dv = new DataView(buf, 8, 2)
    headerLen = dv.getUint16(0, true)
    dataOffset = 10 + headerLen
  } else {
    const dv = new DataView(buf, 8, 4)
    headerLen = dv.getUint32(0, true)
    dataOffset = 12 + headerLen
  }

  const headerBytes = bytes.slice(majorVer === 1 ? 10 : 12, dataOffset)
  const header = new TextDecoder().decode(headerBytes).trim()

  // Parse dtype — look for 'descr': '<f8' etc.
  const descrMatch = header.match(/'descr'\s*:\s*'([^']+)'/)
  if (!descrMatch) return null
  const descr = descrMatch[1]

  // Determine bytes per element and array reader
  const dtypeMap: Record<string, { bytes: number; read: (dv: DataView, offset: number, le: boolean) => number }> = {
    '<f8': { bytes: 8, read: (dv, o, le) => dv.getFloat64(o, le) },
    '<f4': { bytes: 4, read: (dv, o, le) => dv.getFloat32(o, le) },
    '>f8': { bytes: 8, read: (dv, o, _le) => dv.getFloat64(o, false) },
    '>f4': { bytes: 4, read: (dv, o, _le) => dv.getFloat32(o, false) },
    '<i4': { bytes: 4, read: (dv, o, le) => dv.getInt32(o, le) },
    '<i8': { bytes: 8, read: (dv, o, le) => Number(dv.getBigInt64(o, le)) },
    '<i2': { bytes: 2, read: (dv, o, le) => dv.getInt16(o, le) },
    '<i1': { bytes: 1, read: (dv, o, _le) => dv.getInt8(o) },
  }
  const dtype = dtypeMap[descr]
  if (!dtype) return null

  const littleEndian = descr[0] === '<'

  // Parse shape
  const shapeMatch = header.match(/'shape'\s*:\s*\(([^)]*)\)/)
  if (!shapeMatch) return null
  const shapeParts = shapeMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
  const shape = shapeParts.map(Number)
  if (shape.some(isNaN)) return null

  const ndim = shape.length
  const nrows = ndim === 1 ? shape[0] : shape[0]
  const ncols = ndim === 1 ? 1 : shape[1]

  if (nrows === 0 || ncols === 0) return null
  // Limit to 2000 rows × 500 cols to avoid browser hang
  if (nrows > 2000 || ncols > 500) return null

  const dv = new DataView(buf, dataOffset)
  const flat: number[] = []
  const total = nrows * ncols
  for (let i = 0; i < total; i++) {
    flat.push(dtype.read(dv, i * dtype.bytes, littleEndian))
  }

  const columns = Array.from({ length: ncols }, (_, ci) =>
    ncols === 1 ? 'value' : String(ci + 1),
  )
  const rows: number[][] = []
  for (let ri = 0; ri < nrows; ri++) {
    rows.push(flat.slice(ri * ncols, ri * ncols + ncols))
  }

  return { columns, rows }
}
