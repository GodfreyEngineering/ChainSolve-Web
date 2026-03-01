/**
 * expressionExtractor.ts — E6-1: Build an expression tree from a canvas DAG.
 *
 * Given a target node (typically a display/probe), walk upstream through
 * edges to build a symbolic expression tree. Each tree node holds:
 *   - the op type and label
 *   - computed value (scalar/vector/table/error)
 *   - child expressions keyed by input port name
 *
 * The tree can then be rendered as plain text, LaTeX, etc. (E6-2).
 */

import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/types'
import type { Value } from '../engine/value'
import { BLOCK_REGISTRY } from '../blocks/registry'

// ── Expression tree types ───────────────────────────────────────────────────

export interface ExpressionNode {
  /** Graph node ID */
  nodeId: string
  /** Block type (e.g. 'add', 'eng.mechanics.force_ma') */
  opType: string
  /** User-visible label */
  label: string
  /** Computed value from the engine */
  value?: Value
  /** For source nodes: the literal value from node data */
  sourceValue?: number
  /** Child expressions keyed by input port ID */
  inputs: Record<string, ExpressionNode>
  /** Ordered port IDs matching the block definition's input order */
  portOrder: string[]
}

// ── Source block types (leaf nodes with no upstream inputs) ──────────────────

const SOURCE_TYPES = new Set([
  'number',
  'slider',
  'variableSource',
  'constant',
  'material',
  'pi',
  'euler',
  'tau',
  'phi',
  'ln2',
  'ln10',
  'sqrt2',
  'inf',
])

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build an expression tree by tracing upstream from a target node.
 *
 * Returns null if the target node is not found.
 * Handles diamond-shaped DAGs via memoisation (shared subtrees
 * are referenced, not duplicated).
 */
export function buildExpressionTree(
  targetNodeId: string,
  nodes: Node[],
  edges: Edge[],
  computed: ReadonlyMap<string, Value>,
): ExpressionNode | null {
  const nodeMap = new Map<string, Node>()
  for (const n of nodes) {
    nodeMap.set(n.id, n)
  }

  // Build incoming-edge index: targetId → [{sourceId, targetHandle}]
  const inEdges = new Map<string, Array<{ sourceId: string; targetHandle: string }>>()
  for (const e of edges) {
    const list = inEdges.get(e.target) ?? []
    list.push({ sourceId: e.source, targetHandle: e.targetHandle ?? 'in' })
    inEdges.set(e.target, list)
  }

  // Memo cache for diamond DAGs
  const memo = new Map<string, ExpressionNode>()

  function walk(nodeId: string): ExpressionNode | null {
    if (memo.has(nodeId)) return memo.get(nodeId)!

    const node = nodeMap.get(nodeId)
    if (!node) return null

    const data = node.data as NodeData
    const blockType = data.blockType ?? ''
    const label = data.label ?? blockType

    const exprNode: ExpressionNode = {
      nodeId,
      opType: blockType,
      label,
      value: computed.get(nodeId),
      inputs: {},
      portOrder: [],
    }

    // For source nodes, capture literal value
    if (
      SOURCE_TYPES.has(blockType) ||
      blockType.startsWith('const.') ||
      blockType.startsWith('preset.')
    ) {
      exprNode.sourceValue = typeof data.value === 'number' ? data.value : undefined
    }

    // Store in memo before recursing (handles potential cycles gracefully)
    memo.set(nodeId, exprNode)

    // Get port order from block definition
    const def = BLOCK_REGISTRY.get(blockType)
    const defPorts = def?.inputs?.map((p) => p.id) ?? []

    // Walk upstream edges
    const incoming = inEdges.get(nodeId) ?? []
    for (const { sourceId, targetHandle } of incoming) {
      const child = walk(sourceId)
      if (child) {
        exprNode.inputs[targetHandle] = child
      }
    }

    // Port order: definition order first, then any extra connected ports
    const connectedPorts = new Set(Object.keys(exprNode.inputs))
    exprNode.portOrder = [
      ...defPorts.filter((p) => connectedPorts.has(p)),
      ...[...connectedPorts].filter((p) => !defPorts.includes(p)),
    ]

    return exprNode
  }

  return walk(targetNodeId)
}

