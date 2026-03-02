/**
 * constants-blocks.ts — Constants block pack (W11c -> H4-1).
 *
 * H4-1: All individual constant blocks have been removed. Constants are now
 * accessed exclusively via the unified Constant picker block, which reads
 * from constantsCatalog.ts. The bridge resolves selections to 'number'
 * with the exact value -- no individual Rust catalog entries needed.
 *
 * Legacy Rust eval handlers remain in ops.rs for backward compatibility
 * with old saved projects that reference individual constant block types.
 *
 * Material/fluid presets are handled by the unified Material node (H3-1)
 * via materialCatalog.ts.
 *
 * Exports a registration function called by registry.ts (now a no-op).
 */

import type { BlockDef } from './types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerConstantsBlocks(_register: (def: BlockDef) => void): void {
  // H4-1: Individual constant blocks removed -- all constants now accessed via
  // the unified Constant picker. See constantsCatalog.ts for the full catalog.
}
