/**
 * logger-blocks.ts — 2.132: Logger block (time-series data recording).
 *
 * UI-only block. Records timestamped numeric values from the connected
 * signal port. Stores up to a configurable number of entries in memory.
 * Provides CSV export and clear functionality.
 *
 * Bridge remaps blockType='logger' → 'display' (pass-through).
 */

import type { BlockDef } from './registry'

export function registerLoggerBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'logger',
    label: 'Logger',
    category: 'output',
    nodeKind: 'csLogger',
    inputs: [{ id: 'signal', label: 'Signal' }],
    proOnly: false,
    defaultData: {
      blockType: 'logger',
      label: 'Logger',
      /** Maximum number of log entries to retain in memory. */
      logMaxEntries: 1000,
      /** Whether to log timestamps relative to first entry (true) or absolute (false). */
      logRelativeTime: true,
    },
  })
}
