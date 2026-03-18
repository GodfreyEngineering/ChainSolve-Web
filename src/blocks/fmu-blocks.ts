/**
 * fmu-blocks.ts — FMI/FMU block pack (2.125, 2.126).
 *
 * Blocks for importing FMUs (Functional Mock-up Units) and exporting
 * ChainSolve computations as FMUs.
 */

import type { BlockDef } from './types'

export function registerFmuBlocks(register: (def: BlockDef) => void): void {
  // ── FMU Import ──────────────────────────────────────────────────────────────

  register({
    type: 'fmu.import',
    label: 'FMU Import',
    category: 'data',
    nodeKind: 'csFmuImport',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'fmu.import',
      label: 'FMU Import',
      fmuName: null,
      fmuVersion: null,
      fmuModelName: null,
      fmuDescription: null,
      fmuInputCount: 0,
      fmuOutputCount: 0,
      fmuParamCount: 0,
      tableData: null,
    },
    synonyms: [
      'fmu', 'fmi', 'functional mock-up unit', 'co-simulation', 'model exchange',
      'fmi 2.0', 'fmi 3.0', 'modelDescription',
    ],
    tags: ['fmu', 'fmi', 'import', 'simulation', 'external'],
    description:
      'FMU Import (FMI 2.0/3.0): load a .fmu file, parse modelDescription.xml, ' +
      'and expose variable names and initial values as a table. ' +
      'Outputs: table [output variable names × initial values]. ' +
      'Binary FMU execution is not performed in browser — use server dispatch for simulation.',
  })

  // ── FMU Export ─────────────────────────────────────────────────────────────

  register({
    type: 'fmu.export',
    label: 'FMU Export',
    category: 'data',
    nodeKind: 'csOperation',
    inputs: [{ id: 'data', label: 'Computed value (any)' }],
    proOnly: true,
    defaultData: {
      blockType: 'fmu.export',
      label: 'FMU Export',
      fmuModelName: 'ChainSolveFMU',
      fmuGuid: '',
      fmuDescription: '',
      outputVariables: [],
    },
    synonyms: [
      'fmu export', 'fmi export', 'functional mock-up unit export',
      'hil', 'hardware in the loop', 'co-simulation export',
    ],
    tags: ['fmu', 'fmi', 'export', 'simulation', 'hil'],
    description:
      'FMU Export: generates a modelDescription.xml and C stub for exporting a ' +
      'ChainSolve computation as an FMI-compliant Functional Mock-up Unit. ' +
      'Input: any computed value. Output: Text containing the modelDescription.xml. ' +
      'Download the generated FMU from the block inspector.',
  })
}
