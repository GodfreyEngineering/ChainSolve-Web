/**
 * MarketplaceAuthorPage — P108 author dashboard v0.
 *
 * Route: /explore/author (D9-1: renamed from /marketplace)
 *
 * Features:
 *   - Lists all items the current user has authored (published + drafts)
 *   - "New item" form: name, category, version (semver-validated), description
 *   - Publish / unpublish toggle per item
 *   - Auth-gated: redirects to /login if unauthenticated
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  listAuthorItems,
  createAuthorItem,
  togglePublishItem,
  validateMarketplaceVersion,
  getPublishGate,
  type MarketplaceItem,
  type MarketplaceCategory,
} from '../lib/marketplaceService'
import { startConnectOnboarding } from '../lib/stripeConnectService'
import { BRAND, CONTACT } from '../lib/brand'

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
    maxWidth: 860,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  } satisfies React.CSSProperties,
  card: {
    background: 'var(--card-bg, #252525)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '1.25rem',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  } satisfies React.CSSProperties,
  badge: (published: boolean): React.CSSProperties => ({
    padding: '0.2rem 0.6rem',
    borderRadius: 12,
    fontSize: '0.72rem',
    fontWeight: 600,
    background: published ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
    color: published ? '#4ade80' : 'rgba(244,244,243,0.4)',
    border: published ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  }),
  reviewBadge: (status: 'pending' | 'approved' | 'rejected'): React.CSSProperties => ({
    padding: '0.2rem 0.6rem',
    borderRadius: 12,
    fontSize: '0.72rem',
    fontWeight: 600,
    flexShrink: 0,
    background:
      status === 'approved'
        ? 'rgba(74,222,128,0.12)'
        : status === 'rejected'
          ? 'rgba(239,68,68,0.10)'
          : 'rgba(251,191,36,0.10)',
    color: status === 'approved' ? '#4ade80' : status === 'rejected' ? '#f87171' : '#fbbf24',
    border:
      status === 'approved'
        ? '1px solid rgba(74,222,128,0.25)'
        : status === 'rejected'
          ? '1px solid rgba(239,68,68,0.25)'
          : '1px solid rgba(251,191,36,0.25)',
  }),
  input: {
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--fg, #F4F4F3)',
    fontSize: '0.88rem',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
  } satisfies React.CSSProperties,
  select: {
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--fg, #F4F4F3)',
    fontSize: '0.88rem',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
  } satisfies React.CSSProperties,
  primaryBtn: (disabled: boolean): React.CSSProperties => ({
    padding: '0.45rem 1rem',
    borderRadius: 8,
    border: 'none',
    background: disabled ? '#3f3f46' : '#1CABB0',
    color: disabled ? 'rgba(244,244,243,0.4)' : '#fff',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }),
  ghostBtn: {
    padding: '0.45rem 0.85rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(244,244,243,0.6)',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
}

const CATEGORIES: MarketplaceCategory[] = [
  'template',
  'block_pack',
  'theme',
  'group',
  'custom_block',
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function MarketplaceAuthorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** null = still loading, true/false = verified_author from profile */
  const [verified, setVerified] = useState<boolean | null>(null)
  /** null = still loading, true/false = stripe_onboarded from profile */
  const [stripeOnboarded, setStripeOnboarded] = useState<boolean | null>(null)
  const [connectLoading, setConnectLoading] = useState(false)

  // Create-item form state
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState<MarketplaceCategory>('template')
  const [formVersion, setFormVersion] = useState('1.0.0')
  const [formDescription, setFormDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fetched, gate] = await Promise.all([listAuthorItems(), getPublishGate()])
      setItems(fetched)
      setVerified(gate.verified)
      setStripeOnboarded(gate.stripeOnboarded)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('sign in') || msg.toLowerCase().includes('auth')) {
        navigate('/login')
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const handleCreate = useCallback(async () => {
    setFormError(null)
    if (!formName.trim()) {
      setFormError(t('marketplace.nameRequired'))
      return
    }
    const versionCheck = validateMarketplaceVersion(formVersion)
    if (!versionCheck.ok) {
      setFormError(versionCheck.error ?? t('marketplace.versionInvalid'))
      return
    }
    setCreating(true)
    try {
      const newItem = await createAuthorItem({
        name: formName.trim(),
        category: formCategory,
        version: formVersion.trim(),
        description: formDescription.trim() || null,
      })
      setItems((prev) => [newItem, ...prev])
      setShowForm(false)
      setFormName('')
      setFormVersion('1.0.0')
      setFormDescription('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('sign in')) {
        navigate('/login')
        return
      }
      setFormError(msg)
    } finally {
      setCreating(false)
    }
  }, [formName, formCategory, formVersion, formDescription, navigate, t])

  const handleTogglePublish = useCallback(async (item: MarketplaceItem) => {
    const next = !item.is_published
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_published: next } : i)))
    try {
      await togglePublishItem(item.id, next)
    } catch (err) {
      // Revert on failure
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_published: !next } : i)))
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const handleConnectStripe = useCallback(async () => {
    setConnectLoading(true)
    setError(null)
    try {
      const url = await startConnectOnboarding()
      window.location.href = url
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('sign in')) {
        navigate('/login')
        return
      }
      setError(msg)
    } finally {
      setConnectLoading(false)
    }
  }, [navigate])

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav} aria-label={t('marketplace.authorNavLabel')}>
        <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 28 }} />
        </a>
        <a
          href="/explore"
          style={{ fontSize: '0.82rem', color: 'rgba(244,244,243,0.5)', textDecoration: 'none' }}
        >
          {t('marketplace.backToMarketplace')}
        </a>
      </nav>

      {/* Body */}
      <main style={s.body} data-testid="author-dashboard">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700 }}>
              {t('marketplace.authorTitle')}
            </h1>
            <p style={{ margin: 0, opacity: 0.5, fontSize: '0.85rem' }}>
              {t('marketplace.authorSubtitle')}
            </p>
          </div>
          {!showForm && verified === true && (
            <button
              style={s.primaryBtn(false)}
              onClick={() => setShowForm(true)}
              data-testid="new-item-btn"
            >
              {t('marketplace.newItem')}
            </button>
          )}
        </div>

        {/* Not-verified notice */}
        {verified === false && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.25)',
              color: '#fbbf24',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
            data-testid="not-verified-notice"
            role="status"
          >
            <span>{t('marketplace.notVerifiedNotice')}</span>
            <a href={`mailto:${CONTACT.support}`} style={{ color: '#fbbf24', fontWeight: 600 }}>
              {t('marketplace.contactSupport')}
            </a>
          </div>
        )}

        {/* Connect Stripe CTA — shown when verified but not yet onboarded */}
        {verified === true && stripeOnboarded === false && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: 'rgba(244,244,243,0.85)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
            data-testid="connect-stripe-notice"
            role="status"
          >
            <span style={{ flex: 1 }}>{t('marketplace.connectStripeNotice')}</span>
            <button
              style={s.primaryBtn(connectLoading)}
              disabled={connectLoading}
              onClick={() => void handleConnectStripe()}
              data-testid="connect-stripe-btn"
            >
              {t('marketplace.connectStripe')}
            </button>
          </div>
        )}

        {/* Global error */}
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

        {/* Create-item form */}
        {showForm && (
          <div
            style={{
              background: 'var(--card-bg, #252525)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
            data-testid="create-item-form"
          >
            <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
              {t('marketplace.newItem')}
            </h2>

            {formError && (
              <div
                style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#f87171',
                  fontSize: '0.82rem',
                  marginBottom: '0.85rem',
                }}
                role="alert"
              >
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input
                type="text"
                placeholder={t('marketplace.itemNamePlaceholder')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={s.input}
                aria-label={t('marketplace.itemNamePlaceholder')}
                data-testid="form-name"
              />

              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as MarketplaceCategory)}
                  style={{ ...s.select, flex: 1 }}
                  aria-label={t('marketplace.categoryLabel')}
                  data-testid="form-category"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(
                        {
                          template: 'marketplace.categoryTemplate',
                          block_pack: 'marketplace.categoryBlockPack',
                          theme: 'marketplace.categoryTheme',
                          group: 'marketplace.categoryGroup',
                          custom_block: 'marketplace.categoryCustomBlock',
                        }[c],
                      )}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder={t('marketplace.itemVersionPlaceholder')}
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                  style={{ ...s.input, flex: 1 }}
                  aria-label={t('marketplace.itemVersionPlaceholder')}
                  data-testid="form-version"
                />
              </div>

              <textarea
                placeholder={t('marketplace.itemDescriptionPlaceholder')}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
                aria-label={t('marketplace.itemDescriptionPlaceholder')}
                data-testid="form-description"
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  style={s.primaryBtn(creating)}
                  disabled={creating}
                  onClick={() => void handleCreate()}
                  data-testid="create-submit-btn"
                >
                  {creating ? t('marketplace.creating') : t('marketplace.createItem')}
                </button>
                <button
                  style={s.ghostBtn}
                  onClick={() => {
                    setShowForm(false)
                    setFormError(null)
                  }}
                >
                  {t('marketplace.cancelCreate')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ opacity: 0.45, fontSize: '0.88rem', textAlign: 'center', padding: '2rem' }}>
            {t('marketplace.loading')}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && items.length === 0 && !showForm && (
          <div
            style={{ opacity: 0.35, fontSize: '0.88rem', textAlign: 'center', padding: '3rem 0' }}
            data-testid="no-author-items"
          >
            {t('marketplace.noAuthorItems')}
          </div>
        )}

        {/* Items list */}
        {items.map((item) => (
          <div key={item.id} style={s.card} data-testid="author-item">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
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
              <div
                style={{
                  display: 'flex',
                  gap: '0.65rem',
                  fontSize: '0.75rem',
                  color: 'rgba(244,244,243,0.4)',
                  flexWrap: 'wrap',
                }}
              >
                <span>{item.category}</span>
                <span>{t('marketplace.version', { version: item.version })}</span>
                <span>{t('marketplace.downloads', { count: item.downloads_count })}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
              <span
                style={s.reviewBadge(item.review_status)}
                data-testid={`review-status-${item.id}`}
              >
                {item.review_status === 'approved'
                  ? t('marketplace.reviewApproved')
                  : item.review_status === 'rejected'
                    ? t('marketplace.reviewRejected')
                    : t('marketplace.reviewPending')}
              </span>
              <span style={s.badge(item.is_published)}>
                {item.is_published ? t('marketplace.installed') : t('marketplace.draftBadge')}
              </span>
              <button
                style={s.ghostBtn}
                onClick={() => void handleTogglePublish(item)}
                data-testid={`toggle-publish-${item.id}`}
              >
                {item.is_published ? t('marketplace.unpublish') : t('marketplace.publish')}
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
