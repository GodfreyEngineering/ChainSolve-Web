/**
 * CSEL Graph Generator — converts an AST into React Flow nodes + edges.
 *
 * Maps expression operators to ChainSolve block types:
 *   + → add, - → subtract, * → multiply, / → divide, ^ → power
 *   sin() → sin, cos() → cos, max(a,b,c) → max (variadic), etc.
 *
 * Literals create Number source blocks. Trailing '=' creates Display blocks.
 * Assignments create named Number blocks that can be referenced later.
 */

import type { CselNode, CselProgram } from './types.ts'

export interface GeneratedNode {
  id: string
  type: string // React Flow node type (e.g., 'csSource', 'csOperation', 'csDisplay')
  blockType: string // ChainSolve block type (e.g., 'number', 'add', 'display')
  data: Record<string, unknown>
  position: { x: number; y: number }
}

export interface GeneratedEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface GeneratedGraph {
  nodes: GeneratedNode[]
  edges: GeneratedEdge[]
}

/** Map CSEL binary operators to block types. */
const BINARY_OP_MAP: Record<string, string> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '^': 'power',
}

/** Map CSEL function names to block types. */
const FUNCTION_MAP: Record<string, string> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  asin: 'asin',
  acos: 'acos',
  atan: 'atan',
  sqrt: 'sqrt',
  abs: 'abs',
  ln: 'ln',
  log: 'log10',
  log10: 'log10',
  exp: 'exp',
  floor: 'floor',
  ceil: 'ceil',
  round: 'round',
  max: 'max',
  min: 'min',
  // Additional mappings can be added for all block types
}

let nodeCounter = 0
let edgeCounter = 0

function nextNodeId(): string {
  return `csel_n${++nodeCounter}`
}

function nextEdgeId(): string {
  return `csel_e${++edgeCounter}`
}

/**
 * Generate a graph from a CSEL AST.
 *
 * @param program The parsed CSEL program
 * @param startX Starting X position for layout
 * @param startY Starting Y position for layout
 */
export function generateGraph(program: CselProgram, startX = 100, startY = 100): GeneratedGraph {
  nodeCounter = 0
  edgeCounter = 0

  const nodes: GeneratedNode[] = []
  const edges: GeneratedEdge[] = []
  const namedVars = new Map<string, string>() // variable name → node ID
  let layoutX = startX

  for (const stmt of program) {
    const result = generateNode(stmt, nodes, edges, namedVars, layoutX, startY)
    layoutX = result.maxX + 200

    if (stmt.type === 'assign') {
      namedVars.set(stmt.name, result.outputNodeId)
    }
  }

  return { nodes, edges }
}

interface GenResult {
  outputNodeId: string
  outputHandle: string
  maxX: number
}

