/**
 * FeedbackWidget — Floating feedback button + modal overlay.
 *
 * Renders a small FAB in the bottom-right corner of the workspace.
 * Only visible when a user is authenticated. Submits to the `feedback`
 * table via the service layer and fires a confirmation email.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'improvement', label: 'Suggestion' },
  { value: 'question', label: 'Question' },
]

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'calculation', label: 'Calculation Engine' },
  { value: 'ui', label: 'UI / Interface' },
  { value: 'performance', label: 'Performance' },
  { value: 'blocks', label: 'Nodes & Blocks' },
  { value: 'export', label: 'Export' },
  { value: 'auth', label: 'Account & Auth' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Other' },
]

// ── Component ────────────────────────────────────────────────────────────────

export function FeedbackWidget() {
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

      toast(`Report received — ID: CS-${result.shortId}. We'll review it shortly.`, 'success')
      resetForm()

      // Auto-close after 4 seconds
      autoCloseRef.current = setTimeout(() => setOpen(false), 4000)
    } catch {
      toast('Failed to submit feedback. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Don't render for unauthenticated users
  if (!userId) return null

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={fabStyle}
        aria-label="Send feedback"
        title="Send feedback"
      >
        <MessageSquarePlus size={18} />
      </button>

      {/* Feedback modal */}
      <Modal open={open} onClose={handleClose} title="Send Feedback" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                style={{
                  ...typeBtnStyle,
                  ...(type === opt.value ? typeBtnActiveStyle : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Category */}
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          />

          {/* Title */}
          <Input
            label="Title"
            placeholder="Brief summary of the issue or idea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              placeholder="Describe in detail — what happened, what you expected, steps to reproduce for bugs"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={textareaStyle}
              required
            />
            {description.length > 0 && description.trim().length < 20 && (
              <span style={errorHintStyle}>Minimum 20 characters</span>
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
              {errorLogs ? 'Console Error Detected' : 'Error Details (optional)'}
            </button>
            {showErrors && (
              <textarea
                placeholder="Paste any error messages or console output here"
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
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSubmit()}
                disabled={!title.trim() || description.trim().length < 20 || submitting}
                loading={submitting}
              >
                Submit
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
