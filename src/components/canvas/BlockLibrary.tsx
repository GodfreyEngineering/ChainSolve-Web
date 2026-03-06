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

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  lazy,
  Suspense,
  type DragEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  BLOCK_REGISTRY,
  BLOCK_TAXONOMY,
  getSubcategoryBlocks,
  registerCustomFunction,
  unregisterCustomFunction,
  syncCustomFunctions,
  type BlockDef,
} from '../../blocks/registry'
import { type Plan, getEntitlements, isBlockEntitled } from '../../lib/entitlements'
import {
  listTemplates,
  deleteTemplate as deleteTemplateApi,
  renameTemplate as renameTemplateApi,
  type Template,
} from '../../lib/templates'
import { useCustomFunctionsStore } from '../../stores/customFunctionsStore'

import {
  DRAG_TYPE,
  trackBlockUsed,
  getRecentlyUsed,
  getFavourites,
  toggleFavourite,
  scoreMatch,
} from './blockLibraryUtils'
import { ChevronLeft, ChevronRight, Library } from 'lucide-react'
import { HelpLink } from '../ui/HelpLink'
import { Tooltip } from '../ui/Tooltip'

const FunctionWizard = lazy(() =>
  import('./FunctionWizard').then((m) => ({ default: m.FunctionWizard })),
)

// ── Taxonomy grouping (G3-1) ────────────────────────────────────────────────

/** Pre-computed map: subcatId -> BlockDef[]. */
function buildTaxonomyGrouped(): Map<string, BlockDef[]> {
  const map = new Map<string, BlockDef[]>()
  for (const main of BLOCK_TAXONOMY) {
    for (const sub of main.subcategories) {
      map.set(sub.id, getSubcategoryBlocks(sub))
    }
  }
  return map
}

const TAXONOMY_GROUPED = buildTaxonomyGrouped()

/** E5-5: Ranked match — returns true if block matches query. */
function matchesQuery(def: BlockDef, q: string): boolean {
  return scoreMatch(def, q) !== null
}

/** E5-5: Sort blocks by search relevance (lower score = better match). */
function sortByRelevance(blocks: BlockDef[], q: string): BlockDef[] {
  return [...blocks].sort((a, b) => (scoreMatch(a, q) ?? 99) - (scoreMatch(b, q) ?? 99))
}

// ── Styles ────────────────────────────────────────────────────────────────────

const px = (v: number) => `${v}px`

type StyleMap = Record<string, React.CSSProperties>
const s: StyleMap = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid var(--border)',
    background: 'var(--surface-1)',
    height: '100%',
    transition: 'width var(--transition-panel, 0.25s cubic-bezier(0.16, 1, 0.3, 1))',
    position: 'relative',
  },
  topBar: {
    padding: '0.45rem 0.5rem 0.35rem',
    borderBottom: '1px solid var(--border)',
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
    border: '1px solid var(--border)',
    background: 'var(--input-bg, rgba(0,0,0,0.2))',
    color: 'var(--text, #F4F4F3)',
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
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text, #F4F4F3)',
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
    fontSize: 'var(--font-xs)',
    fontWeight: 700,
    letterSpacing: '0.07em',
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    userSelect: 'none',
  },
  blockItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.28rem 0.6rem',
    fontSize: 'var(--font-sm)',
    cursor: 'grab',
    borderRadius: 'var(--radius-sm)',
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

interface BlockItemProps {
  def: BlockDef
  favs: Set<string>
  onToggleFav: (type: string) => void
  entitled: boolean
  onProBlocked?: () => void
  /** G5-1: Description text for hover tooltip. */
  description?: string
  /** G5-1: Whether this block's star is currently animating. */
  starAnimating?: boolean
}

