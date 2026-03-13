/**
 * TourPromptModal — shown after first-run setup to ask if the user
 * wants a guided tour.
 *
 * 3.19: "Would you like a quick tour?" with opt-in/opt-out buttons.
 */

import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'

interface Props {
  open: boolean
  onAccept: () => void
  onDecline: () => void
}

export function TourPromptModal({ open, onAccept, onDecline }: Props) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onDecline} title={t('tour.promptTitle', 'Welcome to ChainSolve!')} width={400}>
      <p style={descStyle}>
        {t(
          'tour.promptDesc',
          "We have a quick interactive tour that shows you how everything works. It only takes a minute.",
        )}
      </p>
      <div style={btnRow}>
        <button style={primaryBtn} onClick={onAccept}>
          {t('tour.accept', 'Yes, show me around')}
        </button>
        <button style={secondaryBtn} onClick={onDecline}>
          {t('tour.decline', "No thanks, I'll explore on my own")}
        </button>
      </div>
      <p style={hintStyle}>
        {t('tour.restartHint', 'You can always restart the tour from the Help menu.')}
      </p>
    </Modal>
  )
}

const descStyle: React.CSSProperties = {
  margin: '0 0 1.25rem 0',
  fontSize: '0.88rem',
  lineHeight: 1.5,
  opacity: 0.75,
}

const btnRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const primaryBtn: React.CSSProperties = {
  padding: '0.65rem 1rem',
  border: 'none',
  borderRadius: 8,
  background: 'var(--primary)',
  color: 'var(--color-on-primary)',
  fontSize: '0.88rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  width: '100%',
}

const secondaryBtn: React.CSSProperties = {
  padding: '0.65rem 1rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  width: '100%',
  opacity: 0.7,
}

const hintStyle: React.CSSProperties = {
  margin: '1rem 0 0 0',
  fontSize: '0.75rem',
  opacity: 0.45,
  textAlign: 'center',
}
