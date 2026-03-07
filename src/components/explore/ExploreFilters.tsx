/**
 * ExploreFilters — V3-7.4 filter sidebar for the Explore page.
 *
 * Category checkboxes, rating minimum, tag pills, and active-filter summary.
 */

import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { MarketplaceCategory, ExploreSource } from '../../lib/marketplaceService'

export interface ExploreFilterState {
  categories: Set<MarketplaceCategory>
  source: ExploreSource
  tag: string | null
  minRating: number
}

interface Props {
  filters: ExploreFilterState
  availableTags: string[]
  onChange: (filters: ExploreFilterState) => void
}

const CATEGORY_KEYS: MarketplaceCategory[] = [
  'template',
  'block_pack',
  'theme',
  'group',
  'custom_block',
]

const SOURCE_KEYS: ExploreSource[] = ['all', 'official', 'community', 'enterprise']

export function ExploreFilters({ filters, availableTags, onChange }: Props) {
  const { t } = useTranslation()

  const toggleCategory = (cat: MarketplaceCategory) => {
    const next = new Set(filters.categories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    onChange({ ...filters, categories: next })
  }

  const setSource = (src: ExploreSource) => {
    onChange({ ...filters, source: src })
  }

  const setTag = (tag: string | null) => {
    onChange({ ...filters, tag })
  }

  const setMinRating = (r: number) => {
    onChange({ ...filters, minRating: r })
  }

  const activeCount =
    filters.categories.size +
    (filters.source !== 'all' ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0)

  const clearAll = () => {
    onChange({ categories: new Set(), source: 'all', tag: null, minRating: 0 })
  }

  return (
    <aside style={sidebar}>
      {/* Header */}
      <div style={header}>
        <span style={headerTitle}>{t('exploreFilters.title')}</span>
        {activeCount > 0 && (
          <button style={clearBtn} onClick={clearAll}>
            {t('exploreFilters.clearAll')}
          </button>
        )}
      </div>

      {/* Source */}
      <div style={section}>
        <div style={sectionTitle}>{t('exploreFilters.source')}</div>
        {SOURCE_KEYS.map((src) => (
          <label key={src} style={checkRow}>
            <input
              type="radio"
              name="source"
              checked={filters.source === src}
              onChange={() => setSource(src)}
              style={radioInput}
            />
            <span style={checkLabel}>{t(`exploreFilters.source_${src}`)}</span>
          </label>
        ))}
      </div>

      {/* Categories */}
      <div style={section}>
        <div style={sectionTitle}>{t('exploreFilters.categories')}</div>
        {CATEGORY_KEYS.map((cat) => (
          <label key={cat} style={checkRow}>
            <input
              type="checkbox"
              checked={filters.categories.has(cat)}
              onChange={() => toggleCategory(cat)}
              style={checkInput}
            />
            <span style={checkLabel}>{t(`explore.category_${cat}`, cat)}</span>
          </label>
        ))}
      </div>

      {/* Min rating */}
      <div style={section}>
        <div style={sectionTitle}>{t('exploreFilters.minRating')}</div>
        <div style={ratingRow}>
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              style={{
                ...ratingBtn,
                background: filters.minRating === r ? 'var(--primary)' : 'var(--surface-3)',
                color: filters.minRating === r ? '#fff' : 'var(--text)',
              }}
              onClick={() => setMinRating(r)}
            >
              {r === 0 ? t('exploreFilters.any') : `${r}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      {availableTags.length > 0 && (
        <div style={section}>
          <div style={sectionTitle}>{t('exploreFilters.tags')}</div>
          <div style={tagCloud}>
            {availableTags.map((tag) => (
              <button
                key={tag}
                style={{
                  ...tagPill,
                  background: filters.tag === tag ? 'var(--primary)' : 'var(--surface-3)',
                  color: filters.tag === tag ? '#fff' : 'var(--text-muted)',
                }}
                onClick={() => setTag(filters.tag === tag ? null : tag)}
              >
                {tag}
                {filters.tag === tag && <X size={10} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const sidebar: React.CSSProperties = {
  width: 220,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '0.75rem',
  background: 'var(--surface-2)',
  borderRadius: 10,
  border: '1px solid var(--border)',
  alignSelf: 'flex-start',
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 4,
}

const headerTitle: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 700,
}

const clearBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--primary)',
  fontSize: '0.68rem',
  cursor: 'pointer',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  padding: 0,
}

const section: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
  paddingTop: 8,
}

const sectionTitle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 0',
  cursor: 'pointer',
}

const checkInput: React.CSSProperties = {
  margin: 0,
  accentColor: 'var(--primary)',
}

const radioInput: React.CSSProperties = {
  margin: 0,
  accentColor: 'var(--primary)',
}

const checkLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'capitalize',
}

const ratingRow: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
}

const ratingBtn: React.CSSProperties = {
  padding: '0.2rem 0.5rem',
  borderRadius: 6,
  border: 'none',
  fontSize: '0.68rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Montserrat', system-ui, sans-serif",
}

const tagCloud: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
}

const tagPill: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  padding: '0.15rem 0.5rem',
  borderRadius: 999,
  border: 'none',
  fontSize: '0.65rem',
  cursor: 'pointer',
  fontFamily: "'Montserrat', system-ui, sans-serif",
}
