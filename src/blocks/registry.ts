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
  category: 'variable',
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

// D7-3: Unified constant picker — one block to search all constants
reg({
  type: 'constant',
  label: 'Constant',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'constant', label: 'Constant' },
})

// D7-4: Unified material/fluid picker
reg({
  type: 'material',
  label: 'Material',
  category: 'presetMaterials',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'material', label: 'Material' },
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

// ── Annotation blocks (E7-1: non-evaluating visual nodes) ────────────────────

reg({
  type: 'annotation_text',
  label: 'Text Label',
  category: 'annotations',
  nodeKind: 'csAnnotation',
  inputs: [],
  defaultData: {
    blockType: 'annotation_text',
    label: 'Text',
    annotationType: 'text',
    annotationText: 'Label',
    annotationColor: '#facc15',
  },
})

reg({
  type: 'annotation_callout',
  label: 'Callout Box',
  category: 'annotations',
  nodeKind: 'csAnnotation',
  inputs: [],
  defaultData: {
    blockType: 'annotation_callout',
    label: 'Callout',
    annotationType: 'callout',
    annotationText: 'Note',
    annotationColor: '#60a5fa',
  },
})

reg({
  type: 'annotation_highlight',
  label: 'Highlight Region',
  category: 'annotations',
  nodeKind: 'csAnnotation',
  inputs: [],
  defaultData: {
    blockType: 'annotation_highlight',
    label: 'Highlight',
    annotationType: 'highlight',
    annotationColor: '#facc15',
  },
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
  'annotations',
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
  annotations: 'Annotations',
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
      {
        id: 'inputMaterial',
        label: 'Material input',
        categories: ['presetMaterials', 'presetFluids'],
      },
      {
        id: 'inputConstant',
        label: 'Constant input',
        categories: [
          'constants',
          'constMath',
          'constPhysics',
          'constAtmos',
          'constThermo',
          'constElec',
        ],
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
      { id: 'fnVectorOps', label: 'Vector Ops', categories: ['vectorOps'] },
      { id: 'fnTableOps', label: 'Table Ops', categories: ['tableOps'] },
    ],
  },
  {
    id: 'outputBlocks',
    label: 'Output Blocks',
    subcategories: [
      { id: 'outDisplay', label: 'Display', categories: ['output', 'annotations'] },
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

/** Categories that contain physical/math constants (not material presets). */
const CONSTANT_CATEGORIES: ReadonlySet<BlockCategory> = new Set([
  'constants',
  'constMath',
  'constPhysics',
  'constAtmos',
  'constThermo',
  'constElec',
])

export interface ConstantCatalogEntry {
  type: string
  label: string
  category: BlockCategory
}

/**
 * Returns the list of all constant block types that can be selected
 * in the unified Constant node. Excludes material/fluid presets
 * (handled by the unified Material node in D7-4).
 */
export function getConstantsCatalog(): ConstantCatalogEntry[] {
  const entries: ConstantCatalogEntry[] = []
  for (const [, def] of BLOCK_REGISTRY) {
    if (CONSTANT_CATEGORIES.has(def.category) && def.type !== 'constant') {
      entries.push({ type: def.type, label: def.label, category: def.category })
    }
  }
  return entries
}

// ── Materials catalog for unified Material node (D7-4) ──────────────────────

/** Categories that contain material and fluid presets. */
const MATERIAL_CATEGORIES: ReadonlySet<BlockCategory> = new Set(['presetMaterials', 'presetFluids'])

/**
 * Returns the list of all material/fluid preset block types that can be
 * selected in the unified Material node.
 */
export function getMaterialsCatalog(): ConstantCatalogEntry[] {
  const entries: ConstantCatalogEntry[] = []
  for (const [, def] of BLOCK_REGISTRY) {
    if (MATERIAL_CATEGORIES.has(def.category) && def.type !== 'material') {
      entries.push({ type: def.type, label: def.label, category: def.category })
    }
  }
  return entries
}

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

// E5-5: Apply search metadata (synonyms + tags) after all blocks are registered
import { SEARCH_METADATA } from './blockSearchMetadata'
for (const [opId, meta] of Object.entries(SEARCH_METADATA)) {
  const def = BLOCK_REGISTRY.get(opId)
  if (def) {
    if (meta.synonyms) def.synonyms = meta.synonyms
    if (meta.tags) def.tags = meta.tags
  }
}

// ── Catalog validation (called after WASM engine boots) ──────────────────────

/**
 * UI-only block types — picker stubs that resolve to a specific engine op
 * when the user makes a selection. They never reach the Rust engine directly.
 * Exported for tests (G0-6).
 */
export const UI_ONLY_BLOCKS: ReadonlySet<string> = new Set([
  'constant',
  'material',
  'annotation_text',
  'annotation_callout',
  'annotation_highlight',
])

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
export function validateCatalog(catalog: CatalogEntry[]): void {
  // Auto-register generic BlockDefs for any Rust catalog op missing from TS.
  for (const entry of catalog) {
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
