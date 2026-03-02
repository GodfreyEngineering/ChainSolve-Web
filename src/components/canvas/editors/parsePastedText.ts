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
