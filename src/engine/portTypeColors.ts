/**
 * portTypeColors.ts — Maps runtime Value kinds to semantic CSS colors and shapes.
 *
 * Item 3.15: Port type visual distinction.
 *   scalar/float    → blue   (--value-color-scalar)
 *   vector          → green  (--value-color-vector)
 *   table/matrix    → purple (--value-color-table)
 *   interval/signal → orange (--value-color-interval)
 *   error           → red    (--value-color-error)
 *   unknown/any     → gray   (--value-color-any)
 *
 * 16.68: Colour independence — each type also has a distinct handle shape
 * (border-radius) so the type is identifiable without relying on colour alone:
 *   scalar    → circle  (50%)
 *   vector    → rounded square (4px)
 *   table     → square  (2px)
 *   interval  → pill    (50% 0%)
 *   error     → sharp   (0%)
 *   any       → circle  (50%)
 *
 * CSS variables are defined in src/index.css under ":root".
 */

import type { Value } from './value'

/**
 * Returns a CSS color value (var(--…) reference) for the given runtime value.
 * Used to colour edges and output handles by data type.
 */
export function getValueTypeColor(v: Value | undefined): string {
  if (!v) return 'var(--value-color-any)'
  switch (v.kind) {
    case 'scalar':
    case 'highPrecision':
      return 'var(--value-color-scalar)'
    case 'vector':
      return 'var(--value-color-vector)'
    case 'table':
      return 'var(--value-color-table)'
    case 'interval':
      return 'var(--value-color-interval)'
    case 'error':
      return 'var(--value-color-error)'
  }
}

/**
 * Returns a CSS border-radius string for the given runtime value kind.
 * Provides a secondary (non-colour) shape cue for accessibility (WCAG 1.4.1).
 */
export function getValueTypeShape(v: Value | undefined): string {
  if (!v) return '50%' // circle — unknown
  switch (v.kind) {
    case 'scalar':
    case 'highPrecision':
      return '50%' // circle
    case 'vector':
      return '4px' // rounded square
    case 'table':
      return '2px' // square
    case 'interval':
      return '50% 0% 50% 0%' // diamond-ish
    case 'error':
      return '0%' // sharp square
  }
}

/**
 * Returns a short text label for the value type (for aria-label / title).
 */
export function getValueTypeLabel(v: Value | undefined): string {
  if (!v) return 'any'
  switch (v.kind) {
    case 'scalar':
      return 'scalar'
    case 'highPrecision':
      return 'high-precision scalar'
    case 'vector':
      return 'vector'
    case 'table':
      return 'table'
    case 'interval':
      return 'interval'
    case 'error':
      return 'error'
  }
}
