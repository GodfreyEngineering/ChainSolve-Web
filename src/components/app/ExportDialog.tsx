/**
 * ExportDialog — V3-6.1 unified export modal.
 *
 * Replaces the scattered export submenus in AppHeader with a single dialog
 * that lets the user pick format, scope, and format-specific options.
 * Preferences are persisted to localStorage when "Remember" is checked.
 */

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStatusBarStore } from '../../stores/statusBarStore'

export type ExportFormat = 'pdf' | 'xlsx' | 'json' | 'git'
export type ExportScope = 'active' | 'project'

const LS_KEY = 'cs:exportPrefs'

export type PdfPageSizeOption = 'A4' | 'Letter' | 'A3'

interface ExportPrefs {
  format: ExportFormat
  scope: ExportScope
  includeImages: boolean
  includeTables: boolean
  includeAnnotations: boolean
  pageSize: PdfPageSizeOption
  remember: boolean
}

const DEFAULTS: ExportPrefs = {
  format: 'pdf',
  scope: 'project',
  includeImages: true,
  includeTables: true,
  includeAnnotations: true,
  pageSize: 'A4',
  remember: true,
}

function loadPrefs(): ExportPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function savePrefs(p: ExportPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
  } catch {
    // private browsing
  }
}

export interface ExportDialogProps {
  open: boolean
  onClose: () => void
  hasProject: boolean
  exportInProgress?: boolean
  onExportPdf: (opts: {
    includeImages: boolean
    scope: ExportScope
    pageSize: PdfPageSizeOption
  }) => void
  onExportXlsx: (opts: { includeTables: boolean; scope: ExportScope }) => void
  onExportJson: () => void
  /** 5.11: Git-friendly .chainsolve export */
  onExportGit?: () => void
  onCancelExport?: () => void
}

