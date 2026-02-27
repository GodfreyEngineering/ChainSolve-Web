/**
 * sheetNames.ts — Excel-safe sheet name helpers.
 *
 * Excel sheet names must be ≤ 31 characters, must not contain
 * the characters \ / * [ ] : ?, and must be unique within a workbook.
 * These pure functions enforce all three constraints.
 */

import { MAX_SHEET_NAME_LENGTH } from './constants'

/** Characters forbidden in Excel sheet names. */
const FORBIDDEN_RE = /[\\/*[\]:?]/g

/**
 * Remove forbidden characters, collapse whitespace, trim,
 * and truncate to MAX_SHEET_NAME_LENGTH (31) characters.
 * Empty result falls back to "Sheet".
 */
export function sanitizeSheetName(name: string): string {
  const cleaned = name
    .replace(FORBIDDEN_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SHEET_NAME_LENGTH)
  return cleaned || 'Sheet'
}

/**
 * Deduplicate an array of sheet names by appending " (2)", " (3)", etc.
 * Comparison is case-insensitive (Excel treats "Sheet" and "sheet" as
 * the same name). The suffix is applied while still respecting the
 * 31-character limit.
 */
export function dedupeSheetNames(names: string[]): string[] {
  const result: string[] = []
  const seen = new Map<string, number>()

  for (const name of names) {
    const key = name.toLowerCase()
    const count = seen.get(key) ?? 0

    if (count === 0) {
      result.push(name)
    } else {
      const suffix = ` (${count + 1})`
      const maxBase = MAX_SHEET_NAME_LENGTH - suffix.length
      const base = name.slice(0, maxBase)
      result.push(base + suffix)
    }

    seen.set(key, count + 1)
  }

  return result
}
