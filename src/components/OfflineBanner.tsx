/**
 * OfflineBanner — Persistent banner shown when the browser is offline.
 *
 * Reads save status from projectStore and online state from the browser
 * to determine whether to show the banner and what message to display.
 *
 * "Offline" — no network and no pending save yet
 * "Queued — offline" — a save was queued while offline
 */

import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectStore } from '../stores/projectStore'

export const OfflineBanner = memo(function OfflineBanner() {
  const { t } = useTranslation()
  const saveStatus = useProjectStore((s) => s.saveStatus)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const hasPendingSave = saveStatus === 'offline-queued'
  if (!isOffline && !hasPendingSave) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--warning, #f59e0b)',
        color: '#000',
        textAlign: 'center',
        padding: '6px 16px',
        fontSize: '0.8rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {hasPendingSave ? t('canvas.offlineQueued') : t('canvas.offline')}
    </div>
  )
})
