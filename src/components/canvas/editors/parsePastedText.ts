/**
 * Smart paste parser for numeric lists (H2-1).
 *
 * Handles: JSON arrays, newline/comma/tab/semicolon-separated values,
 * quoted numbers, scientific notation. Rejects Infinity and NaN.
 */
export function parsePastedText(text: string): {
  values: number[]
  errors: number
} {
  const trimmed = text.trim()
  if (!trimmed) return { values: [], errors: 0 }

  // Try JSON array first
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) {
        const values: number[] = []
        let errors = 0
        for (const item of arr) {
          const n = Number(item)
          if (isFinite(n)) {
            values.push(n)
          } else {
            errors++
          }
        }
        return { values, errors }
      }
    } catch {
      // Fall through to line-based parsing
    }
  }

  // Split by newlines, tabs, commas, or semicolons
  const tokens = trimmed
    .split(/[\n\r\t,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const values: number[] = []
  let errors = 0
  for (const token of tokens) {
    // Strip surrounding whitespace, quotes, currency symbols
    const cleaned = token.replace(/^["'$\s]+|["'\s]+$/g, '')
    const n = Number(cleaned)
    if (cleaned !== '' && isFinite(n)) {
      values.push(n)
    } else {
      errors++
    }
  }
  return { values, errors }
}

/**
 * Parse pasted text as a 2-D grid of numbers for spreadsheet paste (TBL-01).
 *
 * Rows split by newlines, columns split by tabs (or commas if no tabs).
 * Each cell is a number or null (non-numeric → null = keep existing value).
 */
export function parsePastedGrid(text: string): (number | null)[][] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []

  // Detect cell separator: prefer tab, fall back to comma
  const sep = lines[0].includes('\t') ? '\t' : ','

  return lines.map((line) =>
    line.split(sep).map((cell) => {
      const cleaned = cell.trim().replace(/^["']+|["']+$/g, '')
      const n = Number(cleaned)
      return cleaned !== '' && isFinite(n) ? n : null
    }),
  )
}
