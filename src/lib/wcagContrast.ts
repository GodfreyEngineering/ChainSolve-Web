/**
 * wcagContrast.ts — WCAG 2.1 contrast ratio helpers.
 *
 * All math follows the WCAG 2.1 spec:
 *   https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * AA threshold: 4.5:1 for normal text, 3.0:1 for large text (18pt / 14pt bold).
 */

// ── sRGB linearisation ────────────────────────────────────────────────────────

function linearise(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

// ── Relative luminance ────────────────────────────────────────────────────────

/**
 * Compute the WCAG relative luminance of an sRGB colour [0–1 per channel].
 */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b)
}

// ── Alpha blending ────────────────────────────────────────────────────────────

/**
 * Alpha-composite a foreground colour (with alpha) over a solid background.
 * All values in [0, 1].
 * Returns the effective sRGB triple.
 */
export function blendAlpha(
  fg: [number, number, number],
  alpha: number,
  bg: [number, number, number],
): [number, number, number] {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ]
}

// ── Contrast ratio ────────────────────────────────────────────────────────────

/**
 * Compute the WCAG contrast ratio between two luminance values.
 * Result is in [1, 21].
 */
export function contrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Hex / rgba helpers ────────────────────────────────────────────────────────

/**
 * Parse a 6-digit hex colour string (e.g. "#1cabb0") to sRGB [0, 1].
 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '')
  if (h.length !== 6) throw new Error(`Invalid hex colour: ${hex}`)
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  if (isNaN(r) || isNaN(g) || isNaN(b)) throw new Error(`Invalid hex colour: ${hex}`)
  return [r, g, b]
}

/**
 * Compute the WCAG contrast ratio between two hex colours.
 * Throws if either string is not a valid 6-digit hex.
 */
export function hexContrast(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  return contrastRatio(luminance(r1, g1, b1), luminance(r2, g2, b2))
}

/**
 * Compute the contrast ratio of an rgba foreground blended over a hex background.
 *
 * @param fgHex   Hex colour of the foreground, e.g. "#f4f4f3"
 * @param alpha   Opacity of the foreground, 0–1
 * @param bgHex   Hex colour of the background, e.g. "#1a1a1a"
 */
export function alphaHexContrast(fgHex: string, alpha: number, bgHex: string): number {
  const fg = hexToRgb(fgHex)
  const bg = hexToRgb(bgHex)
  const blended = blendAlpha(fg, alpha, bg)
  return contrastRatio(luminance(...blended), luminance(...bg))
}

// ── WCAG level checkers ───────────────────────────────────────────────────────

/** True when ratio ≥ 4.5 (WCAG AA normal text). */
export function meetsAA(ratio: number): boolean {
  return ratio >= 4.5
}

/** True when ratio ≥ 3.0 (WCAG AA large text). */
export function meetsAALarge(ratio: number): boolean {
  return ratio >= 3.0
}