// ── Op symbols for common operations ────────────────────────────────────────

const OP_SYMBOLS: Record<string, string> = {
  add: '+',
  subtract: '-',
  multiply: '*',
  divide: '/',
  power: '^',
  mod: 'mod',
  negate: '-',
  abs: '|',
  sqrt: 'sqrt',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  asin: 'asin',
  acos: 'acos',
  atan: 'atan',
  ln: 'ln',
  log10: 'log10',
  exp: 'exp',
  floor: 'floor',
  ceil: 'ceil',
  round: 'round',
  trunc: 'trunc',
  sign: 'sign',
  min: 'min',
  max: 'max',
}

// Binary ops that use infix notation
const INFIX_OPS = new Set(['add', 'subtract', 'multiply', 'divide', 'power', 'mod'])

// Unary function ops
const UNARY_FN_OPS = new Set([
  'negate',
  'abs',
  'sqrt',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'ln',
  'log10',
  'exp',
  'floor',
  'ceil',
  'round',
  'trunc',
  'sign',
])

// ── Plain text rendering ────────────────────────────────────────────────────

/**
 * Render an expression tree as a plain-text formula.
 *
 * Examples:
 *   - `(Mass + Acc)` for add(Mass, Acc)
 *   - `sin(Angle)` for sin(Angle)
 *   - `42` for a number source with value 42
 */
export function renderExpressionText(expr: ExpressionNode): string {
  const blockType = expr.opType

  // Source/leaf nodes
  if (
    SOURCE_TYPES.has(blockType) ||
    blockType.startsWith('const.') ||
    blockType.startsWith('preset.')
  ) {
    if (expr.sourceValue !== undefined) {
      return `${expr.label} [${expr.sourceValue}]`
    }
    return expr.label
  }

  // Display/probe — just show the single input
  if (blockType === 'display' || blockType === 'probe') {
    const child = expr.inputs['value']
    return child ? renderExpressionText(child) : expr.label
  }

  // Infix binary ops
  if (INFIX_OPS.has(blockType) && expr.portOrder.length === 2) {
    const sym = OP_SYMBOLS[blockType] ?? blockType
    const left = expr.inputs[expr.portOrder[0]]
    const right = expr.inputs[expr.portOrder[1]]
    const leftStr = left ? renderExpressionText(left) : '?'
    const rightStr = right ? renderExpressionText(right) : '?'
    return `(${leftStr} ${sym} ${rightStr})`
  }

  // Unary function ops
  if (UNARY_FN_OPS.has(blockType) && expr.portOrder.length >= 1) {
    const sym = OP_SYMBOLS[blockType] ?? blockType
    const arg = expr.inputs[expr.portOrder[0]]
    const argStr = arg ? renderExpressionText(arg) : '?'
    if (blockType === 'abs') {
      return `|${argStr}|`
    }
    return `${sym}(${argStr})`
  }

  // Generic function call (engineering ops, etc.)
  if (expr.portOrder.length > 0) {
    const args = expr.portOrder
      .map((port) => {
        const child = expr.inputs[port]
        return child ? renderExpressionText(child) : `${port}=?`
      })
      .join(', ')
    return `${expr.label}(${args})`
  }

  // Fallback: just the label
  return expr.label
}

/**
 * Render an expression tree as a substituted formula (values plugged in).
 *
 * Example: `(10 + 9.81)` instead of `(Mass + Acc)`
 */
