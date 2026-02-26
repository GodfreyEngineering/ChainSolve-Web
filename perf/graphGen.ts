/**
 * perf/graphGen.ts — Deterministic graph generator for performance tests.
 *
 * Generates EngineSnapshotV1-compatible graphs with controllable shape and
 * size. Uses a seeded Linear Congruential Generator (LCG) for reproducibility
 * across runs.
 *
 * Shapes:
 *   chain   — linear chain: n0 → n1 → ... → n(N-1)
 *   fanOut  — star: n0 → {n1, n2, ..., n(N-1)}
 *   fanIn   — binary tree of `add` ops converging to root
 *   grid    — serpentine row-major grid (single predecessor per cell)
 *   sparse  — random DAG, one random predecessor per non-source node
 *
 * Usage:
 *   import { generateGraph, makeSnapshot } from '../perf/graphGen.ts'
 *   const snap = makeSnapshot({ shape: 'chain', size: 'medium' })
 */

import type {
  EngineSnapshotV1,
  EngineNodeDef,
  EngineEdgeDef,
} from '../src/engine/wasm-types.ts'

// ── Seeded LCG RNG ─────────────────────────────────────────────────────────

/**
 * Park-Miller LCG: a=48271, m=2^31-1.
 * Produces a reproducible sequence for the given seed.
 */
export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1 // ensure non-zero
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state * 48271) % 2147483647
    return this.state / 2147483647
  }

  /** Returns an integer in [0, max). */
  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }
}

// ── Graph shapes and sizes ─────────────────────────────────────────────────

export type GraphShape = 'chain' | 'fanOut' | 'fanIn' | 'grid' | 'sparse'
export type GraphSize = 'small' | 'medium' | 'large'

const SIZE_MAP: Record<GraphSize, number> = {
  small: 200,
  medium: 2000,
  large: 10000,
}

export interface GeneratedGraph {
  nodes: EngineNodeDef[]
  edges: EngineEdgeDef[]
  nodeCount: number
  edgeCount: number
}

// ── Node/edge helpers ──────────────────────────────────────────────────────

function numNode(id: string, value: number): EngineNodeDef {
  return { id, blockType: 'number', data: { value } }
}

function negNode(id: string): EngineNodeDef {
  return { id, blockType: 'negate', data: {} }
}

function addNode(id: string): EngineNodeDef {
  return { id, blockType: 'add', data: {} }
}

function edgeDef(
  id: string,
  source: string,
  srcHandle: string,
  target: string,
  tgtHandle: string,
): EngineEdgeDef {
  return { id, source, sourceHandle: srcHandle, target, targetHandle: tgtHandle }
}

function singleEdge(id: string, source: string, target: string): EngineEdgeDef {
  return edgeDef(id, source, 'out', target, 'a')
}

// ── Shape generators ───────────────────────────────────────────────────────

/**
 * Linear chain: number(1) → negate → negate → ... (N nodes total).
 * Stresses topo-sort + sequential eval.
 */
function buildChain(n: number): GeneratedGraph {
  const nodes: EngineNodeDef[] = [numNode('n0', 1.0)]
  const edges: EngineEdgeDef[] = []
  for (let i = 1; i < n; i++) {
    nodes.push(negNode(`n${i}`))
    edges.push(singleEdge(`e${i}`, `n${i - 1}`, `n${i}`))
  }
  return { nodes, edges, nodeCount: n, edgeCount: n - 1 }
}

/**
 * Star / fan-out: one source (n0) → N-1 negate leaves.
 * Stresses wide dirty-set propagation.
 */
function buildFanOut(n: number): GeneratedGraph {
  const nodes: EngineNodeDef[] = [numNode('n0', 1.0)]
  const edges: EngineEdgeDef[] = []
  for (let i = 1; i < n; i++) {
    nodes.push(negNode(`n${i}`))
    edges.push(singleEdge(`e${i}`, 'n0', `n${i}`))
  }
  return { nodes, edges, nodeCount: n, edgeCount: n - 1 }
}

/**
 * Fan-in: balanced binary tree of `add` ops.
 * Internal nodes are `add` (inputs a + b), leaves are `number`.
 * Stresses deep merge and fan-in topo traversal.
 *
 * Tree layout (0-indexed, breadth-first):
 *   internal nodes: 0 … numInternal-1
 *   leaf nodes:     numInternal … n-1
 *   children of i:  2i+1 (left, handle a), 2i+2 (right, handle b)
 */
