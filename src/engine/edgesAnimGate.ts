/**
 * edgesAnimGate.ts — Animated-edges enable/disable gate with hysteresis.
 *
 * Animation is automatically disabled above ANIM_EDGES_DISABLE_AT edges
 * and only re-enabled once the count drops below ANIM_EDGES_REENABLE_AT.
 * The gap between the two thresholds (hysteresis band) prevents rapid
 * toggling when the edge count hovers near the boundary.
 *
 * Usage in React:
 *
 *   const autoDisabledRef = useRef(false)
 *   const effectiveEdgesAnimated = computeEffectiveEdgesAnimated(
 *     edgesAnimated,
 *     edges.length,
 *     autoDisabledRef.current,
 *   )
 *   autoDisabledRef.current = !effectiveEdgesAnimated && edgesAnimated
 *
 * The ref must be updated after each render with the returned autoDisabled
 * flag so hysteresis state persists across renders.
 */

/** Disable animation automatically when the edge count exceeds this value. */
export const ANIM_EDGES_DISABLE_AT = 400

/**
 * Once auto-disabled, only re-enable when the edge count drops below this
 * value. Must be ≤ ANIM_EDGES_DISABLE_AT.
 */
export const ANIM_EDGES_REENABLE_AT = 360

/**
 * Compute whether edge animation should be active, applying hysteresis.
 *
 * @param userEnabled  Whether the user has toggled animation on.
 * @param edgeCount    Current number of edges in the graph.
 * @param wasAutoDisabled  Whether the previous render auto-disabled animation.
 * @returns effective  True when animation should actually run.
 */
export function computeEffectiveEdgesAnimated(
  userEnabled: boolean,
  edgeCount: number,
  wasAutoDisabled: boolean,
): boolean {
  if (!userEnabled) return false
  if (edgeCount > ANIM_EDGES_DISABLE_AT) return false
  // Hysteresis: stay disabled until count drops below the re-enable threshold.
  if (wasAutoDisabled && edgeCount > ANIM_EDGES_REENABLE_AT) return false
  return true
}
