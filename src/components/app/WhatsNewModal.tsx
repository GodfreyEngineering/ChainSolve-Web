import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { CHANGELOG_ENTRIES } from '../../lib/changelog'

interface Props {
  open: boolean
  onClose: () => void
}

export function WhatsNewModal({ open, onClose }: Props) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onClose} title={t('whatsNew.title')} width={560}>
      <div style={containerStyle}>
        {CHANGELOG_ENTRIES.map((entry, idx) => (
          <section key={entry.version} style={sectionStyle(idx === 0)}>
            <div style={headerRowStyle}>
              <h3 style={versionStyle}>{t('whatsNew.version', { version: entry.version })}</h3>
              <span style={dateStyle}>{entry.date}</span>
            </div>
            <p style={entryTitleStyle}>{entry.title}</p>
            <p style={summaryStyle}>{entry.summary}</p>
            <ul style={listStyle}>
              {entry.items.map((item, i) => (
                <li key={i} style={itemStyle}>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  maxHeight: '65vh',
  overflowY: 'auto',
}

function sectionStyle(isLatest: boolean): React.CSSProperties {
  return {
    padding: '0.85rem 1rem',
    borderRadius: 8,
    background: isLatest ? 'var(--primary-dim)' : 'transparent',
    border: isLatest ? '1px solid var(--primary-glow)' : '1px solid var(--border)',
  }
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.75rem',
  marginBottom: '0.2rem',
}

const versionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.78rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--primary)',
}

const dateStyle: React.CSSProperties = {
  fontSize: '0.74rem',
  color: 'var(--text-muted)',
}

const entryTitleStyle: React.CSSProperties = {
  margin: '0 0 0.3rem 0',
  fontSize: '1rem',
  fontWeight: 600,
  color: 'var(--text)',
}

const summaryStyle: React.CSSProperties = {
  margin: '0 0 0.6rem 0',
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '1.1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
}

const itemStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  color: 'var(--text)',
  lineHeight: 1.4,
}
