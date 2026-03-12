/**
 * data-blocks.ts — Data input blocks (Pro only).
 *
 * BUG-13: vectorInput removed — Table Input (tableInput) is now the sole data
 * input block, registered in table-blocks.ts. Old vectorInput nodes in saved
 * projects are transparently migrated to tableInput by canvasSchema.ts.
 *
 * This module is kept as a no-op export to avoid import breakage.
 * Callers: registry.ts → registerDataBlocks.
 */

import type { BlockDef } from './types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerDataBlocks(_register: (def: BlockDef) => void): void {
  // No-op: vectorInput removed. tableInput is registered in table-blocks.ts.
}
