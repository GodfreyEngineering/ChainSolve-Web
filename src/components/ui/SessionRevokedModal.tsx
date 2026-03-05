/**
 * SessionRevokedModal — H9-1: Shown when the current session has been
 * revoked (e.g. the user signed in on another device).
 *
 * Non-dismissible: the user must sign in again.
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { signOut } from '../../lib/auth'
import { Modal } from './Modal'

interface SessionRevokedModalProps {
  open: boolean
}

export function SessionRevokedModal({ open }: SessionRevokedModalProps) {
  const { t } = useTranslation()

  const handleSignIn = useCallback(async () => {
    await signOut()
    window.location.assign('/login')
  }, [])

  // Use a no-op onClose since modal is non-dismissible (sign-in is required)
  return (
    <Modal open={open} onClose={handleSignIn} title={t('session.revokedTitle')} width={420}>
      <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', lineHeight: 1.5 }}>
        {t('session.revokedMessage')}
      </p>
      <button
        onClick={handleSignIn}
        style={{
          width: '100%',
          padding: '0.65rem 0',
          borderRadius: 8,
          border: 'none',
          background: 'var(--primary)',
          color: 'var(--color-on-primary)',
          fontWeight: 700,
          fontSize: '0.9rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {t('session.signInAgain')}
      </button>
    </Modal>
  )
}