export function renderExpressionSubstituted(expr: ExpressionNode): string {
  const blockType = expr.opType

  // Source/leaf nodes — show the value
  if (
    SOURCE_TYPES.has(blockType) ||
    blockType.startsWith('const.') ||
    blockType.startsWith('preset.')
  ) {
    return formatNodeValue(expr)
  }

  // Display/probe
  if (blockType === 'display' || blockType === 'probe') {
    const child = expr.inputs['value']
    return child ? renderExpressionSubstituted(child) : formatNodeValue(expr)
  }

  // Infix binary ops
  if (INFIX_OPS.has(blockType) && expr.portOrder.length === 2) {
    const sym = OP_SYMBOLS[blockType] ?? blockType
    const left = expr.inputs[expr.portOrder[0]]
    const right = expr.inputs[expr.portOrder[1]]
    const leftStr = left ? renderExpressionSubstituted(left) : '?'
    const rightStr = right ? renderExpressionSubstituted(right) : '?'
    return `(${leftStr} ${sym} ${rightStr})`
  }

  // Unary function ops
  if (UNARY_FN_OPS.has(blockType) && expr.portOrder.length >= 1) {
    const sym = OP_SYMBOLS[blockType] ?? blockType
    const arg = expr.inputs[expr.portOrder[0]]
    const argStr = arg ? renderExpressionSubstituted(arg) : '?'
    if (blockType === 'abs') {
      return `|${argStr}|`
    }
    return `${sym}(${argStr})`
  }

  // Generic function call
  if (expr.portOrder.length > 0) {
    const args = expr.portOrder
      .map((port) => {
        const child = expr.inputs[port]
        return child ? renderExpressionSubstituted(child) : '?'
      })
      .join(', ')
    return `${expr.label}(${args})`
  }

  return formatNodeValue(expr)
}

// ── LaTeX rendering ─────────────────────────────────────────────────────────

const LATEX_SYMBOLS: Record<string, string> = {
  add: '+',
  subtract: '-',
  multiply: '\\cdot',
  power: '^',
  mod: '\\bmod',
  sqrt: '\\sqrt',
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  asin: '\\arcsin',
  acos: '\\arccos',
  atan: '\\arctan',
  ln: '\\ln',
  log10: '\\log_{10}',
  exp: '\\exp',
  floor: '\\lfloor',
  ceil: '\\lceil',
  round: '\\mathrm{round}',
  trunc: '\\mathrm{trunc}',
  sign: '\\mathrm{sign}',
  min: '\\min',
  max: '\\max',
  abs: '\\left|',
}

/**
 * Render an expression tree as a LaTeX string.
 *
 * @param mode 'symbolic' uses labels, 'substituted' uses values.
 */