const BlockItem = memo(function BlockItem({
  def,
  favs,
  onToggleFav,
  entitled,
  onProBlocked,
  description,
  starAnimating,
}: BlockItemProps) {
  const { t } = useTranslation()
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

  // V2-020: Build tooltip text: description + drag hint (i18n)
  const tooltipText = entitled
    ? description
      ? `${description}\n${t('blockLibrary.dragHint')}`
      : t('blockLibrary.dragHint')
    : `${def.label} (${t('blockLibrary.proOnly')})`

  return (
    <Tooltip content={tooltipText} side="right" display="block">
      <div
        draggable={entitled}
        onDragStart={onDragStart}
        onClick={!entitled ? onProBlocked : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...s.blockItem,
          background: hovered ? 'var(--primary-dim)' : 'transparent',
          opacity: entitled ? 1 : 0.45,
          cursor: entitled ? 'grab' : 'pointer',
        }}
      >
        {!entitled && (
          <span className="cs-pro-badge" style={{ marginRight: 4, marginLeft: 0 }}>
            PRO
          </span>
        )}
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
              color: isFav ? 'var(--warning)' : 'var(--text-faint)',
              transition: 'transform 0.15s ease',
              transform: starAnimating ? 'scale(1.5)' : 'scale(1)',
            }}
            title={isFav ? t('blockLibrary.removeFavourite') : t('blockLibrary.addFavourite')}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFav(def.type)
            }}
          >
            {isFav ? '\u2605' : '\u2606'}
          </button>
        )}
      </div>
    </Tooltip>
  )
})

// ── TemplateItem ─────────────────────────────────────────────────────────────

interface TemplateItemProps {
  template: Template
  onInsert: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

const TemplateItem = memo(function TemplateItem({
  template,
  onInsert,
  onRename,
  onDelete,
}: TemplateItemProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const nodeCount = template.payload.nodes?.length ?? 0

  return (
    <Tooltip
      content={t('blockLibrary.insertSavedGroup', {
        name: template.name,
        count: nodeCount,
      })}
      side="right"
      display="block"
    >
      <div
        style={{
          ...s.blockItem,
          background: hovered ? 'var(--primary-dim)' : 'transparent',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false)
          setMenuOpen(false)
        }}
        onClick={onInsert}
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
            fontSize: 'var(--font-xs)',
            color: 'var(--text-faint)',
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
                color: 'var(--text-faint)',
                fontSize: '0.85rem',
                padding: '0 2px',
                fontFamily: 'inherit',
                lineHeight: 1,
              }}
              title="Saved group actions"
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
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.2rem',
                  zIndex: 100,
                  minWidth: 100,
                  boxShadow: 'var(--shadow-lg)',
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
                    ;(e.currentTarget as HTMLDivElement).style.background = 'var(--primary-dim)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    const name = window.prompt('Rename saved group:', template.name)
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
                    color: 'var(--danger)',
                  }}
                  role="menuitem"
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background =
                      'var(--menu-danger-hover)'
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
    </Tooltip>
  )
})

// ── CustomFnItem (H5-1) ─────────────────────────────────────────────────────

