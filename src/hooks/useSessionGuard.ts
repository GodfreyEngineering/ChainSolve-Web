/**
 * useSessionGuard — L3-1: Robust session validity monitoring.
 *
 * Centralised session-polling logic used by WorkspacePage and
 * CanvasPage. Single hook that:
 *
 *   1. Polls `isSessionValid()` every SESSION_CHECK_INTERVAL_MS.
 *   2. Checks immediately when the tab regains visibility
 *      (document.visibilitychange) so revocations are detected
 *      as soon as the user returns to the tab.
 *   3. Subscribes to BroadcastChannel so that when *any* tab
 *      detects revocation, all tabs are notified instantly.
 *   4. Broadcasts to other tabs when revocation is detected.
 *
 * Returns `{ sessionRevoked: boolean }`.
 */

import { useEffect, useRef, useState } from 'react'
import { isSessionValid, SESSION_CHECK_INTERVAL_MS } from '../lib/sessionService'
import { broadcastSessionRevoked, onSessionRevoked } from '../lib/sessionBroadcast'

export function useSessionGuard(): { sessionRevoked: boolean } {
  const [sessionRevoked, setSessionRevoked] = useState(false)
  // Ref to prevent duplicate broadcasts / checks after already revoked.
  const revokedRef = useRef(false)

  useEffect(() => {
    function markRevoked() {
      if (revokedRef.current) return
      revokedRef.current = true
      setSessionRevoked(true)
    }

    async function checkValidity() {
      if (revokedRef.current) return
      const valid = await isSessionValid()
      if (!valid) {
        markRevoked()
        broadcastSessionRevoked()
      }
    }

    // 1. Periodic polling
    const timer = setInterval(checkValidity, SESSION_CHECK_INTERVAL_MS)

    // 2. Visibility change — check when user returns to tab
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkValidity()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // 3. BroadcastChannel — instant notification from other tabs
    const unsub = onSessionRevoked(markRevoked)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      unsub()
    }
  }, [])

  return { sessionRevoked }
}
