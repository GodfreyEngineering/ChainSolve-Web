/**
 * ExplorePage — V3-7.1 dedicated full-page explore/marketplace route.
 *
 * Route: /explore
 *
 * Responsive grid of ExploreCards with hero banner, category nav bar,
 * search, sort controls, filter sidebar (V3-7.4), tag pills,
 * and loading skeletons. Links to ExploreItemPage for detail views.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ExploreCard } from '../components/explore/ExploreCard'
import { ExploreFilters, type ExploreFilterState } from '../components/explore/ExploreFilters'
import { Skeleton } from '../components/ui/Skeleton'
import {
  listPublishedItems,
  getAutoCollections,
  type MarketplaceItem,
  type MarketplaceCategory,
  type ExploreSortKey,
  type ExploreSource,
} from '../lib/marketplaceService'

const SORT_OPTIONS: Array<{ key: ExploreSortKey; labelKey: string }> = [
  { key: 'downloads', labelKey: 'explore.sortPopular' },
  { key: 'newest', labelKey: 'explore.sortNewest' },
  { key: 'likes', labelKey: 'explore.sortLiked' },
]

/** Number of skeleton cards to show while loading. */
const SKELETON_COUNT = 8

export function ExplorePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialSort = (searchParams.get('sort') as ExploreSortKey) || 'downloads'
  const initialQuery = searchParams.get('q') || ''
  const initialTag = searchParams.get('tag') || null
  const initialSource = (searchParams.get('source') as ExploreSource) || 'all'

  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<ExploreSortKey>(initialSort)
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
  const [fetchSeq, setFetchSeq] = useState(0)
  const [collections, setCollections] = useState<
    Array<{ name: string; labelKey: string; items: MarketplaceItem[] }>
  >([])
  const [filters, setFilters] = useState<ExploreFilterState>({
    categories: new Set(),
    source: initialSource,
    tag: initialTag,
    minRating: 0,
  })

  // Load auto-collections once
  useEffect(() => {
    getAutoCollections()
      .then(setCollections)
      .catch((err) => console.error('[explore-collections]', err))
  }, [])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Update URL params
  useEffect(() => {
    const p = new URLSearchParams()
    if (sort !== 'downloads') p.set('sort', sort)
    if (debouncedQuery) p.set('q', debouncedQuery)
    if (filters.tag) p.set('tag', filters.tag)
    if (filters.source !== 'all') p.set('source', filters.source)
    setSearchParams(p, { replace: true })
  }, [sort, debouncedQuery, filters.tag, filters.source, setSearchParams])

  const handleSortChange = useCallback((s: ExploreSortKey) => {
    setSort(s)
    setLoading(true)
    setFetchSeq((seq) => seq + 1)
  }, [])

  const handleFiltersChange = useCallback((next: ExploreFilterState) => {
    setFilters(next)
    setLoading(true)
    setFetchSeq((seq) => seq + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    // Use the first selected category, or undefined for all
    const catArr = Array.from(filters.categories)
    const cat: string | undefined = catArr.length === 1 ? catArr[0] : undefined
    listPublishedItems(
      cat,
      debouncedQuery || undefined,
      sort,
      filters.tag ?? undefined,
      filters.source,
    )
      .then((data) => {
        if (!cancelled) {
          // Client-side multi-category filter when more than one category selected
          let filtered = data
          if (catArr.length > 1) {
            const catSet = filters.categories
            filtered = data.filter((item) => catSet.has(item.category as MarketplaceCategory))
          }
          // Client-side min rating filter (comments_count as proxy)
          if (filters.minRating > 0) {
            filtered = filtered.filter((item) => item.comments_count >= filters.minRating)
          }
          setItems(filtered)
        }
      })
      .catch((err) => {
        console.error('[explore]', err)
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSeq, debouncedQuery])

  const handleItemClick = useCallback(
    (id: string) => {
      navigate(`/explore/${id}`)
    },
    [navigate],
  )

  // Collect unique tags from loaded items + collections for the tag cloud
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const item of items) {
      for (const tag of item.tags) tagSet.add(tag)
    }
    for (const coll of collections) {
      for (const item of coll.items) {
        for (const tag of item.tags) tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  }, [items, collections])

  return (
    <div style={page}>
      {/* Hero banner */}
      <div style={hero}>
        <h1 style={heroTitle}>{t('explorePage.heroTitle')}</h1>
        <p style={heroSub}>{t('explorePage.heroSub')}</p>
      </div>

      {/* Featured collections (V3-7.2) */}
      {collections.length > 0 && (
        <div style={collectionsWrap}>
          {collections.map((coll) => (
            <section key={coll.labelKey} style={collSection}>
              <h2 style={collTitle}>{t(coll.labelKey)}</h2>
              <div style={collScroll}>
                {coll.items.map((item) => (
                  <div key={item.id} style={collCard}>
                    <ExploreCard item={item} onClick={() => handleItemClick(item.id)} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Search + Sort bar */}
      <div style={toolbar}>
        <div style={searchWrap}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            style={searchInput}
            placeholder={t('explore.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={sortWrap}>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              style={{
                ...sortBtn,
                fontWeight: sort === s.key ? 700 : 400,
                borderBottom: sort === s.key ? '2px solid var(--primary)' : '2px solid transparent',
              }}
              onClick={() => handleSortChange(s.key)}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Content area: filters sidebar + grid */}
      <div style={contentArea}>
        <ExploreFilters
          filters={filters}
          availableTags={availableTags}
          onChange={handleFiltersChange}
        />

        <div style={gridCol}>
          {loading ? (
            <div style={grid}>
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <div key={i} style={skeletonCard}>
                  <Skeleton height={120} style={{ borderRadius: '10px 10px 0 0' }} />
                  <div style={skeletonBody}>
                    <Skeleton width="70%" height={14} />
                    <Skeleton width="90%" height={10} style={{ marginTop: 6 }} />
                    <Skeleton width="60%" height={10} style={{ marginTop: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div style={emptyState}>{t('explore.noResults')}</div>
          ) : (
            <div style={grid}>
              {items.map((item) => (
                <ExploreCard key={item.id} item={item} onClick={() => handleItemClick(item.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: "'Montserrat', system-ui, sans-serif",
}

const hero: React.CSSProperties = {
  textAlign: 'center',
  padding: '3rem 2rem 2rem',
  background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
  borderBottom: '1px solid var(--border)',
}

const heroTitle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 800,
  margin: 0,
}

const heroSub: React.CSSProperties = {
  fontSize: '1rem',
  color: 'var(--text-muted)',
  margin: '0.5rem 0 0',
}

const toolbar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.75rem 2rem',
  gap: 16,
  flexWrap: 'wrap',
}

const searchWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.4rem 0.75rem',
  flex: '1 1 200px',
  maxWidth: 400,
}

const searchInput: React.CSSProperties = {
  border: 'none',
  background: 'none',
  color: 'var(--text)',
  fontSize: '0.85rem',
  outline: 'none',
  width: '100%',
  fontFamily: "'Montserrat', system-ui, sans-serif",
}

const sortWrap: React.CSSProperties = {
  display: 'flex',
  gap: 12,
}

const sortBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text)',
  fontSize: '0.82rem',
  cursor: 'pointer',
  padding: '0.3rem 0',
  fontFamily: "'Montserrat', system-ui, sans-serif",
}

const contentArea: React.CSSProperties = {
  display: 'flex',
  gap: 20,
  padding: '0 2rem 3rem',
  alignItems: 'flex-start',
}

const gridCol: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: 16,
}

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '4rem 2rem',
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
}

const collectionsWrap: React.CSSProperties = {
  padding: '1rem 2rem 0',
}

const collSection: React.CSSProperties = {
  marginBottom: '1.5rem',
}

const collTitle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  margin: '0 0 0.6rem',
}

const collScroll: React.CSSProperties = {
  display: 'flex',
  gap: 14,
  overflowX: 'auto',
  paddingBottom: 8,
}

const collCard: React.CSSProperties = {
  minWidth: 220,
  maxWidth: 260,
  flexShrink: 0,
}

const skeletonCard: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  overflow: 'hidden',
}

const skeletonBody: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
}
