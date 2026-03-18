/**
 * opendrive-blocks.ts — 4.15: OpenDRIVE .xodr road geometry import block definition.
 */

import type { BlockDef } from './types'

type RegFn = (def: Omit<BlockDef, 'synonyms' | 'tags' | 'description' | 'proOnly'> & { proOnly?: boolean }) => void

export function registerOpenDriveBlocks(reg: RegFn): void {
  reg({
    type: 'data.openDriveImport',
    label: 'OpenDRIVE Import',
    category: 'data',
    nodeKind: 'csOpenDrive',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'data.openDriveImport',
      label: 'OpenDRIVE Import',
      xodrFileName: null,
      xodrRoadCount: 0,
      xodrTotalLength: 0,
      tableData: null,
    },
  })
}