export function ExportDialog({
  open,
  onClose,
  hasProject,
  exportInProgress,
  onExportPdf,
  onExportXlsx,
  onExportJson,
  onExportGit,
  onCancelExport,
}: ExportDialogProps) {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useState<ExportPrefs>(loadPrefs)
  const exportHistory = useStatusBarStore((s) => s.exportHistory)

  const update = useCallback((patch: Partial<ExportPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      if (next.remember) savePrefs(next)
      return next
    })
  }, [])

  const handleExport = useCallback(() => {
    if (prefs.remember) savePrefs(prefs)

    switch (prefs.format) {
      case 'pdf':
        onExportPdf({
          includeImages: prefs.includeImages,
          scope: prefs.scope,
          pageSize: prefs.pageSize,
        })
        break
      case 'xlsx':
        onExportXlsx({ includeTables: prefs.includeTables, scope: prefs.scope })
        break
      case 'json':
        onExportJson()
        break
      case 'git':
        onExportGit?.()
        break
    }
    onClose()
  }, [prefs, onExportPdf, onExportXlsx, onExportJson, onExportGit, onClose])

  if (!open) return null

  const scopeDisabled = prefs.format === 'json' || prefs.format === 'git' || !hasProject

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>{t('exportDialog.title')}</h3>

        {/* Format selector */}
        <Field label={t('exportDialog.format')}>
          <div style={radioGroup}>
            {(['pdf', 'xlsx', 'json', 'git'] as const).map((f) => (
              <label key={f} style={radioLabel}>
                <input
                  type="radio"
                  name="exportFormat"
                  checked={prefs.format === f}
                  onChange={() => update({ format: f })}
                />
                {t(`exportDialog.format_${f}`)}
              </label>
            ))}
          </div>
        </Field>

        {/* Scope */}
        <Field label={t('exportDialog.scope')}>
          <div style={radioGroup}>
            <label style={radioLabel}>
              <input
                type="radio"
                name="exportScope"
                checked={prefs.scope === 'active'}
                onChange={() => update({ scope: 'active' })}
                disabled={scopeDisabled}
              />
              {t('exportDialog.scopeActive')}
            </label>
            <label style={radioLabel}>
              <input
                type="radio"
                name="exportScope"
                checked={prefs.scope === 'project'}
                onChange={() => update({ scope: 'project' })}
                disabled={scopeDisabled}
              />
              {t('exportDialog.scopeProject')}
            </label>
          </div>
        </Field>

        {/* Format-specific options */}
        {prefs.format === 'pdf' && (
          <Field label={t('exportDialog.pdfOptions')}>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={prefs.includeImages}
                onChange={() => update({ includeImages: !prefs.includeImages })}
              />
              {t('exportDialog.includeImages')}
            </label>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={prefs.includeAnnotations}
                onChange={() => update({ includeAnnotations: !prefs.includeAnnotations })}
              />
              {t('exportDialog.includeAnnotations')}
            </label>
            <div style={{ marginTop: 8 }}>
              <div style={{ ...fieldLabel, marginBottom: 4 }}>
                {t('exportDialog.pageSize', 'Page size')}
              </div>
              <div style={radioGroup}>
                {(['A4', 'Letter', 'A3'] as const).map((ps) => (
                  <label key={ps} style={radioLabel}>
                    <input
                      type="radio"
                      name="exportPageSize"
                      checked={prefs.pageSize === ps}
                      onChange={() => update({ pageSize: ps })}
                    />
                    {ps}
                  </label>
                ))}
              </div>
            </div>
          </Field>
        )}

        {prefs.format === 'xlsx' && (
          <Field label={t('exportDialog.xlsxOptions')}>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={prefs.includeTables}
                onChange={() => update({ includeTables: !prefs.includeTables })}
              />
              {t('exportDialog.includeTables')}
            </label>
          </Field>
        )}

        {/* Remember */}
        <label style={{ ...checkLabel, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={prefs.remember}
            onChange={() => update({ remember: !prefs.remember })}
          />
          {t('exportDialog.rememberPrefs')}
        </label>

        {/* Actions */}
        <div style={actions}>
          {exportInProgress && onCancelExport && (
            <button style={cancelBtn} onClick={onCancelExport}>
              {t('exportDialog.cancel')}
            </button>
          )}
          <button style={secondaryBtn} onClick={onClose}>
            {t('exportDialog.close')}
          </button>
          <button style={primaryBtn} onClick={handleExport} disabled={!!exportInProgress}>
            {exportInProgress ? t('exportDialog.exporting') : t('exportDialog.export')}
          </button>
        </div>

        {/* Export history */}
        {exportHistory.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={fieldLabel}>{t('exportDialog.recentExports')}</div>
            {exportHistory.map((entry, i) => (
              <div key={i} style={historyRow}>
                <span style={{ fontWeight: 600 }}>{entry.format}</span>
                <span style={{ color: 'var(--text-muted)' }}>{entry.name}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {fmtRelTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const dialog: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.5rem',
  minWidth: 360,
  maxWidth: 440,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  color: 'var(--text)',
  fontFamily: "'Montserrat', system-ui, sans-serif",
}

const titleStyle: React.CSSProperties = {
  margin: '0 0 1rem 0',
  fontSize: '1.1rem',
  fontWeight: 700,
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  marginBottom: 4,
  fontWeight: 600,
}

const radioGroup: React.CSSProperties = {
  display: 'flex',
  gap: 16,
}

const radioLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: '0.85rem',
  cursor: 'pointer',
}

const checkLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.85rem',
  cursor: 'pointer',
  marginTop: 4,
}

const actions: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 20,
}

const btnBase: React.CSSProperties = {
  padding: '0.45rem 1rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Montserrat', system-ui, sans-serif",
}

const primaryBtn: React.CSSProperties = {
  ...btnBase,
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
}

const secondaryBtn: React.CSSProperties = {
  ...btnBase,
  background: 'var(--surface-hover)',
  color: 'var(--text)',
}

const cancelBtn: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--error)',
  border: '1px solid var(--error)',
}

const historyRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  fontSize: '0.78rem',
  padding: '3px 0',
}
