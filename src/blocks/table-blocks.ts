/**
 * table-blocks.ts — Table blocks removed in H2-1.
 *
 * Tables are replaced by List (1xN vector) input blocks.
 * This file is kept as a stub for backward compatibility.
 */

import type { BlockDef } from './types'

export function registerTableBlocks(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _register: (def: BlockDef) => void,
): void {
  // No table blocks registered — removed in H2-1.
}
