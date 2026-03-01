import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'

interface Props {
  open: boolean
  onClose: () => void
  onStartScratch: () => void
  onBrowseTemplates: () => void
  onImport: () => void
}

export function FirstRunModal({
  open,
  onClose,
  onStartScratch,
  onBrowseTemplates,
  onImport,
}: Props) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onClose} title={t('onboarding.title')} width={480}>
      <p style={subtitleStyle}>{t('onboarding.subtitle')}</p>

      <div style={optionsStyle}>
        {/* Start from scratch */}
        <button style={optionBtnStyle} onClick={onStartScratch}>
          <span style={optionIconStyle}>✦</span>
          <span>
            <strong style={optionLabelStyle}>{t('onboarding.scratch')}</strong>
            <span style={optionDescStyle}>{t('onboarding.scratchDesc')}</span>
          </span>
        </button>

        {/* Browse templates via Explore */}
        <button style={optionBtnStyle} onClick={onBrowseTemplates}>
          <span style={optionIconStyle}>⬡</span>
          <span>
            <strong style={optionLabelStyle}>{t('onboarding.template')}</strong>
            <span style={optionDescStyle}>{t('onboarding.templateDesc')}</span>
          </span>
        </button>

        {/* Import project */}
        <button style={optionBtnStyle} onClick={onImport}>
          <span style={optionIconStyle}>⬆</span>
          <span>
            <strong style={optionLabelStyle}>{t('onboarding.import')}</strong>
            <span style={optionDescStyle}>{t('onboarding.importDesc')}</span>
          </span>
        </button>
      </div>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const subtitleStyle: React.CSSProperties = {
  margin: '0 0 1.5rem 0',
  fontSize: '0.88rem',
  opacity: 0.65,
  lineHeight: 1.5,
}

const optionsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const optionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.9rem 1rem',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  fontFamily: 'inherit',
  color: 'var(--text)',
  transition: 'background 0.1s',
}

const optionIconStyle: React.CSSProperties = {
  fontSize: '1.3rem',
  flexShrink: 0,
  width: 28,
  textAlign: 'center',
  color: 'var(--primary)',
}

const optionLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.9rem',
  fontWeight: 600,
  marginBottom: 2,
}

const optionDescStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  opacity: 0.6,
}
