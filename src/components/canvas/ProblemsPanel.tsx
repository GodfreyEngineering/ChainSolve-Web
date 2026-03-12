/**
 * ProblemsPanel — shows graph validation warnings/errors (V3-2.4).
 *
 * BUG-02: Error chain tracing.
 * - Root cause nodes: error nodes whose input sources have no error.
 * - Propagated errors: error nodes with at least one upstream error source.
 * - Clicking "Jump" pans+zooms to the root cause node.
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNodes, useEdges, useReactFlow, type Node, type Edge } from '@xyflow/react'
import { CompassIcon, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useComputed } from '../../contexts/ComputedContext'
import type { Value } from '../../engine/value'

interface ErrorEntry {
  nodeId: string
  label: string
  message: string
  isRootCause: boolean
  rootCauseId: string
}

/**
 * Walk backwards through edges to find the root-cause error node.
 * A root cause is an error node whose input source nodes have no errors.
 * Returns the nodeId of the root cause (may be the node itself if it's primary).
 */
function findErrorRoot(
  nodeId: string,
  edges: Edge[],
  computed: ReadonlyMap<string, Value>,
  visited = new Set<string>(),
): string {
  if (visited.has(nodeId)) return nodeId
  visited.add(nodeId)

  // Find all incoming edges to this node
  const incoming = edges.filter((e) => e.target === nodeId)
  for (const edge of incoming) {
    const srcVal = computed.get(edge.source)
    if (srcVal?.kind === 'error') {
      // Upstream source also has error — recurse
      return findErrorRoot(edge.source, edges, computed, visited)
    }
  }
  // No upstream errors — this IS the root cause
  return nodeId
}

function nodeLabel(nodeId: string, nodes: Node[]): string {
  const node = nodes.find((n) => n.id === nodeId)
  const data = node?.data as Record<string, unknown> | undefined
  return typeof data?.label === 'string' && data.label.length > 0 ? data.label : nodeId
}

export default function ProblemsPanel() {
  const { t } = useTranslation()
  const computed = useComputed()
  const nodes = useNodes()
  const edges = useEdges()
  const { fitView, setNodes } = useReactFlow()

  const jumpToNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })))
      requestAnimationFrame(() => {
        fitView({ nodes: [{ id: nodeId }], padding: 0.5, duration: 400 })
      })
    },
    [setNodes, fitView],
  )

  const errors: ErrorEntry[] = []
  for (const [id, val] of computed.entries()) {
    if (val?.kind === 'error') {
      const rootCauseId = findErrorRoot(id, edges, computed)
      errors.push({
        nodeId: id,
        label: nodeLabel(id, nodes),
        message: val.message,
        isRootCause: rootCauseId === id,
        rootCauseId,
      })
    }
  }

  if (errors.length === 0) {
    return (
      <div style={emptyStyle}>
        <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
        <span>{t('problems.noProblems', 'No problems detected')}</span>
      </div>
    )
  }

  // Sort: root causes first
  errors.sort((a, b) => (b.isRootCause ? 1 : 0) - (a.isRootCause ? 1 : 0))

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
        <span>
          {errors.length}{' '}
          {errors.length === 1
            ? t('problems.problem', 'problem')
            : t('problems.problems', 'problems')}
        </span>
      </div>
      <div style={listStyle}>
        {errors.map((e) => (
          <div key={e.nodeId} style={itemStyle}>
            <div style={itemTopStyle}>
              {e.isRootCause ? (
                <span style={rootBadgeStyle}>{t('problems.root', 'root')}</span>
              ) : (
                <span style={propBadgeStyle}>{t('problems.propagated', 'chain')}</span>
              )}
              <span style={labelStyle}>{e.label}</span>
              <button
                style={jumpBtnStyle}
                title={t('problems.jumpToNode', 'Jump to node')}
                onClick={() => jumpToNode(e.isRootCause ? e.nodeId : e.rootCauseId)}
              >
                <CompassIcon size={10} />
                {e.isRootCause ? t('problems.jump', 'Jump') : t('problems.jumpToRoot', 'Root')}
              </button>
            </div>
            <div style={msgStyle}>{e.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  color: 'var(--text-muted)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderBottom: '1px solid var(--border)',
  fontWeight: 500,
  flexShrink: 0,
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
}

const itemStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderBottom: '1px solid var(--separator)',
}

const itemTopStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  marginBottom: 2,
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 500,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const badgeBase: React.CSSProperties = {
  fontSize: '0.58rem',
  fontWeight: 700,
  padding: '1px 4px',
  borderRadius: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  flexShrink: 0,
}

const rootBadgeStyle: React.CSSProperties = {
  ...badgeBase,
  background: 'color-mix(in srgb, var(--danger) 18%, transparent)',
  color: 'var(--danger)',
  border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
}

const propBadgeStyle: React.CSSProperties = {
  ...badgeBase,
  background: 'color-mix(in srgb, var(--warning) 18%, transparent)',
  color: 'var(--warning)',
  border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
}

const jumpBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  fontSize: '0.62rem',
  padding: '1px 5px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 3,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  flexShrink: 0,
}

const msgStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--danger-text, var(--danger))',
  opacity: 0.85,
}
