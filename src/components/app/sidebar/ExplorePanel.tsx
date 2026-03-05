/**
 * ExplorePanel — inline marketplace browser in the sidebar.
 *
 * Lists published items in a compact sidebar-friendly layout.
 * Click item → drills down to ExploreItemDetail sub-view.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Compass, Search, Download, Heart, Star } from 'lucide-react'
import { Icon } from '../../ui/Icon'
import { Skeleton } from '../../ui/Skeleton'
import {
  listPublishedItems,
  type MarketplaceItem,
  type MarketplaceCategory,
} from '../../../lib/marketplaceService'
import { useSidebarStore } from '../../../stores/sidebarStore'
import { ExploreItemDetail } from './ExploreItemDetail'

type SortKey = 'downloads' | 'likes' | 'newest'

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'template', label: 'Templates' },
  { id: 'block_pack', label: 'Block Packs' },
  { id: 'theme', label: 'Themes' },
  { id: 'group', label: 'Groups' },
]

export function ExplorePanel() {
  const { t } = useTranslation()
  const exploreItemId = useSidebarStore((s) => s.exploreItemId)
  const openExploreItem = useSidebarStore((s) => s.openExploreItem)
  const closeExploreItem = useSidebarStore((s) => s.closeExploreItem)

  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<SortKey>('downloads')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listPublishedItems(
        category === 'all' ? undefined : category,
        query || undefined,
        sort,
      )
      setItems(data)
    } catch {
      // Silently handle — show empty state
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [category, query, sort])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  // If an item is selected, show detail view
  if (exploreItemId) {
    return <ExploreItemDetail itemId={exploreItemId} onBack={closeExploreItem} />
  }

  return (
    <div style={containerStyle}>
      {/* Search */}
      <div style={searchWrapStyle}>
        <Icon icon={Search} size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('explore.searchPlaceholder', 'Search marketplace...')}
          style={searchInputStyle}
        />
      </div>

      {/* Category pills */}
      <div style={pillsRowStyle}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            style={{
              ...pillStyle,
              ...(category === cat.id ? pillActiveStyle : {}),
            }}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div style={sortRowStyle}>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={sortSelectStyle}
        >
          <option value="downloads">{t('explore.sortPopular', 'Popular')}</option>
          <option value="newest">{t('explore.sortNewest', 'Newest')}</option>
          <option value="likes">{t('explore.sortLiked', 'Most liked')}</option>
        </select>
      </div>

      {/* Items list */}
      <div style={listStyle}>
        {loading ? (
          <>
            <Skeleton height={56} style={{ marginBottom: 6 }} />
            <Skeleton height={56} style={{ marginBottom: 6 }} />
            <Skeleton height={56} style={{ marginBottom: 6 }} />
            <Skeleton height={56} />
          </>
        ) : items.length === 0 ? (
          <div style={emptyStyle}>
            <Icon icon={Compass} size={28} style={{ color: 'var(--text-faint)', opacity: 0.4 }} />
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
              {query
                ? t('explore.noResults', 'No items match your search')
                : t('explore.empty', 'No published items yet')}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <button key={item.id} style={itemCardStyle} onClick={() => openExploreItem(item.id)}>
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt="" style={thumbStyle} />
              ) : (
                <div style={thumbPlaceholderStyle}>
                  <Icon icon={categoryIcon(item.category)} size={16} />
                </div>
              )}
              <div style={itemInfoStyle}>
                <div style={itemNameStyle}>
                  {item.name}
                  {item.is_official && (
                    <Icon
                      icon={Star}
                      size={10}
                      style={{ color: 'var(--warning)', marginLeft: 3, flexShrink: 0 }}
                    />
                  )}
                </div>
                <div style={itemMetaStyle}>
                  <span style={categoryBadgeStyle}>{item.category}</span>
                  <span style={statStyle}>
                    <Icon icon={Download} size={10} /> {item.downloads_count}
                  </span>
                  <span style={statStyle}>
                    <Icon icon={Heart} size={10} /> {item.likes_count}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function categoryIcon(cat: string) {
  switch (cat as MarketplaceCategory) {
    case 'template':
      return Compass
    case 'theme':
      return Star
    default:
      return Compass
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  gap: 0,
}

const searchWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  margin: '0.5rem 0.6rem 0',
  padding: '0.35rem 0.5rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-3, var(--input-bg))',
  border: '1px solid var(--border)',
}

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  outline: 'none',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  color: 'inherit',
}

const pillsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '0.4rem 0.6rem',
  overflowX: 'auto',
  flexShrink: 0,
}

const pillStyle: React.CSSProperties = {
  padding: '0.2rem 0.5rem',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-full, 999px)',
  background: 'transparent',
  color: 'var(--text-faint)',
  fontSize: '0.65rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const pillActiveStyle: React.CSSProperties = {
  background: 'var(--primary-dim)',
  color: 'var(--primary-text)',
  borderColor: 'var(--primary)',
}

const sortRowStyle: React.CSSProperties = {
  padding: '0 0.6rem 0.3rem',
  display: 'flex',
  justifyContent: 'flex-end',
}

const sortSelectStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontFamily: 'inherit',
  background: 'transparent',
  color: 'var(--text-faint)',
  border: 'none',
  cursor: 'pointer',
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0 0.5rem 0.5rem',
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  padding: '2rem 1rem',
}

const itemCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '0.4rem 0.5rem',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  transition: 'background 0.1s',
}

const thumbStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 'var(--radius-sm)',
  objectFit: 'cover',
  flexShrink: 0,
}

const thumbPlaceholderStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--text-faint)',
}

const itemInfoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const itemNameStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
}

const itemMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.62rem',
  color: 'var(--text-faint)',
}

const categoryBadgeStyle: React.CSSProperties = {
  padding: '0 0.3rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-3)',
  fontSize: '0.58rem',
  textTransform: 'capitalize',
}

const statStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
}