interface CustomFnItemProps {
  def: BlockDef
  fn: import('../../lib/customFunctions').CustomFunction
  favs: Set<string>
  onToggleFav: (type: string) => void
  entitled: boolean
  onProBlocked?: () => void
  description?: string
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const CustomFnItem = memo(function CustomFnItem({
  def,
  fn,
  favs,
  onToggleFav,
  entitled,
  onProBlocked,
  description,
  onEdit,
  onDuplicate,
  onDelete,
}: CustomFnItemProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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

  const tooltipText = description
    ? `${description}\n${t('blockLibrary.formula')}: ${fn.formula}`
    : fn.formula

  return (
    <Tooltip content={tooltipText} side="right" display="block">
      <div
        draggable={entitled}
        onDragStart={onDragStart}
        onClick={!entitled ? onProBlocked : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false)
          setMenuOpen(false)
        }}
        style={{
          ...s.blockItem,
          background: hovered ? 'var(--primary-dim)' : 'transparent',
          opacity: entitled ? 1 : 0.45,
          cursor: entitled ? 'grab' : 'pointer',
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: hovered ? 40 : 0,
          }}
        >
          {def.label}
        </span>
        <span
          style={{
            fontSize: '0.6rem',
            color: 'var(--text-faint)',
            fontFamily: 'monospace',
            flexShrink: 0,
            maxWidth: 60,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fn.inputs.length}in
        </span>
        {hovered && entitled && (
          <div style={{ position: 'absolute', right: 6, display: 'flex', gap: 2 }}>
            <button
              style={{
                ...s.starBtn,
                color: favs.has(def.type) ? 'var(--warning)' : 'var(--text-faint)',
              }}
              title={
                favs.has(def.type)
                  ? t('blockLibrary.removeFavourite')
                  : t('blockLibrary.addFavourite')
              }
              onClick={(e) => {
                e.stopPropagation()
                onToggleFav(def.type)
              }}
            >
              {favs.has(def.type) ? '\u2605' : '\u2606'}
            </button>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-faint)',
                fontSize: '0.85rem',
                padding: '0 2px',
                fontFamily: 'inherit',
                lineHeight: 1,
              }}
              title="Function actions"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((p) => !p)
              }}
            >
              {'\u22EF'}
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.2rem',
                  zIndex: 100,
                  minWidth: 100,
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {[
                  { label: 'Edit...', action: onEdit },
                  { label: 'Duplicate', action: onDuplicate },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: '0.3rem 0.5rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      borderRadius: 3,
                    }}
                    role="menuitem"
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLDivElement).style.background = 'var(--primary-dim)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      item.action()
                      setMenuOpen(false)
                    }}
                  >
                    {item.label}
                  </div>
                ))}
                <div
                  style={{
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    borderRadius: 3,
                    color: 'var(--danger)',
                  }}
                  role="menuitem"
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background =
                      'var(--menu-danger-hover)'
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
    </Tooltip>
  )
})

// ── BlockLibrary ──────────────────────────────────────────────────────────────

interface BlockLibraryProps {
  width: number
  onResizeStart: (e: React.MouseEvent) => void
  plan?: Plan
  onProBlocked?: () => void
  onInsertTemplate?: (template: Template) => void
  /** G5-1: When true, panel is collapsed to a thin handle strip. */
  collapsed?: boolean
  /** G5-1: Toggle collapsed state. */
  onToggleCollapsed?: () => void
  /** V2-019: Pre-select a main category filter from outside (e.g. Insert menu). */
  filterMainOverride?: string | null
}

/** Width of the collapsed docking handle strip. */
export const COLLAPSED_HANDLE_WIDTH = 28

