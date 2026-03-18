/**
 * mathsheet-blocks.ts — 2.133: MathSheet spreadsheet-like computation block.
 *
 * UI-only block (no Rust catalog entry). Acts as an inline spreadsheet where:
 *   - Named input ports map to variable names available in cell formulas
 *   - Cells support formulas (=A1+B1, =x*2, =sin(pi/4), etc.)
 *   - The result cell's value is the block output (bridge remaps to 'number')
 *
 * Bridge remaps blockType='mathSheet' → 'number' with node.data.value.
 * Input edges are excluded from the engine snapshot (UI-managed computation).
 */

import type { BlockDef } from './registry'

export function registerMathSheetBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'mathSheet',
    label: 'MathSheet',
    category: 'input',
    nodeKind: 'csMathSheet',
    inputs: [
      { id: 'var_x', label: 'x' },
      { id: 'var_y', label: 'y' },
    ],
    proOnly: false,
    defaultData: {
      blockType: 'mathSheet',
      label: 'MathSheet',
      value: 0,
      /** Named input variables — each becomes a handle and a formula variable. */
      sheetVars: [{ name: 'x' }, { name: 'y' }] as Array<{ name: string }>,
      /** Cell contents: cells[row][col] = formula string or numeric literal. */
      cells: [
        ['=x', '=y', '=A1+B1'],
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['', '', '=C1'],
      ] as string[][],
      numRows: 5,
      numCols: 3,
      /** Result cell address e.g. 'C5'. Empty = last non-empty cell value. */
      resultCell: 'C5',
    },
  })
}
