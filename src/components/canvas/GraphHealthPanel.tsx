/**
 * GraphHealthPanel — Bottom panel showing graph health diagnostics.
 *
 * ADV-05: Expanded with health gauge, critical path, disconnected node list,
 * error node list, and auto-fix suggestions.
 */

import { useMemo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node, Edge } from '@xyflow/react'
import { computeGraphHealth, formatHealthReport } from '../../lib/graphHealth'
import type { HealthWarning } from '../../lib/graphHealth'
import { useComputed } from '../../contexts/ComputedContext'

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
  const computedValues = useComputed()

  const report = useMemo(
    () => computeGraphHealth(nodes, edges, computedValues),
    [nodes, edges, computedValues],
  )

  // Build a nodeId → label map for human-readable display
  const labelMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of nodes) {
      const nd = n.data as Record<string, unknown>
      m.set(n.id, typeof nd.label === 'string' && nd.label ? nd.label : n.id)
    }
    return m
  }, [nodes])

  const handleCopy = useCallback(() => {
    const text = formatHealthReport(report, t)
    navigator.clipboard.writeText(text).catch(() => {})
  }, [report, t])

  const scoreColor =
    report.healthScore >= 90 ? '#10b981' : report.healthScore >= 70 ? '#f59e0b' : '#ef4444'

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
            title={minimized ? t('ui.expand') : t('ui.minimize')}
            aria-label={minimized ? t('ui.expand') : t('ui.minimize')}
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
          {/* Health gauge + stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Circular-ish gauge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width={54} height={54} viewBox="0 0 54 54">
                <circle
                  cx={27}
                  cy={27}
                  r={22}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={5}
                />
                <circle
                  cx={27}
                  cy={27}
                  r={22}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth={5}
                  strokeDasharray={`${(report.healthScore / 100) * 138.2} 138.2`}
                  strokeLinecap="round"
                  transform="rotate(-90 27 27)"
                  style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
                />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: scoreColor,
                }}
              >
                {report.healthScore}%
              </span>
            </div>

            {/* Stats grid */}
            <div style={{ ...gridStyle, flex: 1 }}>
              <StatCell label={t('graphHealth.nodes', 'Blocks')} value={report.nodeCount} />
              <StatCell label={t('graphHealth.edges', 'Chains')} value={report.edgeCount} />
              <StatCell label={t('graphHealth.groups', 'Groups')} value={report.groupCount} />
              <StatCell
                label={t('graphHealth.collapsed', 'Collapsed')}
                value={report.collapsedGroupCount}
              />
            </div>
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

          {/* Cycle path */}
          {report.cycleDetected && report.cyclePath.length > 0 && (
            <div style={detailBoxStyle}>
              <div style={detailLabelStyle}>CYCLE DETECTED</div>
              <div style={{ fontSize: '0.65rem', color: '#ef4444', wordBreak: 'break-all' }}>
                {report.cyclePath.map((id) => labelMap.get(id) ?? id).join(' → ')}
              </div>
            </div>
          )}

          {/* Disconnected blocks */}
          {report.orphanNodeIds.length > 0 && (
            <div style={detailBoxStyle}>
              <div style={detailLabelStyle}>
                Disconnected blocks ({report.orphanNodeIds.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {report.orphanNodeIds.slice(0, 20).map((id) => (
                  <span key={id} style={tagStyle}>
                    {labelMap.get(id) ?? id}
                  </span>
                ))}
                {report.orphanNodeIds.length > 20 && (
                  <span style={{ ...tagStyle, opacity: 0.5 }}>
                    +{report.orphanNodeIds.length - 20} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error blocks */}
          {report.errorNodeIds.length > 0 && (
            <div style={detailBoxStyle}>
              <div style={detailLabelStyle}>Error blocks ({report.errorNodeIds.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {report.errorNodeIds.slice(0, 20).map((id) => (
                  <span key={id} style={{ ...tagStyle, borderColor: '#ef4444', color: '#ef4444' }}>
                    {labelMap.get(id) ?? id}
                  </span>
                ))}
                {report.errorNodeIds.length > 20 && (
                  <span style={{ ...tagStyle, opacity: 0.5 }}>
                    +{report.errorNodeIds.length - 20} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Critical path */}
          {report.criticalPath.length > 1 && (
            <div style={detailBoxStyle}>
              <div style={detailLabelStyle}>
                Critical path — {report.criticalPath.length} blocks
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--text-muted, #888)',
                  marginTop: 4,
                  wordBreak: 'break-all',
                }}
              >
                {report.criticalPath.map((id) => labelMap.get(id) ?? id).join(' → ')}
              </div>
            </div>
          )}

          {/* Auto-fix suggestions */}
          {report.warnings.length > 0 && (
            <div style={detailBoxStyle}>
              <div style={detailLabelStyle}>Auto-fix suggestions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                {report.orphanCount > 0 && (
                  <div style={fixSuggestionStyle}>
                    → Delete or connect {report.orphanCount} disconnected block
                    {report.orphanCount > 1 ? 's' : ''}
                  </div>
                )}
                {report.cycleDetected && (
                  <div style={fixSuggestionStyle}>
                    → Remove chain from{' '}
                    {report.cyclePath.length > 1
                      ? `"${labelMap.get(report.cyclePath[report.cyclePath.length - 2]) ?? ''}" → "${labelMap.get(report.cyclePath[0]) ?? ''}"`
                      : 'the cycle'}{' '}
                    to break the loop
                  </div>
                )}
                {report.errorNodeIds.length > 0 && (
                  <div style={fixSuggestionStyle}>
                    → Check inputs on {report.errorNodeIds.length} error block
                    {report.errorNodeIds.length > 1 ? 's' : ''}
                  </div>
                )}
                {report.crossingEdgeCount > 0 && (
                  <div style={fixSuggestionStyle}>
                    → Move {report.crossingEdgeCount} cross-group chain
                    {report.crossingEdgeCount > 1 ? 's' : ''} inside their respective groups
                  </div>
                )}
              </div>
            </div>
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
  const color = warning.severity === 'warn' ? 'var(--warning)' : '#3b82f6'
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
  background: 'var(--surface-1)',
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
  gap: 10,
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

const detailBoxStyle: React.CSSProperties = {
  padding: '6px 8px',
  background: 'rgba(255,255,255,0.03)',
  borderRadius: 4,
  borderLeft: '2px solid rgba(255,255,255,0.1)',
}

const detailLabelStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: 'var(--text-muted, #888)',
  textTransform: 'uppercase',
}

const tagStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  padding: '1px 6px',
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'var(--text-muted, #888)',
}

const fixSuggestionStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-muted, #aaa)',
  padding: '1px 0',
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
  color: 'var(--color-on-primary)',
}

const aiActionBtnSecondary: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--primary, #1cab80)',
  color: 'var(--primary, #1cab80)',
}