export function BlockLibrary({
  width,
  onResizeStart,
  plan = 'free',
  onProBlocked,
  onInsertTemplate,
  collapsed = false,
  onToggleCollapsed,
  filterMainOverride,
}: BlockLibraryProps) {
  const { t } = useTranslation()
  const ent = getEntitlements(plan)
  const [query, setQuery] = useState('')
  const [filterMain, setFilterMain] = useState<string | null>(null)

  // V2-019: Sync external filter override (e.g. from Insert menu)
  useEffect(() => {
    if (filterMainOverride !== undefined) setFilterMain(filterMainOverride)
  }, [filterMainOverride])

  const [favs, setFavs] = useState<Set<string>>(getFavourites)
  const [recent, setRecent] = useState<string[]>(getRecentlyUsed)
  const searchRef = useRef<HTMLInputElement>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoaded, setTemplatesLoaded] = useState(false)
  const [customFnsOpen, setCustomFnsOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingFn, setEditingFn] = useState<
    import('../../lib/customFunctions').CustomFunction | undefined
  >(undefined)
  const customFunctions = useCustomFunctionsStore((s) => s.functions)
  const deleteCustomFn = useCustomFunctionsStore((s) => s.deleteFunction)
  const duplicateCustomFn = useCustomFunctionsStore((s) => s.duplicateFunction)

  // Sync custom functions to block registry on mount and when functions change
  useEffect(() => {
    syncCustomFunctions(customFunctions)
  }, [customFunctions])

  // G5-1: Lazy-load block descriptions for hover tooltips
  const [descriptions, setDescriptions] = useState<Record<string, string>>({})
  useEffect(() => {
    import('../../blocks/blockDescriptions').then((m) => setDescriptions(m.BLOCK_DESCRIPTIONS))
  }, [])

  // Refresh recent list when panel is focused (user may have added blocks)
  const refreshRecent = useCallback(() => setRecent(getRecentlyUsed()), [])

  // G5-1: Track which block was just favorited for star animation
  const [animatingFav, setAnimatingFav] = useState<string | null>(null)
  const toggleFav = useCallback((type: string) => {
    const next = toggleFavourite(type)
    setFavs(next)
    if (next.has(type)) {
      setAnimatingFav(type)
      setTimeout(() => setAnimatingFav(null), 400)
    }
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
  const taxForFilter = filterMain
    ? BLOCK_TAXONOMY.filter((m) => m.id === filterMain)
    : BLOCK_TAXONOMY
  const noBlockResults =
    q.length > 0 &&
    taxForFilter.every((main) =>
      main.subcategories.every((sub) =>
        (TAXONOMY_GROUPED.get(sub.id) ?? []).every((d) => !matchesQuery(d, q)),
      ),
    )

  // G5-1: Collapsed docking handle
  if (collapsed) {
    return <DockHandle side="expand" onClick={onToggleCollapsed} />
  }

  return (
    <div data-tour="block-library" style={{ ...s.panel, width: px(width) }} onFocus={refreshRecent}>
      {/* Search + category filter */}
      <div style={s.topBar}>
        <div style={s.searchRow}>
          <input
            ref={searchRef}
            style={s.search}
            type="search"
            placeholder={t('blockLibrary.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <HelpLink section="block-library" />
        </div>

        <div style={s.catFilter}>
          <button
            style={{
              ...s.catPill,
              background: !filterMain ? 'var(--primary-dim)' : 'transparent',
              borderColor: !filterMain ? 'var(--primary-text)' : undefined,
              color: !filterMain ? 'var(--primary-text)' : undefined,
            }}
            onClick={() => setFilterMain(null)}
          >
            {t('blockLibrary.all')}
          </button>
          {BLOCK_TAXONOMY.map((main) => (
            <button
              key={main.id}
              style={{
                ...s.catPill,
                background: filterMain === main.id ? 'var(--primary-dim)' : 'transparent',
                borderColor: filterMain === main.id ? 'var(--primary-text)' : undefined,
                color: filterMain === main.id ? 'var(--primary-text)' : undefined,
              }}
              onClick={() => setFilterMain(main.id === filterMain ? null : main.id)}
            >
              {main.label}
            </button>
          ))}
        </div>
      </div>

      <div style={s.scroll}>
        {/* Favourites section */}
        {!q && favList.length > 0 && (
          <div>
            <div style={s.sectionLabel}>{t('blockLibrary.favourites')}</div>
            {favList.map((def) => (
              <BlockItem
                key={def.type}
                def={def}
                favs={favs}
                onToggleFav={toggleFav}
                entitled={isBlockEntitled(def, ent)}
                onProBlocked={onProBlocked}
                description={descriptions[def.type]}
                starAnimating={animatingFav === def.type}
              />
            ))}
          </div>
        )}

        {/* Recently used section */}
        {!q && recentList.length > 0 && (
          <div>
            <div style={s.sectionLabel}>{t('blockLibrary.recent')}</div>
            {recentList.map((def) => (
              <BlockItem
                key={def.type}
                def={def}
                favs={favs}
                onToggleFav={toggleFav}
                entitled={isBlockEntitled(def, ent)}
                onProBlocked={onProBlocked}
                description={descriptions[def.type]}
                starAnimating={animatingFav === def.type}
              />
            ))}
          </div>
        )}

        {/* Zero search results */}
        {noBlockResults && (
          <div
            style={{
              padding: '0.75rem 0.6rem',
              fontSize: 'var(--font-sm)',
              color: 'var(--text-faint)',
              textAlign: 'center',
            }}
          >
            <div>{t('blockLibrary.noMatches', { query })}</div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', opacity: 0.6 }}>
              {t('blockLibrary.noMatchesHint')}
            </div>
          </div>
        )}

        {/* All blocks by taxonomy: main category → subcategory (G3-1) */}
        {taxForFilter.map((main, mainIdx) => {
          const mainBlocksRaw = main.subcategories.flatMap((sub) =>
            (TAXONOMY_GROUPED.get(sub.id) ?? []).filter((d) => !q || matchesQuery(d, q)),
          )
          if (mainBlocksRaw.length === 0) return null
          return (
            <div key={main.id}>
              {mainIdx > 0 && (
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    margin: '0.25rem 0.5rem 0',
                    opacity: 0.5,
                  }}
                />
              )}
              <div style={s.sectionLabel}>{main.label}</div>
              {main.subcategories.map((sub) => {
                const blocksRaw = (TAXONOMY_GROUPED.get(sub.id) ?? []).filter(
                  (d) => !q || matchesQuery(d, q),
                )
                const blocks = q ? sortByRelevance(blocksRaw, q) : blocksRaw
                if (blocks.length === 0) return null
                const subHasPro = blocks.some((d) => d.proOnly)
                return (
                  <div key={sub.id}>
                    <div
                      style={{
                        ...s.sectionLabel,
                        fontSize: '0.58rem',
                        paddingLeft: '0.9rem',
                        opacity: 0.6,
                      }}
                    >
                      {sub.label}
                      {subHasPro && <span className="cs-pro-badge">PRO</span>}
                    </div>
                    {blocks.map((def) => (
                      <BlockItem
                        key={def.type}
                        def={def}
                        favs={favs}
                        onToggleFav={toggleFav}
                        entitled={isBlockEntitled(def, ent)}
                        onProBlocked={onProBlocked}
                        description={descriptions[def.type]}
                        starAnimating={animatingFav === def.type}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Custom Functions section (H5-1, Pro only) */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.3rem' }}>
          <div
            style={{
              ...s.sectionLabel,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.45rem 0.6rem 0.2rem',
            }}
            onClick={() => setCustomFnsOpen((p) => !p)}
          >
            <span style={{ fontSize: '0.55rem', opacity: 0.5 }}>
              {customFnsOpen ? '\u25BC' : '\u25B6'}
            </span>
            {t('blockLibrary.customFunctions')}
            <span className="cs-pro-badge">PRO</span>
            {customFunctions.length > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.6rem',
                  opacity: 0.5,
                }}
              >
                {customFunctions.length}
              </span>
            )}
          </div>
          {customFnsOpen && (
            <div style={{ padding: '0.2rem 0' }}>
              {customFunctions.length === 0 ? (
                <div
                  style={{
                    padding: '0.5rem 0.6rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-faint)',
                  }}
                >
                  {t('blockLibrary.noCustomFunctions')}
                </div>
              ) : (
                customFunctions.map((fn) => {
                  const blockType = `cfb:${fn.id}`
                  const def = BLOCK_REGISTRY.get(blockType)
                  return def ? (
                    <CustomFnItem
                      key={fn.id}
                      def={def}
                      fn={fn}
                      favs={favs}
                      onToggleFav={toggleFav}
                      entitled={ent.canCreateCustomFunctions}
                      onProBlocked={onProBlocked}
                      description={fn.description ?? fn.formula}
                      onEdit={() => {
                        setEditingFn(fn)
                        setWizardOpen(true)
                      }}
                      onDuplicate={() => {
                        const dup = duplicateCustomFn(fn.id)
                        if (dup) registerCustomFunction(dup)
                      }}
                      onDelete={() => {
                        unregisterCustomFunction(fn.id)
                        deleteCustomFn(fn.id)
                      }}
                    />
                  ) : null
                })
              )}
              {ent.canCreateCustomFunctions ? (
                <button
                  type="button"
                  style={{
                    display: 'block',
                    margin: '0.3rem 0.6rem',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.72rem',
                    borderRadius: 4,
                    border: '1px dashed var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: 'calc(100% - 1.2rem)',
                  }}
                  onClick={() => {
                    setEditingFn(undefined)
                    setWizardOpen(true)
                  }}
                >
                  + Create custom function
                </button>
              ) : (
                <button
                  type="button"
                  style={{
                    display: 'block',
                    margin: '0.3rem 0.6rem',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.72rem',
                    borderRadius: 4,
                    border: '1px dashed var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    opacity: 0.5,
                    width: 'calc(100% - 1.2rem)',
                  }}
                  onClick={onProBlocked}
                >
                  + Create custom function (Pro)
                </button>
              )}
            </div>
          )}
        </div>

        {wizardOpen && (
          <Suspense fallback={null}>
            <FunctionWizard
              open={wizardOpen}
              onClose={() => {
                setWizardOpen(false)
                setEditingFn(undefined)
              }}
              editFunction={editingFn}
            />
          </Suspense>
        )}

        {/* Templates section (Pro only) */}
        {ent.canUseGroups && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.3rem' }}>
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
              Saved groups
              <span className="cs-pro-badge">PRO</span>
            </div>
            {templatesOpen && (
              <div style={{ padding: '0.2rem 0' }}>
                {templates.length === 0 ? (
                  <div
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-faint)',
                    }}
                  >
                    No saved groups yet.
                    <br />
                    <span style={{ fontSize: '0.68rem' }}>
                      Save a group for reuse across projects.
                    </span>
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

      {/* G5-1: Docking handle (resize + collapse) */}
      <DockHandle side="collapse" onClick={onToggleCollapsed} onResizeStart={onResizeStart} />
    </div>
  )
}

// ── DockHandle (G5-1) ───────────────────────────────────────────────────────

interface DockHandleProps {
  /** 'expand' = collapsed state (arrow pointing right), 'collapse' = expanded state (arrow pointing left). */
  side: 'expand' | 'collapse'
  onClick?: () => void
  onResizeStart?: (e: React.MouseEvent) => void
}

function DockHandle({ side, onClick, onResizeStart }: DockHandleProps) {
  const { t } = useTranslation()
  const isExpand = side === 'expand'

  if (isExpand) {
    // Collapsed — single-click to expand, shows icon + rotated "Library" label
    return (
      <Tooltip content={t('dock.expandLibrary')} side="right">
        <div
          className="cs-dock-handle"
          style={{
            width: COLLAPSED_HANDLE_WIDTH,
            height: '100%',
            borderRight: '1px solid var(--border)',
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            paddingTop: 10,
          }}
          onClick={onClick}
        >
          <Library size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <ChevronRight size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <span
            style={{
              writingMode: 'vertical-rl',
              fontSize: '0.6rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--text-faint)',
              userSelect: 'none',
            }}
          >
            {t('dock.library')}
          </span>
        </div>
      </Tooltip>
    )
  }

  // Expanded — resize handle (drag) + collapse button (single-click)
  return (
    <>
      <div
        className="cs-dock-resize-handle"
        data-direction="horizontal-right"
        onMouseDown={onResizeStart}
        title={t('dock.dragToResize')}
      />
      <Tooltip content={t('dock.collapseLibrary')} side="right">
        <button
          className="cs-dock-collapse-btn"
          onClick={onClick}
          style={{ position: 'absolute', right: 2, top: 4, zIndex: 11 }}
        >
          <ChevronLeft size={12} />
        </button>
      </Tooltip>
    </>
  )
}
