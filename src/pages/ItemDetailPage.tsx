/**
 * ItemDetailPage — P105 item detail + install button.
 *
 * Route: /marketplace/items/:itemId
 *
 * Features:
 *   - Item metadata (name, version, author, category, downloads)
 *   - Thumbnail
 *   - Description (full)
 *   - Install / Installed button (auth-gated)
 *   - Back link to marketplace browse
 *   - Loading and not-found states
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getItem,
  forkTemplate,
  installBlockPack,
  installTheme,
  getUserInstalls,
  type MarketplaceItem,
} from '../lib/marketplaceService'
import { createCheckoutSession } from '../lib/stripeConnectService'
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
    maxWidth: 820,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  } satisfies React.CSSProperties,
  installBtn: (done: boolean, loading: boolean, isPaid: boolean): React.CSSProperties => ({
    padding: '0.6rem 1.5rem',
    borderRadius: 8,
    border: 'none',
    background: done
      ? 'rgba(74,222,128,0.12)'
      : loading
        ? '#3f3f46'
        : isPaid
          ? '#7c3aed'
          : '#1CABB0',
    color: done ? '#4ade80' : loading ? 'rgba(244,244,243,0.4)' : '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: done || loading ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }),
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ItemDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { itemId } = useParams<{ itemId: string }>()

  const [item, setItem] = useState<MarketplaceItem | null>(null)
  const [installed, setInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        const [fetched, installs] = await Promise.all([getItem(itemId), getUserInstalls()])
        if (!fetched) {
          setNotFound(true)
        } else {
          setItem(fetched)
          setInstalled(installs.some((p) => p.item_id === itemId))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [itemId])

  const isPaid = (item?.price_cents ?? 0) > 0

  const handleInstall = useCallback(async () => {
    if (!itemId || installed || installing) return
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
  }, [itemId, installed, installing, navigate, item, isPaid])

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav} aria-label={t('marketplace.itemNavLabel')}>
        <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 28 }} />
        </a>
        <a
          href="/marketplace"
          style={{ fontSize: '0.82rem', color: 'rgba(244,244,243,0.5)', textDecoration: 'none' }}
        >
          ← {t('marketplace.title')}
        </a>
      </nav>

      {/* Body */}
      <main style={s.body} data-testid="item-detail-page">
        {/* Loading */}
        {loading && (
          <div
            style={{ opacity: 0.45, fontSize: '0.88rem', textAlign: 'center', padding: '3rem 0' }}
          >
            {t('marketplace.loading')}
          </div>
        )}

        {/* Not found */}
        {!loading && notFound && (
          <div
            style={{ opacity: 0.45, fontSize: '0.88rem', textAlign: 'center', padding: '3rem 0' }}
            data-testid="item-not-found"
          >
            {t('marketplace.itemNotFound')}
          </div>
        )}

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
              marginBottom: '1.5rem',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Item detail */}
        {!loading && item && (
          <article data-testid="item-detail">
            {/* Thumbnail */}
            {item.thumbnail_url && (
              <img
                src={item.thumbnail_url}
                alt={item.name}
                style={{
                  width: '100%',
                  maxHeight: 280,
                  objectFit: 'cover',
                  borderRadius: 12,
                  marginBottom: '1.5rem',
                }}
              />
            )}

            {/* Header row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                flexWrap: 'wrap',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700 }}>
                  {item.name}
                </h1>
                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    fontSize: '0.8rem',
                    color: 'rgba(244,244,243,0.45)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{t('marketplace.version', { version: item.version })}</span>
                  <span>{item.category}</span>
                  <span>{t('marketplace.downloads', { count: item.downloads_count })}</span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '0.3rem',
                }}
              >
                {!isPaid && !installed && (
                  <span style={{ fontSize: '0.72rem', color: 'rgba(74,222,128,0.7)' }}>
                    {t('marketplace.free')}
                  </span>
                )}
                <button
                  style={s.installBtn(installed, installing, isPaid)}
                  onClick={() => void handleInstall()}
                  disabled={installed || installing}
                  data-testid="install-btn"
                >
                  {installed
                    ? t('marketplace.installed')
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
              </div>
            </div>

            {/* Description */}
            {item.description && (
              <p
                style={{
                  fontSize: '0.9rem',
                  lineHeight: 1.65,
                  opacity: 0.75,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {item.description}
              </p>
            )}
          </article>
        )}
      </main>
    </div>
  )
}
