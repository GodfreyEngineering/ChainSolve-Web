/**
 * LOD (Level of Detail) tier logic for the canvas.
 *
 * Three tiers map zoom levels to rendering fidelity:
 *   full    – all node UI visible (headers, body, ports, edge badges)
 *   compact – body hidden; header + value line visible; edge badges hidden
 *   minimal – only the node shell visible; all inner content hidden
 *
 * Hysteresis bands prevent rapid toggling when zoom hovers near a boundary.
 *
 *   Zoom-out transitions (enter lower tier):
 *     full → compact   at zoom < LOD_COMPACT_ENTER  (0.60)
 *     compact → minimal at zoom < LOD_MINIMAL_ENTER  (0.35)
 *
 *   Zoom-in transitions (re-enter higher tier):
 *     minimal → compact at zoom >= LOD_COMPACT_REENTER (0.45)
 *     compact → full    at zoom >= LOD_FULL_REENTER    (0.75)
 *
 * The hysteresis band between enter/re-enter thresholds is ~15 % in each case,
 * which prevents flutter when the user holds zoom near a boundary.
 */

export type LodTier = 'full' | 'compact' | 'minimal'

/** Zoom drops below this → switch from full to compact. */
export const LOD_COMPACT_ENTER = 0.6

/** Zoom rises to this or above → switch from compact back to full. */
export const LOD_FULL_REENTER = 0.75

/** Zoom drops below this → switch from compact to minimal. */
export const LOD_MINIMAL_ENTER = 0.35

/** Zoom rises to this or above → switch from minimal back to compact. */
export const LOD_COMPACT_REENTER = 0.45

/**
 * Compute the next LOD tier given the current zoom and the previous tier.
 * Using the previous tier makes transitions hysteretic: the same zoom level
 * may map to different tiers depending on the direction of travel.
 */
export function computeLodTier(zoom: number, prev: LodTier): LodTier {
  if (prev === 'full') {
    return zoom < LOD_COMPACT_ENTER ? 'compact' : 'full'
  }
  if (prev === 'compact') {
    if (zoom >= LOD_FULL_REENTER) return 'full'
    if (zoom < LOD_MINIMAL_ENTER) return 'minimal'
    return 'compact'
  }
  // prev === 'minimal'
  return zoom >= LOD_COMPACT_REENTER ? 'compact' : 'minimal'
}
