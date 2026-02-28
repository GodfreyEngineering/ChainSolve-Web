/**
 * tableConstants.ts — hard limits for table input nodes.
 *
 * These constants guard the TableInput node editor and CSV import from
 * runaway data entry that would degrade canvas performance.
 *
 * Display limits (engine output tables) are intentionally permissive —
 * the virtual-scroll renderer in TableEditor already handles large row
 * counts efficiently.
 */

/** Maximum number of rows a TableInput node may hold. */
export const MAX_TABLE_INPUT_ROWS = 10_000

/** Maximum number of columns a TableInput node may hold. */
export const MAX_TABLE_INPUT_COLS = 50

/**
 * Clamp columns and rows to the declared limits.
 *
 * Returns the (possibly trimmed) data plus a flag indicating whether any
 * trimming occurred.  Safe to call on already-valid data — returns the
 * original arrays untouched when no trimming is needed.
 */
export function enforceTableLimits(
  columns: string[],
  rows: number[][],
  maxRows = MAX_TABLE_INPUT_ROWS,
  maxCols = MAX_TABLE_INPUT_COLS,
): { columns: string[]; rows: number[][]; truncated: boolean } {
  const colsTruncated = columns.length > maxCols
  const rowsTruncated = rows.length > maxRows
  const truncated = colsTruncated || rowsTruncated

  const clampedCols = colsTruncated ? columns.slice(0, maxCols) : columns
  const clampedRows = rowsTruncated ? rows.slice(0, maxRows) : rows

  // If columns were trimmed, also trim each row's cells.
  const finalRows = colsTruncated ? clampedRows.map((r) => r.slice(0, maxCols)) : clampedRows

  return { columns: clampedCols, rows: finalRows, truncated }
}
