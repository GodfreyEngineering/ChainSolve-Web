import { useCallback, useEffect, useRef, useState } from 'react'

interface ScrollShadowState {
  showTop: boolean
  showBottom: boolean
}

/**
 * Tracks scroll position of a container and returns which scroll-shadow
 * CSS classes should be applied (top, bottom, or both).
 *
 * Usage:
 * ```tsx
 * const { ref, className } = useScrollShadow()
 * return <div ref={ref} className={className} style={{ overflow: 'auto' }}>...</div>
 * ```
 */
export function useScrollShadow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [state, setState] = useState<ScrollShadowState>({ showTop: false, showBottom: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const threshold = 4
    setState({
      showTop: scrollTop > threshold,
      showBottom: scrollTop + clientHeight < scrollHeight - threshold,
    })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    // Also update on resize
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [update])

  let className = ''
  if (state.showTop && state.showBottom) className = 'cs-scroll-shadow-both'
  else if (state.showTop) className = 'cs-scroll-shadow-top'
  else if (state.showBottom) className = 'cs-scroll-shadow-bottom'

  return { ref, className, ...state }
}
