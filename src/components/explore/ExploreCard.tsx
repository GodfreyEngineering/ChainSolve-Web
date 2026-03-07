/**
 * ExploreCard — V3-7.1 card component for marketplace items in the Explore page.
 *
 * Shows thumbnail, title, author badge, downloads, likes, rating stars,
 * and category/price badges.
 */

import { useTranslation } from 'react-i18next'
import { Download, Heart, Star } from 'lucide-react'
import type { MarketplaceItem } from '../../lib/marketplaceService'

interface Props {
  item: MarketplaceItem
  onClick?: () => void
}

export function ExploreCard({ item, onClick }: Props) {
  const { t } = useTranslation()

  const categoryLabel = t(`explore.category_${item.category}`, item.category)
  const isPaid = item.price_cents > 0

  return (
    <button style={card} onClick={onClick} type="button">
      {/* Thumbnail */}
      <div style={thumbWrap}>
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.name} style={thumbImg} loading="lazy" />
        ) : (
          <div style={thumbPlaceholder}>
            <span style={{ fontSize: '1.6rem', opacity: 0.25 }}>
              {item.category === 'template'
                ? '\u{1F4C4}'
                : item.category === 'theme'
                  ? '\u{1F3A8}'
                  : '\u{1F4E6}'}
            </span>
          </div>
        )}
        {/* Badges */}
        <div style={badgeRow}>
          <span style={categoryBadge}>{categoryLabel}</span>
          {isPaid && <span style={priceBadge}>${(item.price_cents / 100).toFixed(2)}</span>}
          {item.is_official && <span style={officialBadge}>Official</span>}
        </div>
      </div>

      {/* Body */}
      <div style={body}>
        <div style={titleText}>{item.name}</div>
        {item.description && (
          <div style={descText}>
            {item.description.length > 80 ? item.description.slice(0, 80) + '…' : item.description}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={footer}>
        <span style={stat}>
          <Download size={12} />
          {fmtCount(item.downloads_count)}
        </span>
        <span style={stat}>
          <Heart size={12} />
          {fmtCount(item.likes_count)}
        </span>
        <span style={stat}>
          <Star size={12} />
          {item.comments_count}
        </span>
      </div>
    </button>
  )
}

function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Styles ───────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  overflow: 'hidden',
  cursor: 'pointer',
  textAlign: 'left',
  padding: 0,
  color: 'var(--text)',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  transition: 'box-shadow 0.15s, border-color 0.15s',
  width: '100%',
}

const thumbWrap: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '16/10',
  background: 'var(--surface-1)',
  overflow: 'hidden',
}

const thumbImg: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const thumbPlaceholder: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const badgeRow: React.CSSProperties = {
  position: 'absolute',
  bottom: 6,
  left: 6,
  display: 'flex',
  gap: 4,
}

const badgeBase: React.CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
}

const categoryBadge: React.CSSProperties = {
  ...badgeBase,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  backdropFilter: 'blur(4px)',
}

const priceBadge: React.CSSProperties = {
  ...badgeBase,
  background: 'var(--primary)',
  color: '#fff',
}

const officialBadge: React.CSSProperties = {
  ...badgeBase,
  background: 'rgba(52,211,153,0.9)',
  color: '#000',
}

const body: React.CSSProperties = {
  padding: '0.6rem 0.75rem 0.3rem',
  flex: 1,
  minHeight: 48,
}

const titleText: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  lineHeight: 1.3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const descText: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  lineHeight: 1.35,
  marginTop: 3,
}

const footer: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  padding: '0.4rem 0.75rem 0.55rem',
  borderTop: '1px solid var(--border)',
}

const stat: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  fontSize: '0.68rem',
  color: 'var(--text-muted)',
}
