/**
 * FeedbackModal — L4-3: Unified feedback form.
 *
 * Combines bug report, suggestion, and block request into a single
 * modal with a type selector. Bug reports include redacted engine
 * diagnostics via exportDiagnostics().
 */

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { useToast } from './ui/useToast'
import { getCurrentUser } from '../lib/auth'
import { submitBugReport, uploadBugScreenshot } from '../lib/bugReportsService'
import { submitSuggestion, type SuggestionCategory } from '../lib/suggestionsService'
import { exportDiagnostics } from '../observability/diagnostics'
import { BUILD_VERSION, BUILD_SHA, BUILD_ENV } from '../lib/build-info'

type FeedbackType = 'bug' | 'suggestion' | 'block_request'

/** Max screenshot file size: 5 MB */
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024

interface Props {
  open: boolean
  onClose: () => void
  /** Pre-select the feedback type on open. */
  initialType?: FeedbackType
}

/** Collect non-sensitive diagnostics. When includeLogs=true, attaches the engine diagnostics bundle. */
function collectDiagnostics(includeLogs: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    version: BUILD_VERSION,
    sha: BUILD_SHA,
    env: BUILD_ENV,
    userAgent: navigator.userAgent,
    url: window.location.pathname,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    online: navigator.onLine,
    timestamp: new Date().toISOString(),
    colorScheme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  }
  if (includeLogs) {
    try {
      base.engineDiagnostics = exportDiagnostics()
    } catch {
      // best-effort
    }
  }
  return base
}

const SUGGESTION_CATEGORY_MAP: Record<'suggestion' | 'block_request', SuggestionCategory> = {
  suggestion: 'feature_request',
  block_request: 'block_library',
}

export function FeedbackModal({ open, onClose, initialType = 'bug' }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setTitle('')
    setDescription('')
    setScreenshot(null)
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview)
    setScreenshotPreview(null)
    setIncludeDiagnostics(true)
  }, [screenshotPreview])

  const handleScreenshotSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (file.size > MAX_SCREENSHOT_BYTES) {
        toast(t('bugReport.screenshotTooLarge'), 'error')
        return
      }
      if (!file.type.startsWith('image/')) {
        toast(t('bugReport.screenshotInvalidType'), 'error')
        return
      }
      setScreenshot(file)
      setScreenshotPreview(URL.createObjectURL(file))
    },
    [toast, t],
  )

  const removeScreenshot = useCallback(() => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview)
    setScreenshot(null)
    setScreenshotPreview(null)
  }, [screenshotPreview])

  async function handleSubmit() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const user = await getCurrentUser()
      if (!user) {
        toast(t('feedback.error'), 'error')
        return
      }

      if (feedbackType === 'bug') {
        let screenshotPath: string | null = null
        if (screenshot) {
          screenshotPath = await uploadBugScreenshot(user.id, screenshot)
        }
        const metadata = includeDiagnostics
          ? collectDiagnostics(true)
          : { version: BUILD_VERSION, sha: BUILD_SHA, timestamp: new Date().toISOString() }

        await submitBugReport({
          userId: user.id,
          title: title.trim(),
          description: description.trim(),
          metadata,
          screenshotPath,
        })
      } else {
        await submitSuggestion({
          userId: user.id,
          category: SUGGESTION_CATEGORY_MAP[feedbackType],
          title: title.trim(),
          description: description.trim(),
          metadata: {
            version: BUILD_VERSION,
            sha: BUILD_SHA,
            url: window.location.pathname,
            timestamp: new Date().toISOString(),
          },
        })
      }

      toast(t('feedback.success'), 'success')
      resetForm()
      onClose()
    } catch {
      toast(t('feedback.error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const isBug = feedbackType === 'bug'

  return (
    <Modal open={open} onClose={onClose} title={t('feedback.title')} width={540}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Type selector */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['bug', 'suggestion', 'block_request'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFeedbackType(type)}
              style={{
                ...typeBtnStyle,
                ...(feedbackType === type ? typeBtnActiveStyle : {}),
              }}
            >
              {t(`feedback.type_${type}`)}
            </button>
          ))}
        </div>

        <Input
          label={t('feedback.titleLabel')}
          placeholder={t(`feedback.titlePlaceholder_${feedbackType}`)}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={labelStyle}>{t('feedback.descriptionLabel')}</label>
          <textarea
            placeholder={t(`feedback.descriptionPlaceholder_${feedbackType}`)}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={textareaStyle}
          />
        </div>

        {/* Bug-only: screenshot + diagnostics */}
        {isBug && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={labelStyle}>{t('bugReport.screenshotLabel')}</label>
              {screenshotPreview ? (
                <div style={previewContainerStyle}>
                  <img src={screenshotPreview} alt="Screenshot preview" style={previewImgStyle} />
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    style={removeButtonStyle}
                    aria-label={t('bugReport.removeScreenshot')}
                  >
                    X
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={uploadBtnStyle}
                >
                  {t('bugReport.attachScreenshot')}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleScreenshotSelect}
              />
              <span style={hintStyle}>{t('bugReport.screenshotHint')}</span>
            </div>

            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
              />
              <span>{t('feedback.includeDiagnostics')}</span>
            </label>
            {includeDiagnostics && <span style={hintStyle}>{t('feedback.diagnosticsHint')}</span>}
          </>
        )}

        <div style={footerStyle}>
          <span style={metaStyle}>
            v{BUILD_VERSION} ({BUILD_SHA})
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!title.trim() || submitting}
          >
            {submitting ? t('feedback.submitting') : t('feedback.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  opacity: 0.8,
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

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '0.5rem',
}

const metaStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.72rem',
  opacity: 0.4,
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
  background: 'rgba(var(--primary-rgb, 59,130,246), 0.1)',
  fontWeight: 600,
}

const uploadBtnStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px dashed var(--border)',
  borderRadius: 8,
  padding: '0.6rem',
  cursor: 'pointer',
  fontSize: '0.82rem',
  color: 'var(--text)',
  opacity: 0.7,
  fontFamily: 'inherit',
}

const previewContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  maxWidth: '100%',
}

const previewImgStyle: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: 150,
  borderRadius: 8,
  border: '1px solid var(--border)',
  objectFit: 'contain',
}

const removeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  border: 'none',
  borderRadius: '50%',
  width: 22,
  height: 22,
  cursor: 'pointer',
  fontSize: '0.7rem',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
}

const hintStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  opacity: 0.5,
  lineHeight: 1.4,
}

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.82rem',
  cursor: 'pointer',
}
