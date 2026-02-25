/**
 * QuickAddPalette — floating block picker.
 *
 * Triggered by "Add block here" in the canvas context menu.
 * Appears at the right-click cursor position, auto-focuses search,
 * and supports keyboard navigation (↑ ↓ Enter ESC).
 */

import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { BLOCK_REGISTRY, CATEGORY_ORDER, type BlockDef } from '../../blocks/registry'
import { trackBlockUsed } from './BlockLibrary'

interface QuickAddPaletteProps {
  /** Screen X (px) where the palette should anchor */
  screenX: number
  /** Screen Y (px) where the palette should anchor */
  screenY: number
  /** Called with the chosen block type when user commits a selection */
  onAdd: (blockType: string) => void
  /** Called when user dismisses without selecting */
  onClose: () => void
}

// Flatten all blocks ordered by category
function buildAllBlocks(): BlockDef[] {
  return CATEGORY_ORDER.flatMap(cat =>
    [...BLOCK_REGISTRY.values()].filter(d => d.category === cat),
  )
}

const ALL_BLOCKS = buildAllBlocks()

export function QuickAddPalette({ screenX, screenY, onAdd, onClose }: QuickAddPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-focus search on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? ALL_BLOCKS.filter(d => d.label.toLowerCase().includes(q) || d.type.includes(q))
    : ALL_BLOCKS

  const clampedIdx = Math.min(activeIdx, Math.max(0, filtered.length - 1))

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.children[clampedIdx] as HTMLElement | undefined
    active?.scrollIntoView({ block: 'nearest' })
  }, [clampedIdx])

  const commit = (def: BlockDef) => {
    trackBlockUsed(def.type)
    onAdd(def.type)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const def = filtered[clampedIdx]
      if (def) commit(def)
    }
  }

  // Keep palette on-screen
  const PALETTE_W = 214
  const PALETTE_H = 340
  const left = Math.min(screenX + 4, window.innerWidth - PALETTE_W - 8)
  const top = Math.min(screenY + 4, window.innerHeight - PALETTE_H - 8)

  return (
    <>
      {/* Invisible overlay — captures outside clicks */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1001 }}
        onClick={onClose}
        onContextMenu={e => { e.preventDefault(); onClose() }}
      />

      <div
        style={{
          position: 'fixed',
          left,
          top,
          zIndex: 1002,
          width: PALETTE_W,
          maxHeight: PALETTE_H,
          background: '#2c2c2c',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Montserrat', system-ui, sans-serif",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.35rem 0.65rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'rgba(244,244,243,0.35)',
              textTransform: 'uppercase',
              userSelect: 'none',
            }}
          >
            Add Block
          </span>
          <span
            style={{
              fontSize: '0.6rem',
              color: 'rgba(244,244,243,0.25)',
              fontFamily: "'JetBrains Mono', monospace",
              userSelect: 'none',
            }}
          >
            ↑↓ · ↵ add · ESC
          </span>
        </div>

        {/* Search */}
        <div
          style={{
            padding: '0.3rem 0.45rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setActiveIdx(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Filter blocks…"
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 6,
              color: '#F4F4F3',
              fontSize: '0.8rem',
              padding: '0.3rem 0.5rem',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Block list */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, paddingBottom: '0.2rem' }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '1.2rem',
                textAlign: 'center',
                fontSize: '0.78rem',
                color: 'rgba(244,244,243,0.25)',
              }}
            >
              No blocks match
            </div>
          ) : (
            filtered.map((def, i) => {
              const isActive = i === clampedIdx
              return (
                <div
                  key={def.type}
                  onClick={() => commit(def)}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(28,171,176,0.14)' : 'transparent',
                    color: isActive ? '#1CABB0' : '#F4F4F3',
                    borderLeft: `2px solid ${isActive ? '#1CABB0' : 'transparent'}`,
                    userSelect: 'none',
                  }}
                >
                  {def.label}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
