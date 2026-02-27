/**
 * BlockLibrary — collapsible left sidebar.
 *
 * Features:
 * - Search (/ shortcut focuses it)
 * - Category filter tabs
 * - Recently used section (localStorage, top 8)
 * - Favourites (localStorage, star toggle on hover)
 * - Drag to canvas
 */

import { useState, useRef, useEffect, useCallback, type DragEvent } from 'react'
import {
  BLOCK_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type BlockCategory,
  type BlockDef,
} from '../../blocks/registry'
import { type Plan, getEntitlements, isBlockEntitled } from '../../lib/entitlements'
import {
  listTemplates,
  deleteTemplate as deleteTemplateApi,
  renameTemplate as renameTemplateApi,
  type Template,
} from '../../lib/templates'

import { DRAG_TYPE, trackBlockUsed } from './blockLibraryUtils'

// ── localStorage helpers ──────────────────────────────────────────────────────

const RECENT_KEY = 'cs:recent'
const FAV_KEY = 'cs:favs'

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function getFavs(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveFavs(favs: Set<string>): void {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]))
}

// ── Block grouping ────────────────────────────────────────────────────────────

function buildGrouped(): Map<BlockCategory, BlockDef[]> {
  const map = new Map<BlockCategory, BlockDef[]>()
  for (const cat of CATEGORY_ORDER) map.set(cat, [])
  for (const def of BLOCK_REGISTRY.values()) map.get(def.category)?.push(def)
  return map
}

const GROUPED = buildGrouped()

// ── Styles ────────────────────────────────────────────────────────────────────

const px = (v: number) => `${v}px`

type StyleMap = Record<string, React.CSSProperties>
const s: StyleMap = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid rgba(255,255,255,0.08)',
    background: '#2c2c2c',
    height: '100%',
    transition: 'width 0.2s ease',
    position: 'relative',
  },
  topBar: {
    padding: '0.45rem 0.5rem 0.35rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flexShrink: 0,
  },
  searchRow: {
    display: 'flex',
    gap: '0.3rem',
    alignItems: 'center',
  },
  search: {
    flex: 1,
    padding: '0.28rem 0.5rem',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.2)',
    color: '#F4F4F3',
    fontSize: '0.78rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  catFilter: {
    display: 'flex',
    gap: '0.2rem',
    flexWrap: 'wrap',
    paddingTop: '0.1rem',
  },
  catPill: {
    padding: '0.12rem 0.45rem',
    borderRadius: 20,
    fontSize: '0.65rem',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: '#F4F4F3',
    userSelect: 'none',
    transition: 'background 0.1s',
    fontFamily: 'inherit',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.2rem 0 0.5rem',
  },
  sectionLabel: {
    padding: '0.35rem 0.6rem 0.1rem',
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    color: 'rgba(244,244,243,0.35)',
    textTransform: 'uppercase',
    userSelect: 'none',
  },
  blockItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.28rem 0.6rem',
    fontSize: '0.78rem',
    cursor: 'grab',
    borderRadius: 4,
    margin: '1px 4px',
    userSelect: 'none',
    position: 'relative',
  },
  starBtn: {
    position: 'absolute',
    right: 6,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: '0.75rem',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  resizeHandle: {
    position: 'absolute',
    right: -3,
    top: 0,
    bottom: 0,
    width: 6,
    cursor: 'ew-resize',
    zIndex: 10,
  },
}

// ── BlockItem ─────────────────────────────────────────────────────────────────

/** Pro-only categories that require specific entitlements. */
const PRO_CATEGORIES: Set<BlockCategory> = new Set([
  'data',
  'vectorOps',
  'tableOps',
  'plot',
  'finTvm',
  'finReturns',
  'finDepr',
  'statsDesc',
  'statsRel',
  'probComb',
  'probDist',
  'utilCalc',
])

interface BlockItemProps {
  def: BlockDef
  favs: Set<string>
  onToggleFav: (type: string) => void
  entitled: boolean
  onProBlocked?: () => void
}

function BlockItem({ def, favs, onToggleFav, entitled, onProBlocked }: BlockItemProps) {
  const [hovered, setHovered] = useState(false)
  const isFav = favs.has(def.type)

  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (!entitled) {
      e.preventDefault()
      onProBlocked?.()
      return
    }
    e.dataTransfer.setData(DRAG_TYPE, def.type)
    e.dataTransfer.effectAllowed = 'copy'
    trackBlockUsed(def.type)
  }

  return (
    <div
      draggable={entitled}
      onDragStart={onDragStart}
      onClick={!entitled ? onProBlocked : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.blockItem,
        background: hovered ? 'rgba(28,171,176,0.12)' : 'transparent',
        opacity: entitled ? 1 : 0.45,
        cursor: entitled ? 'grab' : 'pointer',
      }}
      title={entitled ? `Drag to add ${def.label}` : `${def.label} (Pro)`}
    >
      {!entitled && <span style={{ fontSize: '0.65rem', marginRight: 4, opacity: 0.6 }}>🔒</span>}
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingRight: hovered ? 20 : 0,
        }}
      >
        {def.label}
      </span>
      {hovered && entitled && (
        <button
          style={{
            ...s.starBtn,
            color: isFav ? '#f59e0b' : 'rgba(255,255,255,0.3)',
          }}
          title={isFav ? 'Remove from favourites' : 'Add to favourites'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFav(def.type)
          }}
        >
          {isFav ? '★' : '☆'}
        </button>
      )}
    </div>
  )
}

