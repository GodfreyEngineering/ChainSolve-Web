/**
 * Block registry — defines every block type available on the canvas.
 * Each entry describes its category, React Flow node type, input ports,
 * and a pure scalar evaluate function.
 *
 * NodeData must extend Record<string, unknown> for @xyflow/react.
 */

export type BlockCategory = 'input' | 'math' | 'trig' | 'constants' | 'logic' | 'output'

/** Which React Flow custom-node renderer to use. */
export type NodeKind = 'csSource' | 'csOperation' | 'csDisplay'

export interface PortDef {
  /** Unique within the block — used as targetHandle / sourceHandle. */
  id: string
  label: string
}

/** Data payload stored inside each ReactFlow node. */
export interface NodeData extends Record<string, unknown> {
  blockType: string
  label: string
  /** For Number + Slider + Display passthrough value. */
  value?: number
  /** Slider range. */
  min?: number
  max?: number
  step?: number
  /**
   * Per-port manual values for operation nodes.
   * portId → number. Used when port is disconnected or portOverrides[portId]=true.
   */
  manualValues?: Record<string, number>
  /**
   * Per-port override flags. When true for a connected port, manualValues[portId]
   * is used instead of the upstream computed value.
   */
  portOverrides?: Record<string, boolean>
}

export interface BlockDef {
  type: string
  label: string
  category: BlockCategory
  /** Which React Flow node component to render. */
  nodeKind: NodeKind
  inputs: PortDef[]
  defaultData: NodeData
  /**
   * Pure evaluation function.
   * `inputs` is ordered by `inputs[]`; null = port disconnected.
   * Must never throw — return NaN on any error.
   */
  evaluate: (inputs: ReadonlyArray<number | null>, data: NodeData) => number
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const BLOCK_REGISTRY = new Map<string, BlockDef>()

function reg(def: BlockDef): void {
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
  evaluate: (_inputs, data) => data.value ?? 0,
})

reg({
  type: 'slider',
  label: 'Slider',
  category: 'input',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'slider', label: 'Slider', value: 0, min: 0, max: 100, step: 1 },
  evaluate: (_inputs, data) => data.value ?? 0,
})

// ── Constants category ────────────────────────────────────────────────────────

reg({
  type: 'pi',
  label: 'Pi (π)',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'pi', label: 'π' },
  evaluate: () => Math.PI,
})

reg({
  type: 'euler',
  label: 'E (e)',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'euler', label: 'e' },
  evaluate: () => Math.E,
})

reg({
  type: 'tau',
  label: 'Tau (τ)',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'tau', label: 'τ' },
  evaluate: () => 2 * Math.PI,
})

reg({
  type: 'phi',
  label: 'Phi (φ)',
  category: 'constants',
  nodeKind: 'csSource',
  inputs: [],
  defaultData: { blockType: 'phi', label: 'φ' },
  evaluate: () => (1 + Math.sqrt(5)) / 2,
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : a + b),
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : a - b),
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : a * b),
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : b === 0 ? Infinity : a / b),
})

reg({
  type: 'negate',
  label: 'Negate',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'negate', label: 'Negate' },
  evaluate: ([a]) => (a === null ? NaN : -a),
})

reg({
  type: 'abs',
  label: 'Abs',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'abs', label: 'Abs' },
  evaluate: ([a]) => (a === null ? NaN : Math.abs(a)),
})

reg({
  type: 'sqrt',
  label: 'Sqrt',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'sqrt', label: 'Sqrt' },
  evaluate: ([a]) => (a === null ? NaN : Math.sqrt(a)),
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
  evaluate: ([base, exp]) => (base === null || exp === null ? NaN : Math.pow(base, exp)),
})

reg({
  type: 'floor',
  label: 'Floor',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'floor', label: 'Floor' },
  evaluate: ([a]) => (a === null ? NaN : Math.floor(a)),
})

reg({
  type: 'ceil',
  label: 'Ceil',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'ceil', label: 'Ceil' },
  evaluate: ([a]) => (a === null ? NaN : Math.ceil(a)),
})

reg({
  type: 'round',
  label: 'Round',
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'round', label: 'Round' },
  evaluate: ([a]) => (a === null ? NaN : Math.round(a)),
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : b === 0 ? NaN : a % b),
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
  evaluate: ([val, min, max]) =>
    val === null || min === null || max === null ? NaN : Math.min(Math.max(val, min), max),
})

// ── Trig category ─────────────────────────────────────────────────────────────

reg({
  type: 'sin',
  label: 'Sin',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'θ (rad)' }],
  defaultData: { blockType: 'sin', label: 'Sin' },
  evaluate: ([a]) => (a === null ? NaN : Math.sin(a)),
})

reg({
  type: 'cos',
  label: 'Cos',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'θ (rad)' }],
  defaultData: { blockType: 'cos', label: 'Cos' },
  evaluate: ([a]) => (a === null ? NaN : Math.cos(a)),
})

reg({
  type: 'tan',
  label: 'Tan',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'θ (rad)' }],
  defaultData: { blockType: 'tan', label: 'Tan' },
  evaluate: ([a]) => (a === null ? NaN : Math.tan(a)),
})

reg({
  type: 'asin',
  label: 'Asin',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'asin', label: 'Asin' },
  evaluate: ([a]) => (a === null ? NaN : Math.asin(a)),
})

reg({
  type: 'acos',
  label: 'Acos',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'acos', label: 'Acos' },
  evaluate: ([a]) => (a === null ? NaN : Math.acos(a)),
})

reg({
  type: 'atan',
  label: 'Atan',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'a', label: 'A' }],
  defaultData: { blockType: 'atan', label: 'Atan' },
  evaluate: ([a]) => (a === null ? NaN : Math.atan(a)),
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
  evaluate: ([y, x]) => (y === null || x === null ? NaN : Math.atan2(y, x)),
})

reg({
  type: 'degToRad',
  label: 'Deg → Rad',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'deg', label: '°' }],
  defaultData: { blockType: 'degToRad', label: 'Deg→Rad' },
  evaluate: ([deg]) => (deg === null ? NaN : (deg * Math.PI) / 180),
})

reg({
  type: 'radToDeg',
  label: 'Rad → Deg',
  category: 'trig',
  nodeKind: 'csOperation',
  inputs: [{ id: 'rad', label: 'rad' }],
  defaultData: { blockType: 'radToDeg', label: 'Rad→Deg' },
  evaluate: ([rad]) => (rad === null ? NaN : (rad * 180) / Math.PI),
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : a > b ? 1 : 0),
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : a < b ? 1 : 0),
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : Math.abs(a - b) < 1e-10 ? 1 : 0),
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
  evaluate: ([cond, then_, else_]) =>
    cond === null || then_ === null || else_ === null ? NaN : cond !== 0 ? then_ : else_,
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : Math.max(a, b)),
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
  evaluate: ([a, b]) => (a === null || b === null ? NaN : Math.min(a, b)),
})

// ── Output category ───────────────────────────────────────────────────────────

reg({
  type: 'display',
  label: 'Display',
  category: 'output',
  nodeKind: 'csDisplay',
  inputs: [{ id: 'value', label: 'Value' }],
  defaultData: { blockType: 'display', label: 'Display' },
  evaluate: ([v]) => (v === null ? NaN : v),
})

// ── Block palette (ordered for display) ──────────────────────────────────────

export const CATEGORY_ORDER: BlockCategory[] = [
  'input',
  'math',
  'trig',
  'constants',
  'logic',
  'output',
]

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  input: 'Input',
  math: 'Math',
  trig: 'Trig',
  constants: 'Constants',
  logic: 'Logic',
  output: 'Output',
}
