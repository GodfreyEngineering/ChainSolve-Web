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
import { CONSTANTS_CATALOG } from './constantsCatalog'
import { MATERIAL_CATALOG } from './materialCatalog'

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
  variadic?: boolean
  minInputs?: number
  maxInputs?: number
  description?: string
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
  category: 'variable',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'variableSource', label: 'Variable', value: 0 },
})

// ── Constants category ────────────────────────────────────────────────────────
// H4-1: Individual constant blocks (pi, euler, tau, phi, const.*) removed.
// All constants accessed via the unified Constant picker backed by constantsCatalog.ts.

reg({
  type: 'constant',
  label: 'Constant',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'constant', label: 'Constant' },
})

// BUG-12: Single unified Material block (multi-output, formerly material_full).
// TS type key is 'material' (block library entry), but the Rust op is 'material_full'
// (stored as data.blockType). 'material' is in UI_ONLY_BLOCKS because its TS type key
// differs from the Rust op name. Old simple 'material' (csSource) is migrated via
// canvasSchema.ts: type→csMaterial, data.blockType→'material_full'.
reg({
  type: 'material',
  label: 'Material',
  category: 'presetMaterials',
  nodeKind: 'csMaterial',
  inputs: [],
  proOnly: true,
  defaultData: { blockType: 'material_full', label: 'Material' },
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
  variadic: true,
  minInputs: 2,
  maxInputs: 64,
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
  variadic: true,
  minInputs: 2,
  maxInputs: 64,
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

reg({
  type: 'trunc',
  label: 'Trunc',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'trunc', label: 'Trunc' },
})

reg({
  type: 'sign',
  label: 'Sign',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'sign', label: 'Sign' },
})

reg({
  type: 'ln',
  label: 'Ln',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'ln', label: 'Ln' },
})

reg({
  type: 'log10',
  label: 'Log10',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'log10', label: 'Log10' },
})

reg({
  type: 'exp',
  label: 'Exp',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'exp', label: 'Exp' },
})

reg({
  type: 'log_base',
  label: 'Log (base)',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'val', label: 'Value' },
    { id: 'base', label: 'Base' },
  ],
  defaultData: { blockType: 'log_base', label: 'Log (base)' },
})

reg({
  type: 'roundn',
  label: 'Round N',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'val', label: 'Value' },
    { id: 'digits', label: 'Digits' },
  ],
  defaultData: { blockType: 'roundn', label: 'Round N' },
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
  variadic: true,
  minInputs: 2,
  maxInputs: 64,
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
  variadic: true,
  minInputs: 2,
  maxInputs: 64,
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

// ── H7-1: Publish / Subscribe blocks (cross-sheet value sharing) ─────────────

reg({
  type: 'publish',
  label: 'Publish',
  category: 'output',
  nodeKind: 'csPublish',
  inputs: [{ id: 'value', label: 'Value' }],
  defaultData: { blockType: 'publish', label: 'Publish', publishChannelName: '' },
})

reg({
  type: 'subscribe',
  label: 'Subscribe',
  category: 'input',
  nodeKind: 'csSubscribe',
  inputs: [],
  defaultData: { blockType: 'subscribe', label: 'Subscribe', subscribeChannelName: '' },
})

// ── Block palette (ordered for display) ──────────────────────────────────────

export const CATEGORY_ORDER: BlockCategory[] = [
  'input',
  'variable',
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
  'chem',
  'structural',
  'aerospace',
  'controlSystems',
  'lifeSci',
  'finOptions',
  'dateTime',
  'text',
  'interval',
  'signal',
  'complex',
  'matrix',
  'optimization',
  'machineLearning',
  'neuralNetworks',
  'odeSolvers',
  'vehicleSim',
]

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  input: 'Input',
  variable: 'Variable',
  math: 'Math',
  trig: 'Trig',
  constants: 'Constants',
  logic: 'Logic',
  output: 'Output',
  data: 'Data',
  vectorOps: 'List Ops',
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
  customFunctions: 'Custom Functions',
  chem: 'Chemical Eng',
  structural: 'Structural Eng',
  aerospace: 'Aerospace',
  controlSystems: 'Control Systems',
  lifeSci: 'Life Sciences',
  finOptions: 'Options & Risk',
  dateTime: 'Date & Time',
  text: 'Text',
  interval: 'Interval Arithmetic',
  signal: 'Signal Processing',
  complex: 'Complex Numbers',
  matrix: 'Matrix Ops',
  optimization: 'Optimization',
  machineLearning: 'Machine Learning',
  neuralNetworks: 'Neural Networks',
  odeSolvers: 'ODE Solvers',
  vehicleSim: 'Vehicle Simulation',
}

