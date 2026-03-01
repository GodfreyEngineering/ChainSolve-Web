/**
 * AdminDangerZone.tsx — E3-1: Admin "Danger Zone" settings tab.
 *
 * Only rendered for users with is_developer or is_admin flags.
 * Provides destructive operations with typed "DELETE" confirmation + re-auth.
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { ReauthModal } from '../../components/ui/ReauthModal'
import { isReauthed } from '../../lib/reauth'
import { deleteAllUserProjects, adminDeleteProject, resetLocalCaches } from '../../lib/adminService'

type PendingAction = 'deleteAllData' | 'deleteProject' | 'resetCaches' | null

export function AdminDangerZone() {
  const { t } = useTranslation()

  // Confirmation input
  const [confirmText, setConfirmText] = useState('')
  const [projectIdInput, setProjectIdInput] = useState('')

  // Operation state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reauth flow
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [showReauth, setShowReauth] = useState(false)

  const isDeleteConfirmed = confirmText === 'DELETE'

  const executeAction = useCallback(
    async (action: PendingAction) => {
      setLoading(true)
      setResult(null)
      setError(null)
      try {
        switch (action) {
          case 'deleteAllData': {
            const count = await deleteAllUserProjects()
            setResult(t('admin.deleteAllSuccess', { count }))
            break
          }
          case 'deleteProject': {
            await adminDeleteProject(projectIdInput.trim())
            setResult(t('admin.deleteProjectSuccess', { id: projectIdInput.trim() }))
            setProjectIdInput('')
            break
          }
          case 'resetCaches': {
            const count = resetLocalCaches()
            setResult(t('admin.resetCachesSuccess', { count }))
            break
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setConfirmText('')
        setPendingAction(null)
      }
    },
    [t, projectIdInput],
  )

  const handleAction = useCallback(
    (action: PendingAction) => {
      if (!isReauthed()) {
        setPendingAction(action)
        setShowReauth(true)
        return
      }
      void executeAction(action)
    },
    [executeAction],
  )

  const handleReauthSuccess = useCallback(() => {
    setShowReauth(false)
    if (pendingAction) {
      void executeAction(pendingAction)
    }
  }, [pendingAction, executeAction])

  return (
    <div>
      <h2 style={headingStyle}>{t('admin.dangerZoneTitle')}</h2>
      <p style={warningBannerStyle}>{t('admin.dangerZoneWarning')}</p>

      {/* Result / Error banners */}
      {result && (
        <div style={successBannerStyle} role="status">
          {result}
        </div>
      )}
      {error && (
        <div style={errorBannerStyle} role="alert">
          {error}
        </div>
      )}

      {/* ── Section 1: Delete All User Data ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t('admin.deleteAllTitle')}</h3>
        <p style={sectionDescStyle}>{t('admin.deleteAllDesc')}</p>
        <div style={actionRowStyle}>
          <Button
            variant="danger"
            size="sm"
            disabled={!isDeleteConfirmed || loading}
            onClick={() => handleAction('deleteAllData')}
          >
            {loading && pendingAction === 'deleteAllData'
              ? t('admin.deleting')
              : t('admin.deleteAllBtn')}
          </Button>
        </div>
      </div>

      {/* ── Section 2: Delete Project by ID ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t('admin.deleteProjectTitle')}</h3>
        <p style={sectionDescStyle}>{t('admin.deleteProjectDesc')}</p>
        <input
          type="text"
          placeholder={t('admin.projectIdPlaceholder')}
          value={projectIdInput}
          onChange={(e) => setProjectIdInput(e.target.value)}
          style={inputStyle}
          disabled={loading}
        />
        <div style={actionRowStyle}>
          <Button
            variant="danger"
            size="sm"
            disabled={!isDeleteConfirmed || !projectIdInput.trim() || loading}
            onClick={() => handleAction('deleteProject')}
          >
            {loading && pendingAction === 'deleteProject'
              ? t('admin.deleting')
              : t('admin.deleteProjectBtn')}
          </Button>
        </div>
      </div>

      {/* ── Section 3: Reset Local Caches ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t('admin.resetCachesTitle')}</h3>
        <p style={sectionDescStyle}>{t('admin.resetCachesDesc')}</p>
        <div style={actionRowStyle}>
          <Button
            variant="danger"
            size="sm"
            disabled={!isDeleteConfirmed || loading}
            onClick={() => handleAction('resetCaches')}
          >
            {loading && pendingAction === 'resetCaches'
              ? t('admin.resetting')
              : t('admin.resetCachesBtn')}
          </Button>
        </div>
      </div>

      {/* ── Typed confirmation ── */}
      <div style={confirmSectionStyle}>
        <label style={confirmLabelStyle} htmlFor="admin-confirm">
          {t('admin.confirmLabel')}
        </label>
        <input
          id="admin-confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          style={inputStyle}
          autoComplete="off"
          disabled={loading}
        />
        {confirmText.length > 0 && !isDeleteConfirmed && (
          <span style={confirmHintStyle}>{t('admin.confirmHint')}</span>
        )}
      </div>

      {/* ── Re-auth modal ── */}
      {showReauth && (
        <ReauthModal
          open={showReauth}
          onClose={() => {
            setShowReauth(false)
            setPendingAction(null)
          }}
          onSuccess={handleReauthSuccess}
        />
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1.1rem',
  fontWeight: 700,
}

const warningBannerStyle: React.CSSProperties = {
  padding: '0.7rem 1rem',
  borderRadius: 8,
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#f87171',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  marginBottom: '1.25rem',
}

const successBannerStyle: React.CSSProperties = {
  padding: '0.6rem 0.85rem',
  borderRadius: 8,
  background: 'rgba(34,197,94,0.08)',
  border: '1px solid rgba(34,197,94,0.25)',
  color: 'var(--success)',
  fontSize: '0.85rem',
  marginBottom: '1rem',
}

const errorBannerStyle: React.CSSProperties = {
  padding: '0.6rem 0.85rem',
  borderRadius: 8,
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#f87171',
  fontSize: '0.85rem',
  marginBottom: '1rem',
}

const sectionStyle: React.CSSProperties = {
  padding: '1rem',
  borderRadius: 8,
  border: '1px solid rgba(239,68,68,0.2)',
  marginBottom: '0.75rem',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 0.3rem',
  fontSize: '0.9rem',
  fontWeight: 600,
}

const sectionDescStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
  lineHeight: 1.45,
}

const actionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.7rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  marginBottom: '0.5rem',
}

const confirmSectionStyle: React.CSSProperties = {
  marginTop: '1.25rem',
  padding: '1rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface2, #2c2c2c)',
}

const confirmLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  marginBottom: '0.4rem',
}

const confirmHintStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#f87171',
  marginTop: '0.25rem',
}
