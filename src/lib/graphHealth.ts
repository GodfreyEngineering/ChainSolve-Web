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
  crossingEdgeCount: number
  cycleDetected: boolean
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
 * Simple DFS-based cycle detection on the directed edge graph.
 * Excludes group nodes (blockType === '__group__') from the graph.
 * O(V + E).
 */
function hasCycle(nodes: Node[], edges: Edge[]): boolean {
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

  for (const id of evalNodeIds) {
    if (state.get(id) === 0) {
      const stack = [id]
      const iterStack: { node: string; idx: number }[] = [{ node: id, idx: 0 }]
      state.set(id, 1)

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
        if (ns === 1) return true // back edge → cycle
        if (ns === 0) {
          state.set(next, 1)
          stack.push(next)
          iterStack.push({ node: next, idx: 0 })
        }
      }
    }
  }
  return false
}

// ── Compute health ───────────────────────────────────────────────────────────

/**
 * Compute a full health report from the current graph state.
 * All operations are O(N) in nodes + edges.
 */
export function computeGraphHealth(nodes: Node[], edges: Edge[]): GraphHealthReport {
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
  const orphanCount = evalNodes.filter((n) => !connected.has(n.id)).length

  const crossingEdgeCount = getCrossingEdges(nodes, edges).length
  const cycleDetected = hasCycle(nodes, edges)

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

  return {
    nodeCount: evalNodes.length,
    edgeCount: edges.length,
    groupCount: groups.length,
    collapsedGroupCount: collapsedGroups.length,
    orphanCount,
    crossingEdgeCount,
    cycleDetected,
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
    '',
  ]

  if (report.orphanCount > 0) {
    lines.push(`  ⚠ ${t('graphHealth.orphans', { count: report.orphanCount })}`)
  }
  if (report.crossingEdgeCount > 0) {
    lines.push(`  ⚠ ${t('graphHealth.crossingEdges', { count: report.crossingEdgeCount })}`)
  }
  if (report.cycleDetected) {
    lines.push(`  ⚠ ${t('graphHealth.cycleDetected')}`)
  }
  if (report.nodeCount > 300) {
    lines.push(`  ℹ ${t('graphHealth.largeGraph')}`)
  }

  return lines.join('\n')
}
