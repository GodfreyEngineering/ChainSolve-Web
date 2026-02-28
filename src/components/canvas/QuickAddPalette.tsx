/**
 * QuickAddPalette — floating block picker.
 *
 * Triggered by "Add block here" in the canvas context menu.
 * Appears at the right-click cursor position, auto-focuses search,
 * and supports keyboard navigation (↑ ↓ Enter ESC).
 *
 * P069 improvements:
 *  - Category name is searched in addition to label and type.
 *  - When no query: recently-used blocks appear first in a dedicated section,
 *    followed by all blocks grouped by category with visible headers.
 *  - When searching: flat results list (unchanged behaviour).
 */

import { useState, useEffect, useRef, useMemo, type KeyboardEvent } from 'react'
import {
  BLOCK_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type BlockDef,
} from '../../blocks/registry'
import { trackBlockUsed, getRecentlyUsed } from './blockLibraryUtils'
import { type Plan, getEntitlements, isBlockEntitled } from '../../lib/entitlements'

interface QuickAddPaletteProps {
  /** Screen X (px) where the palette should anchor */
  screenX: number
  /** Screen Y (px) where the palette should anchor */
  screenY: number
  /** Called with the chosen block type when user commits a selection */
  onAdd: (blockType: string) => void
  /** Called when user dismisses without selecting */
  onClose: () => void
  plan?: Plan
  onProBlocked?: () => void
}

// ── Block data ────────────────────────────────────────────────────────────────

/** All blocks ordered by category. */
function buildAllBlocks(): BlockDef[] {
  return CATEGORY_ORDER.flatMap((cat) =>
    [...BLOCK_REGISTRY.values()].filter((d) => d.category === cat),
  )
}

const ALL_BLOCKS = buildAllBlocks()

