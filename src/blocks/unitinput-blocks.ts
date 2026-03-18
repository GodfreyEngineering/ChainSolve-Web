/**
 * unitinput-blocks.ts — 2.13: UnitInput block.
 *
 * A numeric input block with an attached unit picker. The user enters a
 * numeric value and selects a unit from a searchable dropdown (500+ units
 * across SI base/derived, CGS, imperial, and engineering systems).
 *
 * The numeric value is converted to SI base units before being sent to the
 * engine (bridge treats it as 'number'). The selected unit symbol and
 * conversion factor are stored in block data for dimensional analysis.
 *
 * Bridge: blockType='unitInput' → 'number' (SI-converted value).
 */

import type { BlockDef } from './registry'

export function registerUnitInputBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'units.convert',
    label: 'Unit Converter',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [{ id: 'value', label: 'Value' }],
    proOnly: false,
    defaultData: {
      blockType: 'units.convert',
      label: 'Unit Converter',
      from_unit: 'm',
      to_unit: 'km',
    },
    synonyms: ['unit', 'convert', 'SI', 'imperial', 'metric', 'dimensional'],
    tags: ['units', 'conversion', 'math'],
  })

  register({
    type: 'units.analyze',
    label: 'Unit Analyser',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [],
    proOnly: false,
    defaultData: {
      blockType: 'units.analyze',
      label: 'Unit Analyser',
      units: 'kg, m, s',
    },
    synonyms: ['unit', 'dimension', 'analyse', 'analyze', 'consistency', 'SI'],
    tags: ['units', 'analysis', 'math'],
  })

  register({
    type: 'unitInput',
    label: 'Unit Input',
    category: 'input',
    nodeKind: 'csUnitInput',
    inputs: [],
    proOnly: false,
    defaultData: {
      blockType: 'unitInput',
      label: 'Unit Input',
      /** Raw numeric value as entered by the user (in the selected unit). */
      rawValue: 1,
      /** Selected unit symbol (e.g. 'km/h', 'psi', 'degC'). */
      unit: 'm',
      /** SI base unit symbol for display (e.g. 'm', 'kg', 'K'). */
      siUnit: 'm',
      /** Conversion factor: siValue = rawValue * toSI + offsetSI */
      toSI: 1,
      /** Additive offset (non-zero for Celsius/Fahrenheit). */
      offsetSI: 0,
      /** SI-converted output value (what the engine receives). */
      value: 1,
    },
    synonyms: [
      'unit',
      'quantity',
      'physical',
      'measurement',
      'dimension',
      'SI',
      'imperial',
      'metric',
    ],
    tags: ['input', 'unit', 'physical'],
    description:
      'Physical quantity input with 500+ unit picker. Enter a value and pick a unit — output is automatically converted to SI base units for dimensional-safe computation.',
  })
}