// ── Block taxonomy (G3-1: 3 main categories with subcategories) ─────────────

export interface TaxonomySubcategory {
  id: string
  label: string
  /** Include all blocks from these BlockCategory values. */
  categories?: BlockCategory[]
  /** Include specific blocks by type (when a category spans subcategories). */
  blockTypes?: string[]
}

export interface TaxonomyMainCategory {
  id: string
  label: string
  subcategories: TaxonomySubcategory[]
}

/** The 3-level block taxonomy: Main Category > Subcategory > Blocks. */
export const BLOCK_TAXONOMY: TaxonomyMainCategory[] = [
  {
    id: 'inputBlocks',
    label: 'Input Blocks',
    subcategories: [
      { id: 'inputNumber', label: 'Standard number input', blockTypes: ['number'] },
      { id: 'inputSlider', label: 'Slider input', blockTypes: ['slider'] },
      { id: 'inputMaterial', label: 'Material input', blockTypes: ['material'] },
      {
        id: 'inputConstant',
        label: 'Constant input',
        blockTypes: ['constant'],
      },
      { id: 'inputVariable', label: 'Variable input', categories: ['variable'] },
      { id: 'inputList', label: 'List input', categories: ['data'] },
    ],
  },
  {
    id: 'functionBlocks',
    label: 'Function Blocks',
    subcategories: [
      { id: 'fnMath', label: 'Math', categories: ['math'] },
      { id: 'fnTrig', label: 'Trig', categories: ['trig'] },
      { id: 'fnLogic', label: 'Logic', categories: ['logic'] },
      { id: 'fnMechanics', label: 'Mechanics', categories: ['engMechanics'] },
      { id: 'fnMaterials', label: 'Materials', categories: ['engMaterials'] },
      { id: 'fnSections', label: 'Sections', categories: ['engSections'] },
      { id: 'fnInertia', label: 'Inertia', categories: ['engInertia'] },
      { id: 'fnFluids', label: 'Fluids', categories: ['engFluids'] },
      { id: 'fnThermo', label: 'Thermo', categories: ['engThermo'] },
      { id: 'fnElectrical', label: 'Electrical', categories: ['engElectrical'] },
      { id: 'fnConversions', label: 'Conversions', categories: ['engConversions'] },
      { id: 'fnTvm', label: 'TVM', categories: ['finTvm'] },
      { id: 'fnReturns', label: 'Returns & Risk', categories: ['finReturns'] },
      { id: 'fnDepr', label: 'Depreciation', categories: ['finDepr'] },
      { id: 'fnStatsDesc', label: 'Descriptive Stats', categories: ['statsDesc'] },
      { id: 'fnStatsRel', label: 'Relationships', categories: ['statsRel'] },
      { id: 'fnComb', label: 'Combinatorics', categories: ['probComb'] },
      { id: 'fnDist', label: 'Distributions', categories: ['probDist'] },
      { id: 'fnUtil', label: 'Utilities', categories: ['utilCalc'] },
      { id: 'fnVectorOps', label: 'List Ops', categories: ['vectorOps'] },
      { id: 'fnTableOps', label: 'Table Ops', categories: ['tableOps'] },
      { id: 'fnChem', label: 'Chemical Eng', categories: ['chem'] },
      { id: 'fnStructural', label: 'Structural Eng', categories: ['structural'] },
      { id: 'fnAerospace', label: 'Aerospace', categories: ['aerospace'] },
      { id: 'fnControlSystems', label: 'Control Systems', categories: ['controlSystems'] },
      { id: 'fnLifeSci', label: 'Life Sciences', categories: ['lifeSci'] },
      { id: 'fnFinOptions', label: 'Options & Risk', categories: ['finOptions'] },
      { id: 'fnDateTime', label: 'Date & Time', categories: ['dateTime'] },
      { id: 'fnText', label: 'Text', categories: ['text'] },
      { id: 'fnInterval', label: 'Interval Arithmetic', categories: ['interval'] },
      { id: 'fnSignal', label: 'Signal Processing', categories: ['signal'] },
      { id: 'fnComplex', label: 'Complex Numbers', categories: ['complex'] },
      { id: 'fnMatrix', label: 'Matrix Ops', categories: ['matrix'] },
      { id: 'fnOptimization', label: 'Optimization', categories: ['optimization'] },
      { id: 'fnMachineLearning', label: 'Machine Learning', categories: ['machineLearning'] },
      { id: 'fnNeuralNetworks', label: 'Neural Networks', categories: ['neuralNetworks'] },
      { id: 'fnOdeSolvers', label: 'ODE Solvers', categories: ['odeSolvers'] },
      { id: 'fnVehicleSim', label: 'Vehicle Simulation', categories: ['vehicleSim'] },
    ],
  },
  {
    id: 'outputBlocks',
    label: 'Output Blocks',
    subcategories: [
      {
        id: 'outDisplay',
        label: 'Display',
        blockTypes: ['display', 'listTable'],
      },
      { id: 'outPublish', label: 'Publish / Subscribe', blockTypes: ['publish', 'subscribe'] },
      { id: 'outGraph', label: 'Graph blocks', categories: ['plot'] },
    ],
  },
]

