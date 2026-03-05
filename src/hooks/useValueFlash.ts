import { useCallback, useEffect, useState } from 'react'

/**
 * Returns a boolean that flips to `true` for ~300ms whenever `value` changes
 * (after the initial render). Used to trigger a flash animation on value badges.
 */
export function useValueFlash(value: unknown): boolean {
  const [flash, setFlash] = useState(false)
  const [prev, setPrev] = useState(value)

  const startFlash = useCallback(() => {
    setFlash(true)
  }, [])

  // Detect value change via state comparison (no refs)
  if (prev !== value) {
    setPrev(value)
    startFlash()
  }

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 300)
    return () => clearTimeout(t)
  }, [flash])

  return flash
}
