/**
 * ProblemsPanel — shows graph validation warnings/errors (V3-2.4).
 *
 * Reads computed values from ComputedContext and shows nodes with errors.
 */

import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { ComputedContext } from '../../contexts/ComputedContext'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface ErrorEntry {
  nodeId: string
  message: string
}

export default function ProblemsPanel() {
  const { t } = useTranslation()
  const computed = useContext(ComputedContext)

  const errors: ErrorEntry[] = []
  if (computed) {
    for (const [id, val] of computed.entries()) {
      const v = val as { kind?: string; value?: string }
      if (v?.kind === 'error' && v.value) {
        errors.push({ nodeId: id, message: v.value })
      }
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
            <span style={nodeIdStyle}>{e.nodeId}</span>
            <span style={msgStyle}>{e.message}</span>
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
  display: 'flex',
  gap: 8,
  padding: '4px 12px',
  borderBottom: '1px solid var(--separator)',
  alignItems: 'baseline',
}

const nodeIdStyle: React.CSSProperties = {
  color: 'var(--primary)',
  fontFamily: 'monospace',
  fontSize: '0.7rem',
  flexShrink: 0,
}

const msgStyle: React.CSSProperties = {
  color: 'var(--danger)',
}
