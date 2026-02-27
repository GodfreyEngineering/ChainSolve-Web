/**
 * constants.ts — Excel format limits and safe thresholds.
 *
 * These constants enforce deterministic truncation/splitting
 * rather than letting write-excel-file crash on oversized data.
 */

/** Maximum rows per worksheet (Excel hard limit). */
export const MAX_EXCEL_ROWS = 1_048_576

/** Maximum columns per worksheet (Excel hard limit). */
export const MAX_EXCEL_COLS = 16_384

/** Maximum characters per cell (Excel hard limit). */
export const MAX_CELL_CHARS = 32_767

/** Safe row limit for table worksheets (perf threshold). */
export const SAFE_MAX_TABLE_ROWS = 200_000

/** Safe column limit for table worksheets (perf threshold). */
export const SAFE_MAX_TABLE_COLS = 512

/** Maximum sheet name length (Excel hard limit). */
export const MAX_SHEET_NAME_LENGTH = 31
