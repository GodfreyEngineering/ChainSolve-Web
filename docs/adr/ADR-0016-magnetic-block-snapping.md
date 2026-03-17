# ADR-0016: Magnetic Block Snapping on the Canvas

**Status:** Accepted
**Date:** 2026-03-17

---

## Context

ChainSolve's canvas is a free-form drag-and-drop environment built on React Flow v12. Early in development, user testing revealed that graphs with more than 15-20 blocks quickly became visually cluttered — blocks were placed at arbitrary positions, edges crossed each other, and the overall layout communicated no structural meaning. Users spent significant time manually aligning blocks to make graphs readable.

Grid snapping (snapping block positions to a fixed pixel grid) was the obvious first solution, but it was rejected during a design review: a global grid constrains layout globally and often forces blocks into positions that look aligned on the grid but misaligned relative to the specific blocks they connect to. Grid snapping also creates a disconcerting "quantized" feel during drag.

The desired UX was context-sensitive alignment: when dragging a block near another block with which it shares a structural relationship (connected by edges, or positioned in a chain), the canvas should nudge the dragged block into the "right" position and show visual confirmation that alignment was achieved. This is the "magnetic snapping" pattern common in graphic design tools (Figma, Sketch, Affinity).

The implementation had to work within React Flow's event model, where block positions are managed by the `useNodes` store and drag events fire at pointer-move frequency. Guide lines needed to appear and disappear instantly without causing React re-renders on every pixel of drag movement.

---

## Decision

Magnetic snapping is implemented in the `useBlockSnapping` custom hook (`src/hooks/useBlockSnapping.ts`), which plugs into React Flow's `onNodeDrag` and `onNodeDragStop` handlers. The hook runs a **proximity scan** on every drag event and, if any alignment condition is met within the 12 px threshold, overrides the dragged node's proposed position with the snapped position.

**Three alignment modes are supported:**

1. **Horizontal chain snap (right→left, 12 px gap).** When the dragged block's left edge is within 12 px of another block's right edge horizontally, and the two blocks' vertical centers are within 12 px of each other, the dragged block snaps so its left edge sits exactly 12 px to the right of the anchor block's right edge, with vertical centers aligned. This models the natural reading direction of a data pipeline.

2. **Vertical stack snap (center-aligned).** When the dragged block's horizontal center is within 12 px of another block's horizontal center, and the blocks do not overlap vertically, the dragged block snaps so its horizontal center aligns with the anchor block's horizontal center. Vertical position is not constrained by this mode.

3. **Center-align snap.** When both horizontal and vertical centers are within 12 px of an anchor block's centers simultaneously, the dragged block snaps to exact center-center alignment. This handles the case of stacking parallel blocks (e.g., two constant-value blocks feeding into the same combiner).

**Guide lines** are rendered as SVG overlay elements positioned absolutely over the React Flow canvas. Rather than managing guide line visibility through React state (which would trigger re-renders at pointer-move frequency), guide line positions are written directly to DOM element attributes via a stable ref (`guideLineRef`), and the elements' `visibility` CSS property is toggled via direct DOM manipulation. This keeps drag performance at native speed regardless of guide line count.

Snapping is **disabled** when the user holds `Alt` during drag, providing a momentary override for precise manual placement. The `evalMode` is not affected by snapping — position changes do not trigger graph re-evaluation (positions are cosmetic metadata in the graph snapshot).

---

## Consequences

**Positive:**
- Graphs self-organize into readable layouts with minimal user effort — horizontal pipelines emerge naturally from chain snapping.
- Guide lines provide immediate visual feedback that a snap is about to occur, reducing surprises.
- The direct-DOM guide line approach keeps drag performance smooth even on graphs with 100+ blocks; no React re-render occurs during drag.
- The `Alt` override makes magnetic snapping feel assistive rather than coercive — power users can always escape it.
- The 12 px threshold was tuned through user testing and aligns with Fitts's law considerations for touch input on tablet-sized screens.

**Negative / risks:**
- The O(n) proximity scan on every pointer-move event scales linearly with block count. A spatial index (R-tree or grid bucketing) should be introduced if block counts regularly exceed ~150.
- Direct DOM manipulation for guide lines bypasses React's reconciliation and can cause guide lines to appear stale if a component above the canvas force-remounts the SVG overlay. Observed during hot-module replacement in development but not in production.
- Three alignment modes can compete with each other when multiple anchors satisfy different snap conditions simultaneously. Current tie-breaking is by anchor array order (React Flow's node list order), which is non-deterministic across sessions. A priority model (prefer connected-edge anchors) would be more predictable.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Global pixel grid snapping | Aligns blocks to an arbitrary grid rather than to each other, producing layouts disconnected from graph topology. User testing rated it as "making things worse." |
| Auto-layout on demand (Dagre/ELK) | Full auto-layout is destructive — it repositions every block, destroying intentional manual arrangements. Implemented as a separate "Organize" action but not as a drag-time behavior. |
| Snap to nearest edge (any edge, any direction) | Without directionality constraints, blocks snap to irrelevant neighbours, creating confusing layouts where unrelated blocks are pulled together. The right→left chain model respects data flow direction. |
| CSS snap containers | CSS scroll-snap is a scroll-context primitive with no equivalent for free-form canvas drag. |
