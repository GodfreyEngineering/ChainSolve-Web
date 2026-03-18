/**
 * LegalLanguageNotice — Shown on legal pages when the user's UI language is
 * not English. Informs them that:
 *   1. The legal document content is in English only.
 *   2. The English version is the legally binding version.
 *   3. Browser translation tools may be used for convenience.
 *
 * Satisfies checklist item 16.75: legal pages must note that the English
 * version governs when accessed in other languages.
 */

import { useTranslation } from 'react-i18next'

interface LegalLanguageNoticeProps {
  /** The canonical English URL for this legal page, e.g. "/terms" */
  canonicalUrl: string
}

export function LegalLanguageNotice({ canonicalUrl }: LegalLanguageNoticeProps) {
  const { i18n } = useTranslation()

  // Only show for non-English UI language
  const lang = i18n.language?.slice(0, 2) ?? 'en'
  if (lang === 'en') return null

  return (
    <div style={noticeStyle} role="note" aria-label="Language notice">
      <span style={iconStyle} aria-hidden="true">
        🌐
      </span>
      <div>
        <strong style={titleStyle}>English only</strong>
        <p style={bodyStyle}>
          This legal document is currently only available in English. The English version at{' '}
          <a href={canonicalUrl} style={linkStyle} lang="en">
            chainsolve.co.uk{canonicalUrl}
          </a>{' '}
          is the legally binding version. You may use your browser&apos;s built-in translation
          feature to read a translated version for convenience, but the English text governs in all
          cases.
        </p>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const noticeStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'flex-start',
  background: 'rgba(28, 171, 176, 0.08)',
  border: '1px solid rgba(28, 171, 176, 0.25)',
  borderRadius: '8px',
  padding: '1rem 1.25rem',
  marginBottom: '1.5rem',
}

const iconStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  flexShrink: 0,
  lineHeight: 1,
  marginTop: '0.1rem',
}

const titleStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.9rem',
  fontWeight: 600,
  marginBottom: '0.25rem',
}

const bodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  lineHeight: 1.6,
  opacity: 0.85,
}

const linkStyle: React.CSSProperties = {
  color: 'var(--primary)',
  textDecoration: 'underline',
}
