import { useEffect, useState } from 'react'

export const MOBILE_BP = 900
export const TABLET_BP = 1024

export type Breakpoint = 'phone' | 'tablet' | 'desktop'

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BP : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return mobile
}

/** K3-1: Detect portrait orientation (height > width). */
export function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
  )
  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setPortrait(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return portrait
}

/** K3-1: Multi-level breakpoint: phone (<900px), tablet (900–1024px), desktop (>1024px). */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop'
    const w = window.innerWidth
    if (w < MOBILE_BP) return 'phone'
    if (w < TABLET_BP) return 'tablet'
    return 'desktop'
  })
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w < MOBILE_BP) return 'phone' as const
      if (w < TABLET_BP) return 'tablet' as const
      return 'desktop' as const
    }
    const handler = () => setBp(compute())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return bp
}
