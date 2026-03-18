/**
 * tirfileinput-blocks.ts — 4.14: Pacejka .tir tire parameter file import.
 *
 * Parses Pacejka Magic Formula 6.1/6.2 tire parameter files (.tir format)
 * used across the automotive industry (Adams, CarSim, IPG, OpenTIRE).
 *
 * File format: INI-like with [SECTION] headers and key = value pairs.
 * Example sections: MODEL, UNITS, TIRE_CONDITIONS, LATERAL_COEFFICIENTS,
 * LONGITUDINAL_COEFFICIENTS, OVERTURNING_COEFFICIENTS, ROLLING_COEFFICIENTS,
 * ALIGNING_COEFFICIENTS, VERTICAL, STRUCTURAL.
 *
 * Output: DataTable with all parsed parameters (param_name, value, section).
 * Additional named outputs for the main Pacejka coefficients (B, C, D, E sets).
 *
 * Block type: 'tirFileInput' — nodeKind: 'csTirFileInput' — category: 'data'
 * Bridge: tirFileInput → 'tableInput' (parsed tableData output as DataTable).
 */

import type { BlockDef } from './registry'

export function registerTirFileInputBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'tirFileInput',
    label: '.tir File Input',
    category: 'data',
    nodeKind: 'csTirFileInput',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'tirFileInput',
      label: '.tir File Input',
      /** Parsed DataTable with columns [param, value, section]. */
      tableData: { columns: ['param', 'value', 'section'], rows: [] } as {
        columns: string[]
        rows: number[][]
      },
      /** Raw .tir file content for re-parsing. */
      tirRaw: '' as string,
      /** File name of the loaded .tir file. */
      tirFileName: '' as string,
      /** Parse error message, if any. */
      tirError: null as string | null,
      /** Number of parameters parsed. */
      tirParamCount: 0 as number,
      /** Main Pacejka section flags. */
      tirHasLateral: false as boolean,
      tirHasLongitudinal: false as boolean,
    },
    synonyms: [
      '.tir',
      'Pacejka',
      'MF6',
      'Magic Formula',
      'tire parameters',
      'tire model',
      'CarSim',
      'Adams',
      'IPG',
      'OpenTIRE',
      'MF61',
      'MF62',
    ],
    tags: ['data', 'tire', 'vehicle', 'Pacejka', 'import'],
    description:
      'Import Pacejka Magic Formula 6.1/6.2 tire parameter files (.tir). ' +
      'Parses all key-value parameters into a DataTable. ' +
      'Supports Adams, CarSim, IPG, and OpenTIRE file formats. ' +
      'Wire the output into Pacejka tire model blocks for full vehicle simulation.',
  })
}
