/**
 * ReportModal — K5-1: Reusable modal for reporting offensive content.
 *
 * Accepts a target type and target ID, collects a reason from the user,
 * and submits via userReportsService. Shows success/error feedback inline.
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'
import { submitReport, type ReportTargetType } from '../../lib/userReportsService'

interface ReportModalProps {
  open: boolean
  onClose: () => void
  targetType: ReportTargetType
  targetId: string
  /** Called after a successful submission. */
  onReported?: () => void
}

const MAX_REASON = 1000

export function ReportModal({ open, onClose, targetType, targetId, onReported }: ReportModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = useCallback(async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError(t('report.reasonRequired'))
      return
    }
    if (trimmed.length > MAX_REASON) {
      setError(t('report.reasonTooLong'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitReport(targetType, targetId, trimmed)
      setSuccess(true)
      onReported?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }, [reason, targetType, targetId, onReported, t])

  const handleClose = useCallback(() => {
    setReason('')
    setError(null)
    setSuccess(false)
    onClose()
  }, [onClose])

  return (
    <Modal open={open} onClose={handleClose} title={t('report.title')} width={420}>
      {success ? (
        <div>
          <p style={successText}>{t('report.success')}</p>
          <button style={btnStyle} onClick={handleClose}>
            {t('ui.close')}
          </button>
        </div>
      ) : (
        <div>
          <p style={descText}>
            {t('report.description', { type: t(`report.type_${targetType}`) })}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('report.reasonPlaceholder')}
            maxLength={MAX_REASON}
            rows={4}
            style={textareaStyle}
            disabled={submitting}
            autoFocus
          />
          <div style={charCount}>
            {reason.length}/{MAX_REASON}
          </div>
          {error && (
            <div style={errorText} role="alert">
              {error}
            </div>
          )}
          <div style={btnRow}>
            <button style={cancelBtn} onClick={handleClose} disabled={submitting}>
              {t('ui.cancel')}
            </button>
            <button
              style={submitBtn(submitting)}
              onClick={() => void handleSubmit()}
              disabled={submitting || !reason.trim()}
            >
              {submitting ? t('report.submitting') : t('report.submit')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const descText: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box',
}

const charCount: React.CSSProperties = {
  textAlign: 'right',
  fontSize: '0.72rem',
  color: 'var(--text-faint)',
  marginTop: '0.25rem',
}

const errorText: React.CSSProperties = {
  fontSize: '0.82rem',
  color: 'var(--danger-text)',
  marginTop: '0.5rem',
}

const successText: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--success)',
  margin: '0 0 1rem',
}

const btnRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1rem',
}

const btnStyle: React.CSSProperties = {
  padding: '0.45rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--primary)',
  color: 'var(--color-on-primary)',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const cancelBtn: React.CSSProperties = {
  ...btnStyle,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

function submitBtn(disabled: boolean): React.CSSProperties {
  return {
    ...btnStyle,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'default' : 'pointer',
  }
}