export function renderExpressionLatex(
  expr: ExpressionNode,
  mode: 'symbolic' | 'substituted' = 'symbolic',
): string {
  const blockType = expr.opType

  // Source/leaf nodes
  if (
    SOURCE_TYPES.has(blockType) ||
    blockType.startsWith('const.') ||
    blockType.startsWith('preset.')
  ) {
    if (mode === 'substituted') return formatNodeValue(expr)
    return escapeLatex(expr.label)
  }

  // Display/probe — transparent
  if (blockType === 'display' || blockType === 'probe') {
    const child = expr.inputs['value']
    return child ? renderExpressionLatex(child, mode) : escapeLatex(expr.label)
  }

  // Division → frac
  if (blockType === 'divide' && expr.portOrder.length === 2) {
    const num = expr.inputs[expr.portOrder[0]]
    const den = expr.inputs[expr.portOrder[1]]
    const numStr = num ? renderExpressionLatex(num, mode) : '?'
    const denStr = den ? renderExpressionLatex(den, mode) : '?'
    return `\\frac{${numStr}}{${denStr}}`
  }

  // Power → base^{exp}
  if (blockType === 'power' && expr.portOrder.length === 2) {
    const base = expr.inputs[expr.portOrder[0]]
    const exp = expr.inputs[expr.portOrder[1]]
    const baseStr = base ? renderExpressionLatex(base, mode) : '?'
    const expStr = exp ? renderExpressionLatex(exp, mode) : '?'
    return `{${baseStr}}^{${expStr}}`
  }

  // Other infix binary ops
  if (INFIX_OPS.has(blockType) && expr.portOrder.length === 2) {
    const sym = LATEX_SYMBOLS[blockType] ?? blockType
    const left = expr.inputs[expr.portOrder[0]]
    const right = expr.inputs[expr.portOrder[1]]
    const leftStr = left ? renderExpressionLatex(left, mode) : '?'
    const rightStr = right ? renderExpressionLatex(right, mode) : '?'
    return `${leftStr} ${sym} ${rightStr}`
  }

  // Sqrt → special
  if (blockType === 'sqrt' && expr.portOrder.length >= 1) {
    const arg = expr.inputs[expr.portOrder[0]]
    const argStr = arg ? renderExpressionLatex(arg, mode) : '?'
    return `\\sqrt{${argStr}}`
  }

  // Abs → |x|
  if (blockType === 'abs' && expr.portOrder.length >= 1) {
    const arg = expr.inputs[expr.portOrder[0]]
    const argStr = arg ? renderExpressionLatex(arg, mode) : '?'
    return `\\left|${argStr}\\right|`
  }

  // Floor/ceil
  if (blockType === 'floor' && expr.portOrder.length >= 1) {
    const arg = expr.inputs[expr.portOrder[0]]
    const argStr = arg ? renderExpressionLatex(arg, mode) : '?'
    return `\\lfloor ${argStr} \\rfloor`
  }
  if (blockType === 'ceil' && expr.portOrder.length >= 1) {
    const arg = expr.inputs[expr.portOrder[0]]
    const argStr = arg ? renderExpressionLatex(arg, mode) : '?'
    return `\\lceil ${argStr} \\rceil`
  }

  // Other unary function ops
  if (UNARY_FN_OPS.has(blockType) && expr.portOrder.length >= 1) {
    const sym = LATEX_SYMBOLS[blockType] ?? `\\mathrm{${escapeLatex(blockType)}}`
    const arg = expr.inputs[expr.portOrder[0]]
    const argStr = arg ? renderExpressionLatex(arg, mode) : '?'
    return `${sym}\\left(${argStr}\\right)`
  }

  // Generic function call
  if (expr.portOrder.length > 0) {
    const args = expr.portOrder
      .map((port) => {
        const child = expr.inputs[port]
        return child ? renderExpressionLatex(child, mode) : '?'
      })
      .join(', ')
    return `\\mathrm{${escapeLatex(expr.label)}}\\left(${args}\\right)`
  }

  if (mode === 'substituted') return formatNodeValue(expr)
  return escapeLatex(expr.label)
}

function escapeLatex(s: string): string {
  return s.replace(/[_&%$#{}~^\\]/g, (c) => `\\${c}`)
}

// ── Equation string (label = value) ─────────────────────────────────────────

/**
 * Render a full equation: symbolic = result (plain text).
 * Example: `(A + B) = 7`
 */
export function renderEquationText(expr: ExpressionNode): string {
  const sym = renderExpressionText(expr)
  const val = expr.value ? formatNodeValue({ ...expr, sourceValue: undefined }) : '?'
  return `${sym} = ${val}`
}

/**
 * Render a full equation: symbolic = result (LaTeX).
 * Example: `A + B = 7`
 */
export function renderEquationLatex(expr: ExpressionNode): string {
  const sym = renderExpressionLatex(expr, 'symbolic')
  const val = expr.value ? formatNodeValue({ ...expr, sourceValue: undefined }) : '?'
  return `${sym} = ${val}`
}

function formatNodeValue(expr: ExpressionNode): string {
  if (expr.sourceValue !== undefined) return String(expr.sourceValue)
  if (!expr.value) return '?'
  switch (expr.value.kind) {
    case 'scalar':
      return String(expr.value.value)
    case 'vector':
      return `[${expr.value.value.slice(0, 5).join(', ')}${expr.value.value.length > 5 ? ', ...' : ''}]`
    case 'table':
      return `<${expr.value.rows.length}x${expr.value.columns.length} table>`
    case 'error':
      return `ERR(${expr.value.message})`
  }
}
