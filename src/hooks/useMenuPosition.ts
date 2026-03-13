/**
 * useMenuPosition — clamps a menu position so it stays within the viewport.
 *
 * After the menu renders, its size is measured and the position is flipped
 * horizontally or vertically if it would overflow the screen edge.
 */

import { useLayoutEffect, useRef, useState } from 'react'

const MARGIN = 8

interface MenuPosition {
  left: number
  top: number
}

/**
 * Given an initial (x, y) from the cursor or trigger element, returns a
 * ref for the menu element and the clamped { left, top } to apply.
 */
export function useMenuPosition(x: number, y: number) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<MenuPosition>({ left: x, top: y })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = x
    let top = y

    // Flip horizontally if overflowing right edge
    if (left + rect.width > vw - MARGIN) {
      left = Math.max(MARGIN, x - rect.width)
    }

    // Flip vertically if overflowing bottom edge
    if (top + rect.height > vh - MARGIN) {
      top = Math.max(MARGIN, y - rect.height)
    }

    setPos({ left, top })
  }, [x, y])

  return { menuRef, pos }
}

/**
 * Pure function variant — clamp a position after measuring.
 * Useful for imperative positioning without a React ref.
 */
export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): MenuPosition {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080

  let left = x
  let top = y

  if (left + width > vw - MARGIN) {
    left = Math.max(MARGIN, x - width)
  }
  if (top + height > vh - MARGIN) {
    top = Math.max(MARGIN, y - height)
  }

  return { left, top }
}
