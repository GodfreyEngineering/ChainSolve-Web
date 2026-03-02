/**
 * SuggestionModal — H9-2: Feature request, block library addition,
 * and UX feedback submission form.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { useToast } from './ui/useToast'
import { getCurrentUser } from '../lib/auth'
import { submitSuggestion, type SuggestionCategory } from '../lib/suggestionsService'
import { BUILD_VERSION, BUILD_SHA } from '../lib/build-info'

interface Props {
  open: boolean
  onClose: () => void
}

const CATEGORIES: SuggestionCategory[] = ['feature_request', 'block_library', 'ux_feedback']

export function SuggestionModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [category, setCategory] = useState<SuggestionCategory>('feature_request')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const user = await getCurrentUser()
      if (!user) {
        toast(t('suggestion.error'), 'error')
        return
      }

      await submitSuggestion({
        userId: user.id,
        category,
        title: title.trim(),
        description: description.trim(),
        metadata: {
          version: BUILD_VERSION,
          sha: BUILD_SHA,
          url: window.location.pathname,
          timestamp: new Date().toISOString(),
        },
      })

      toast(t('suggestion.success'), 'success')
      setTitle('')
      setDescription('')
      setCategory('feature_request')
      onClose()
    } catch {
      toast(t('suggestion.error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('suggestion.title')} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Category selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={labelStyle}>{t('suggestion.categoryLabel')}</label>
          <div style={categoryRowStyle}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  ...categoryBtnStyle,
                  ...(category === cat ? categoryBtnActiveStyle : {}),
                }}
              >
                {t(`suggestion.cat_${cat}`)}
              </button>
            ))}
          </div>
        </div>

        <Input
          label={t('suggestion.titleLabel')}
          placeholder={t('suggestion.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={labelStyle}>{t('suggestion.descriptionLabel')}</label>
          <textarea
            placeholder={t('suggestion.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            style={textareaStyle}
          />
        </div>

        <div style={footerStyle}>
          <span style={hintStyle}>{t('suggestion.hint')}</span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!title.trim() || submitting}
          >
            {submitting ? t('suggestion.submitting') : t('suggestion.submit')}
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

const hintStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  opacity: 0.5,
  lineHeight: 1.4,
}

const categoryRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
}

const categoryBtnStyle: React.CSSProperties = {
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

const categoryBtnActiveStyle: React.CSSProperties = {
  borderColor: 'var(--primary)',
  background: 'rgba(var(--primary-rgb, 59,130,246), 0.1)',
  fontWeight: 600,
}