/** Get all blocks matching a taxonomy subcategory definition. */
export function getSubcategoryBlocks(subcat: TaxonomySubcategory): BlockDef[] {
  const result: BlockDef[] = []
  const catSet = new Set(subcat.categories ?? [])
  const typeSet = new Set(subcat.blockTypes ?? [])
  for (const def of BLOCK_REGISTRY.values()) {
    if (typeSet.has(def.type) || catSet.has(def.category)) {
      result.push(def)
    }
  }
  return result
}

/** Get all blocks for a main taxonomy category. */
export function getMainCategoryBlocks(main: TaxonomyMainCategory): BlockDef[] {
  return main.subcategories.flatMap(getSubcategoryBlocks)
}

/** Lazily-built reverse map: block type -> { main, sub } taxonomy labels. */
let _taxonomyLabels: Map<string, { main: string; sub: string }> | null = null

export function getTaxonomyLabels(): Map<string, { main: string; sub: string }> {
  if (_taxonomyLabels) return _taxonomyLabels
  const map = new Map<string, { main: string; sub: string }>()
  for (const main of BLOCK_TAXONOMY) {
    for (const sub of main.subcategories) {
      for (const def of getSubcategoryBlocks(sub)) {
        if (!map.has(def.type)) {
          map.set(def.type, { main: main.label, sub: sub.label })
        }
      }
    }
  }
  _taxonomyLabels = map
  return map
}

// ── Constants catalog for unified Constant node (D7-3) ──────────────────────

export interface ConstantCatalogEntry {
  type: string
  label: string
  category: BlockCategory
}

/**
 * Returns the list of all constant entries that can be selected
 * in the unified Constant node. H4-1: reads from standalone
 * constantsCatalog instead of individual block registrations.
 */
export function getConstantsCatalog(): ConstantCatalogEntry[] {
  return CONSTANTS_CATALOG.map((c) => ({
    type: c.type,
    label: c.label,
    category: c.category,
  }))
}

// ── Materials catalog for unified Material node (D7-4) ──────────────────────

export interface MaterialsCatalogEntry extends ConstantCatalogEntry {
  subcategory: string
}

/**
 * Returns the list of all material/fluid preset entries that can be
 * selected in the unified Material node. H3-1: reads from standalone
 * materialCatalog instead of individual block registrations.
 */
export function getMaterialsCatalog(): MaterialsCatalogEntry[] {
  return MATERIAL_CATALOG.map((m) => ({
    type: m.type,
    label: m.label,
    category: m.category,
    subcategory: m.subcategory,
  }))
}

// ── Domain block packs (UI-PERF-05) ─────────────────────────────────────────
// Block packs are lazily loaded via registerAllBlocks.ts to keep them out of
// the initial JS bundle. They are imported dynamically in main.tsx after the
// WASM engine boots. See registerAllBlocks.ts for the full list.
//
// G4-1: Block descriptions live in blockDescriptions.ts and are imported
// directly by consumers (Inspector) to avoid bloating the initial bundle.

// ── Catalog validation (called after WASM engine boots) ──────────────────────

/**
 * UI-only block types — picker stubs that resolve to a specific engine op
 * when the user makes a selection. They never reach the Rust engine directly.
 * Exported for tests (G0-6).
 */
// 'constant' and 'material' are UI-only in the sense that their TS registry type
// key ('constant', 'material') does not correspond to a Rust op with the same name.
// The actual Rust ops for material are named 'material_full' (stored in data.blockType).
export const UI_ONLY_BLOCKS: ReadonlySet<string> = new Set(['constant', 'material'])

