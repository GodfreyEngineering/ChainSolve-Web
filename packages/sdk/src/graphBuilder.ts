/**
 * Fluent graph builder for constructing ChainSolve computation graphs
 * programmatically (10.7).
 *
 * ## Usage
 *
 * ```typescript
 * import { GraphBuilder } from '@chainsolve/sdk'
 *
 * const snapshot = new GraphBuilder()
 *   .node('n1', 'number', { value: 3 })
 *   .node('n2', 'number', { value: 4 })
 *   .node('sum', 'add', {})
 *   .edge('n1', 'out', 'sum', 'in_0')
 *   .edge('n2', 'out', 'sum', 'in_1')
 *   .build()
 *
 * // Convenience helpers for common block types:
 * const snapshot2 = new GraphBuilder()
 *   .number('a', 10)
 *   .number('b', 20)
 *   .op('result', 'add', { inputs: ['a', 'b'] })
 *   .build()
 * ```
 */

import type { EdgeDef, GraphSnapshot, NodeDef } from './types.ts'

// ── Edge specification ────────────────────────────────────────────────────────

/** Specifies a pending edge connection before node IDs are assigned. */
interface PendingEdge {
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

// ── GraphBuilder ──────────────────────────────────────────────────────────────

/**
 * Fluent builder for constructing a `GraphSnapshot`.
 *
 * Every method returns `this` for chaining.  Call `build()` to produce the
 * final immutable snapshot.
 */
export class GraphBuilder {
  private readonly _nodes: NodeDef[] = []
  private readonly _edges: PendingEdge[] = []
  private _edgeCounter = 0

  // ── Core builder methods ──────────────────────────────────────────────────

  /**
   * Add a node with an explicit block type and data payload.
   *
   * @param id      Unique node identifier (must be unique within this graph).
   * @param blockType  Block operation name (e.g. `"number"`, `"add"`, `"sin"`).
   * @param data    Block-specific configuration data.
   */
  node(id: string, blockType: string, data: Record<string, unknown> = {}): this {
    this._nodes.push({ id, blockType, data })
    return this
  }

  /**
   * Add a directed edge from `sourceNode.sourceHandle` to
   * `targetNode.targetHandle`.
   *
   * Standard handle names:
   *   - Number/source nodes use `"out"` as the output handle.
   *   - Binary ops use `"in_0"` and `"in_1"` for inputs, `"out"` for output.
   *   - Variadic ops use `"in_0"`, `"in_1"`, ..., `"in_N"`.
   */
  edge(
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string,
  ): this {
    this._edges.push({ source, sourceHandle, target, targetHandle })
    return this
  }

  // ── Convenience helpers ───────────────────────────────────────────────────

  /**
   * Add a `number` (constant scalar) node.
   *
   * @param id    Node identifier.
   * @param value The numeric constant value.
   */
  number(id: string, value: number): this {
    return this.node(id, 'number', { value })
  }

  /**
   * Add a `text` constant node.
   *
   * @param id    Node identifier.
   * @param value The string content.
   */
  text(id: string, value: string): this {
    return this.node(id, 'text_const', { value })
  }

  /**
   * Add a `display` output node.
   *
   * @param id    Node identifier.
   * @param source  Source node whose `out` handle feeds this display.
   */
  display(id: string, source: string): this {
    this.node(id, 'display', {})
    this.edge(source, 'out', id, 'in')
    return this
  }

  /**
   * Add a binary/variadic operation node and automatically wire inputs.
   *
   * @param id      Node identifier.
   * @param blockType  Block type (e.g. `"add"`, `"multiply"`, `"subtract"`).
   * @param options.inputs  Array of source node IDs (each uses `"out"` handle).
   * @param options.data    Extra block data merged with the node data.
   */
  op(
    id: string,
    blockType: string,
    options: { inputs?: string[]; data?: Record<string, unknown> } = {},
  ): this {
    this.node(id, blockType, options.data ?? {})
    for (const [i, srcId] of (options.inputs ?? []).entries()) {
      this.edge(srcId, 'out', id, `in_${i}`)
    }
    return this
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  /**
   * Produce the final immutable `GraphSnapshot`.
   *
   * Validates that:
   *   - All node IDs are unique.
   *   - All edge source/target IDs refer to existing nodes.
   *
   * @throws `Error` if validation fails.
   */
  build(): GraphSnapshot {
    const ids = new Set<string>()
    for (const n of this._nodes) {
      if (ids.has(n.id)) {
        throw new Error(`[GRAPH_BUILDER] Duplicate node id: '${n.id}'`)
      }
      ids.add(n.id)
    }

    for (const e of this._edges) {
      if (!ids.has(e.source)) {
        throw new Error(
          `[GRAPH_BUILDER] Edge references unknown source node: '${e.source}'`,
        )
      }
      if (!ids.has(e.target)) {
        throw new Error(
          `[GRAPH_BUILDER] Edge references unknown target node: '${e.target}'`,
        )
      }
    }

    const edges: EdgeDef[] = this._edges.map((e) => ({
      id: `e${++this._edgeCounter}`,
      ...e,
    }))

    return {
      version: 1,
      nodes: this._nodes.map((n) => ({ ...n })),
      edges,
    }
  }

  /**
   * Serialize the built snapshot to a JSON string.
   * Equivalent to `JSON.stringify(builder.build())`.
   */
  toJSON(): string {
    return JSON.stringify(this.build())
  }

  /**
   * Return the current node count (before calling `build()`).
   */
  get nodeCount(): number {
    return this._nodes.length
  }

  /**
   * Return the current edge count (before calling `build()`).
   */
  get edgeCount(): number {
    return this._edges.length
  }
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

/**
 * Parse a JSON string into a `GraphSnapshot`, validating the version field.
 *
 * @throws `Error` if the JSON is invalid or the version is not 1.
 */
export function parseSnapshot(json: string): GraphSnapshot {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('[PARSE_SNAPSHOT] Invalid JSON')
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as Record<string, unknown>)['version'] !== 1
  ) {
    throw new Error('[PARSE_SNAPSHOT] Not a valid EngineSnapshotV1 (version must be 1)')
  }
  return parsed as GraphSnapshot
}

/**
 * Apply parameter overrides to a snapshot, returning a new snapshot with
 * the specified Number node values replaced.
 *
 * @param snapshot  Source snapshot (not mutated).
 * @param params    Map from node ID to replacement numeric value.
 */
export function applyParams(
  snapshot: GraphSnapshot,
  params: Record<string, number>,
): GraphSnapshot {
  if (Object.keys(params).length === 0) return snapshot
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((n) => {
      const override = params[n.id]
      if (override === undefined) return n
      return { ...n, data: { ...n.data, value: override } }
    }),
  }
}
