/**
 * ItemDetailPage — P105 item detail + install button.
 *
 * Route: /explore/items/:itemId (D9-1: renamed from /marketplace)
 *
 * Features:
 *   - Item metadata (name, version, author, category, downloads)
 *   - Thumbnail
 *   - Description (full)
 *   - Install / Installed button (auth-gated + plan-gated D9-3)
 *   - Back link to Explore browse
 *   - Loading and not-found states
 *   - D16-2: What's included, compatibility, changelog sections
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getItem,
  forkTemplate,
  installBlockPack,
  installTheme,
  getUserInstalls,
  getUserLikes,
  likeItem,
  unlikeItem,
  getItemComments,
  postComment,
  deleteComment,
  reportComment,
  reportItem,
  checkCommentRateLimit,
  type MarketplaceItem,
  type MarketplaceComment,
} from '../lib/marketplaceService'
import { createCheckoutSession } from '../lib/stripeConnectService'
import { getProfile } from '../lib/profilesService'
import { getProjectCount } from '../lib/projects'
import { canInstallExploreItem, type Plan } from '../lib/entitlements'
import { getSession } from '../lib/auth'
import { listMyOrgs, getOrgPolicy, type OrgPolicy } from '../lib/orgsService'
import { ENGINE_CONTRACT_VERSION } from '../lib/engineContractVersion'
import { isUserBlocked, blockUser as blockUserAction, getBlockedUsers } from '../lib/blockedUsers'
import { BRAND } from '../lib/brand'

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  template: 'marketplace.categoryTemplate',
  block_pack: 'marketplace.categoryBlockPack',
  theme: 'marketplace.categoryTheme',
  group: 'marketplace.categoryGroup',
  custom_block: 'marketplace.categoryCustomBlock',
}

const CATEGORY_EMOJI: Record<string, string> = {
  template: '\uD83D\uDCC4',
  block_pack: '\uD83E\uDDE9',
  theme: '\uD83C\uDFA8',
  group: '\uD83D\uDCC2',
  custom_block: '\u2699\uFE0F',
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
    padding: '0 var(--space-6)',
    height: 56,
    borderBottom: '1px solid var(--border)',
    background: 'var(--card-bg)',
  } satisfies React.CSSProperties,
  body: {
    maxWidth: 820,
    margin: '0 auto',
    padding: 'var(--space-8) var(--space-6)',
  } satisfies React.CSSProperties,
  backLink: {
    fontSize: 'var(--font-sm)',
    color: 'var(--text-muted)',
    textDecoration: 'none',
  } satisfies React.CSSProperties,
  thumbnail: {
    width: '100%',
    maxHeight: 280,
    objectFit: 'cover' as const,
    borderRadius: 'var(--radius-xl)',
    marginBottom: 'var(--space-6)',
  } satisfies React.CSSProperties,
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 'var(--space-4)',
    flexWrap: 'wrap' as const,
    marginBottom: 'var(--space-4)',
  } satisfies React.CSSProperties,
  metaRow: {
    display: 'flex',
    gap: 'var(--space-4)',
    fontSize: 'var(--font-sm)',
    color: 'var(--text-muted)',
    flexWrap: 'wrap' as const,
  } satisfies React.CSSProperties,
  dateRow: {
    display: 'flex',
    gap: 'var(--space-4)',
    fontSize: 'var(--font-xs)',
    color: 'var(--text-faint)',
    marginTop: 'var(--space-1)',
    flexWrap: 'wrap' as const,
  } satisfies React.CSSProperties,
  tag: {
    padding: '0.15rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-2xs)',
    background: 'var(--surface2)',
    color: 'var(--text-muted)',
  } satisfies React.CSSProperties,
  installBtn: (
    done: boolean,
    loading: boolean,
    isPaid: boolean,
    locked: boolean,
  ): React.CSSProperties => ({
    padding: '0.6rem 1.5rem',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: done
      ? 'rgba(74,222,128,0.12)'
      : locked
        ? 'rgba(124,58,237,0.15)'
        : loading
          ? 'var(--surface2)'
          : isPaid
            ? '#7c3aed'
            : 'var(--primary)',
    color: done ? 'var(--success)' : locked ? '#a78bfa' : loading ? 'var(--text-faint)' : '#fff',
    fontSize: 'var(--font-md)',
    fontWeight: 600,
    cursor: done || loading ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }),
  likeBtn: (liked: boolean): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 'var(--font-sm)',
    color: liked ? 'var(--danger)' : 'var(--text-muted)',
    padding: '0.2rem 0',
    fontFamily: 'inherit',
  }),
  section: {
    marginTop: 'var(--space-8)',
    paddingTop: 'var(--space-6)',
    borderTop: '1px solid var(--border)',
  } satisfies React.CSSProperties,
  sectionTitle: {
    fontSize: 'var(--font-lg)',
    fontWeight: 600,
    marginBottom: 'var(--space-4)',
    margin: '0 0 var(--space-4)',
  } satisfies React.CSSProperties,
  infoCard: {
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
  } satisfies React.CSSProperties,
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-2) 0',
    fontSize: 'var(--font-sm)',
  } satisfies React.CSSProperties,
  infoLabel: {
    color: 'var(--text-muted)',
  } satisfies React.CSSProperties,
  infoValue: {
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 'var(--font-sm)',
  } satisfies React.CSSProperties,
  compatBadge: (ok: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    padding: '0.2rem 0.6rem',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
    color: ok ? 'var(--success)' : 'var(--danger)',
  }),
  changelogEntry: {
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    marginBottom: 'var(--space-2)',
  } satisfies React.CSSProperties,
  commentTextarea: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: 'var(--font-sm)',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  } satisfies React.CSSProperties,
  commentSubmitBtn: (disabled: boolean): React.CSSProperties => ({
    padding: '0.4rem 1rem',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: disabled ? 'var(--surface2)' : 'var(--primary)',
    color: disabled ? 'var(--text-faint)' : '#fff',
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }),
  commentCard: {
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    marginBottom: 'var(--space-2)',
  } satisfies React.CSSProperties,
  commentAction: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 'var(--font-2xs)',
    color: 'var(--text-faint)',
    fontFamily: 'inherit',
    padding: 0,
  } satisfies React.CSSProperties,
  errorBanner: {
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: 'var(--danger)',
    fontSize: 'var(--font-sm)',
    marginBottom: 'var(--space-6)',
  } satisfies React.CSSProperties,
  muted: {
    fontSize: 'var(--font-md)',
    textAlign: 'center' as const,
    padding: 'var(--space-8) 0',
    color: 'var(--text-muted)',
  } satisfies React.CSSProperties,
}

// ── Payload helpers ─────────────────────────────────────────────────────────────

interface PayloadMeta {
  minContractVersion?: number
  changelog?: string
}

interface TemplatePayload extends PayloadMeta {
  snapshot?: { nodes?: unknown[]; edges?: unknown[] }
  sheets?: unknown[]
}

interface BlockPackPayload extends PayloadMeta {
  defs?: unknown[]
}

interface ThemePayload extends PayloadMeta {
  variables?: Record<string, string>
}

function getWhatsIncluded(category: string, payload: unknown): { label: string; value: string }[] {
  if (!payload || typeof payload !== 'object') return []
  const items: { label: string; value: string }[] = []

  if (category === 'template') {
    const p = payload as TemplatePayload
    const nodes = p.snapshot?.nodes
    const edges = p.snapshot?.edges
    const sheets = p.sheets
    if (Array.isArray(nodes)) items.push({ label: 'Nodes', value: String(nodes.length) })
    if (Array.isArray(edges)) items.push({ label: 'Connections', value: String(edges.length) })
    if (Array.isArray(sheets)) items.push({ label: 'Sheets', value: String(sheets.length) })
  } else if (category === 'block_pack') {
    const p = payload as BlockPackPayload
    if (Array.isArray(p.defs))
      items.push({ label: 'Block definitions', value: String(p.defs.length) })
  } else if (category === 'theme') {
    const p = payload as ThemePayload
    if (p.variables && typeof p.variables === 'object') {
      items.push({ label: 'CSS variables', value: String(Object.keys(p.variables).length) })
    }
  }

  return items
}

function getMinContractVersion(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as PayloadMeta
  return typeof p.minContractVersion === 'number' ? p.minContractVersion : null
}

function getChangelog(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as PayloadMeta
  return typeof p.changelog === 'string' && p.changelog.trim() ? p.changelog.trim() : null
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ItemDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { itemId } = useParams<{ itemId: string }>()

  const [item, setItem] = useState<MarketplaceItem | null>(null)
  const [installed, setInstalled] = useState(false)
  const [liked, setLiked] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // D9-3: plan + project count for install gating
  const [plan, setPlan] = useState<Plan>('free')
  const [projectCount, setProjectCount] = useState(0)

  // D9-4: comments
  const [comments, setComments] = useState<MarketplaceComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentPosting, setCommentPosting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // D10-2: org policy
  const [orgPolicy, setOrgPolicy] = useState<OrgPolicy | null>(null)

  // D16-3: moderation
  const [authorBlocked, setAuthorBlocked] = useState(false)
  const [itemReported, setItemReported] = useState(false)

  useEffect(() => {
    if (!itemId) {
      setNotFound(true)
      setLoading(false)
      return
    }
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [fetched, installs, likes] = await Promise.all([
          getItem(itemId),
          getUserInstalls(),
          getUserLikes(),
        ])
        if (!fetched) {
          setNotFound(true)
        } else {
          setItem(fetched)
          setInstalled(installs.some((p) => p.item_id === itemId))
          setLiked(likes.has(itemId))
          // D16-3: check if author is blocked
          setAuthorBlocked(isUserBlocked(fetched.author_id))
        }
        // D9-3: fetch plan + project count; D9-4: fetch comments; D10-2: org policy
        const session = await getSession()
        if (session) {
          setCurrentUserId(session.user.id)
          const [profile, count, orgs] = await Promise.all([
            getProfile(session.user.id),
            getProjectCount(),
            listMyOrgs(),
          ])
          if (profile?.plan) setPlan(profile.plan as Plan)
          setProjectCount(count)
          // D10-2: fetch policy for first org
          if (orgs.length > 0) {
            getOrgPolicy(orgs[0].id)
              .then(setOrgPolicy)
              .catch(() => {})
          }
        }
        // D9-4: load comments (non-blocking)
        if (fetched) {
          getItemComments(itemId)
            .then(setComments)
            .catch(() => {})
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [itemId])

  const isPaid = (item?.price_cents ?? 0) > 0
  const canInstall = item ? canInstallExploreItem(plan, item.category, projectCount) : false
  const isLocked = !canInstall && !installed && !isPaid

  // D16-2: payload-derived sections
  const whatsIncluded = useMemo(
    () => (item ? getWhatsIncluded(item.category, item.payload) : []),
    [item],
  )
  const minContract = useMemo(() => (item ? getMinContractVersion(item.payload) : null), [item])
  const isCompatible = minContract === null || minContract <= ENGINE_CONTRACT_VERSION
  const changelog = useMemo(() => (item ? getChangelog(item.payload) : null), [item])

  // D16-3: filter comments from blocked users
  const visibleComments = useMemo(() => {
    const blocked = getBlockedUsers()
    if (blocked.size === 0) return comments
    return comments.filter((c) => !blocked.has(c.user_id))
  }, [comments])

  const handleToggleLike = useCallback(async () => {
    if (!itemId || !item) return
    const wasLiked = liked
    setLiked(!wasLiked)
    setItem((prev) =>
      prev ? { ...prev, likes_count: prev.likes_count + (wasLiked ? -1 : 1) } : prev,
    )
    try {
      if (wasLiked) await unlikeItem(itemId)
      else await likeItem(itemId)
    } catch (err) {
      setLiked(wasLiked)
      setItem((prev) =>
        prev ? { ...prev, likes_count: prev.likes_count + (wasLiked ? 1 : -1) } : prev,
      )
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('sign in')) {
        navigate('/login')
      }
    }
  }, [itemId, item, liked, navigate])

  const handleInstall = useCallback(async () => {
    if (!itemId || installed || installing) return

    // D10-2: org policy install check
    if (orgPolicy?.policy_installs_allowed === false) {
      setError(t('marketplace.installsDisabled'))
      return
    }

    // D9-3: plan gating check
    if (!isPaid && item && !canInstallExploreItem(plan, item.category, projectCount)) {
      setError(t('marketplace.upgradeToInstall'))
      return
    }

    setInstalling(true)
    try {
      // Paid item — redirect to Stripe Checkout
      if (isPaid) {
        const { url } = await createCheckoutSession(itemId)
        window.location.href = url
        return
      }
      if (item?.category === 'template') {
        // Fork the template into the user's projects, then navigate there
        const projectId = await forkTemplate(itemId)
        setProjectCount((c) => c + 1)
        navigate(`/canvas/${projectId}`)
        return
      }
      if (item?.category === 'block_pack') {
        await installBlockPack(itemId)
      } else if (item?.category === 'theme') {
        await installTheme(itemId)
      }
      setInstalled(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('sign in')) {
        navigate('/login')
        return
      }
      setError(msg)
    } finally {
      setInstalling(false)
    }
  }, [itemId, installed, installing, navigate, item, isPaid, plan, projectCount, t, orgPolicy])

  // D9-4: comment handlers
  const handlePostComment = useCallback(async () => {
    if (!itemId || !commentText.trim()) return
    // D10-2: org policy comment check
    if (orgPolicy?.policy_comments_allowed === false) {
      setCommentError(t('marketplace.commentsDisabled'))
      return
    }
    if (!checkCommentRateLimit()) {
      setCommentError(t('marketplace.commentRateLimited'))
      return
    }
    setCommentPosting(true)
    setCommentError(null)
    try {
      const newComment = await postComment(itemId, commentText)
      setComments((prev) => [newComment, ...prev])
      setCommentText('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('sign in')) {
        navigate('/login')
        return
      }
      setCommentError(msg)
    } finally {
      setCommentPosting(false)
    }
  }, [itemId, commentText, navigate, t, orgPolicy])

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const handleReportComment = useCallback(
    async (commentId: string) => {
      try {
        await reportComment(commentId, 'Reported by user')
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('sign in')) {
          navigate('/login')
          return
        }
        setCommentError(msg)
      }
    },
    [navigate],
  )

  // D16-3: report item handler
  const handleReportItem = useCallback(async () => {
    if (!itemId) return
    if (!window.confirm(t('marketplace.reportItemConfirm'))) return
    try {
      await reportItem(itemId, 'Reported by user')
      setItemReported(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('sign in')) {
        navigate('/login')
        return
      }
      setError(msg)
    }
  }, [itemId, t, navigate])

  // D16-3: block author handler
  const handleBlockAuthor = useCallback(() => {
    if (!item) return
    if (!window.confirm(t('marketplace.blockUserConfirm'))) return
    blockUserAction(item.author_id)
    setAuthorBlocked(true)
  }, [item, t])

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav} aria-label={t('marketplace.itemNavLabel')}>
        <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 28 }} />
        </a>
        <a href="/explore" style={s.backLink}>
          {'\u2190'} {t('marketplace.title')}
        </a>
      </nav>

      {/* Body */}
      <main style={s.body} data-testid="item-detail-page">
        {/* Loading */}
        {loading && <div style={s.muted}>{t('marketplace.loading')}</div>}

        {/* Not found */}
        {!loading && notFound && (
          <div style={s.muted} data-testid="item-not-found">
            {t('marketplace.itemNotFound')}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={s.errorBanner} role="alert">
            {error}
          </div>
        )}

        {/* D16-3: Blocked author notice */}
        {!loading && item && authorBlocked && (
          <div
            style={{
              ...s.errorBanner,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: 'var(--warning)',
            }}
            data-testid="blocked-notice"
          >
            {t('marketplace.blockedNotice')}
          </div>
        )}

        {/* Item detail */}
        {!loading && item && (
          <article data-testid="item-detail">
            {/* Thumbnail */}
            {item.thumbnail_url ? (
              <img src={item.thumbnail_url} alt={item.name} style={s.thumbnail} />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 180,
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3rem',
                  marginBottom: 'var(--space-6)',
                }}
              >
                {CATEGORY_EMOJI[item.category] ?? '\uD83D\uDCC4'}
              </div>
            )}

            {/* Header row */}
            <div style={s.headerRow}>
              <div>
                <h1
                  style={{
                    margin: '0 0 var(--space-1)',
                    fontSize: 'var(--font-2xl)',
                    fontWeight: 700,
                  }}
                >
                  {item.name}
                </h1>
                <div style={s.metaRow}>
                  <span>
                    {t(CATEGORY_LABEL_KEYS[item.category] ?? 'marketplace.categoryTemplate')}
                  </span>
                  <span>{t('marketplace.version', { version: item.version })}</span>
                  <span>{t('marketplace.downloads', { count: item.downloads_count })}</span>
                  <span>{t('marketplace.likes', { count: item.likes_count ?? 0 })}</span>
                </div>
                <div style={s.dateRow}>
                  <span>
                    {t('marketplace.created')}: {formatDate(item.created_at)}
                  </span>
                  <span>
                    {t('marketplace.updated')}: {formatDate(item.updated_at)}
                  </span>
                </div>
                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-1)',
                      flexWrap: 'wrap',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    {item.tags.map((tag) => (
                      <span key={tag} style={s.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 'var(--space-1)',
                }}
              >
                {!isPaid && !installed && !isLocked && (
                  <span
                    style={{ fontSize: 'var(--font-xs)', color: 'var(--success)', opacity: 0.8 }}
                  >
                    {t('marketplace.free')}
                  </span>
                )}
                {isLocked && (
                  <span style={{ fontSize: 'var(--font-xs)', color: '#a78bfa' }}>
                    {t('marketplace.proRequired')}
                  </span>
                )}
                <button
                  style={s.installBtn(installed, installing, isPaid, isLocked)}
                  onClick={() => void handleInstall()}
                  disabled={installed || installing}
                  data-testid="install-btn"
                >
                  {installed
                    ? t('marketplace.installed')
                    : isLocked
                      ? t('marketplace.upgradeToInstall')
                      : installing
                        ? isPaid
                          ? t('marketplace.buying')
                          : t('marketplace.installing')
                        : isPaid
                          ? t('marketplace.buyFor', {
                              price: (item.price_cents / 100).toFixed(2),
                            })
                          : t('marketplace.install')}
                </button>
                <button
                  onClick={() => void handleToggleLike()}
                  style={s.likeBtn(liked)}
                  aria-label={t('marketplace.toggleLike')}
                  data-testid="like-btn"
                >
                  {liked ? '\u2665' : '\u2661'} {item.likes_count ?? 0}
                </button>
                {/* D16-3: moderation actions */}
                {currentUserId && currentUserId !== item.author_id && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    <button
                      onClick={() => void handleReportItem()}
                      disabled={itemReported}
                      style={s.commentAction}
                      data-testid="report-item-btn"
                    >
                      {itemReported
                        ? t('marketplace.reportItemSuccess')
                        : t('marketplace.reportItem')}
                    </button>
                    {!authorBlocked && (
                      <button
                        onClick={handleBlockAuthor}
                        style={s.commentAction}
                        data-testid="block-author-btn"
                      >
                        {t('marketplace.blockUser')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {item.description && (
              <p
                style={{
                  fontSize: 'var(--font-md)',
                  lineHeight: 1.65,
                  color: 'var(--text-muted)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {item.description}
              </p>
            )}

            {/* D16-2: What's included */}
            {whatsIncluded.length > 0 && (
              <section style={s.section} data-testid="whats-included">
                <h2 style={s.sectionTitle}>{t('marketplace.whatsIncluded')}</h2>
                <div style={s.infoCard}>
                  {whatsIncluded.map((row, i) => (
                    <div
                      key={row.label}
                      style={{
                        ...s.infoRow,
                        borderBottom:
                          i < whatsIncluded.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <span style={s.infoLabel}>{row.label}</span>
                      <span style={s.infoValue}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* D16-2: Compatibility */}
            <section style={s.section} data-testid="compatibility">
              <h2 style={s.sectionTitle}>{t('marketplace.compatibility')}</h2>
              <div style={s.infoCard}>
                <div style={s.infoRow}>
                  <span style={s.infoLabel}>{t('marketplace.requiredEngine')}</span>
                  <span style={s.infoValue}>
                    {minContract !== null ? `v${minContract}` : t('marketplace.anyVersion')}
                  </span>
                </div>
                <div style={{ ...s.infoRow, borderTop: '1px solid var(--border)' }}>
                  <span style={s.infoLabel}>{t('marketplace.yourEngine')}</span>
                  <span style={s.infoValue}>v{ENGINE_CONTRACT_VERSION}</span>
                </div>
                <div
                  style={{
                    ...s.infoRow,
                    borderTop: '1px solid var(--border)',
                    justifyContent: 'flex-start',
                    gap: 'var(--space-2)',
                  }}
                >
                  <span style={s.compatBadge(isCompatible)}>
                    {isCompatible ? '\u2713' : '\u2717'}{' '}
                    {isCompatible ? t('marketplace.compatible') : t('marketplace.incompatible')}
                  </span>
                </div>
              </div>
            </section>

            {/* D16-2: Changelog */}
            <section style={s.section} data-testid="changelog">
              <h2 style={s.sectionTitle}>{t('marketplace.changelog')}</h2>
              {changelog ? (
                <div style={s.changelogEntry}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-sm)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {changelog}
                  </p>
                </div>
              ) : (
                <div style={s.changelogEntry}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                      v{item.version}
                    </span>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-faint)' }}>
                      {formatDate(item.updated_at)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 'var(--space-1) 0 0',
                      fontSize: 'var(--font-sm)',
                      color: 'var(--text-faint)',
                    }}
                  >
                    {t('marketplace.initialRelease')}
                  </p>
                </div>
              )}
            </section>

            {/* D9-4: Comments section */}
            <section style={s.section} data-testid="comments-section">
              <h2 style={s.sectionTitle}>
                {t('marketplace.comments')} ({visibleComments.length})
              </h2>

              {/* Comment form */}
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('marketplace.commentPlaceholder')}
                  maxLength={2000}
                  rows={3}
                  style={s.commentTextarea}
                  data-testid="comment-input"
                />
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    alignItems: 'center',
                    marginTop: 'var(--space-2)',
                  }}
                >
                  <button
                    onClick={() => void handlePostComment()}
                    disabled={commentPosting || !commentText.trim()}
                    style={s.commentSubmitBtn(commentPosting || !commentText.trim())}
                    data-testid="comment-submit"
                  >
                    {commentPosting
                      ? t('marketplace.commentPosting')
                      : t('marketplace.commentSubmit')}
                  </button>
                  {commentError && (
                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--danger)' }}>
                      {commentError}
                    </span>
                  )}
                </div>
              </div>

              {/* Comment list */}
              {visibleComments.length === 0 && (
                <p
                  style={{ fontSize: 'var(--font-sm)', color: 'var(--text-faint)', margin: 0 }}
                  data-testid="no-comments"
                >
                  {t('marketplace.noComments')}
                </p>
              )}
              {visibleComments.map((c) => (
                <div key={c.id} style={s.commentCard} data-testid="comment-item">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-faint)' }}>
                      {formatDate(c.created_at)}
                    </span>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {currentUserId === c.user_id && (
                        <button
                          onClick={() => void handleDeleteComment(c.id)}
                          style={s.commentAction}
                        >
                          {t('marketplace.commentDelete')}
                        </button>
                      )}
                      {currentUserId && currentUserId !== c.user_id && (
                        <button
                          onClick={() => void handleReportComment(c.id)}
                          style={s.commentAction}
                        >
                          {t('marketplace.commentReport')}
                        </button>
                      )}
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: 'var(--font-sm)',
                      margin: 0,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {c.content}
                  </p>
                </div>
              ))}
            </section>
          </article>
        )}
      </main>
    </div>
  )
}
