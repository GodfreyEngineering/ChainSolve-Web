/**
 * useNetworkStatus — Reactively tracks browser online/offline state.
 *
 * Returns the current network connectivity from navigator.onLine and
 * updates whenever the window fires 'online' or 'offline' events.
 */
import { useEffect, useState } from 'react'

export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline }
}
