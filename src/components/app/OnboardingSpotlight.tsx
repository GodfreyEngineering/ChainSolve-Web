/**
 * OnboardingSpotlight — tooltip overlay that highlights a target element.
 *
 * Renders a semi-transparent backdrop with a cutout around the target element,
 * plus a tooltip with step content. Used by the onboarding tutorial to draw
 * attention to specific UI elements.
 *
 * Target elements are found via `[data-tour="stepId"]` attribute.
 * Falls back to centered tooltip if the target element is not found.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export interface SpotlightProps {
  /** The data-tour attribute value to find the target element. */
  targetId: string
  /** Tooltip content. */
  children: ReactNode
  /** Called when backdrop is clicked (dismiss). */
  onBackdropClick?: () => void
  /** Whether the spotlight is visible. */
  open: boolean
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

const PADDING = 8
const TOOLTIP_GAP = 12

export function OnboardingSpotlight({ targetId, children, onBackdropClick, open }: SpotlightProps) {
  const [layout, setLayout] = useState<{
    rect: TargetRect | null
    tooltipPos: { top: number; left: number } | null
  }>({ rect: null, tooltipPos: null })
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const measure = () => {
      const el = document.querySelector(`[data-tour="${targetId}"]`)
      if (!el) {
        setLayout({ rect: null, tooltipPos: null })
        return
      }
      const r = el.getBoundingClientRect()
      const rect: TargetRect = { top: r.top, left: r.left, width: r.width, height: r.height }

      // Compute tooltip position
      let tooltipPos: { top: number; left: number } | null = null
      const tt = tooltipRef.current
      if (tt) {
        const ttRect = tt.getBoundingClientRect()
        const viewH = window.innerHeight
        const viewW = window.innerWidth

        // Try below first
        const belowTop = rect.top + rect.height + PADDING + TOOLTIP_GAP
        let top: number
        if (belowTop + ttRect.height < viewH - 20) {
          top = belowTop
        } else {
          top = rect.top - PADDING - TOOLTIP_GAP - ttRect.height
          if (top < 20) top = 20
        }

        let left = rect.left + rect.width / 2 - ttRect.width / 2
        if (left < 12) left = 12
        if (left + ttRect.width > viewW - 12) left = viewW - 12 - ttRect.width

        tooltipPos = { top, left }
      }

      setLayout({ rect, tooltipPos })
    }

    measure()
    // Re-measure on scroll/resize
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const timer = setTimeout(measure, 100)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      clearTimeout(timer)
    }
  }, [targetId, open])

  const { rect, tooltipPos } = layout

  if (!open) return null

  // Cutout dimensions
  const cutout = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null

  return (
    <div style={backdropStyle} onClick={onBackdropClick}>
      {/* SVG overlay with cutout */}
      <svg style={svgStyle} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {cutout && (
              <rect
                x={cutout.left}
                y={cutout.top}
                width={cutout.width}
                height={cutout.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#spotlight-mask)"
        />
        {/* Highlight border around cutout */}
        {cutout && (
          <rect
            x={cutout.left}
            y={cutout.top}
            width={cutout.width}
            height={cutout.height}
            rx="8"
            fill="none"
            stroke="var(--primary, #1cabb0)"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          ...tooltipStyle,
          ...(tooltipPos ? { top: tooltipPos.top, left: tooltipPos.left } : centeredTooltipStyle),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9500,
  cursor: 'default',
}

const svgStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
}

const tooltipStyle: CSSProperties = {
  position: 'absolute',
  background: 'var(--surface-2, #fff)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 'var(--radius-lg, 12px)',
  padding: '1.25rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  maxWidth: 360,
  width: 'max-content',
  animation: 'cs-fade-in 0.2s ease',
  zIndex: 9501,
}

const centeredTooltipStyle: CSSProperties = {
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
}