/**
 * Validate and reconcile the TS registry with the Rust catalog.
 *
 * G0-6 policy:
 *   - Any Rust catalog op that lacks a bespoke TS default is auto-registered
 *     with a generic BlockDef derived from the catalog metadata. The UI can
 *     then render it generically without a manual TS entry.
 *   - TS-only blocks (UI_ONLY_BLOCKS) are expected and silently skipped.
 *   - No console.warn at boot — clean logs.
 */
/** Deprecated Rust ops that should NOT be auto-registered in the block library. */
const DEPRECATED_OPS = new Set(['vectorInput', 'material_full'])

export function validateCatalog(catalog: CatalogEntry[]): void {
  // Auto-register generic BlockDefs for any Rust catalog op missing from TS.
  for (const entry of catalog) {
    if (DEPRECATED_OPS.has(entry.opId)) continue
    if (!BLOCK_REGISTRY.has(entry.opId)) {
      BLOCK_REGISTRY.set(entry.opId, {
        type: entry.opId,
        label: entry.label,
        category: entry.category as BlockCategory,
        nodeKind: entry.nodeKind as NodeKind,
        inputs: entry.inputs.map((p) => ({ id: p.id, label: p.label })),
        defaultData: { blockType: entry.opId, label: entry.label },
        proOnly: entry.proOnly,
      })
    }
  }
}

// ── ODE Solvers (Phase 4) ────────────────────────────────────────────────────

reg({
  type: 'ode.rk4',
  label: 'ODE Solver (RK4)',
  category: 'odeSolvers',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'equations', label: 'Equations (text)' },
    { id: 'y0', label: 'Initial state' },
  ],
  defaultData: { blockType: 'ode.rk4', label: 'ODE RK4', t_end: 1.0, dt: 0.01 },
  proOnly: true,
  description:
    'Solve a system of ODEs using the classic 4th-order Runge-Kutta method (fixed step). Output = table of (t, y0, y1, ...).',
})

reg({
  type: 'ode.rk45',
  label: 'ODE Solver (Adaptive)',
  category: 'odeSolvers',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'equations', label: 'Equations (text)' },
    { id: 'y0', label: 'Initial state' },
  ],
  defaultData: { blockType: 'ode.rk45', label: 'ODE RK45', t_end: 1.0, dt: 0.1, tolerance: 1e-6 },
  proOnly: true,
  description:
    'Solve a system of ODEs using the Dormand-Prince RK4(5) adaptive-step method. Automatically adjusts step size for accuracy.',
})

// ── Vehicle Simulation (Phase 5) ────────────────────────────────────────────

reg({
  type: 'veh.tire.lateralForce',
  label: 'Pacejka Lateral Fy',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'slip_angle', label: 'Slip angle (rad)' },
    { id: 'Fz', label: 'Fz (N)' },
    { id: 'B', label: 'B' },
    { id: 'C', label: 'C' },
    { id: 'D', label: 'D' },
    { id: 'E', label: 'E' },
  ],
  defaultData: { blockType: 'veh.tire.lateralForce', label: 'Pacejka Fy' },
  proOnly: true,
  description: 'Pacejka Magic Formula lateral tire force Fy from slip angle. Output = Fy (N).',
})

reg({
  type: 'veh.tire.longForce',
  label: 'Pacejka Longitudinal Fx',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'slip_ratio', label: 'Slip ratio' },
    { id: 'Fz', label: 'Fz (N)' },
    { id: 'B', label: 'B' },
    { id: 'C', label: 'C' },
    { id: 'D', label: 'D' },
    { id: 'E', label: 'E' },
  ],
  defaultData: { blockType: 'veh.tire.longForce', label: 'Pacejka Fx' },
  proOnly: true,
  description: 'Pacejka Magic Formula longitudinal tire force Fx from slip ratio. Output = Fx (N).',
})

reg({
  type: 'veh.tire.sweep',
  label: 'Tire Force Sweep',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'Fz', label: 'Fz (N)' },
    { id: 'B', label: 'B' },
    { id: 'C', label: 'C' },
    { id: 'D', label: 'D' },
    { id: 'E', label: 'E' },
  ],
  defaultData: {
    blockType: 'veh.tire.sweep',
    label: 'Tire Sweep',
    slipMin: -0.2,
    slipMax: 0.2,
    points: 101,
  },
  proOnly: true,
  description:
    'Generate a Pacejka tire force vs slip table for plotting. Output = table (slip, force).',
})

