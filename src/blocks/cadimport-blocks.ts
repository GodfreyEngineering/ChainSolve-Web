/**
 * cadimport-blocks.ts — 4.11: STEP/IGES geometry import block definitions.
 */

import type { BlockDef } from './types'

type RegFn = (
  def: Omit<BlockDef, 'synonyms' | 'tags' | 'description' | 'proOnly'> & { proOnly?: boolean },
) => void

export function registerCadImportBlocks(reg: RegFn): void {
  reg({
    type: 'data.stepImport',
    label: 'STEP/IGES Import',
    category: 'data',
    nodeKind: 'csCADImport',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'data.stepImport',
      label: 'STEP/IGES Import',
      cadFileName: null,
      cadFormat: null,
      cadVertexCount: 0,
      cadFaceCount: 0,
      tableData: null,
    },
  })
}
