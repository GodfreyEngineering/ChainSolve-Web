/**
 * GraphHealthPanel — Bottom panel showing graph health diagnostics.
 *
 * Renders inside CanvasArea's canvas-wrap div (absolute-positioned at the
 * bottom). Recomputes stats on every nodes/edges change via useMemo.
 */

import { useMemo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node, Edge } from '@xyflow/react'
import { computeGraphHealth, formatHealthReport } from '../../lib/graphHealth'
import type { HealthWarning } from '../../lib/graphHealth'

interface GraphHealthPanelProps {
  nodes: Node[]
  edges: Edge[]
  onClose: () => void
  /** When true, skip outer positioning chrome (rendered inside BottomDock). */
  docked?: boolean
  /** AI-3: Trigger "Fix with Copilot" workflow. */
  onFixWithCopilot?: () => void
  /** AI-3: Trigger "Explain issues" workflow. */
  onExplainIssues?: () => void
}

export default function GraphHealthPanel({
  nodes,
  edges,
  onClose,
  docked,
  onFixWithCopilot,
  onExplainIssues,
}: GraphHealthPanelProps) {
  const { t } = useTranslation()
  const [minimized, setMinimized] = useState(false)

  const report = useMemo(() => computeGraphHealth(nodes, edges), [nodes, edges])

  const handleCopy = useCallback(() => {
    const text = formatHealthReport(report, t)
    navigator.clipboard.writeText(text).catch(() => {})
  }, [report, t])

  return (
    <div style={docked ? dockedStyle : minimized ? { ...panelStyle, height: 'auto' } : panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: '0.75rem', opacity: 0.7 }}>
          {t('graphHealth.title', 'Graph Health')}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button
            onClick={handleCopy}
            style={ctrlBtn}
            title={t('graphHealth.copyReport', 'Copy report')}
          >
            {'\u2398'}
          </button>
          <button
            onClick={() => setMinimized((v) => !v)}
            style={ctrlBtn}
            title={minimized ? 'Expand' : 'Minimize'}
            aria-label={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '\u25b3' : '\u25bd'}
          </button>
          <button onClick={onClose} style={ctrlBtn} title={t('common.close', 'Close')}>
            {'\u2715'}
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div style={bodyStyle}>
          {/* Stats grid */}
          <div style={gridStyle}>
            <StatCell label={t('graphHealth.nodes', 'Nodes')} value={report.nodeCount} />
            <StatCell label={t('graphHealth.edges', 'Edges')} value={report.edgeCount} />
            <StatCell label={t('graphHealth.groups', 'Groups')} value={report.groupCount} />
            <StatCell
              label={t('graphHealth.collapsed', 'Collapsed')}
              value={report.collapsedGroupCount}
            />
          </div>

          {/* Warnings */}
          {report.warnings.length > 0 ? (
            <div style={warningsStyle}>
              {report.warnings.map((w) => (
                <WarningRow key={w.key} warning={w} t={t} />
              ))}
            </div>
          ) : (
            <div style={noWarningsStyle}>{'\u2713'} No issues detected</div>
          )}

          {/* AI-3: Quick actions */}
          {report.warnings.length > 0 && (onFixWithCopilot || onExplainIssues) && (
            <div style={aiActionsStyle}>
              {onFixWithCopilot && (
                <button style={aiActionBtn} onClick={onFixWithCopilot}>
                  {t('ai.fixGraph', 'Fix with Copilot')}
                </button>
              )}
              {onExplainIssues && (
                <button
                  style={{ ...aiActionBtn, ...aiActionBtnSecondary }}
                  onClick={onExplainIssues}
                >
                  {t('ai.explainNode', 'Explain issues')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCellStyle}>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted, #888)', marginTop: 2 }}>
        {label}
      </span>
    </div>
  )
}

function WarningRow({
  warning,
  t,
}: {
  warning: HealthWarning
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const icon = warning.severity === 'warn' ? '\u26a0' : '\u2139'
  const color = warning.severity === 'warn' ? '#f59e0b' : '#3b82f6'
  const msg = warning.detail ? t(warning.key, { count: Number(warning.detail) }) : t(warning.key)
  return (
    <div style={warningRowStyle}>
      <span style={{ color, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '0.72rem' }}>{msg}</span>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 200,
  zIndex: 15,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--card-bg, #1e1e1e)',
  borderTop: '1px solid var(--border, #333)',
  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  fontSize: '0.72rem',
  color: 'var(--text, #f4f4f3)',
}

const dockedStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  fontSize: '0.72rem',
  color: 'var(--text, #f4f4f3)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderBottom: '1px solid var(--border, #333)',
  flexShrink: 0,
}

const ctrlBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text, #f4f4f3)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: '0.68rem',
  padding: '1px 5px',
  fontFamily: 'inherit',
  opacity: 0.6,
}

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
}

const statCellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '6px 4px',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 6,
}

const warningsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const warningRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  background: 'rgba(255,255,255,0.03)',
  borderRadius: 4,
}

const noWarningsStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: '#10b981',
  opacity: 0.7,
  padding: '8px 0',
}

const aiActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginTop: 4,
}

const aiActionBtn: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.68rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  background: 'var(--primary, #1cab80)',
  color: '#fff',
}

const aiActionBtnSecondary: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--primary, #1cab80)',
  color: 'var(--primary, #1cab80)',
}
