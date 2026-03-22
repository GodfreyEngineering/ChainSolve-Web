/**
 * FeedbackWidget — Floating feedback button + modal overlay.
 *
 * Renders a small FAB in the bottom-right corner of the workspace.
 * Only visible when a user is authenticated. Submits to the `feedback`
 * table via the service layer and fires a confirmation email.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquarePlus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useToast } from '../ui/useToast'
import {
  submitFeedback,
  sendFeedbackConfirmation,
  getFeedbackUser,
} from '../../lib/feedbackService'
import { BUILD_VERSION } from '../../lib/build-info'

// ── Types ────────────────────────────────────────────────────────────────────

type FeedbackType = 'bug' | 'improvement' | 'question'
type FeedbackCategory =
  | 'calculation'
  | 'ui'
  | 'performance'
  | 'blocks'
  | 'export'
  | 'auth'
  | 'billing'
  | 'other'

const TYPE_KEYS: FeedbackType[] = ['bug', 'improvement', 'question']
const CATEGORY_KEYS: FeedbackCategory[] = [
  'calculation',
  'ui',
  'performance',
  'blocks',
  'export',
  'auth',
  'billing',
  'other',
]

// ── Component ────────────────────────────────────────────────────────────────

export function FeedbackWidget() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Form state
  const [type, setType] = useState<FeedbackType>('bug')
  const [category, setCategory] = useState<FeedbackCategory>('other')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [errorLogs, setErrorLogs] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check auth state
  useEffect(() => {
    getFeedbackUser()
      .then((u) => {
        setUserId(u?.id ?? null)
        setUserEmail(u?.email ?? null)
      })
      .catch(() => {
        setUserId(null)
      })
  }, [])

  // Pre-populate error logs when modal opens
  useEffect(() => {
    if (open && window.__lastConsoleError) {
      setErrorLogs(window.__lastConsoleError)
      setShowErrors(true)
    }
  }, [open])

  const resetForm = useCallback(() => {
    setType('bug')
    setCategory('other')
    setTitle('')
    setDescription('')
    setErrorLogs('')
    setShowErrors(false)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
  }, [])

  async function handleSubmit() {
    if (!title.trim() || description.trim().length < 20 || !userId) return

    setSubmitting(true)
    try {
      const browserInfo = {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        url: window.location.href,
      }

      const result = await submitFeedback({
        userId,
        type,
        category,
        title: title.trim(),
        description: description.trim(),
        errorLogs: errorLogs.trim() || null,
        browserInfo,
        route: window.location.pathname,
      })

      // Fire-and-forget: send confirmation email
      if (userEmail) {
        sendFeedbackConfirmation(userEmail, result.ticketId, type, title.trim())
      }

      toast(t('feedback.successWithId', { shortId: result.shortId }), 'success')
      resetForm()

      // Auto-close after 4 seconds
      autoCloseRef.current = setTimeout(() => setOpen(false), 4000)
    } catch {
      toast(t('feedback.error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Don't render for unauthenticated users
  if (!userId) return null

  const categoryOptions = CATEGORY_KEYS.map((key) => ({
    value: key,
    label: t(`feedback.category_${key}`),
  }))

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={fabStyle}
        aria-label={t('feedback.widgetLabel')}
        title={t('feedback.widgetLabel')}
      >
        <MessageSquarePlus size={18} />
      </button>

      {/* Feedback modal */}
      <Modal open={open} onClose={handleClose} title={t('feedback.title')} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {TYPE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                style={{
                  ...typeBtnStyle,
                  ...(type === key ? typeBtnActiveStyle : {}),
                }}
              >
                {t(`feedback.type_${key}`)}
              </button>
            ))}
          </div>

          {/* Category */}
          <Select
            label={t('feedback.categoryLabel')}
            options={categoryOptions}
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          />

          {/* Title */}
          <Input
            label={t('feedback.titleLabel')}
            placeholder={t('feedback.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          {/* Description — no maxLength; users may paste long terminal errors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={labelStyle}>{t('feedback.descriptionLabel')}</label>
            <textarea
              placeholder={t('feedback.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              style={descriptionStyle}
              required
            />
            {description.length > 0 && description.trim().length < 20 && (
              <span style={errorHintStyle}>{t('feedback.descriptionMinLength')}</span>
            )}
          </div>

          {/* Error details (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowErrors(!showErrors)}
              style={collapsibleBtnStyle}
            >
              {showErrors ? '\u25BE' : '\u25B8'}{' '}
              {errorLogs ? t('feedback.errorDetected') : t('feedback.errorOptional')}
            </button>
            {showErrors && (
              <textarea
                placeholder={t('feedback.errorPlaceholder')}
                value={errorLogs}
                onChange={(e) => setErrorLogs(e.target.value)}
                rows={3}
                style={{
                  ...textareaStyle,
                  marginTop: '0.35rem',
                  fontSize: '0.78rem',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            )}
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            <span style={metaStyle}>v{BUILD_VERSION}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" size="sm" onClick={handleClose}>
                {t('feedback.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSubmit()}
                disabled={!title.trim() || description.trim().length < 20 || submitting}
                loading={submitting}
              >
                {submitting ? t('feedback.submitting') : t('feedback.submit')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const fabStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 'calc(22px + 12px)', // above StatusBar (22px) + gap
  right: 16,
  zIndex: 8000,
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  fontFamily: 'inherit',
}

const typeBtnStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.4rem 0.75rem',
  fontSize: '0.8rem',
  cursor: 'pointer',
  color: 'var(--text)',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s, background 0.15s',
}

const typeBtnActiveStyle: React.CSSProperties = {
  borderColor: 'var(--primary)',
  background: 'rgba(28, 171, 176, 0.1)',
  fontWeight: 600,
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  opacity: 0.7,
}

const textareaStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.6rem 0.75rem',
  fontSize: '0.88rem',
  color: 'var(--text)',
  resize: 'vertical',
  fontFamily: 'inherit',
  minHeight: 80,
}

const descriptionStyle: React.CSSProperties = {
  ...textareaStyle,
  minHeight: 120,
  maxHeight: '50vh',
}

const errorHintStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--danger-text)',
}

const collapsibleBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  padding: 0,
  fontFamily: 'inherit',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '0.25rem',
}

const metaStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.72rem',
  opacity: 0.4,
}
