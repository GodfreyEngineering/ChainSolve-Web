/**
 * Block registry — defines every block type available on the canvas.
 *
 * Each entry describes its category, React Flow node type, input ports,
 * and default data. Evaluation is handled exclusively by the Rust/WASM
 * engine (W9.1). This registry provides only UI metadata.
 *
 * Types are defined in ./types.ts and re-exported here for backward
 * compatibility with existing import paths.
 *
 * NodeData must extend Record<string, unknown> for @xyflow/react.
 */

import type { BlockCategory, NodeKind, BlockDef } from './types'
import type { CatalogEntry } from '../engine/wasm-types'

// Re-export types so existing `import { ... } from '../../blocks/registry'` still works.
export type { BlockCategory, NodeKind, PortDef, NodeData, BlockDef } from './types'

// ── Registry ─────────────────────────────────────────────────────────────────

export const BLOCK_REGISTRY = new Map<string, BlockDef>()

/** Register a block definition (metadata only, no evaluate). */
function reg(def: {
  type: string
  label: string
  category: BlockCategory
  nodeKind: NodeKind
  inputs: { id: string; label: string }[]
  defaultData: BlockDef['defaultData']
  proOnly?: boolean
}): void {
  BLOCK_REGISTRY.set(def.type, def)
}

// ── Input category ───────────────────────────────────────────────────────────

reg({
  type: 'number',
  label: 'Number',
  category: 'input',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'number', label: 'Number', value: 0 },
})

reg({
  type: 'slider',
  label: 'Slider',
  category: 'input',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'slider', label: 'Slider', value: 0, min: 0, max: 100, step: 1 },
})

reg({
  type: 'variableSource',
  label: 'Variable',
  category: 'input',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'variableSource', label: 'Variable', value: 0 },
})

// ── Constants category ────────────────────────────────────────────────────────

reg({
  type: 'pi',
  label: 'Pi (π)',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'pi', label: 'π' },
})

reg({
  type: 'euler',
  label: 'E (e)',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'euler', label: 'e' },
})

reg({
  type: 'tau',
  label: 'Tau (τ)',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'tau', label: 'τ' },
})

reg({
  type: 'phi',
  label: 'Phi (φ)',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'phi', label: 'φ' },
})

// ── Math category ─────────────────────────────────────────────────────────────

reg({
  type: 'add',
  label: 'Add',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'add', label: 'Add' },
})

reg({
  type: 'subtract',
  label: 'Subtract',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'subtract', label: 'Subtract' },
})

reg({
  type: 'multiply',
  label: 'Multiply',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'multiply', label: 'Multiply' },
})

reg({
  type: 'divide',
  label: 'Divide',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'divide', label: 'Divide' },
})

reg({
  type: 'negate',
  label: 'Negate',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'negate', label: 'Negate' },
})

reg({
  type: 'abs',
  label: 'Abs',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'abs', label: 'Abs' },
})

reg({
  type: 'sqrt',
  label: 'Sqrt',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'sqrt', label: 'Sqrt' },
})

reg({
  type: 'power',
  label: 'Power',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'base', label: 'Base' },
    { id: 'exp', label: 'Exp' },
  ],
  defaultData: { blockType: 'power', label: 'Power' },
})

reg({
  type: 'floor',
  label: 'Floor',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'floor', label: 'Floor' },
})

reg({
  type: 'ceil',
  label: 'Ceil',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'ceil', label: 'Ceil' },
})

reg({
  type: 'round',
  label: 'Round',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'round', label: 'Round' },
})

reg({
  type: 'mod',
  label: 'Mod',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'mod', label: 'Mod' },
})

reg({
  type: 'clamp',
  label: 'Clamp',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'val', label: 'Val' },
    { id: 'min', label: 'Min' },
    { id: 'max', label: 'Max' },
  ],
  defaultData: { blockType: 'clamp', label: 'Clamp' },
})