/** Flat search: filter by label, type, or category (P069). */
function filterBlocks(query: string): BlockDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return ALL_BLOCKS
  return ALL_BLOCKS.filter(
    (d) =>
      d.label.toLowerCase().includes(q) ||
      d.type.includes(q) ||
      d.category.toLowerCase().includes(q) ||
      (CATEGORY_LABELS[d.category] ?? d.category).toLowerCase().includes(q),
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickAddPalette({
  screenX,
  screenY,
  onAdd,
  onClose,
  plan = 'free',
  onProBlocked,
}: QuickAddPaletteProps) {
  const ent = getEntitlements(plan)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-focus search on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const isSearching = query.trim().length > 0

  // When searching: flat filtered list
  const filtered = useMemo(() => (isSearching ? filterBlocks(query) : []), [query, isSearching])

  // When idle: recently-used then grouped by category
  const recentTypes = useMemo<string[]>(() => (isSearching ? [] : getRecentlyUsed()), [isSearching])

  const recentBlocks = useMemo<BlockDef[]>(
    () => recentTypes.map((type) => BLOCK_REGISTRY.get(type)).filter((d): d is BlockDef => !!d),
    [recentTypes],
  )

  const groupedBlocks = useMemo<Array<{ category: string; label: string; blocks: BlockDef[] }>>(
    () =>
      isSearching
        ? []
        : CATEGORY_ORDER.map((cat) => ({
            category: cat,
            label: CATEGORY_LABELS[cat] ?? cat,
            blocks: ALL_BLOCKS.filter((d) => d.category === cat),
          })).filter((g) => g.blocks.length > 0),
    [isSearching],
  )

  // Flat list for keyboard navigation
  const navBlocks = useMemo<BlockDef[]>(() => {
    if (isSearching) return filtered
    return [...recentBlocks, ...ALL_BLOCKS]
  }, [isSearching, filtered, recentBlocks])

  const clampedIdx = Math.min(activeIdx, Math.max(0, navBlocks.length - 1))

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector(`[data-nav-idx="${clampedIdx}"]`) as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest' })
  }, [clampedIdx])

  const commit = (def: BlockDef) => {
    if (def.proOnly && !isBlockEntitled(def, ent)) {
      onProBlocked?.()
      return
    }
    trackBlockUsed(def.type)
    onAdd(def.type)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, navBlocks.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const def = navBlocks[clampedIdx]
      if (def) commit(def)
    }
  }

  // Keep palette on-screen
  const PALETTE_W = 240
  const PALETTE_H = 360
  const left = Math.min(screenX + 4, window.innerWidth - PALETTE_W - 8)
  const top = Math.min(screenY + 4, window.innerHeight - PALETTE_H - 8)

  // nav-idx counter shared across all rendered rows
  let navCounter = 0

  return (
    <>
      {/* Invisible overlay — captures outside clicks */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1001 }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
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
        onClick={(e) => e.stopPropagation()}
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
            onChange={(e) => {
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
          {/* ── Searching: flat filtered results ── */}
          {isSearching && (
            <>
              {filtered.length === 0 ? (
                <div style={emptyStyle}>No blocks match</div>
              ) : (
                filtered.map((def) => {
                  const idx = navCounter++
                  const isActive = idx === clampedIdx
                  const locked = !!def.proOnly && !isBlockEntitled(def, ent)
                  return (
                    <BlockRow
                      key={def.type}
                      def={def}
                      isActive={isActive}
                      locked={locked}
                      navIdx={idx}
                      onClick={() => commit(def)}
                      onMouseEnter={() => setActiveIdx(idx)}
                    />
                  )
                })
              )}
            </>
          )}

          {/* ── Idle: recent + grouped ── */}
          {!isSearching && (
            <>
              {recentBlocks.length > 0 && (
                <>
                  <SectionHeader label="Recently used" />
                  {recentBlocks.map((def) => {
                    const idx = navCounter++
                    const isActive = idx === clampedIdx
                    const locked = !!def.proOnly && !isBlockEntitled(def, ent)
                    return (
                      <BlockRow
                        key={`recent-${def.type}`}
                        def={def}
                        isActive={isActive}
                        locked={locked}
                        navIdx={idx}
                        onClick={() => commit(def)}
                        onMouseEnter={() => setActiveIdx(idx)}
                      />
                    )
                  })}
                </>
              )}

              {groupedBlocks.map(({ category, label, blocks }) => (
                <div key={category}>
                  <SectionHeader label={label} />
                  {blocks.map((def) => {
                    const idx = navCounter++
                    const isActive = idx === clampedIdx
                    const locked = !!def.proOnly && !isBlockEntitled(def, ent)
                    return (
                      <BlockRow
                        key={def.type}
                        def={def}
                        isActive={isActive}
                        locked={locked}
                        navIdx={idx}
                        onClick={() => commit(def)}
                        onMouseEnter={() => setActiveIdx(idx)}
                      />
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '0.25rem 0.7rem 0.1rem',
        fontSize: '0.58rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'rgba(244,244,243,0.3)',
        userSelect: 'none',
        marginTop: '0.15rem',
      }}
    >
      {label}
    </div>
  )
}

interface BlockRowProps {
  def: BlockDef
  isActive: boolean
  locked: boolean
  navIdx: number
  onClick: () => void
  onMouseEnter: () => void
}

function BlockRow({ def, isActive, locked, navIdx, onClick, onMouseEnter }: BlockRowProps) {
  return (
    <div
      data-nav-idx={navIdx}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        padding: '0.3rem 0.7rem',
        fontSize: '0.8rem',
        cursor: 'pointer',
        background: isActive ? 'rgba(28,171,176,0.14)' : 'transparent',
        color: isActive ? '#1CABB0' : '#F4F4F3',
        borderLeft: `2px solid ${isActive ? '#1CABB0' : 'transparent'}`,
        userSelect: 'none',
        opacity: locked ? 0.45 : 1,
      }}
    >
      {locked && <span style={{ fontSize: '0.65rem', marginRight: 4 }}>🔒</span>}
      {def.label}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const emptyStyle: React.CSSProperties = {
  padding: '1.2rem',
  textAlign: 'center',
  fontSize: '0.78rem',
  color: 'rgba(244,244,243,0.25)',
}