function buildFanIn(n: number): GeneratedGraph {
  if (n < 3) return buildChain(n)

  const nodes: EngineNodeDef[] = []
  const edges: EngineEdgeDef[] = []
  const numLeaves = Math.ceil((n + 1) / 2)
  const numInternal = n - numLeaves

  for (let i = 0; i < numInternal; i++) {
    nodes.push(addNode(`n${i}`))
  }
  for (let i = numInternal; i < n; i++) {
    nodes.push(numNode(`n${i}`, 1.0))
  }
  for (let i = 0; i < numInternal; i++) {
    const left = 2 * i + 1
    const right = 2 * i + 2
    if (left < n) {
      edges.push(edgeDef(`el${i}`, `n${left}`, 'out', `n${i}`, 'a'))
    }
    if (right < n) {
      edges.push(edgeDef(`er${i}`, `n${right}`, 'out', `n${i}`, 'b'))
    }
  }
  return { nodes, edges, nodeCount: n, edgeCount: edges.length }
}

/**
 * Serpentine grid: side×side grid (N nodes total), each cell connects to the
 * cell to its left, or wraps to the end of the row above.
 * Gives a compact but non-linear memory access pattern for topo sort.
 */
function buildGrid(n: number): GeneratedGraph {
  const side = Math.ceil(Math.sqrt(n))
  const nodes: EngineNodeDef[] = []
  const edges: EngineEdgeDef[] = []

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / side)
    const col = i % side
    const id = `n${i}`

    if (i === 0) {
      nodes.push(numNode(id, 1.0))
    } else {
      nodes.push(negNode(id))
      if (col > 0) {
        // Connect from the node to the left in the same row
        edges.push(singleEdge(`e${i}`, `n${i - 1}`, id))
      } else {
        // First column: connect from end of previous row
        const prevRowEnd = row * side - 1
        edges.push(singleEdge(`e${i}`, `n${prevRowEnd}`, id))
      }
    }
  }
  return { nodes, edges, nodeCount: nodes.length, edgeCount: edges.length }
}

/**
 * Sparse random DAG: each node i > 0 picks a random predecessor from [0, i).
 * Reproducible via seeded RNG. Stresses unpredictable dirty-set patterns.
 */
function buildSparse(n: number, rng: SeededRandom): GeneratedGraph {
  const nodes: EngineNodeDef[] = [numNode('n0', 1.0)]
  const edges: EngineEdgeDef[] = []
  for (let i = 1; i < n; i++) {
    nodes.push(negNode(`n${i}`))
    const src = rng.nextInt(i)
    edges.push(singleEdge(`e${i}`, `n${src}`, `n${i}`))
  }
  return { nodes, edges, nodeCount: n, edgeCount: n - 1 }
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface GraphGenOptions {
  shape: GraphShape
  /** Exact node count. Takes precedence over `size`. */
  n?: number
  /** Preset size (small=200, medium=2000, large=10000). */
  size?: GraphSize
  /** RNG seed for `sparse` shape (default: 42). */
  seed?: number
}

/**
 * Generate a deterministic graph for perf testing.
 *
 * @example
 * const g = generateGraph({ shape: 'chain', size: 'medium' })
 * // g.nodes, g.edges compatible with EngineSnapshotV1
 */
export function generateGraph(opts: GraphGenOptions): GeneratedGraph {
  const n = opts.n ?? SIZE_MAP[opts.size ?? 'small']
  const rng = new SeededRandom(opts.seed ?? 42)

  switch (opts.shape) {
    case 'chain':
      return buildChain(n)
    case 'fanOut':
      return buildFanOut(n)
    case 'fanIn':
      return buildFanIn(n)
    case 'grid':
      return buildGrid(n)
    case 'sparse':
      return buildSparse(n, rng)
  }
}

/**
 * Convenience wrapper that returns a ready-to-use EngineSnapshotV1.
 */
export function makeSnapshot(opts: GraphGenOptions): EngineSnapshotV1 {
  const { nodes, edges } = generateGraph(opts)
  return { version: 1, nodes, edges }
}
