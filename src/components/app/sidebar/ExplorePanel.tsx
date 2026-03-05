/**
 * ExplorePanel — sidebar tab for browsing the marketplace.
 *
 * Lazy-loads the marketplace content in a compact sidebar-friendly layout.
 * For now, shows a CTA to open the full explore page.
 */

import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Icon } from '../../ui/Icon'

export function ExplorePanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div style={containerStyle}>
      <div style={heroStyle}>
        <Icon icon={Compass} size={32} style={{ color: 'var(--primary)', opacity: 0.6 }} />
        <h3 style={titleStyle}>{t('sidebar.exploreTitle', 'Explore Templates')}</h3>
        <p style={descStyle}>
          {t(
            'sidebar.exploreDesc',
            'Browse community templates, ready-made chains, and shared projects.',
          )}
        </p>
        <button style={ctaBtnStyle} onClick={() => navigate('/explore')}>
          {t('sidebar.openExplore', 'Open Explore')}
        </button>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  padding: '1rem',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}

const heroStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  padding: '2rem 1rem',
  gap: '0.5rem',
}

const titleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 600,
  margin: 0,
}

const descStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--text-faint)',
  lineHeight: 1.5,
  margin: 0,
}

const ctaBtnStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.45rem 1rem',
  border: '1px solid var(--primary)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--primary-dim)',
  color: 'var(--primary-text)',
  fontFamily: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
}
