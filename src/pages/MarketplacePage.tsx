/**
 * MarketplacePage — P103 shell + P104 browse/search/filter UI.
 *
 * Route: /explore (D9-1: renamed from /marketplace)
 *
 * Features:
 *   - Search bar (name filter)
 *   - Category filter tabs (All | Templates | Block packs | Themes | Groups | Custom Blocks)
 *   - Sort: most downloaded, most liked, newest (D9-5)
 *   - Tag filter (D9-5)
 *   - Item grid with install button
 *   - Plan-based install gating (D9-3)
 *   - Loading and empty states
 *   - Auth-gated install (prompts login for unauthenticated users)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  listPublishedItems,
  listOrgExploreItems,
  forkTemplate,
  installBlockPack,
  installTheme,
  getUserInstalls,
  getUserLikes,
  likeItem,
  unlikeItem,
  type MarketplaceItem,
  type ExploreSortKey,
} from '../lib/marketplaceService'
import { listMyOrgs, getOrgPolicy, type Org, type OrgPolicy } from '../lib/orgsService'
import { getProfile } from '../lib/profilesService'
import { getProjectCount } from '../lib/projects'
import { canInstallExploreItem, resolveEffectivePlan, type Plan } from '../lib/entitlements'
import { getSession } from '../lib/auth'
import { BRAND } from '../lib/brand'
import { getBlockedUsers } from '../lib/blockedUsers'

/** Map category key to i18n label key. */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  template: 'marketplace.categoryTemplate',
  block_pack: 'marketplace.categoryBlockPack',
  theme: 'marketplace.categoryTheme',
  group: 'marketplace.categoryGroup',
  custom_block: 'marketplace.categoryCustomBlock',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    height: 56,
    borderBottom: '1px solid var(--border)',
    background: 'var(--card-bg)',
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
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: 'var(--font-md)',
    outline: 'none',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.25rem',
  } satisfies React.CSSProperties,
  card: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    transition: 'box-shadow 0.2s, border-color 0.2s',
  } satisfies React.CSSProperties,
  cardBody: {
    padding: '1rem 1.25rem 1.25rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    flex: 1,
  } satisfies React.CSSProperties,
  categoryRow: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap' as const,
    marginBottom: '1.25rem',
  } satisfies React.CSSProperties,
  catBtn: (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.85rem',
    borderRadius: 'var(--radius-full)',
    border: active ? '1px solid var(--primary-text)' : '1px solid var(--border)',
    background: active ? 'var(--primary-dim)' : 'transparent',
    color: active ? 'var(--primary-text)' : 'var(--text-muted)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  catBadge: (cat: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '0.12rem 0.5rem',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    letterSpacing: '0.03em',
    background:
      cat === 'template'
        ? 'var(--primary-dim)'
        : cat === 'theme'
          ? 'rgba(139,92,246,0.15)'
          : cat === 'block_pack'
            ? 'rgba(34,197,94,0.15)'
            : 'var(--primary-dim)',
    color:
      cat === 'template'
        ? 'var(--primary-text)'
        : cat === 'theme'
          ? '#a78bfa'
          : cat === 'block_pack'
            ? 'var(--success)'
            : 'var(--primary-text)',
  }),
  installBtn: (installed: boolean, loading: boolean, locked: boolean): React.CSSProperties => ({
    marginTop: 'auto',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: installed
      ? 'rgba(74,222,128,0.12)'
      : locked
        ? 'rgba(124,58,237,0.15)'
        : loading
          ? 'var(--surface2)'
          : 'var(--primary)',
    color: installed
      ? 'var(--success)'
      : locked
        ? '#a78bfa'
        : loading
          ? 'var(--text-faint)'
          : '#fff',
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    cursor: installed || loading ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }),
  selectStyle: {
    padding: '0.4rem 0.6rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: 'var(--font-sm)',
    outline: 'none',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  statRow: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    fontSize: 'var(--font-xs)',
    color: 'var(--text-faint)',
    flexWrap: 'wrap' as const,
  } satisfies React.CSSProperties,
  tag: {
    padding: '0.1rem 0.45rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-xs)',
    background: 'var(--surface2)',
    color: 'var(--text-muted)',
  } satisfies React.CSSProperties,
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set())
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  // D9-3: plan + project count for install gating
  const [plan, setPlan] = useState<Plan>('free')
  const [projectCount, setProjectCount] = useState(0)

  // D9-5: sort + tag filter
  const [sort, setSort] = useState<ExploreSortKey>('downloads')
  const [tagFilter, setTagFilter] = useState('')

  // D10-1: Company Library tab
  const [viewMode, setViewMode] = useState<'public' | 'company'>('public')
  const [myOrgs, setMyOrgs] = useState<Org[]>([])
  const [orgItems, setOrgItems] = useState<MarketplaceItem[]>([])
  const [orgLoading, setOrgLoading] = useState(false)

  // D10-2: org policy flags
  const [orgPolicy, setOrgPolicy] = useState<OrgPolicy | null>(null)

  // D16-3: blocked authors (client-side filter)
  const [blockedAuthors] = useState(() => getBlockedUsers())

  // Fetch plan + project count + orgs on mount
  useEffect(() => {
    void (async () => {
      try {
        const session = await getSession()
        if (!session) return
        const [profile, count, orgs] = await Promise.all([
          getProfile(session.user.id),
          getProjectCount(),
          listMyOrgs(),
        ])
        if (profile) setPlan(resolveEffectivePlan(profile))
        setProjectCount(count)
        setMyOrgs(orgs)
        // D10-2: fetch policy for first org
        if (orgs.length > 0) {
          getOrgPolicy(orgs[0].id)
            .then(setOrgPolicy)
            .catch(() => {})
        }
      } catch {
        // Non-critical — default to 'free' plan
      }
    })()
  }, [])

  // Fetch items + user installs + likes on mount / filter change
  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fetched, installs, likes] = await Promise.all([
        listPublishedItems(
          category === 'all' ? undefined : category,
          query,
          sort,
          tagFilter || undefined,
        ),
        getUserInstalls(),
        getUserLikes(),
      ])
      setItems(fetched)
      setInstalledIds(new Set(installs.map((p) => p.item_id)))
      setLikedIds(likes)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [category, query, sort, tagFilter])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  // D10-1: fetch org items when switching to company view
  useEffect(() => {
    if (viewMode !== 'company' || myOrgs.length === 0) return
    setOrgLoading(true)
    void (async () => {
      try {
        const all = await Promise.all(myOrgs.map((o) => listOrgExploreItems(o.id)))
        setOrgItems(all.flat())
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setOrgLoading(false)
      }
    })()
  }, [viewMode, myOrgs])

  const handleInstall = useCallback(
    async (itemId: string) => {
      if (installedIds.has(itemId) || installingId === itemId) return
      const item = items.find((i) => i.id === itemId)
      if (!item) return

      // D10-2: org policy install check
      if (orgPolicy?.policy_installs_allowed === false) {
        setError(t('marketplace.installsDisabled'))
        return
      }

      // D9-3: plan gating check
      if (!canInstallExploreItem(plan, item.category, projectCount)) {
        setError(t('marketplace.upgradeToInstall'))
        return
      }

      setInstallingId(itemId)
      try {
        if (item.category === 'template') {
          const projectId = await forkTemplate(itemId)
          setProjectCount((c) => c + 1)
          navigate(`/canvas/${projectId}`)
          return
        }
        if (item.category === 'block_pack') {
          await installBlockPack(itemId)
        } else if (item.category === 'theme') {
          await installTheme(itemId)
        }
        setInstalledIds((prev) => new Set([...prev, itemId]))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('sign in')) {
          navigate('/login')
          return
        }
        setError(msg)
      } finally {
        setInstallingId(null)
      }
    },
    [installedIds, installingId, navigate, items, plan, projectCount, t],
  )

  const handleToggleLike = useCallback(
    async (itemId: string) => {
      const isLiked = likedIds.has(itemId)
      // Optimistic update
      setLikedIds((prev) => {
        const next = new Set(prev)
        if (isLiked) next.delete(itemId)
        else next.add(itemId)
        return next
      })
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, likes_count: i.likes_count + (isLiked ? -1 : 1) } : i,
        ),
      )
      try {
        if (isLiked) await unlikeItem(itemId)
        else await likeItem(itemId)
      } catch (err) {
        // Revert on failure
        setLikedIds((prev) => {
          const next = new Set(prev)
          if (isLiked) next.add(itemId)
          else next.delete(itemId)
          return next
        })
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, likes_count: i.likes_count + (isLiked ? 1 : -1) } : i,
          ),
        )
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('sign in')) {
          navigate('/login')
          return
        }
      }
    },
    [likedIds, navigate],
  )

  const categories = [
    { key: 'all', label: t('marketplace.allCategories') },
    { key: 'template', label: t('marketplace.categoryTemplate') },
    { key: 'block_pack', label: t('marketplace.categoryBlockPack') },
    { key: 'theme', label: t('marketplace.categoryTheme') },
    { key: 'group', label: t('marketplace.categoryGroup') },
    { key: 'custom_block', label: t('marketplace.categoryCustomBlock') },
  ]

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav} aria-label={t('marketplace.navLabel')}>
        <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 28 }} />
        </a>
        <span
          style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-muted)' }}
          aria-current="page"
        >
          {t('marketplace.title')}
        </span>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a
            href="/explore/author"
            style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            {t('marketplace.myItems')}
          </a>
          <a
            href="/app"
            style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            ← {t('app.name')}
          </a>
        </div>
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

        {/* D10-1: Public / Company toggle (hidden if policy disables Explore D10-2) */}
        {myOrgs.length > 0 && orgPolicy?.policy_explore_enabled !== false && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }} role="tablist">
            <button
              role="tab"
              aria-selected={viewMode === 'public'}
              style={s.catBtn(viewMode === 'public')}
              onClick={() => setViewMode('public')}
            >
              {t('marketplace.title')}
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'company'}
              style={s.catBtn(viewMode === 'company')}
              onClick={() => setViewMode('company')}
              data-testid="company-library-tab"
            >
              {t('marketplace.companyLibrary')}
            </button>
          </div>
        )}

        {/* Search + Sort + Tag filter (D9-5) — public view only */}
        {viewMode === 'public' && (
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
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ExploreSortKey)}
              style={s.selectStyle}
              aria-label={t('marketplace.sortMostDownloaded')}
              data-testid="marketplace-sort"
            >
              <option value="downloads">{t('marketplace.sortMostDownloaded')}</option>
              <option value="likes">{t('marketplace.sortMostLiked')}</option>
              <option value="newest">{t('marketplace.sortNewestFirst')}</option>
            </select>
            <input
              type="text"
              placeholder={t('marketplace.filterByTag')}
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              style={{ ...s.searchInput, flex: 'none', minWidth: 140, width: 160 }}
              aria-label={t('marketplace.filterByTag')}
              data-testid="marketplace-tag-filter"
            />
          </div>
        )}

        {/* Category filter — public view only */}
        {viewMode === 'public' && (
          <div
            style={s.categoryRow}
            role="tablist"
            aria-label={t('marketplace.categoryFilterLabel')}
          >
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
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* D10-1: Company Library view */}
        {viewMode === 'company' && (
          <>
            {orgLoading && (
              <div
                style={{
                  opacity: 0.45,
                  fontSize: '0.88rem',
                  textAlign: 'center',
                  padding: '3rem 0',
                }}
              >
                {t('marketplace.loading')}
              </div>
            )}
            {!orgLoading && orgItems.length === 0 && (
              <div
                style={{
                  opacity: 0.35,
                  fontSize: '0.88rem',
                  textAlign: 'center',
                  padding: '3rem 0',
                }}
                data-testid="company-library-empty"
              >
                {t('marketplace.companyLibraryEmpty')}
              </div>
            )}
            {!orgLoading && orgItems.length > 0 && (
              <div style={s.grid} data-testid="company-library-grid">
                {orgItems.map((item) => (
                  <article key={item.id} style={s.card}>
                    <a
                      href={`/explore/items/${item.id}`}
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      {item.name}
                    </a>
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
                    <div style={s.statRow}>
                      <span style={s.catBadge(item.category)}>
                        {t(CATEGORY_LABEL_KEYS[item.category] ?? 'marketplace.categoryTemplate')}
                      </span>
                      <span>{formatDate(item.updated_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {/* Loading — public view */}
        {viewMode === 'public' && loading && (
          <div
            style={{ opacity: 0.45, fontSize: '0.88rem', textAlign: 'center', padding: '3rem 0' }}
          >
            {t('marketplace.loading')}
          </div>
        )}

        {/* Empty — public view */}
        {viewMode === 'public' && !loading && !error && items.length === 0 && (
          <div
            style={{ opacity: 0.35, fontSize: '0.88rem', textAlign: 'center', padding: '3rem 0' }}
            data-testid="marketplace-empty"
          >
            {t('marketplace.noResults')}
          </div>
        )}

        {/* Items grid — public view */}
        {viewMode === 'public' && !loading && items.length > 0 && (
          <div style={s.grid} data-testid="marketplace-grid">
            {items
              .filter((item) => !blockedAuthors.has(item.author_id))
              .map((item) => {
                const isInstalled = installedIds.has(item.id)
                const isInstalling = installingId === item.id
                const canInstall = canInstallExploreItem(plan, item.category, projectCount)
                const isLocked = !canInstall && !isInstalled
                return (
                  <article key={item.id} style={s.card}>
                    {/* Thumbnail */}
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.name}
                        style={{
                          width: '100%',
                          height: 140,
                          objectFit: 'cover',
                          borderBottom: '1px solid var(--border)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: 80,
                          background: 'var(--surface2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--font-2xl)',
                          color: 'var(--text-faint)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {item.category === 'template'
                          ? '📄'
                          : item.category === 'theme'
                            ? '🎨'
                            : item.category === 'block_pack'
                              ? '📦'
                              : '🧩'}
                      </div>
                    )}

                    {/* Card body */}
                    <div style={s.cardBody}>
                      {/* Category badge + plan badge row */}
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <span style={s.catBadge(item.category)}>
                          {t(CATEGORY_LABEL_KEYS[item.category] ?? 'marketplace.categoryTemplate')}
                        </span>
                        {isLocked && (
                          <span
                            style={{
                              ...s.catBadge(''),
                              background: 'rgba(124,58,237,0.15)',
                              color: '#a78bfa',
                            }}
                          >
                            Pro
                          </span>
                        )}
                      </div>

                      {/* Title + version */}
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                        <a
                          href={`/explore/items/${item.id}`}
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--font-lg)',
                            textDecoration: 'none',
                            color: 'inherit',
                          }}
                        >
                          {item.name}
                        </a>
                        <span
                          style={{
                            fontSize: 'var(--font-xs)',
                            color: 'var(--text-faint)',
                            flexShrink: 0,
                          }}
                        >
                          {t('marketplace.version', { version: item.version })}
                        </span>
                      </div>

                      {/* Description */}
                      {item.description && (
                        <p
                          style={{
                            fontSize: 'var(--font-sm)',
                            color: 'var(--text-muted)',
                            margin: 0,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.5,
                          }}
                        >
                          {item.description}
                        </p>
                      )}

                      {/* Stats row: downloads, likes, date */}
                      <div style={s.statRow}>
                        <span>↓ {item.downloads_count}</span>
                        <span>♡ {item.likes_count ?? 0}</span>
                        <span>{formatDate(item.updated_at)}</span>
                      </div>

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {item.tags.slice(0, 4).map((tag) => (
                            <span key={tag} style={s.tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Like + Install row */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'center',
                          marginTop: 'auto',
                        }}
                      >
                        <button
                          onClick={() => void handleToggleLike(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 'var(--font-sm)',
                            color: likedIds.has(item.id) ? 'var(--danger)' : 'var(--text-faint)',
                            padding: '0.3rem 0',
                            fontFamily: 'inherit',
                          }}
                          aria-label={t('marketplace.toggleLike')}
                        >
                          {likedIds.has(item.id) ? '\u2665' : '\u2661'} {item.likes_count ?? 0}
                        </button>
                        <button
                          style={{ ...s.installBtn(isInstalled, isInstalling, isLocked), flex: 1 }}
                          onClick={() => void handleInstall(item.id)}
                          disabled={isInstalled || isInstalling}
                          aria-label={
                            isInstalled
                              ? t('marketplace.installed')
                              : isLocked
                                ? t('marketplace.upgradeToInstall')
                                : t('marketplace.install') + ' ' + item.name
                          }
                          data-testid={`install-btn-${item.id}`}
                        >
                          {isInstalled
                            ? t('marketplace.installed')
                            : isInstalling
                              ? t('marketplace.installing')
                              : isLocked
                                ? t('marketplace.proRequired')
                                : t('marketplace.install')}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
          </div>
        )}
      </main>
    </div>
  )
}
