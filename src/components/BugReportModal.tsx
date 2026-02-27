import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { useToast } from './ui/useToast'
import { getCurrentUser } from '../lib/auth'
import { submitBugReport } from '../lib/bugReportsService'
import { BUILD_VERSION, BUILD_SHA, BUILD_ENV } from '../lib/build-info'

interface Props {
  open: boolean
  onClose: () => void
}

export function BugReportModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const user = await getCurrentUser()
      if (!user) {
        toast(t('settings.bugError'), 'error')
        return
      }

      await submitBugReport({
        userId: user.id,
        title: title.trim(),
        description: description.trim(),
        metadata: {
          version: BUILD_VERSION,
          sha: BUILD_SHA,
          env: BUILD_ENV,
          userAgent: navigator.userAgent,
          url: window.location.href,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          timestamp: new Date().toISOString(),
        },
      })

      toast(t('settings.bugSuccess'), 'success')
      setTitle('')
      setDescription('')
      onClose()
    } catch {
      toast(t('settings.bugError'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('settings.reportBug')} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          label={t('settings.bugTitle')}
          placeholder={t('settings.bugTitlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={labelStyle}>{t('settings.bugDescription')}</label>
          <textarea
            placeholder={t('settings.bugDescriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            style={textareaStyle}
          />
        </div>

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
            {submitting ? t('settings.bugSubmitting') : t('settings.bugSubmit')}
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
