/**
 * ImportProjectDialog.tsx — Modal dialog for .chainsolvejson import summary.
 *
 * Shows a summary of the file to import (project name, canvas count, etc.)
 * and validation results before the user confirms import.
 */

import { Modal } from '../ui/Modal'
import { useTranslation } from 'react-i18next'
import type { ImportSummary } from '../../lib/chainsolvejson/import/report'
import type { ValidationResult } from '../../lib/chainsolvejson/import/validate'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  summary: ImportSummary | null
  validation: ValidationResult | null
  importing: boolean
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.3rem 0',
  fontSize: '0.88rem',
  borderBottom: '1px solid var(--border)',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
}

const valueStyle: React.CSSProperties = {
  fontWeight: 600,
}

const errorListStyle: React.CSSProperties = {
  margin: '0.5rem 0',
  padding: '0.5rem 0.75rem',
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.25)',
  borderRadius: 8,
  fontSize: '0.82rem',
  maxHeight: 120,
  overflowY: 'auto',
}

const warningListStyle: React.CSSProperties = {
  ...errorListStyle,
  background: 'rgba(245,158,11,0.08)',
  border: '1px solid rgba(245,158,11,0.25)',
}

const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1.2rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.88rem',
}

const btnSecondary: React.CSSProperties = {
  padding: '0.5rem 1.2rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '0.88rem',
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function ImportProjectDialog({
  open,
  onClose,
  onConfirm,
  summary,
  validation,
  importing,
}: Props) {
  const { t } = useTranslation()

  if (!summary) return null

  const hasErrors = validation && !validation.ok
  const hasWarnings = validation && validation.warnings.length > 0

  return (
    <Modal open={open} onClose={onClose} title={t('importProject.title')} width={480}>
      <div>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('importProject.projectName')}</span>
          <span style={valueStyle}>{summary.projectName}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('importProject.canvases')}</span>
          <span style={valueStyle}>{summary.canvasCount}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('importProject.variables')}</span>
          <span style={valueStyle}>{summary.variableCount}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('importProject.embeddedAssets')}</span>
          <span style={valueStyle}>
            {summary.embeddedAssetCount}
            {summary.totalEmbeddedBytes > 0 && ` (${formatBytes(summary.totalEmbeddedBytes)})`}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{t('importProject.referencedAssets')}</span>
          <span style={valueStyle}>{summary.referencedAssetCount}</span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>{t('importProject.exportedAt')}</span>
          <span style={valueStyle}>{new Date(summary.exportedAt).toLocaleString()}</span>
        </div>
      </div>

      {hasErrors && (
        <div style={errorListStyle}>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem', color: '#ef4444' }}>
            {t('importProject.validationErrors', { count: validation.errors.length })}
          </div>
          {validation.errors.map((e, i) => (
            <div key={i} style={{ padding: '0.15rem 0' }}>
              {e.code}: {e.message}
            </div>
          ))}
        </div>
      )}

      {hasWarnings && (
        <div style={warningListStyle}>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem', color: '#f59e0b' }}>
            {t('importProject.warnings', { count: validation!.warnings.length })}
          </div>
          {validation!.warnings.map((w, i) => (
            <div key={i} style={{ padding: '0.15rem 0' }}>
              {w.code}: {w.message}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'flex-end',
          marginTop: '1.25rem',
        }}
      >
        <button style={btnSecondary} onClick={onClose} disabled={importing}>
          {t('importProject.cancel')}
        </button>
        <button
          style={{
            ...btnPrimary,
            ...(hasErrors || importing ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
          }}
          onClick={onConfirm}
          disabled={!!hasErrors || importing}
        >
          {importing ? t('importProject.importing') : t('importProject.confirm')}
        </button>
      </div>
    </Modal>
  )
}
