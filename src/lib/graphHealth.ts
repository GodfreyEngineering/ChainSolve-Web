/**
 * graphHealth.ts — Pure computation functions for graph health diagnostics.
 *
 * All functions are side-effect-free and O(N) in nodes + edges.
 * Used by GraphHealthPanel (UI) and useGraphEngine (dlog).
 */

import type { Node, Edge } from '@xyflow/react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthWarning {
  key: string
  severity: 'info' | 'warn'
  detail?: string
}

export interface GraphHealthReport {
  nodeCount: number
  edgeCount: number
  groupCount: number
  collapsedGroupCount: number
  orphanCount: number
  orphanNodeIds: string[]
  crossingEdgeCount: number
  cycleDetected: boolean
  /** IDs of nodes forming the detected cycle (empty if no cycle). */
  cyclePath: string[]
  /** IDs of nodes on the critical (longest) path, in order (empty if cyclic). */
  criticalPath: string[]
  /** IDs of nodes whose computed value is an error. */
  errorNodeIds: string[]
  /** Composite health score 0-100. */
  healthScore: number
  warnings: HealthWarning[]
}

// ── Crossing edges ───────────────────────────────────────────────────────────

/**
 * Returns edges where source and target belong to different groups
 * (or one is ungrouped and the other is in a group).
 * O(N) — one pass to build node→parent map, one pass through edges.
 */
export function getCrossingEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const parentMap = new Map<string, string | undefined>()
  for (const n of nodes) {
    parentMap.set(n.id, n.parentId)
  }

  return edges.filter((e) => {
    const sp = parentMap.get(e.source)
    const tp = parentMap.get(e.target)
    // Both ungrouped — not crossing
    if (sp === undefined && tp === undefined) return false
    // Different parents (including one undefined)
    return sp !== tp
  })
}

/**
 * Returns crossing edges scoped to a single group's members.
 * Used for collapse safety warning.
 */
export function getCrossingEdgesForGroup(groupId: string, nodes: Node[], edges: Edge[]): Edge[] {
  const memberIds = new Set(nodes.filter((n) => n.parentId === groupId).map((n) => n.id))
  return edges.filter((e) => {
    const srcIn = memberIds.has(e.source)
    const tgtIn = memberIds.has(e.target)
    return (srcIn && !tgtIn) || (!srcIn && tgtIn)
  })
}

// ── Cycle detection ──────────────────────────────────────────────────────────

/**
 * DFS-based cycle detection; returns the cycle as an array of node IDs,
 * or null if no cycle exists.
 * Excludes group nodes (blockType === '__group__') from the graph.
 * O(V + E).
 */
function findCyclePath(nodes: Node[], edges: Edge[]): string[] | null {
  const evalNodeIds = new Set(
    nodes
      .filter((n) => (n.data as Record<string, unknown>).blockType !== '__group__')
      .map((n) => n.id),
  )

  const adj = new Map<string, string[]>()
  for (const id of evalNodeIds) adj.set(id, [])
  for (const e of edges) {
    if (evalNodeIds.has(e.source) && evalNodeIds.has(e.target)) {
      adj.get(e.source)!.push(e.target)
    }
  }

  // 0 = unvisited, 1 = in-stack, 2 = done
  const state = new Map<string, number>()
  for (const id of evalNodeIds) state.set(id, 0)

  for (const startId of evalNodeIds) {
    if (state.get(startId) !== 0) continue

    const stack: string[] = []
    const iterStack: { node: string; idx: number }[] = []

    state.set(startId, 1)
    stack.push(startId)
    iterStack.push({ node: startId, idx: 0 })

    while (iterStack.length > 0) {
      const top = iterStack[iterStack.length - 1]
      const neighbors = adj.get(top.node) ?? []

      if (top.idx >= neighbors.length) {
        state.set(top.node, 2)
        iterStack.pop()
        stack.pop()
        continue
      }

      const next = neighbors[top.idx]
      top.idx++

      const ns = state.get(next)
      if (ns === 1) {
        // Found back edge — reconstruct cycle from stack
        const cycleStart = stack.indexOf(next)
        return [...stack.slice(cycleStart), next]
      }
      if (ns === 0) {
        state.set(next, 1)
        stack.push(next)
        iterStack.push({ node: next, idx: 0 })
      }
    }
  }
  return null
}

