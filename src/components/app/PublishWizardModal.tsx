import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createAuthorItem,
  togglePublishItem,
  type MarketplaceCategory,
} from '../../lib/marketplaceService'

// ── Props ────────────────────────────────────────────────────────────────────

export interface PublishWizardModalProps {
  open: boolean
  projectId: string
  projectName: string
  onClose: () => void
  onPublished: (itemId: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3

export function PublishWizardModal({
  open,
  projectId: _projectId,
  projectName,
  onClose,
  onPublished,
}: PublishWizardModalProps) {
  const { t } = useTranslation()

  const [step, setStep] = useState<WizardStep>(1)
  const [itemType, setItemType] = useState<'project_template' | 'theme'>('project_template')
  const [title, setTitle] = useState(projectName)
  const [description, setDescription] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishedItemId, setPublishedItemId] = useState<string | null>(null)
  const [autoPublished, setAutoPublished] = useState(false)

  // Reset form when opened
  const prevOpen = useRef(open)
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStep(1)
      setItemType('project_template')
      setTitle(projectName)
      setDescription('')
      setTagsRaw('')
      setLoading(false)
      setError(null)
      setPublishedItemId(null)
      setAutoPublished(false)
    }
    prevOpen.current = open
  }, [open, projectName])

  // Escape to close (when not loading)
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, loading, onClose])

  if (!open) return null

  const tags = tagsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const categoryForType: MarketplaceCategory =
    itemType === 'project_template' ? 'template' : 'theme'

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const item = await createAuthorItem({
        name: title.trim(),
        description: description.trim() || null,
        category: categoryForType,
        version: '1.0.0',
        tags,
      })

      // Try to publish immediately; if RLS allows, it will be auto-approved
      let published = false
      try {
        await togglePublishItem(item.id, true)
        published = true
      } catch {
        // Non-verified authors stay in pending review
      }

      setPublishedItemId(item.id)
      setAutoPublished(published)
      setStep(3)
      onPublished(item.id)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('publishWizard.errorGeneric', 'Submit failed'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={backdropStyle} onClick={loading ? undefined : onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {t('publishWizard.title', 'Publish to Marketplace')}
          </span>
          <button
            style={closeBtnStyle}
            onClick={onClose}
            disabled={loading}
            aria-label={t('ui.close', 'Close')}
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div style={stepIndicatorStyle}>
          {([1, 2, 3] as WizardStep[]).map((s) => (
            <div key={s} style={stepDotStyle(s === step, s < step)} />
          ))}
        </div>

        {/* Step 1: Details */}
        {step === 1 && (
          <div style={bodyStyle}>
            <label style={labelStyle}>
              {t('publishWizard.typeLabel', 'Type')}
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as 'project_template' | 'theme')}
                style={inputStyle}
              >
                <option value="project_template">
                  {t('publishWizard.typeTemplate', 'Project Template')}
                </option>
                <option value="theme">{t('publishWizard.typeTheme', 'Theme')}</option>
              </select>
            </label>

            <label style={labelStyle}>
              {t('publishWizard.titleLabel', 'Title')}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={inputStyle}
                maxLength={120}
                placeholder={t('publishWizard.titlePlaceholder', 'Enter a title…')}
              />
            </label>

            <label style={labelStyle}>
              {t('publishWizard.descriptionLabel', 'Description')}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, height: 80, resize: 'vertical' }}
                maxLength={1000}
                placeholder={t('publishWizard.descriptionPlaceholder', 'Describe your listing…')}
              />
            </label>

            <label style={labelStyle}>
              {t('publishWizard.tagsLabel', 'Tags (comma-separated)')}
              <input
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                style={inputStyle}
                placeholder={t('publishWizard.tagsPlaceholder', 'e.g. finance, workflow, ai')}
              />
            </label>

            <p style={noteStyle}>
              {t(
                'publishWizard.reviewNote',
                'Verified authors are auto-approved. Others are submitted for review.',
              )}
            </p>

            <div style={footerStyle}>
              <button style={secondaryBtnStyle} onClick={onClose}>
                {t('ui.cancel', 'Cancel')}
              </button>
              <button style={primaryBtnStyle} disabled={!title.trim()} onClick={() => setStep(2)}>
                {t('publishWizard.next', 'Next')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div style={bodyStyle}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {t('publishWizard.previewLabel', 'Preview how your listing will appear:')}
            </p>

            {/* Card preview */}
            <div style={previewCardStyle}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.35rem' }}>
                {title}
              </div>
              {description && (
                <p
                  style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}
                >
                  {description}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span style={categoryBadgeStyle}>
                  {categoryForType === 'template'
                    ? t('publishWizard.typeTemplate', 'Project Template')
                    : t('publishWizard.typeTheme', 'Theme')}
                </span>
                {tags.map((tag) => (
                  <span key={tag} style={tagBadgeStyle}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {error && <p style={errorStyle}>{error}</p>}

            <div style={footerStyle}>
              <button style={secondaryBtnStyle} onClick={() => setStep(1)} disabled={loading}>
                {t('ui.back', 'Back')}
              </button>
              <button style={primaryBtnStyle} disabled={loading} onClick={handleSubmit}>
                {loading
                  ? t('publishWizard.submitting', 'Submitting…')
                  : t('publishWizard.submit', 'Submit')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div style={{ ...bodyStyle, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎉</div>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.5rem' }}>
              {t('publishWizard.successTitle', 'Your listing has been submitted!')}
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              {autoPublished
                ? t(
                    'publishWizard.successAutoApproved',
                    'Your item is now live on the marketplace.',
                  )
                : t('publishWizard.successPending', 'It will appear after moderator review.')}
            </p>

            <div style={footerStyle}>
              <button style={secondaryBtnStyle} onClick={onClose}>
                {t('ui.close', 'Close')}
              </button>
              <a
                href="/explore"
                style={{ ...primaryBtnStyle, textDecoration: 'none' }}
                onClick={onClose}
              >
                {t('publishWizard.viewMarketplace', 'View Marketplace')}
              </a>
            </div>

            {publishedItemId && (
              <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
                {t('publishWizard.itemId', 'Item ID:')} {publishedItemId}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--overlay, rgba(0,0,0,0.45))',
  zIndex: 9000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const modalStyle: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  width: 460,
  maxWidth: '95vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
  padding: '0.15rem 0.35rem',
}

const stepIndicatorStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.35rem',
  justifyContent: 'center',
  padding: '0.6rem 0',
  flexShrink: 0,
}

function stepDotStyle(active: boolean, done: boolean): React.CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: active
      ? 'var(--primary)'
      : done
        ? 'var(--primary-muted, var(--primary))'
        : 'var(--border)',
    opacity: done ? 0.5 : 1,
  }
}

const bodyStyle: React.CSSProperties = {
  padding: '0.75rem 1rem 1rem',
  overflowY: 'auto',
  flex: 1,
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  marginBottom: '0.75rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2, var(--surface-1))',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '0.4rem 0.6rem',
  fontSize: '0.82rem',
  color: 'var(--text)',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

const noteStyle: React.CSSProperties = {
  fontSize: '0.73rem',
  color: 'var(--text-muted)',
  margin: '0 0 0.75rem',
  padding: '0.4rem 0.6rem',
  background: 'var(--surface-2, var(--surface-1))',
  border: '1px solid var(--border)',
  borderRadius: 4,
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '0.75rem',
}

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '0.4rem 1rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const secondaryBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '0.4rem 1rem',
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const previewCardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.75rem',
  background: 'var(--surface-2, var(--surface-1))',
  marginBottom: '0.75rem',
}

const categoryBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '0.1rem 0.45rem',
  borderRadius: 99,
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
}

const tagBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '0.1rem 0.45rem',
  borderRadius: 99,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
}

const errorStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'var(--danger)',
  margin: '0 0 0.5rem',
}
