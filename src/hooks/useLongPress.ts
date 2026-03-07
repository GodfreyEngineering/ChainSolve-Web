import { useCallback, useRef } from 'react'

const LONG_PRESS_MS = 500

/**
 * Returns touch handlers that fire `onLongPress` after a sustained press.
 * Movement beyond `moveTolerance` px cancels the gesture.
 * Prevents the default context menu on touch so ours replaces it.
 */
export function useLongPress(
  onLongPress: (e: React.TouchEvent) => void,
  { enabled = true, moveTolerance = 10 }: { enabled?: boolean; moveTolerance?: number } = {},
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return
      firedRef.current = false
      const touch = e.touches[0]
      startRef.current = { x: touch.clientX, y: touch.clientY }
      timerRef.current = setTimeout(() => {
        firedRef.current = true
        onLongPress(e)
      }, LONG_PRESS_MS)
    },
    [enabled, onLongPress],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startRef.current || !timerRef.current) return
      const touch = e.touches[0]
      const dx = touch.clientX - startRef.current.x
      const dy = touch.clientY - startRef.current.y
      if (Math.abs(dx) > moveTolerance || Math.abs(dy) > moveTolerance) {
        clear()
      }
    },
    [clear, moveTolerance],
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (firedRef.current) {
        // Prevent the tap from propagating after a long-press
        e.preventDefault()
      }
      clear()
    },
    [clear],
  )

  const onContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // On touch devices, suppress the native context menu so ours shows instead
    if (firedRef.current) {
      e.preventDefault()
    }
  }, [])

  return { onTouchStart, onTouchMove, onTouchEnd, onContextMenu }
}