// ── Critical path ─────────────────────────────────────────────────────────────

/**
 * Finds the longest path (critical path) in the DAG using topological sort + DP.
 * Returns node IDs in order from source to sink.
 * Returns [] for cyclic graphs or empty graphs.
 * O(V + E).
 */
function findCriticalPath(nodes: Node[], edges: Edge[]): string[] {
  const evalNodes = nodes.filter(
    (n) => (n.data as Record<string, unknown>).blockType !== '__group__',
  )
  if (evalNodes.length === 0) return []

  const ids = new Set(evalNodes.map((n) => n.id))
  const adj = new Map<string, string[]>() // successors
  const inDeg = new Map<string, number>()

  for (const id of ids) {
    adj.set(id, [])
    inDeg.set(id, 0)
  }

  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target)) {
      adj.get(e.source)!.push(e.target)
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
    }
  }

  // Kahn's topological sort
  const queue: string[] = []
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id)
  }

  const topo: string[] = []
  const remaining = new Map(inDeg)
  while (queue.length > 0) {
    const node = queue.shift()!
    topo.push(node)
    for (const next of adj.get(node) ?? []) {
      const d = (remaining.get(next) ?? 1) - 1
      remaining.set(next, d)
      if (d === 0) queue.push(next)
    }
  }

  // If not all nodes processed → cycle; bail out
  if (topo.length !== ids.size) return []

  // Longest path DP (dp[id] = length of longest path ending at id)
  const dp = new Map<string, number>()
  const prev = new Map<string, string | null>()
  for (const id of topo) {
    dp.set(id, 1)
    prev.set(id, null)
  }

  for (const id of topo) {
    for (const next of adj.get(id) ?? []) {
      const candidate = (dp.get(id) ?? 1) + 1
      if (candidate > (dp.get(next) ?? 1)) {
        dp.set(next, candidate)
        prev.set(next, id)
      }
    }
  }

  // Find the node with the maximum dp value
  let maxLen = 0
  let endNode = ''
  for (const [id, len] of dp) {
    if (len > maxLen) {
      maxLen = len
      endNode = id
    }
  }

  if (maxLen < 2) return [] // single node isn't a meaningful chain

  // Reconstruct path by tracing back through prev
  const path: string[] = []
  let cur: string | null | undefined = endNode
  while (cur != null) {
    path.unshift(cur)
    cur = prev.get(cur) ?? null
  }
  return path
}

// ── Health score ──────────────────────────────────────────────────────────────

function computeHealthScore(
  cycleDetected: boolean,
  orphanCount: number,
  errorCount: number,
  crossingEdgeCount: number,
): number {
  let score = 100
  if (cycleDetected) score -= 30
  score -= Math.min(orphanCount * 3, 15)
  score -= Math.min(errorCount * 5, 20)
  score -= Math.min(crossingEdgeCount * 2, 10)
  return Math.max(0, score)
}

// ── Compute health ───────────────────────────────────────────────────────────

/**
 * Compute a full health report from the current graph state.
 * @param computedValues  Optional map of nodeId → Value (for error-node detection).
 */
