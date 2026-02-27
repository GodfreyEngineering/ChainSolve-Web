import { useCallback, useEffect, useRef, useState } from 'react'
import {
  computeNextFocusIdx,
  isSeparator,
  isSubmenu,
  type MenuEntry,
  type MenuItem,
} from './dropdownMenuTypes'

// Re-export types only (functions live in dropdownMenuTypes.ts)
export type { MenuEntry, MenuItem, MenuSeparator, MenuSubmenu } from './dropdownMenuTypes'

// ── Component ────────────────────────────────────────────────────────────────

export interface DropdownMenuProps {
  label: string
  items: MenuEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onHoverTrigger?: () => void
}

export function DropdownMenu({
  label,
  items,
  open,
  onOpenChange,
  onHoverTrigger,
}: DropdownMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [subOpen, setSubOpen] = useState<number | null>(null)

  // Wrap close to also reset internal state
  const doClose = useCallback(() => {
    setFocusIdx(-1)
    setSubOpen(null)
    onOpenChange(false)
  }, [onOpenChange])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      doClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, doClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        doClose()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, doClose])

  const handleTriggerClick = useCallback(() => {
    if (open) {
      doClose()
    } else {
      onOpenChange(true)
    }
  }, [open, onOpenChange, doClose])

  const handleTriggerMouseEnter = useCallback(() => {
    onHoverTrigger?.()
  }, [onHoverTrigger])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenChange(true)
          setFocusIdx(0)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setFocusIdx(computeNextFocusIdx(focusIdx, 'ArrowDown', items))
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setFocusIdx(computeNextFocusIdx(focusIdx, 'ArrowUp', items))
          break
        }
        case 'ArrowRight': {
          const item = items[focusIdx]
          if (item && isSubmenu(item)) {
            e.preventDefault()
            setSubOpen(focusIdx)
          }
          break
        }
        case 'ArrowLeft': {
          if (subOpen !== null) {
            e.preventDefault()
            setSubOpen(null)
          }
          break
        }
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const item = items[focusIdx]
          if (!item) break
          if (isSubmenu(item)) {
            setSubOpen(focusIdx)
          } else if (!isSeparator(item) && !item.disabled && item.onClick) {
            item.onClick()
            doClose()
          }
          break
        }
      }
    },
    [open, focusIdx, items, onOpenChange, doClose, subOpen],
  )

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleTriggerClick}
        onMouseEnter={handleTriggerMouseEnter}
        onKeyDown={handleKeyDown}
        style={triggerStyle(open)}
      >
        {label}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={label}
          style={panelStyle}
          onKeyDown={handleKeyDown}
        >
          {items.map((entry, i) => {
            if (isSeparator(entry)) {
              return <div key={`sep-${i}`} style={separatorStyle} role="separator" />
            }

            if (isSubmenu(entry)) {
              return (
                <div
                  key={entry.label}
                  role="menuitem"
                  aria-haspopup="true"
                  aria-expanded={subOpen === i}
                  tabIndex={-1}
                  style={itemStyle(focusIdx === i, false)}
                  onMouseEnter={() => {
                    setFocusIdx(i)
                    setSubOpen(i)
                  }}
                  onMouseLeave={() => setSubOpen(null)}
                >
                  <span>{entry.label}</span>
                  <span style={{ marginLeft: 'auto', opacity: 0.4 }}>{'\u25b8'}</span>
                  {subOpen === i && (
                    <div role="menu" style={submenuPanelStyle}>
                      {entry.children.map((child, ci) => {
                        if (isSeparator(child)) {
                          return (
                            <div key={`sub-sep-${ci}`} style={separatorStyle} role="separator" />
                          )
                        }
                        const c = child as MenuItem
                        return (
                          <div
                            key={c.label}
                            role="menuitem"
                            tabIndex={-1}
                            aria-disabled={c.disabled || undefined}
                            style={itemStyle(false, !!c.disabled)}
                            onClick={() => {
                              if (!c.disabled && c.onClick) {
                                c.onClick()
                                doClose()
                              }
                            }}
                          >
                            <span>{c.label}</span>
                            {c.shortcut && <span style={shortcutStyle}>{c.shortcut}</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const item = entry as MenuItem
            return (
              <div
                key={item.label}
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                style={itemStyle(focusIdx === i, !!item.disabled)}
                onMouseEnter={() => {
                  setFocusIdx(i)
                  setSubOpen(null)
                }}
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick()
                    doClose()
                  }
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <span style={shortcutStyle}>{item.shortcut}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

function triggerStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--primary-dim)' : 'transparent',
    border: 'none',
    color: 'var(--text)',
    fontSize: '0.78rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
    cursor: 'pointer',
    lineHeight: 1.2,
  }
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 2,
  minWidth: 200,
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.3rem 0',
  zIndex: 100,
  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
}

const submenuPanelStyle: React.CSSProperties = {
  position: 'absolute',
  top: -4,
  left: '100%',
  marginLeft: 2,
  minWidth: 180,
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.3rem 0',
  zIndex: 101,
  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
}

function itemStyle(focused: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.4rem 0.75rem',
    fontSize: '0.8rem',
    color: disabled ? 'var(--text-muted)' : 'var(--text)',
    cursor: disabled ? 'default' : 'pointer',
    background: focused ? 'var(--primary-dim)' : 'transparent',
    position: 'relative',
    userSelect: 'none',
  }
}

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '0.3rem 0.5rem',
}

const shortcutStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '0.7rem',
  opacity: 0.4,
  fontFamily: "'JetBrains Mono', monospace",
}
