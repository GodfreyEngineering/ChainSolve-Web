/**
 * MarketplacePage — P103 shell + P104 browse/search/filter UI.
 *
 * Route: /marketplace
 *
 * Features:
 *   - Search bar (name filter)
 *   - Category filter tabs (All | Templates | Block packs | Themes)
 *   - Item grid with install button
 *   - Loading and empty states
 *   - Auth-gated install (prompts login for unauthenticated users)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  listPublishedItems,
  recordInstall,
  getUserInstalls,
  type MarketplaceItem,
} from '../lib/marketplaceService'
import { BRAND } from '../lib/brand'

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg, #1a1a1a)',
    color: 'var(--fg, #F4F4F3)',
    fontFamily: 'system-ui, sans-serif',
  } satisfies React.CSSProperties,
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    height: 56,
    borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
    background: 'var(--card-bg, #252525)',
  } satisfies React.CSSProperties,
  body: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  } satisfies React.CSSProperties,
  searchRow: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  } satisfies React.CSSProperties,
  searchInput: {
    flex: 1,
    minWidth: 200,
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--fg, #F4F4F3)',
    fontSize: '0.9rem',
    outline: 'none',
  } satisfies React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1rem',
  } satisfies React.CSSProperties,
  card: {
    background: 'var(--card-bg, #252525)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  } satisfies React.CSSProperties,
  categoryRow: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap' as const,
    marginBottom: '1.25rem',
  } satisfies React.CSSProperties,
  catBtn: (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.85rem',
    borderRadius: 20,
    border: active ? '1px solid #1CABB0' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(28,171,176,0.15)' : 'transparent',
    color: active ? '#1CABB0' : 'rgba(244,244,243,0.6)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  installBtn: (installed: boolean, loading: boolean): React.CSSProperties => ({
    marginTop: 'auto',
    padding: '0.45rem 1rem',
    borderRadius: 8,
    border: 'none',
    background: installed ? 'rgba(74,222,128,0.12)' : loading ? '#3f3f46' : '#1CABB0',
    color: installed ? '#4ade80' : loading ? 'rgba(244,244,243,0.4)' : '#fff',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: installed || loading ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }),
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set())
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  // Fetch items + user installs on mount / filter change
  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fetched, installs] = await Promise.all([
        listPublishedItems(category === 'all' ? undefined : category, query),
        getUserInstalls(),
      ])
      setItems(fetched)
      setInstalledIds(new Set(installs.map((p) => p.item_id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [category, query])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const handleInstall = useCallback(
    async (itemId: string) => {
      if (installedIds.has(itemId) || installingId === itemId) return
      setInstallingId(itemId)
      try {
        await recordInstall(itemId)
        setInstalledIds((prev) => new Set([...prev, itemId]))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // If unauthenticated, redirect to login
        if (msg.toLowerCase().includes('sign in')) {
          navigate('/login')
          return
        }
        setError(msg)
      } finally {
        setInstallingId(null)
      }
    },
    [installedIds, installingId, navigate],
  )

  const categories = [
    { key: 'all', label: t('marketplace.allCategories') },
    { key: 'template', label: t('marketplace.categoryTemplate') },
    { key: 'block_pack', label: t('marketplace.categoryBlockPack') },
    { key: 'theme', label: t('marketplace.categoryTheme') },
  ]

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav} aria-label={t('marketplace.navLabel')}>
        <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 28 }} />
        </a>
        <span
          style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(244,244,243,0.7)' }}
          aria-current="page"
        >
          {t('marketplace.title')}
        </span>
        <a
          href="/app"
          style={{ fontSize: '0.82rem', color: 'rgba(244,244,243,0.5)', textDecoration: 'none' }}
        >
          ← {t('app.name')}
        </a>
      </nav>

      {/* Body */}
      <main style={s.body} data-testid="marketplace-page">
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: '0 0 0.35rem',
          }}
        >
          {t('marketplace.title')}
        </h1>
        <p style={{ margin: '0 0 1.5rem', opacity: 0.5, fontSize: '0.88rem' }}>
          {t('marketplace.subtitle')}
        </p>

        {/* Search */}
        <div style={s.searchRow}>
          <input
            type="search"
            placeholder={t('marketplace.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={s.searchInput}
            aria-label={t('marketplace.searchPlaceholder')}
            data-testid="marketplace-search"
          />
        </div>

        {/* Category filter */}
        <div style={s.categoryRow} role="tablist" aria-label={t('marketplace.categoryFilterLabel')}>
          {categories.map((cat) => (
            <button
              key={cat.key}
              role="tab"
              aria-selected={category === cat.key}
              style={s.catBtn(category === cat.key)}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div
            style={{ opacity: 0.45, fontSize: '0.88rem', textAlign: 'center', padding: '3rem 0' }}
          >
            {t('marketplace.loading')}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && items.length === 0 && (
          <div
            style={{ opacity: 0.35, fontSize: '0.88rem', textAlign: 'center', padding: '3rem 0' }}
            data-testid="marketplace-empty"
          >
            {t('marketplace.noResults')}
          </div>
        )}

        {/* Items grid */}
        {!loading && items.length > 0 && (
          <div style={s.grid} data-testid="marketplace-grid">
            {items.map((item) => {
              const isInstalled = installedIds.has(item.id)
              const isInstalling = installingId === item.id
              return (
                <article key={item.id} style={s.card}>
                  {item.thumbnail_url && (
                    <img
                      src={item.thumbnail_url}
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 8,
                        marginBottom: '0.25rem',
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.4rem',
                      alignItems: 'baseline',
                    }}
                  >
                    <a
                      href={`/marketplace/items/${item.id}`}
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      {item.name}
                    </a>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: 'rgba(244,244,243,0.35)',
                        flexShrink: 0,
                      }}
                    >
                      {t('marketplace.version', { version: item.version })}
                    </span>
                  </div>
                  {item.description && (
                    <p
                      style={{
                        fontSize: '0.8rem',
                        opacity: 0.55,
                        margin: 0,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {item.description}
                    </p>
                  )}
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'rgba(244,244,243,0.35)',
                      display: 'flex',
                      gap: '0.75rem',
                    }}
                  >
                    <span>{item.category}</span>
                    <span>{t('marketplace.downloads', { count: item.downloads_count })}</span>
                  </div>
                  <button
                    style={s.installBtn(isInstalled, isInstalling)}
                    onClick={() => void handleInstall(item.id)}
                    disabled={isInstalled || isInstalling}
                    aria-label={
                      isInstalled
                        ? t('marketplace.installed')
                        : t('marketplace.install') + ' ' + item.name
                    }
                  >
                    {isInstalled
                      ? t('marketplace.installed')
                      : isInstalling
                        ? t('marketplace.installing')
                        : t('marketplace.install')}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
