import { useState, useRef, useCallback, useEffect, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  side?: TooltipSide
  shortcut?: string
  delay?: number
  disabled?: boolean
  /** Display mode for the wrapper element. Default 'inline-flex'. Use 'block' for full-width children. */
  display?: 'inline-flex' | 'block' | 'flex'
}

const ARROW_OFFSET = 8
const VIEWPORT_PAD = 8

const tooltipStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-tooltip, 10000)' as unknown as number,
  padding: '6px 10px',
  borderRadius: 8,
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  color: 'var(--tooltip-text)',
  fontSize: '0.72rem',
  lineHeight: 1.4,
  maxWidth: 240,
  pointerEvents: 'none' as const,
  whiteSpace: 'pre-line' as const,
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  animation: 'cs-fade-in var(--transition-tooltip) ease',
}

const kbdStyle: CSSProperties = {
  display: 'inline-block',
  marginLeft: 6,
  padding: '1px 5px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  fontSize: '0.62rem',
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-faint)',
  verticalAlign: 'middle',
  lineHeight: 1.4,
}

function computePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferredSide: TooltipSide,
): { top: number; left: number; actualSide: TooltipSide } {
  const { innerWidth: vw, innerHeight: vh } = window

  const positions: Record<TooltipSide, { top: number; left: number }> = {
    top: {
      top: triggerRect.top - tooltipRect.height - ARROW_OFFSET,
      left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
    },
    bottom: {
      top: triggerRect.bottom + ARROW_OFFSET,
      left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
    },
    left: {
      top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
      left: triggerRect.left - tooltipRect.width - ARROW_OFFSET,
    },
    right: {
      top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
      left: triggerRect.right + ARROW_OFFSET,
    },
  }

  // Try preferred side first, then flip if out of viewport
  const tryOrder: TooltipSide[] = [preferredSide]
  const opposite: Record<TooltipSide, TooltipSide> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  }
  tryOrder.push(opposite[preferredSide])
  // Add remaining sides
  for (const s of ['top', 'bottom', 'left', 'right'] as TooltipSide[]) {
    if (!tryOrder.includes(s)) tryOrder.push(s)
  }

  for (const side of tryOrder) {
    const pos = positions[side]
    if (
      pos.top >= VIEWPORT_PAD &&
      pos.left >= VIEWPORT_PAD &&
      pos.top + tooltipRect.height <= vh - VIEWPORT_PAD &&
      pos.left + tooltipRect.width <= vw - VIEWPORT_PAD
    ) {
      return { ...pos, actualSide: side }
    }
  }

  // Fallback: clamp to viewport
  const pos = positions[preferredSide]
  return {
    top: Math.max(VIEWPORT_PAD, Math.min(pos.top, vh - tooltipRect.height - VIEWPORT_PAD)),
    left: Math.max(VIEWPORT_PAD, Math.min(pos.left, vw - tooltipRect.width - VIEWPORT_PAD)),
    actualSide: preferredSide,
  }
}

export function Tooltip({
  children,
  content,
  side = 'top',
  shortcut,
  delay = 350,
  disabled = false,
  display = 'inline-flex',
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(
    0 as unknown as ReturnType<typeof setTimeout>,
  )

  const show = useCallback(() => {
    if (disabled) return
    timerRef.current = setTimeout(() => {
      setVisible(true)
    }, delay)
  }, [delay, disabled])

  const hide = useCallback(() => {
    clearTimeout(timerRef.current)
    setVisible(false)
    setPosition(null)
  }, [])

  // Position once visible and rendered
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const pos = computePosition(triggerRect, tooltipRect, side)
    setPosition({ top: pos.top, left: pos.left })
  }, [visible, side])

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display, alignItems: display !== 'block' ? 'center' : undefined }}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              ...tooltipStyle,
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              opacity: position ? 1 : 0,
            }}
          >
            {content}
            {shortcut && <kbd style={kbdStyle}>{shortcut}</kbd>}
          </div>,
          document.body,
        )}
    </>
  )
}