// ── Trig category ─────────────────────────────────────────────────────────────

reg({
  type: 'sin',
  label: 'Sin',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'θ (rad)' }],
  defaultData: { blockType: 'sin', label: 'Sin' },
})

reg({
  type: 'cos',
  label: 'Cos',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'θ (rad)' }],
  defaultData: { blockType: 'cos', label: 'Cos' },
})

reg({
  type: 'tan',
  label: 'Tan',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'θ (rad)' }],
  defaultData: { blockType: 'tan', label: 'Tan' },
})

reg({
  type: 'asin',
  label: 'Asin',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'asin', label: 'Asin' },
})

reg({
  type: 'acos',
  label: 'Acos',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'acos', label: 'Acos' },
})

reg({
  type: 'atan',
  label: 'Atan',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'atan', label: 'Atan' },
})

reg({
  type: 'atan2',
  label: 'Atan2',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'y', label: 'Y' },
    { id: 'x', label: 'X' },
  ],
  defaultData: { blockType: 'atan2', label: 'Atan2' },
})

reg({
  type: 'degToRad',
  label: 'Deg → Rad',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'deg', label: '°' }],
  defaultData: { blockType: 'degToRad', label: 'Deg→Rad' },
})

reg({
  type: 'radToDeg',
  label: 'Rad → Deg',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'rad', label: 'rad' }],
  defaultData: { blockType: 'radToDeg', label: 'Rad→Deg' },
})

// ── Logic category ────────────────────────────────────────────────────────────

reg({
  type: 'greater',
  label: 'Greater',
  category: 'logic',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'greater', label: 'A > B' },
})

reg({
  type: 'less',
  label: 'Less',
  category: 'logic',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'less', label: 'A < B' },
})

reg({
  type: 'equal',
  label: 'Equal',
  category: 'logic',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'equal', label: 'A = B' },
})

reg({
  type: 'ifthenelse',
  label: 'If / Then / Else',
  category: 'logic',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'cond', label: 'If (≠0)' },
    { id: 'then', label: 'Then' },
    { id: 'else', label: 'Else' },
  ],
  defaultData: { blockType: 'ifthenelse', label: 'If/Then/Else' },
})

reg({
  type: 'max',
  label: 'Max',
  category: 'logic',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'max', label: 'Max' },
})

reg({
  type: 'min',
  label: 'Min',
  category: 'logic',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'min', label: 'Min' },
})

// ── Output category ───────────────────────────────────────────────────────────

reg({
  type: 'display',
  label: 'Display',
  category: 'output',
  nodeKind: 'csDisplay',
  inputs: [{ id: 'value', label: 'Value' }],
  defaultData: { blockType: 'display', label: 'Display' },
})

reg({
  type: 'probe',
  label: 'Probe',
  category: 'output',
  nodeKind: 'csProbe',
  inputs: [{ id: 'value', label: 'Value' }],
  defaultData: { blockType: 'probe', label: 'Probe' },
})

// ── Block palette (ordered for display) ──────────────────────────────────────

