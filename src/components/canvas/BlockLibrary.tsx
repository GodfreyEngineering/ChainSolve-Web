/**
 * BlockLibrary — left sidebar showing all available blocks grouped by category.
 * Blocks are draggable onto the canvas.
 */

import { useState, type DragEvent } from 'react'
import {
  BLOCK_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type BlockCategory,
  type BlockDef,
} from '../../blocks/registry'

const DRAG_TYPE = 'application/chainsolve-block'

// Group blocks by category
function buildGrouped(): Map<BlockCategory, BlockDef[]> {
  const map = new Map<BlockCategory, BlockDef[]>()
  for (const cat of CATEGORY_ORDER) map.set(cat, [])
  for (const def of BLOCK_REGISTRY.values()) {
    map.get(def.category)?.push(def)
  }
  return map
}

const GROUPED = buildGrouped()

const s = {
  panel: {
    width: 200,
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    background: 'var(--card-bg)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  searchWrap: {
    padding: '0.5rem',
    borderBottom: '1px solid var(--border)',
  },
  search: {
    width: '100%',
    padding: '0.3rem 0.5rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'inherit',
    fontSize: '0.82rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  scroll: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0.25rem 0',
  },
  catLabel: {
    padding: '0.4rem 0.6rem 0.15rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    opacity: 0.45,
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
  },
  blockItem: {
    padding: '0.3rem 0.6rem',
    fontSize: '0.8rem',
    cursor: 'grab',
    borderRadius: 4,
    margin: '1px 4px',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'background 0.1s',
  },
}

interface BlockItemProps {
  def: BlockDef
}

function BlockItem({ def }: BlockItemProps) {
  const [hovered, setHovered] = useState(false)

  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(DRAG_TYPE, def.type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.blockItem,
        background: hovered ? 'rgba(100,108,255,0.15)' : 'transparent',
      }}
      title={`Drag to add ${def.label}`}
    >
      {def.label}
    </div>
  )
}

export function BlockLibrary() {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  return (
    <div style={s.panel}>
      <div style={s.searchWrap}>
        <input
          style={s.search}
          type="search"
          placeholder="Search blocks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={s.scroll}>
        {CATEGORY_ORDER.map((cat) => {
          const blocks = (GROUPED.get(cat) ?? []).filter(
            (d) => !q || d.label.toLowerCase().includes(q) || d.type.includes(q),
          )
          if (blocks.length === 0) return null

          return (
            <div key={cat}>
              <div style={s.catLabel}>{CATEGORY_LABELS[cat]}</div>
              {blocks.map((def) => (
                <BlockItem key={def.type} def={def} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { DRAG_TYPE }
