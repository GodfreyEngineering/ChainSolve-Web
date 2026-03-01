/**
 * useDebounce — returns a debounced copy of a value.
 *
 * E11-3: Used to debounce search inputs to avoid excessive API calls.
 */

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
