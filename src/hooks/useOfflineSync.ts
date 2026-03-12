/**
 * useOfflineSync — Tracks online/offline status and queues pending saves.
 *
 * When the browser goes offline:
 *   - `isOffline` becomes true so the UI can show a banner.
 *   - Any in-progress autosave is deferred until reconnection.
 *
 * When the browser comes back online:
 *   - `isOffline` becomes false.
 *   - `onReconnect` is called so callers can flush any deferred saves.
 */

import { useEffect, useRef, useState } from 'react'

export interface OfflineSyncOptions {
  /** Called when the network is restored. Use to flush pending saves. */
  onReconnect?: () => void
}

export interface OfflineSyncState {
  isOffline: boolean
  /** True when a save was deferred while offline and is pending retry. */
  hasPendingSave: boolean
  /** Call this when a save fails due to offline so it can be re-queued. */
  markPendingSave: () => void
}

export function useOfflineSync(options?: OfflineSyncOptions): OfflineSyncState {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [hasPendingSave, setHasPendingSave] = useState(false)
  const onReconnectRef = useRef(options?.onReconnect)
  useEffect(() => {
    onReconnectRef.current = options?.onReconnect
  })

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => {
      setIsOffline(false)
      if (hasPendingSave) {
        setHasPendingSave(false)
        onReconnectRef.current?.()
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [hasPendingSave])

  return {
    isOffline,
    hasPendingSave,
    markPendingSave: () => setHasPendingSave(true),
  }
}