// ── TemplateItem ─────────────────────────────────────────────────────────────

interface TemplateItemProps {
  template: Template
  onInsert: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

function TemplateItem({ template, onInsert, onRename, onDelete }: TemplateItemProps) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const nodeCount = template.payload.nodes?.length ?? 0

  return (
    <div
      style={{
        ...s.blockItem,
        background: hovered ? 'rgba(28,171,176,0.12)' : 'transparent',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setMenuOpen(false)
      }}
      onClick={onInsert}
      title={`Insert "${template.name}" (${nodeCount} nodes)`}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: template.color,
          flexShrink: 0,
          marginRight: 4,
        }}
      />
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingRight: hovered ? 24 : 0,
        }}
      >
        {template.name}
      </span>
      <span
        style={{
          fontSize: '0.65rem',
          color: 'rgba(244,244,243,0.35)',
          flexShrink: 0,
        }}
      >
        {nodeCount}n
      </span>
      {hovered && (
        <div style={{ position: 'absolute', right: 6 }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.85rem',
              padding: '0 2px',
              fontFamily: 'inherit',
              lineHeight: 1,
            }}
            title="Template actions"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((p) => !p)
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                background: '#2c2c2c',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                padding: '0.2rem',
                zIndex: 100,
                minWidth: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
            >
              <div
                style={{
                  padding: '0.3rem 0.5rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  borderRadius: 3,
                }}
                role="menuitem"
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(28,171,176,0.15)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  const name = window.prompt('Rename template:', template.name)
                  if (name?.trim()) {
                    onRename(name.trim())
                    setMenuOpen(false)
                  }
                }}
              >
                Rename…
              </div>
              <div
                style={{
                  padding: '0.3rem 0.5rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  borderRadius: 3,
                  color: '#f87171',
                }}
                role="menuitem"
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.12)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                  setMenuOpen(false)
                }}
              >
                Delete
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── BlockLibrary ──────────────────────────────────────────────────────────────

interface BlockLibraryProps {
  width: number
  onResizeStart: (e: React.MouseEvent) => void
  plan?: Plan
  onProBlocked?: () => void
  onInsertTemplate?: (template: Template) => void
}

