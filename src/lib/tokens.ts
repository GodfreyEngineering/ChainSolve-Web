/**
 * tokens.ts — TS-side mirror of CSS custom properties defined in index.css.
 *
 * Use these constants in inline styles where a raw number is needed (e.g.
 * z-index values) or where referencing the CSS variable name would be
 * cumbersome.  The CSS file remains the single source of truth for visual
 * tokens; this file simply re-exports the numeric/structural constants
 * that TypeScript code needs.
 */

/** Z-index layer constants — matches --z-* tokens in index.css. */
export const Z = {
  dropdown: 100,
  modal: 9000,
  toast: 9500,
  dock: 9999,
} as const

/** Font-weight constants used across the UI. */
export const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const
