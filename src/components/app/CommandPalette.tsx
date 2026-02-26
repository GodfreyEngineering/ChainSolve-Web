/**
 * CommandPalette — search-first overlay for fast action access.
 *
 * Triggered by Ctrl+K on desktop and by the ⋯ overflow button on mobile.
 * Groups actions by menu section, supports keyboard navigation.
 */

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { filterActions, type PaletteAction } from '../../lib/actions'

export interface CommandPaletteProps {
  actions: PaletteAction[]
  onClose: () => void
}

export function CommandPalette({ actions, onClose }: CommandPaletteProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, true)

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const filtered = filterActions(actions, query)
  const clampedIdx = Math.min(activeIdx, Math.max(0, filtered.length - 1))

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.children[clampedIdx] as HTMLElement | undefined
    active?.scrollIntoView({ block: 'nearest' })
  }, [clampedIdx])

  const selectAction = useCallback(
    (action: PaletteAction) => {
      if (action.disabled) return
      onClose()
      action.execute()
    },
    [onClose],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1 >= filtered.length ? 0 : i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 < 0 ? filtered.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const action = filtered[clampedIdx]
      if (action) selectAction(action)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div style={backdropStyle} onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.title')}
        style={panelStyle}
      >
        {/* Search row */}
        <div style={searchRowStyle}>
          <span style={searchIconStyle} aria-hidden>
            &#x2315;
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIdx(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={t('commandPalette.placeholder')}
            style={inputStyle}
            aria-label={t('commandPalette.placeholder')}
          />
          <kbd style={kbdStyle}>ESC</kbd>
        </div>

        {/* Divider */}
        <div style={dividerStyle} />

        {/* Results */}
        <div ref={listRef} role="listbox" style={listStyle}>
          {filtered.length === 0 ? (
            <div style={emptyStyle}>{t('commandPalette.noResults')}</div>
          ) : (
            filtered.map((action, i) => {
              const isActive = i === clampedIdx
              return (
                <div
                  key={action.id}
                  role="option"
                  aria-selected={isActive}
                  aria-disabled={action.disabled || undefined}
                  onClick={() => selectAction(action)}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={itemStyle(isActive, action.disabled)}
                >
                  <span style={groupBadgeStyle}>{action.group}</span>
                  <span style={labelStyle(isActive)}>{action.label}</span>
                  {action.shortcut && <kbd style={shortcutStyle}>{action.shortcut}</kbd>}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <span style={hintStyle}>{t('commandPalette.hint')}</span>
        </div>
      </div>
    </>
  )
}

/* ── Styles ──────────────────────────────────────────────────────────────────── */

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9500,
  background: 'rgba(0,0,0,0.5)',
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: '20%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 520,
  maxWidth: '92vw',
  maxHeight: '60vh',
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 9501,
  fontFamily: "'Montserrat', system-ui, sans-serif",
}

const searchRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.65rem 0.85rem',
  gap: '0.5rem',
}

const searchIconStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: 'var(--text-muted)',
  flexShrink: 0,
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--text)',
  fontSize: '1rem',
  fontFamily: 'inherit',
}

const kbdStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  padding: '0.1rem 0.4rem',
  borderRadius: 4,
  border: '1px solid var(--border)',
  fontFamily: "'JetBrains Mono', monospace",
  flexShrink: 0,
}

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0.3rem 0',
  maxHeight: 320,
}

const emptyStyle: React.CSSProperties = {
  padding: '2rem 1rem',
  textAlign: 'center',
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
  opacity: 0.6,
}

function itemStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 0.85rem',
    cursor: disabled ? 'default' : 'pointer',
    background: active ? 'var(--primary-dim)' : 'transparent',
    opacity: disabled ? 0.4 : 1,
    fontSize: '0.82rem',
  }
}

const groupBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  minWidth: 80,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

function labelStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    color: active ? 'var(--primary)' : 'var(--text)',
    fontWeight: active ? 600 : 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}

const shortcutStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '0.65rem',
  opacity: 0.45,
  fontFamily: "'JetBrains Mono', monospace",
  padding: '0.1rem 0.35rem',
  borderRadius: 3,
  border: '1px solid var(--border)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
}

const footerStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
  padding: '0.4rem 0.85rem',
}

const hintStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  fontFamily: "'JetBrains Mono', monospace",
}