export function computeGraphHealth(
  nodes: Node[],
  edges: Edge[],
  computedValues?: ReadonlyMap<string, { kind: string }>,
): GraphHealthReport {
  const groups = nodes.filter((n) => (n.data as Record<string, unknown>).blockType === '__group__')
  const evalNodes = nodes.filter(
    (n) => (n.data as Record<string, unknown>).blockType !== '__group__',
  )

  const collapsedGroups = groups.filter(
    (n) => (n.data as Record<string, unknown>).groupCollapsed === true,
  )

  // Orphan detection — nodes with zero connections (excluding groups)
  const connected = new Set<string>()
  for (const e of edges) {
    connected.add(e.source)
    connected.add(e.target)
  }
  const orphanNodeIds = evalNodes.filter((n) => !connected.has(n.id)).map((n) => n.id)
  const orphanCount = orphanNodeIds.length

  const crossingEdgeCount = getCrossingEdges(nodes, edges).length
  const cyclePath = findCyclePath(nodes, edges) ?? []
  const cycleDetected = cyclePath.length > 0

  // Error nodes from computed values
  const errorNodeIds: string[] = []
  if (computedValues) {
    for (const [id, val] of computedValues) {
      if (val.kind === 'error' && connected.has(id)) {
        errorNodeIds.push(id)
      }
    }
  }

  const criticalPath = cycleDetected ? [] : findCriticalPath(nodes, edges)

  const healthScore = computeHealthScore(
    cycleDetected,
    orphanCount,
    errorNodeIds.length,
    crossingEdgeCount,
  )

  // Build warnings
  const warnings: HealthWarning[] = []

  if (orphanCount > 0) {
    warnings.push({
      key: 'graphHealth.orphans',
      severity: 'warn',
      detail: String(orphanCount),
    })
  }

  if (crossingEdgeCount > 0) {
    warnings.push({
      key: 'graphHealth.crossingEdges',
      severity: 'warn',
      detail: String(crossingEdgeCount),
    })
  }

  if (evalNodes.length > 300) {
    warnings.push({
      key: 'graphHealth.largeGraph',
      severity: 'info',
    })
  }

  if (cycleDetected) {
    warnings.push({
      key: 'graphHealth.cycleDetected',
      severity: 'warn',
    })
  }

  if (errorNodeIds.length > 0) {
    warnings.push({
      key: 'graphHealth.errorNodes',
      severity: 'warn',
      detail: String(errorNodeIds.length),
    })
  }

  return {
    nodeCount: evalNodes.length,
    edgeCount: edges.length,
    groupCount: groups.length,
    collapsedGroupCount: collapsedGroups.length,
    orphanCount,
    orphanNodeIds,
    crossingEdgeCount,
    cycleDetected,
    cyclePath,
    criticalPath,
    errorNodeIds,
    healthScore,
    warnings,
  }
}

// ── Format report ────────────────────────────────────────────────────────────

/**
 * Produce a plain-text summary for clipboard / dlog.
 * The `t` parameter is an i18n translate function (key, options) → string.
 */
export function formatHealthReport(
  report: GraphHealthReport,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const lines: string[] = [
    `${t('graphHealth.title')}`,
    `  ${t('graphHealth.nodes')}: ${report.nodeCount}`,
    `  ${t('graphHealth.edges')}: ${report.edgeCount}`,
    `  ${t('graphHealth.groups')}: ${report.groupCount}`,
    `  ${t('graphHealth.collapsed')}: ${report.collapsedGroupCount}`,
    `  Health: ${report.healthScore}%`,
    '',
  ]

  if (report.orphanCount > 0) {
    lines.push(`  ⚠ ${t('graphHealth.orphans', { count: report.orphanCount })}`)
  }
  if (report.crossingEdgeCount > 0) {
    lines.push(`  ⚠ ${t('graphHealth.crossingEdges', { count: report.crossingEdgeCount })}`)
  }
  if (report.cycleDetected) {
    lines.push(`  ⚠ ${t('graphHealth.cycleDetected')} [${report.cyclePath.join(' → ')}]`)
  }
  if (report.errorNodeIds.length > 0) {
    lines.push(`  ⚠ ${report.errorNodeIds.length} error block(s)`)
  }
  if (report.nodeCount > 300) {
    lines.push(`  ℹ ${t('graphHealth.largeGraph')}`)
  }
  if (report.criticalPath.length > 0) {
    lines.push(`  Critical path: ${report.criticalPath.length} blocks`)
  }

  return lines.join('\n')
}
