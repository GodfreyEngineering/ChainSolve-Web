/**
 * OutputPanel — shows last engine evaluation summary (V3-2.4).
 *
 * Displays: elapsed time, nodes evaluated, diagnostics count, partial status.
 */

import { useStatusBarStore } from '../../stores/statusBarStore'
import { useTranslation } from 'react-i18next'

export default function OutputPanel() {
  const { t } = useTranslation()
  const engineStatus = useStatusBarStore((s) => s.engineStatus)
  const nodeCount = useStatusBarStore((s) => s.nodeCount)
  const edgeCount = useStatusBarStore((s) => s.edgeCount)

  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        <span style={labelStyle}>{t('output.engineStatus', 'Engine')}</span>
        <span style={valueStyle}>{engineStatus}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>{t('statusBar.nodes', 'Nodes')}</span>
        <span style={valueStyle}>{nodeCount}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>{t('statusBar.edges', 'Edges')}</span>
        <span style={valueStyle}>{edgeCount}</span>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  padding: '8px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  minWidth: 80,
}

const valueStyle: React.CSSProperties = {
  fontWeight: 500,
}