export const CATEGORY_ORDER: BlockCategory[] = [
  'input',
  'math',
  'trig',
  'constants',
  'logic',
  'output',
  'data',
  'vectorOps',
  'tableOps',
  'plot',
  'engMechanics',
  'engMaterials',
  'engSections',
  'engInertia',
  'engFluids',
  'engThermo',
  'engElectrical',
  'engConversions',
  'finTvm',
  'finReturns',
  'finDepr',
  'statsDesc',
  'statsRel',
  'probComb',
  'probDist',
  'utilCalc',
  'constMath',
  'constPhysics',
  'constAtmos',
  'constThermo',
  'constElec',
  'presetMaterials',
  'presetFluids',
]

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  input: 'Input',
  math: 'Math',
  trig: 'Trig',
  constants: 'Constants',
  logic: 'Logic',
  output: 'Output',
  data: 'Data',
  vectorOps: 'Vector Ops',
  tableOps: 'Table Ops',
  plot: 'Plot',
  engMechanics: 'Mechanics',
  engMaterials: 'Materials',
  engSections: 'Sections',
  engInertia: 'Inertia',
  engFluids: 'Fluids',
  engThermo: 'Thermo',
  engElectrical: 'Electrical',
  engConversions: 'Conversions',
  finTvm: 'TVM',
  finReturns: 'Returns & Risk',
  finDepr: 'Depreciation',
  statsDesc: 'Descriptive Stats',
  statsRel: 'Relationships',
  probComb: 'Combinatorics',
  probDist: 'Distributions',
  utilCalc: 'Utilities',
  constMath: 'Math Constants',
  constPhysics: 'Physics',
  constAtmos: 'Atmospheric',
  constThermo: 'Thermodynamic',
  constElec: 'Electrical',
  presetMaterials: 'Material Presets',
  presetFluids: 'Fluid Presets',
}

// ── Library families (D6-4: primary grouping for block library) ──────────────

export interface LibraryFamily {
  id: string
  label: string
  categories: BlockCategory[]
}

/** Primary families for the block library sidebar. */
export const LIBRARY_FAMILIES: LibraryFamily[] = [
  { id: 'inputs', label: 'Inputs', categories: ['input'] },
  {
    id: 'constants',
    label: 'Constants',
    categories: [
      'constants',
      'constMath',
      'constPhysics',
      'constAtmos',
      'constThermo',
      'constElec',
    ],
  },
  {
    id: 'materials',
    label: 'Materials',
    categories: ['presetMaterials', 'presetFluids'],
  },
  {
    id: 'functions',
    label: 'Functions',
    categories: [
      'math',
      'trig',
      'logic',
      'engMechanics',
      'engMaterials',
      'engSections',
      'engInertia',
      'engFluids',
      'engThermo',
      'engElectrical',
      'engConversions',
      'finTvm',
      'finReturns',
      'finDepr',
      'statsDesc',
      'statsRel',
      'probComb',
      'probDist',
      'utilCalc',
    ],
  },
  { id: 'outputs', label: 'Outputs', categories: ['output'] },
  {
    id: 'data',
    label: 'Data',
    categories: ['data', 'vectorOps', 'tableOps'],
  },
  { id: 'plots', label: 'Plots', categories: ['plot'] },
]

// ── Pro-only block registration (no circular imports) ────────────────────────
// Block packs export registration functions instead of importing reg.

import { registerDataBlocks } from './data-blocks'
import { registerVectorBlocks } from './vector-blocks'
import { registerTableBlocks } from './table-blocks'
import { registerPlotBlocks } from './plot-blocks'
import { registerEngBlocks } from './eng-blocks'
import { registerFinStatsBlocks } from './fin-stats-blocks'
import { registerConstantsBlocks } from './constants-blocks'

registerDataBlocks(reg)
registerVectorBlocks(reg)
registerTableBlocks(reg)
registerPlotBlocks(reg)
registerEngBlocks(reg)
registerFinStatsBlocks(reg)
registerConstantsBlocks(reg)

// ── Catalog validation (called after WASM engine boots) ──────────────────────

/**
 * Validate that the TS registry matches the Rust catalog.
 * Logs warnings for any mismatches. Does not replace entries —
 * TS keeps defaultData (Rust doesn't carry UI defaults).
 */
export function validateCatalog(catalog: CatalogEntry[]): void {
  for (const entry of catalog) {
    const def = BLOCK_REGISTRY.get(entry.opId)
    if (!def) {
      console.warn(`[registry] Catalog op "${entry.opId}" has no TS default — UI may not render it`)
    }
  }
  for (const [type] of BLOCK_REGISTRY) {
    if (!catalog.some((e) => e.opId === type)) {
      console.warn(
        `[registry] TS block "${type}" is not in the Rust catalog — engine won't evaluate it`,
      )
    }
  }
}
