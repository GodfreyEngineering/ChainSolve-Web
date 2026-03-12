/**
 * NewProjectModal — Built-in templates gallery for the new-project wizard.
 *
 * Shows a "Blank project" option followed by template cards grouped by
 * category. The user selects a card and clicks "Create project".
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { TEMPLATES } from '../../templates/index'
import { createProject, createProjectFromTemplate } from '../../lib/projects'
import { useToast } from '../ui/useToast'

export interface NewProjectModalProps {
  open: boolean
  onClose: () => void
  onCreated: (projectId: string) => void
}

const BLANK_ID = '__blank__'

// Ordered list of categories to display
const CATEGORY_ORDER = ['Science', 'Engineering', 'Finance', 'Student']

export function NewProjectModal({ open, onClose, onCreated }: NewProjectModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [selectedId, setSelectedId] = useState<string>(BLANK_ID)
  const [loading, setLoading] = useState(false)

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Reset selection when modal opens — intentional setState-in-effect for modal reset pattern
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setSelectedId(BLANK_ID)
      setLoading(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCreate = useCallback(async () => {
    setLoading(true)
    try {
      let proj: { id: string }
      if (selectedId === BLANK_ID) {
        proj = await createProject(t('newProject.defaultName', 'Untitled project'))
      } else {
        proj = await createProjectFromTemplate(selectedId)
      }
      onCreated(proj.id)
      navigate(`/app/${proj.id}`)
      onClose()
    } catch (err: unknown) {
      toast(
        err instanceof Error
          ? err.message
          : t('newProject.createFailed', 'Failed to create project'),
        'error',
      )
      setLoading(false)
    }
  }, [selectedId, t, onCreated, navigate, onClose, toast])

  if (!open) return null

  // Group templates by category, preserving CATEGORY_ORDER
  const byCategory: Record<string, typeof TEMPLATES> = {}
  for (const tmpl of TEMPLATES) {
    if (!byCategory[tmpl.category]) byCategory[tmpl.category] = []
    byCategory[tmpl.category].push(tmpl)
  }

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => byCategory[c]),
    ...Object.keys(byCategory).filter((c) => !CATEGORY_ORDER.includes(c)),
  ]

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('newProject.title', 'New project')}
      >
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t('newProject.title', 'New project')}</h2>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={bodyStyle}>
          {/* Blank project card */}
          <div style={sectionStyle}>
            <div
              style={cardStyle(selectedId === BLANK_ID)}
              onClick={() => setSelectedId(BLANK_ID)}
              role="option"
              aria-selected={selectedId === BLANK_ID}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedId(BLANK_ID)
              }}
            >
              <div style={cardIconStyle}>✦</div>
              <div style={cardBodyStyle}>
                <div style={cardNameStyle}>{t('newProject.blank', 'Blank project')}</div>
                <div style={cardDescStyle}>
                  {t('newProject.blankDesc', 'Start with an empty canvas.')}
                </div>
              </div>
            </div>
          </div>

          {/* Template categories */}
          {orderedCategories.map((category) => (
            <div key={category} style={sectionStyle}>
              <div style={categoryLabelStyle}>{category}</div>
              <div style={gridStyle}>
                {byCategory[category].map((tmpl) => (
                  <div
                    key={tmpl.id}
                    style={cardStyle(selectedId === tmpl.id)}
                    onClick={() => setSelectedId(tmpl.id)}
                    role="option"
                    aria-selected={selectedId === tmpl.id}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedId(tmpl.id)
                    }}
                  >
                    <div style={cardIconStyle}>⬡</div>
                    <div style={cardBodyStyle}>
                      <div style={cardNameStyle}>{tmpl.name}</div>
                      <div style={cardDescStyle}>{tmpl.description}</div>
                      {tmpl.tags.length > 0 && (
                        <div style={tagsStyle}>
                          {tmpl.tags.map((tag) => (
                            <span key={tag} style={tagStyle}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button style={createBtnStyle} onClick={handleCreate} disabled={loading}>
            {loading
              ? t('newProject.creating', 'Creating\u2026')
              : t('newProject.create', 'Create project')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: 'var(--surface-1, #1e1e2e)',
  border: '1px solid var(--border, rgba(255,255,255,0.1))',
  borderRadius: 14,
  width: '100%',
  maxWidth: 720,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  overflow: 'hidden',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  color: 'var(--text, #e2e8f0)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1.1rem 1.4rem',
  borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
  flexShrink: 0,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted, rgba(226,232,240,0.5))',
  cursor: 'pointer',
  fontSize: '1rem',
  padding: '0.25rem 0.4rem',
  borderRadius: 6,
  lineHeight: 1,
}

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '1rem 1.4rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.2rem',
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
}

const categoryLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  opacity: 0.45,
  marginBottom: '0.15rem',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '0.55rem',
}

function cardStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
    padding: '0.85rem 1rem',
    border: selected
      ? '2px solid var(--primary, #6366f1)'
      : '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 10,
    background: selected ? 'rgba(99,102,241,0.08)' : 'transparent',
    cursor: 'pointer',
    transition: 'border-color 0.12s, background 0.12s',
    userSelect: 'none',
    outline: 'none',
  }
}

const cardIconStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '1.1rem',
  color: 'var(--primary, #6366f1)',
  width: 22,
  textAlign: 'center',
  marginTop: 2,
}

const cardBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  minWidth: 0,
}

const cardNameStyle: React.CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 600,
  lineHeight: 1.3,
}

const cardDescStyle: React.CSSProperties = {
  fontSize: '0.77rem',
  opacity: 0.58,
  lineHeight: 1.45,
}

const tagsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.3rem',
  marginTop: 4,
}

const tagStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '1px 7px',
  borderRadius: 99,
  border: '1px solid var(--border, rgba(255,255,255,0.15))',
  opacity: 0.65,
  letterSpacing: '0.02em',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.6rem',
  padding: '0.9rem 1.4rem',
  borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
  flexShrink: 0,
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '0.45rem 1.1rem',
  border: '1px solid var(--border, rgba(255,255,255,0.15))',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--text, #e2e8f0)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  fontWeight: 500,
}

const createBtnStyle: React.CSSProperties = {
  padding: '0.45rem 1.3rem',
  border: 'none',
  borderRadius: 8,
  background: 'var(--primary, #6366f1)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  fontWeight: 600,
}
