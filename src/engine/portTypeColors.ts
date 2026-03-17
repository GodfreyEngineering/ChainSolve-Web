/**
 * portTypeColors.ts — Maps runtime Value kinds to semantic CSS colors.
 *
 * Item 3.15: Port type visual distinction.
 *   scalar/float    → blue   (--value-color-scalar)
 *   vector          → green  (--value-color-vector)
 *   table/matrix    → purple (--value-color-table)
 *   interval/signal → orange (--value-color-interval)
 *   error           → red    (--value-color-error)
 *   unknown/any     → gray   (--value-color-any)
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
