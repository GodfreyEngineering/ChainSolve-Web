/**
 * ExplorePage — V3-7.1 dedicated full-page explore/marketplace route.
 *
 * Route: /explore
 *
 * Responsive grid of ExploreCards with hero banner, category nav bar,
 * search, and sort controls. Links to ExploreItemPage for detail views.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ExploreCard } from '../components/explore/ExploreCard'
import {
  listPublishedItems,
  type MarketplaceItem,
  type MarketplaceCategory,
  type ExploreSortKey,
} from '../lib/marketplaceService'

const CATEGORIES: Array<{ key: MarketplaceCategory | 'all'; labelKey: string }> = [
  { key: 'all', labelKey: 'explore.catAll' },
  { key: 'template', labelKey: 'explore.catTemplate' },
  { key: 'block_pack', labelKey: 'explore.catBlockPack' },
  { key: 'theme', labelKey: 'explore.catTheme' },
  { key: 'group', labelKey: 'explore.catGroup' },
]

const SORT_OPTIONS: Array<{ key: ExploreSortKey; labelKey: string }> = [
  { key: 'downloads', labelKey: 'explore.sortPopular' },
  { key: 'newest', labelKey: 'explore.sortNewest' },
  { key: 'likes', labelKey: 'explore.sortLiked' },
]

export function ExplorePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialCat = (searchParams.get('category') as MarketplaceCategory) || 'all'
  const initialSort = (searchParams.get('sort') as ExploreSortKey) || 'downloads'
  const initialQuery = searchParams.get('q') || ''

  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<MarketplaceCategory | 'all'>(initialCat)
  const [sort, setSort] = useState<ExploreSortKey>(initialSort)
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
  const [fetchSeq, setFetchSeq] = useState(0)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Update URL params
  useEffect(() => {
    const p = new URLSearchParams()
    if (category !== 'all') p.set('category', category)
    if (sort !== 'downloads') p.set('sort', sort)
    if (debouncedQuery) p.set('q', debouncedQuery)
    setSearchParams(p, { replace: true })
  }, [category, sort, debouncedQuery, setSearchParams])

  // Trigger loading on dependency change
  const handleCategoryChange = useCallback((c: MarketplaceCategory | 'all') => {
    setCategory(c)
    setLoading(true)
    setFetchSeq((s) => s + 1)
  }, [])

  const handleSortChange = useCallback((s: ExploreSortKey) => {
    setSort(s)
    setLoading(true)
    setFetchSeq((seq) => seq + 1)
  }, [])

  // Fetch items
  useEffect(() => {
    let cancelled = false
    const cat = category === 'all' ? undefined : category
    listPublishedItems(cat, debouncedQuery || undefined, sort)
      .then((data) => {
        if (!cancelled) setItems(data)
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

  return (
    <div style={page}>
      {/* Hero banner */}
      <div style={hero}>
        <h1 style={heroTitle}>{t('explorePage.heroTitle')}</h1>
        <p style={heroSub}>{t('explorePage.heroSub')}</p>
      </div>

      {/* Category nav */}
      <nav style={catNav}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            style={{
              ...catBtn,
              background: category === c.key ? 'var(--primary)' : 'var(--surface-hover)',
              color: category === c.key ? '#fff' : 'var(--text)',
            }}
            onClick={() => handleCategoryChange(c.key)}
          >
            {t(c.labelKey)}
          </button>
        ))}
      </nav>

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

      {/* Grid */}
      {loading ? (
        <div style={emptyState}>{t('explorePage.loading')}</div>
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

const catNav: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '1rem 2rem 0',
  flexWrap: 'wrap',
}

const catBtn: React.CSSProperties = {
  padding: '0.4rem 1rem',
  borderRadius: 20,
  border: '1px solid var(--border)',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Montserrat', system-ui, sans-serif",
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

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: 16,
  padding: '1rem 2rem 3rem',
}

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '4rem 2rem',
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
}