function generateNode(
  node: CselNode,
  nodes: GeneratedNode[],
  edges: GeneratedEdge[],
  namedVars: Map<string, string>,
  x: number,
  y: number,
): GenResult {
  switch (node.type) {
    case 'literal': {
      const id = nextNodeId()
      nodes.push({
        id,
        type: 'csSource',
        blockType: 'number',
        data: { blockType: 'number', label: String(node.value), value: node.value },
        position: { x, y },
      })
      return { outputNodeId: id, outputHandle: 'out', maxX: x }
    }

    case 'identifier': {
      // Check if this is a named variable
      const varNodeId = namedVars.get(node.name)
      if (varNodeId) {
        return { outputNodeId: varNodeId, outputHandle: 'out', maxX: x }
      }
      // Check if it's a known constant (pi, e, etc.)
      const constants: Record<string, number> = {
        pi: Math.PI,
        e: Math.E,
        tau: Math.PI * 2,
        phi: (1 + Math.sqrt(5)) / 2,
      }
      if (node.name in constants) {
        const id = nextNodeId()
        nodes.push({
          id,
          type: 'csSource',
          blockType: 'number',
          data: { blockType: 'number', label: node.name, value: constants[node.name] },
          position: { x, y },
        })
        return { outputNodeId: id, outputHandle: 'out', maxX: x }
      }
      // Unknown identifier — create a Number block with label
      const id = nextNodeId()
      nodes.push({
        id,
        type: 'csSource',
        blockType: 'number',
        data: { blockType: 'number', label: node.name, value: 0 },
        position: { x, y },
      })
      namedVars.set(node.name, id)
      return { outputNodeId: id, outputHandle: 'out', maxX: x }
    }

    case 'binary': {
      const blockType = BINARY_OP_MAP[node.op] ?? 'add'
      const leftResult = generateNode(node.left, nodes, edges, namedVars, x, y)
      const rightResult = generateNode(node.right, nodes, edges, namedVars, x, y + 80)
      const opX = Math.max(leftResult.maxX, rightResult.maxX) + 200
      const opId = nextNodeId()
      nodes.push({
        id: opId,
        type: 'csOperation',
        blockType,
        data: { blockType, label: blockType.charAt(0).toUpperCase() + blockType.slice(1) },
        position: { x: opX, y },
      })
      edges.push({
        id: nextEdgeId(),
        source: leftResult.outputNodeId,
        sourceHandle: leftResult.outputHandle,
        target: opId,
        targetHandle: 'a',
      })
      edges.push({
        id: nextEdgeId(),
        source: rightResult.outputNodeId,
        sourceHandle: rightResult.outputHandle,
        target: opId,
        targetHandle: 'b',
      })
      return { outputNodeId: opId, outputHandle: 'out', maxX: opX }
    }

    case 'unary': {
      const operandResult = generateNode(node.operand, nodes, edges, namedVars, x, y)
      const negId = nextNodeId()
      const negX = operandResult.maxX + 200
      nodes.push({
        id: negId,
        type: 'csOperation',
        blockType: 'negate',
        data: { blockType: 'negate', label: 'Negate' },
        position: { x: negX, y },
      })
      edges.push({
        id: nextEdgeId(),
        source: operandResult.outputNodeId,
        sourceHandle: operandResult.outputHandle,
        target: negId,
        targetHandle: 'a',
      })
      return { outputNodeId: negId, outputHandle: 'out', maxX: negX }
    }

    case 'call': {
      const blockType = FUNCTION_MAP[node.name] ?? node.name
      const argResults = node.args.map((arg, i) =>
        generateNode(arg, nodes, edges, namedVars, x, y + i * 80),
      )
      const fnX = Math.max(x, ...argResults.map((r) => r.maxX)) + 200
      const fnId = nextNodeId()
      const isVariadic =
        argResults.length > 2 &&
        (blockType === 'max' ||
          blockType === 'min' ||
          blockType === 'add' ||
          blockType === 'multiply')

      nodes.push({
        id: fnId,
        type: 'csOperation',
        blockType,
        data: {
          blockType,
          label: blockType.charAt(0).toUpperCase() + blockType.slice(1),
          ...(isVariadic ? { dynamicInputCount: argResults.length } : {}),
        },
        position: { x: fnX, y },
      })

      // Wire arguments to input ports
      if (isVariadic) {
        argResults.forEach((arg, i) => {
          edges.push({
            id: nextEdgeId(),
            source: arg.outputNodeId,
            sourceHandle: arg.outputHandle,
            target: fnId,
            targetHandle: `in_${i}`,
          })
        })
      } else if (argResults.length === 1) {
        edges.push({
          id: nextEdgeId(),
          source: argResults[0].outputNodeId,
          sourceHandle: argResults[0].outputHandle,
          target: fnId,
          targetHandle: 'a',
        })
      } else if (argResults.length >= 2) {
        edges.push({
          id: nextEdgeId(),
          source: argResults[0].outputNodeId,
          sourceHandle: argResults[0].outputHandle,
          target: fnId,
          targetHandle: 'a',
        })
        edges.push({
          id: nextEdgeId(),
          source: argResults[1].outputNodeId,
          sourceHandle: argResults[1].outputHandle,
          target: fnId,
          targetHandle: 'b',
        })
      }

      return { outputNodeId: fnId, outputHandle: 'out', maxX: fnX }
    }

    case 'assign': {
      const valueResult = generateNode(node.value, nodes, edges, namedVars, x, y)
      // For assignments, the output node IS the value node (named for reference)
      return valueResult
    }

    case 'display': {
      const exprResult = generateNode(node.expr, nodes, edges, namedVars, x, y)
      const dispX = exprResult.maxX + 200
      const dispId = nextNodeId()
      nodes.push({
        id: dispId,
        type: 'csDisplay',
        blockType: 'display',
        data: { blockType: 'display', label: 'Result' },
        position: { x: dispX, y },
      })
      edges.push({
        id: nextEdgeId(),
        source: exprResult.outputNodeId,
        sourceHandle: exprResult.outputHandle,
        target: dispId,
        targetHandle: 'value',
      })
      return { outputNodeId: dispId, outputHandle: 'out', maxX: dispX }
    }
  }
}
