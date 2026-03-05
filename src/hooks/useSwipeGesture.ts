import { useEffect, useRef, type RefObject } from 'react'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

interface SwipeConfig {
  direction: SwipeDirection
  threshold?: number
  onSwipe: () => void
  enabled?: boolean
}

/**
 * Detects a single-finger swipe gesture on a ref element.
 * Fires `onSwipe` when the finger moves past `threshold` px in the configured direction.
 */
export function useSwipeGesture(ref: RefObject<HTMLElement | null>, config: SwipeConfig) {
  const { direction, threshold = 50, onSwipe, enabled = true } = config
  const startRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    function handleStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    function handleEnd(e: TouchEvent) {
      if (!startRef.current || e.changedTouches.length !== 1) return
      const dx = e.changedTouches[0].clientX - startRef.current.x
      const dy = e.changedTouches[0].clientY - startRef.current.y
      startRef.current = null

      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      // Determine if swipe is primarily horizontal or vertical
      const isHorizontal = absDx > absDy
      const isVertical = absDy > absDx

      if (direction === 'left' && isHorizontal && dx < -threshold) onSwipe()
      else if (direction === 'right' && isHorizontal && dx > threshold) onSwipe()
      else if (direction === 'up' && isVertical && dy < -threshold) onSwipe()
      else if (direction === 'down' && isVertical && dy > threshold) onSwipe()
    }

    el.addEventListener('touchstart', handleStart, { passive: true })
    el.addEventListener('touchend', handleEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleStart)
      el.removeEventListener('touchend', handleEnd)
    }
  }, [ref, direction, threshold, onSwipe, enabled])
}