reg({
  type: 'veh.aero.drag',
  label: 'Aero Drag',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'rho', label: 'ρ (kg/m³)' },
    { id: 'Cd', label: 'Cd' },
    { id: 'A', label: 'A (m²)' },
    { id: 'v', label: 'v (m/s)' },
  ],
  defaultData: { blockType: 'veh.aero.drag', label: 'Aero Drag' },
  proOnly: true,
  description: 'Aerodynamic drag force: F = 0.5 × ρ × Cd × A × v².',
})

reg({
  type: 'veh.aero.downforce',
  label: 'Aero Downforce',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'rho', label: 'ρ (kg/m³)' },
    { id: 'Cl', label: 'Cl' },
    { id: 'A', label: 'A (m²)' },
    { id: 'v', label: 'v (m/s)' },
  ],
  defaultData: { blockType: 'veh.aero.downforce', label: 'Aero Downforce' },
  proOnly: true,
  description: 'Aerodynamic downforce: F = 0.5 × ρ × Cl × A × v².',
})

reg({
  type: 'veh.aero.balance',
  label: 'Aero Balance',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'f_front', label: 'F front (N)' },
    { id: 'f_total', label: 'F total (N)' },
  ],
  defaultData: { blockType: 'veh.aero.balance', label: 'Aero Balance' },
  proOnly: true,
  description: 'Front downforce percentage: F_front / F_total × 100.',
})

reg({
  type: 'veh.powertrain.gearRatio',
  label: 'Gear Ratio',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'torque', label: 'Torque (Nm)' },
    { id: 'rpm', label: 'RPM' },
    { id: 'ratio', label: 'Ratio' },
  ],
  defaultData: { blockType: 'veh.powertrain.gearRatio', label: 'Gear Ratio' },
  proOnly: true,
  description: 'Apply gear ratio: torque_out = torque × ratio, rpm_out = rpm / ratio.',
})

reg({
  type: 'veh.powertrain.wheelSpeed',
  label: 'Wheel Speed',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'rpm', label: 'RPM' },
    { id: 'radius', label: 'Radius (m)' },
    { id: 'ratio', label: 'Overall ratio' },
  ],
  defaultData: { blockType: 'veh.powertrain.wheelSpeed', label: 'Wheel Speed' },
  proOnly: true,
  description: 'Vehicle speed from engine RPM, tire radius, and overall gear ratio.',
})

reg({
  type: 'veh.powertrain.drivetrainLoss',
  label: 'Drivetrain Loss',
  category: 'vehicleSim',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'power', label: 'Power (W)' },
    { id: 'efficiency', label: 'η' },
  ],
  defaultData: { blockType: 'veh.powertrain.drivetrainLoss', label: 'Drivetrain Loss' },
  proOnly: true,
  description: 'Apply drivetrain efficiency: P_out = P_in × η.',
})

// ── H5-1: Custom function block dynamic registration ────────────────────────

import type { CustomFunction } from '../lib/customFunctions'

/**
 * Register a custom function as a BlockDef in the registry.
 * The block type uses the `cfb:` prefix to identify custom functions.
 */
export function registerCustomFunction(fn: CustomFunction): void {
  const blockType = `cfb:${fn.id}`
  BLOCK_REGISTRY.set(blockType, {
    type: blockType,
    label: fn.name,
    category: 'customFunctions',
    nodeKind: 'csOperation',
    inputs: fn.inputs.map((inp) => ({ id: inp.id, label: inp.label })),
    defaultData: {
      blockType,
      label: fn.name,
      formula: fn.formula,
      customFunctionId: fn.id,
    },
    proOnly: true,
    description: fn.description ?? `Custom: ${fn.formula}`,
    tags: [fn.tag],
  })
  // Invalidate taxonomy label cache
  _taxonomyLabels = null
}

/** Unregister a custom function block from the registry. */
export function unregisterCustomFunction(fnId: string): void {
  BLOCK_REGISTRY.delete(`cfb:${fnId}`)
  _taxonomyLabels = null
}

/**
 * Sync the registry with a full list of custom functions.
 * Removes any stale registrations and adds/updates all current ones.
 */
export function syncCustomFunctions(fns: CustomFunction[]): void {
  // Remove all existing cfb: registrations
  for (const key of [...BLOCK_REGISTRY.keys()]) {
    if (key.startsWith('cfb:')) {
      BLOCK_REGISTRY.delete(key)
    }
  }
  // Re-register all current custom functions
  for (const fn of fns) {
    registerCustomFunction(fn)
  }
  _taxonomyLabels = null
}
