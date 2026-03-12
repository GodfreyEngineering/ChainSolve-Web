/**
 * DangerZoneSettings — ACCT-01: Account deletion flow.
 *
 * Shows a "Delete Account" button. When clicked, opens a two-step
 * confirmation dialog:
 *   Step 1: Summary of what will be deleted + Stripe cancellation notice.
 *   Step 2: Type "DELETE" to confirm.
 *
 * On confirmation: calls deleteMyAccount(), then signs out and redirects
 * to the homepage with a ?deleted=1 query param.
 */

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteMyAccount, signOut } from '../../lib/auth'

type Step = 'idle' | 'confirm1' | 'confirm2' | 'deleting' | 'error'

export function DangerZoneSettings() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('idle')
  const [confirmText, setConfirmText] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleOpenDialog = useCallback(() => {
    setStep('confirm1')
    setConfirmText('')
    setErrorMsg(null)
  }, [])

  const handleProceedToStep2 = useCallback(() => {
    setStep('confirm2')
    setConfirmText('')
  }, [])

  const handleCancel = useCallback(() => {
    setStep('idle')
    setConfirmText('')
    setErrorMsg(null)
  }, [])

  const handleDelete = useCallback(async () => {
    if (confirmText !== 'DELETE') return
    setStep('deleting')
    setErrorMsg(null)
    const { error } = await deleteMyAccount()
    if (error) {
      setStep('error')
      setErrorMsg(error)
      return
    }
    // Sign out locally (the auth user row is already deleted server-side)
    await signOut()
    window.location.href = '/?deleted=1'
  }, [confirmText])

  return (
    <div>
      <h2 style={headingStyle}>{t('settings.dangerZone', 'Danger Zone')}</h2>

      <div style={dangerCardStyle}>
        <div style={dangerRowStyle}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f87171' }}>
              {t('settings.deleteAccountTitle', 'Delete account')}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>
              {t(
                'settings.deleteAccountDesc',
                'Permanently delete your account, all projects, and all data. This cannot be undone.',
              )}
            </div>
          </div>
          <button style={dangerBtn} onClick={handleOpenDialog} disabled={step === 'deleting'}>
            {t('settings.deleteAccount', 'Delete account')}
          </button>
        </div>
      </div>

      {/* Step 1: What will be deleted */}
      {step === 'confirm1' && (
        <div style={overlayStyle} onClick={handleCancel}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>
              {t('settings.deleteAccountConfirmTitle', 'Delete your account?')}
            </h3>
            <p style={dialogText}>
              {t('settings.deleteAccountWarning', 'The following will be permanently deleted:')}
            </p>
            <ul style={deleteList}>
              <li>{t('settings.deleteAccountItem1', 'All projects and canvases')}</li>
              <li>{t('settings.deleteAccountItem2', 'All uploaded files and assets')}</li>
              <li>{t('settings.deleteAccountItem3', 'Your profile and account settings')}</li>
              <li>
                {t(
                  'settings.deleteAccountItem4',
                  'Active subscription (cancelled immediately, no refund)',
                )}
              </li>
            </ul>
            <p style={{ ...dialogText, color: '#f87171', fontWeight: 600 }}>
              {t('settings.deleteAccountFinal', 'This action is irreversible.')}
            </p>
            <div style={dialogBtns}>
              <button style={cancelBtn} onClick={handleCancel}>
                {t('settings.cancel', 'Cancel')}
              </button>
              <button style={dangerBtn} onClick={handleProceedToStep2}>
                {t('settings.deleteAccountContinue', 'Continue to deletion')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Type DELETE */}
      {step === 'confirm2' && (
        <div style={overlayStyle} onClick={handleCancel}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>
              {t('settings.deleteAccountFinalTitle', 'Final confirmation')}
            </h3>
            <p style={dialogText}>
              {t('settings.deleteAccountTypePrompt', 'Type')} <strong>DELETE</strong>{' '}
              {t('settings.deleteAccountTypeConfirm', 'to permanently delete your account:')}
            </p>
            <input
              style={confirmInput}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && confirmText === 'DELETE') void handleDelete()
                if (e.key === 'Escape') handleCancel()
              }}
            />
            <div style={dialogBtns}>
              <button style={cancelBtn} onClick={handleCancel}>
                {t('settings.cancel', 'Cancel')}
              </button>
              <button
                style={{ ...dangerBtn, opacity: confirmText !== 'DELETE' ? 0.4 : 1 }}
                disabled={confirmText !== 'DELETE'}
                onClick={() => void handleDelete()}
              >
                {t('settings.deleteAccountFinalBtn', 'Permanently delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deleting state overlay */}
      {step === 'deleting' && (
        <div style={overlayStyle}>
          <div style={{ ...dialogStyle, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              {t('settings.deleteAccountProgress', 'Deleting your account\u2026')}
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {step === 'error' && (
        <div style={overlayStyle} onClick={handleCancel}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <h3
              style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: '#f87171' }}
            >
              {t('settings.deleteAccountError', 'Deletion failed')}
            </h3>
            <p style={dialogText}>{errorMsg}</p>
            <p style={{ ...dialogText, opacity: 0.6 }}>
              {t(
                'settings.deleteAccountErrorHint',
                'Please try again or contact support if the problem persists.',
              )}
            </p>
            <div style={dialogBtns}>
              <button style={cancelBtn} onClick={handleCancel}>
                {t('settings.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: '0 0 1.25rem',
  fontSize: '1.15rem',
  fontWeight: 700,
}

const dangerCardStyle: React.CSSProperties = {
  border: '1px solid rgba(248, 113, 113, 0.3)',
  borderRadius: 12,
  padding: '1.25rem 1.5rem',
  background: 'rgba(248, 113, 113, 0.05)',
}

const dangerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1.5rem',
}

const dangerBtn: React.CSSProperties = {
  padding: '0.45rem 1rem',
  border: '1px solid #f87171',
  borderRadius: 6,
  background: 'transparent',
  color: '#f87171',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
}

const dialogStyle: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.75rem',
  maxWidth: 440,
  width: '90vw',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

const dialogText: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.85rem',
  lineHeight: 1.5,
}

const deleteList: React.CSSProperties = {
  margin: '0 0 1rem 1.25rem',
  padding: 0,
  fontSize: '0.82rem',
  lineHeight: 1.7,
}

const dialogBtns: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1.25rem',
}

const cancelBtn: React.CSSProperties = {
  padding: '0.45rem 1rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'transparent',
  color: 'inherit',
  fontWeight: 500,
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const confirmInput: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg)',
  color: 'inherit',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  letterSpacing: '0.05em',
  boxSizing: 'border-box',
}