export function BlockLibrary({
  width,
  onResizeStart,
  plan = 'free',
  onProBlocked,
  onInsertTemplate,
}: BlockLibraryProps) {
  const ent = getEntitlements(plan)
  const [query, setQuery] = useState('')
  const [filterCat, setFilterCat] = useState<BlockCategory | null>(null)
  const [favs, setFavs] = useState<Set<string>>(getFavs)
  const [recent, setRecent] = useState<string[]>(getRecent)
  const searchRef = useRef<HTMLInputElement>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoaded, setTemplatesLoaded] = useState(false)

  // Refresh recent list when panel is focused (user may have added blocks)
  const refreshRecent = useCallback(() => setRecent(getRecent()), [])

  const toggleFav = useCallback((type: string) => {
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      saveFavs(next)
      return next
    })
  }, [])

  // Load templates lazily on first expand
  const loadTemplates = useCallback(() => {
    if (templatesLoaded) return
    setTemplatesLoaded(true)
    listTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [templatesLoaded])

  /** Refresh the templates list (call after save/delete). */
  const refreshTemplates = useCallback(() => {
    listTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [])

  // Press "/" anywhere (not in an input) to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const q = query.trim().toLowerCase()
  const favList = [...BLOCK_REGISTRY.values()].filter((d) => favs.has(d.type))
  const recentList = recent
    .map((t) => BLOCK_REGISTRY.get(t))
    .filter((d): d is BlockDef => d !== undefined)
  const noBlockResults =
    q.length > 0 &&
    CATEGORY_ORDER.filter((cat) => !filterCat || cat === filterCat).every(
      (cat) =>
        (GROUPED.get(cat) ?? []).filter(
          (d) => d.label.toLowerCase().includes(q) || d.type.includes(q),
        ).length === 0,
    )

  return (
    <div style={{ ...s.panel, width: px(width) }} onFocus={refreshRecent}>
      {/* Search + category filter */}
      <div style={s.topBar}>
        <div style={s.searchRow}>
          <input
            ref={searchRef}
            style={s.search}
            type="search"
            placeholder='Search…  ("/" to focus)'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={s.catFilter}>
          <button
            style={{
              ...s.catPill,
              background: !filterCat ? 'rgba(28,171,176,0.2)' : 'transparent',
              borderColor: !filterCat ? '#1CABB0' : undefined,
              color: !filterCat ? '#1CABB0' : undefined,
            }}
            onClick={() => setFilterCat(null)}
          >
            All
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              style={{
                ...s.catPill,
                background: filterCat === cat ? 'rgba(28,171,176,0.2)' : 'transparent',
                borderColor: filterCat === cat ? '#1CABB0' : undefined,
                color: filterCat === cat ? '#1CABB0' : undefined,
              }}
              onClick={() => setFilterCat(cat === filterCat ? null : cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div style={s.scroll}>
        {/* Favourites section */}
        {!q && favList.length > 0 && (
          <div>
            <div style={s.sectionLabel}>Favourites</div>
            {favList.map((def) => (
              <BlockItem
                key={def.type}
                def={def}
                favs={favs}
                onToggleFav={toggleFav}
                entitled={isBlockEntitled(def, ent)}
                onProBlocked={onProBlocked}
              />
            ))}
          </div>
        )}

        {/* Recently used section */}
        {!q && recentList.length > 0 && (
          <div>
            <div style={s.sectionLabel}>Recent</div>
            {recentList.map((def) => (
              <BlockItem
                key={def.type}
                def={def}
                favs={favs}
                onToggleFav={toggleFav}
                entitled={isBlockEntitled(def, ent)}
                onProBlocked={onProBlocked}
              />
            ))}
          </div>
        )}

        {/* Zero search results */}
        {noBlockResults && (
          <div
            style={{
              padding: '0.75rem 0.6rem',
              fontSize: '0.78rem',
              color: 'rgba(244,244,243,0.35)',
              textAlign: 'center',
            }}
          >
            No blocks match &ldquo;{query}&rdquo;
          </div>
        )}

        {/* All blocks by category */}
        {CATEGORY_ORDER.filter((cat) => !filterCat || cat === filterCat).map((cat) => {
          const blocks = (GROUPED.get(cat) ?? []).filter(
            (d) => !q || d.label.toLowerCase().includes(q) || d.type.includes(q),
          )
          if (blocks.length === 0) return null
          const isPro = PRO_CATEGORIES.has(cat)
          return (
            <div key={cat}>
              <div style={s.sectionLabel}>
                {CATEGORY_LABELS[cat]}
                {isPro && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: '0.55rem',
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: 'rgba(28,171,176,0.15)',
                      color: '#1CABB0',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      verticalAlign: 'middle',
                    }}
                  >
                    PRO
                  </span>
                )}
              </div>
              {blocks.map((def) => (
                <BlockItem
                  key={def.type}
                  def={def}
                  favs={favs}
                  onToggleFav={toggleFav}
                  entitled={isBlockEntitled(def, ent)}
                  onProBlocked={onProBlocked}
                />
              ))}
            </div>
          )
        })}

        {/* Templates section (Pro only) */}
        {ent.canUseGroups && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.3rem' }}>
            <div
              style={{
                ...s.sectionLabel,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.45rem 0.6rem 0.2rem',
              }}
              onClick={() => {
                setTemplatesOpen((p) => !p)
                loadTemplates()
              }}
            >
              <span style={{ fontSize: '0.55rem', opacity: 0.5 }}>{templatesOpen ? '▼' : '▶'}</span>
              Templates
              <span
                style={{
                  marginLeft: 4,
                  fontSize: '0.55rem',
                  padding: '1px 4px',
                  borderRadius: 3,
                  background: 'rgba(28,171,176,0.15)',
                  color: '#1CABB0',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                PRO
              </span>
            </div>
            {templatesOpen && (
              <div style={{ padding: '0.2rem 0' }}>
                {templates.length === 0 ? (
                  <div
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontSize: '0.75rem',
                      color: 'rgba(244,244,243,0.3)',
                    }}
                  >
                    No templates yet.
                    <br />
                    <span style={{ fontSize: '0.68rem' }}>Save a group as template.</span>
                  </div>
                ) : (
                  templates.map((t) => (
                    <TemplateItem
                      key={t.id}
                      template={t}
                      onInsert={() => onInsertTemplate?.(t)}
                      onRename={(newName) => {
                        renameTemplateApi(t.id, newName).then(refreshTemplates)
                      }}
                      onDelete={() => {
                        deleteTemplateApi(t.id).then(refreshTemplates)
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div style={s.resizeHandle} onMouseDown={onResizeStart} />
    </div>
  )
}
