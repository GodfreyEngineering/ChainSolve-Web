import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { BRAND, CONTACT } from '../../lib/brand'
import { BUILD_VERSION, BUILD_SHA } from '../../lib/build-info'

interface Props {
  open: boolean
  onClose: () => void
}

export function AboutModal({ open, onClose }: Props) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onClose} title={t('menu.about')} width={380}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.5rem 0',
        }}
      >
        <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 32 }} />
        <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0, textAlign: 'center' }}>
          {t('app.tagline')}
        </p>
        <span style={versionStyle}>
          v{BUILD_VERSION} ({BUILD_SHA})
        </span>
        <div style={contactStyle}>
          <a href={`mailto:${CONTACT.support}`} style={linkStyle}>
            {t('contact.support')}
          </a>
          <span style={{ opacity: 0.25 }}>|</span>
          <a href={`mailto:${CONTACT.info}`} style={linkStyle}>
            {t('contact.generalEnquiries')}
          </a>
        </div>
      </div>
    </Modal>
  )
}

const versionStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.72rem',
  opacity: 0.4,
}

const contactStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  fontSize: '0.78rem',
}

const linkStyle: React.CSSProperties = {
  color: '#93c5fd',
  textDecoration: 'none',
  opacity: 0.8,
}
