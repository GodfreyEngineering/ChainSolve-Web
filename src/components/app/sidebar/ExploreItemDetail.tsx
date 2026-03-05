/**
 * ExploreItemDetail — item detail sub-view within the sidebar Explore tab.
 *
 * Shows full item info, install/fork button, like toggle.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Heart, Star, ExternalLink } from 'lucide-react'
import { Icon } from '../../ui/Icon'
import { Skeleton } from '../../ui/Skeleton'
import {
  getItem,
  forkTemplate,
  installBlockPack,
  installTheme,
  getUserLikes,
  likeItem,
  unlikeItem,
  type MarketplaceItem,
} from '../../../lib/marketplaceService'

interface ExploreItemDetailProps {
  itemId: string
  onBack: () => void
}

export function ExploreItemDetail({ itemId, onBack }: ExploreItemDetailProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [item, setItem] = useState<MarketplaceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([getItem(itemId), getUserLikes()]).then(([data, likes]) => {
      if (cancelled) return
      setItem(data)
      setLiked(likes.has(itemId))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [itemId])

  const handleInstall = useCallback(async () => {
    if (!item) return
    setInstalling(true)
    try {
      if (item.category === 'template') {
        const projectId = await forkTemplate(item.id)
        navigate(`/app/${projectId}`)
      } else if (item.category === 'block_pack' || item.category === 'group') {
        await installBlockPack(item.id)
      } else if (item.category === 'theme') {
        await installTheme(item.id)
      }
    } catch {
      // Install error
    } finally {
      setInstalling(false)
    }
  }, [item, navigate])

  const handleToggleLike = useCallback(async () => {
    if (!item) return
    try {
      if (liked) {
        await unlikeItem(item.id)
        setLiked(false)
      } else {
        await likeItem(item.id)
        setLiked(true)
      }
    } catch {
      // Like error
    }
  }, [item, liked])

  if (loading) {
    return (
      <div style={containerStyle}>
        <button style={backBtnStyle} onClick={onBack}>
          <Icon icon={ArrowLeft} size={14} />
          <span>{t('explore.back', 'Back')}</span>
        </button>
        <Skeleton height={120} style={{ marginBottom: 12 }} />
        <Skeleton height={20} style={{ marginBottom: 8 }} />
        <Skeleton height={14} style={{ marginBottom: 8 }} />
        <Skeleton height={14} />
      </div>
    )
  }

  if (!item) {
    return (
      <div style={containerStyle}>
        <button style={backBtnStyle} onClick={onBack}>
          <Icon icon={ArrowLeft} size={14} />
          <span>{t('explore.back', 'Back')}</span>
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center' }}>
          {t('explore.notFound', 'Item not found')}
        </p>
      </div>
    )
  }

  const installLabel =
    item.category === 'template'
      ? t('explore.useTemplate', 'Use Template')
      : t('explore.install', 'Install')

  return (
    <div style={containerStyle}>
      {/* Back button */}
      <button style={backBtnStyle} onClick={onBack}>
        <Icon icon={ArrowLeft} size={14} />
        <span>{t('explore.back', 'Back')}</span>
      </button>

      {/* Thumbnail */}
      {item.thumbnail_url && <img src={item.thumbnail_url} alt="" style={thumbnailStyle} />}

      {/* Title + meta */}
      <h3 style={titleStyle}>
        {item.name}
        {item.is_official && (
          <Icon icon={Star} size={12} style={{ color: 'var(--warning)', marginLeft: 4 }} />
        )}
      </h3>

      <div style={metaRowStyle}>
        <span style={categoryBadge}>{item.category}</span>
        <span style={statStyle}>
          <Icon icon={Download} size={11} /> {item.downloads_count}
        </span>
        <span style={statStyle}>
          <Icon icon={Heart} size={11} /> {item.likes_count}
        </span>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>v{item.version}</span>
      </div>

      {/* Description */}
      {item.description && <p style={descStyle}>{item.description}</p>}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div style={tagsRowStyle}>
          {item.tags.map((tag) => (
            <span key={tag} style={tagStyle}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={actionsStyle}>
        <button style={installBtnStyle} onClick={handleInstall} disabled={installing}>
          <Icon icon={item.category === 'template' ? ExternalLink : Download} size={13} />
          {installing ? t('explore.installing', 'Installing...') : installLabel}
        </button>
        <button
          style={{
            ...likeBtnStyle,
            color: liked ? 'var(--danger)' : 'var(--text-faint)',
          }}
          onClick={handleToggleLike}
        >
          <Icon icon={Heart} size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '0.5rem 0.6rem',
  gap: 8,
  height: '100%',
  overflowY: 'auto',
}

const backBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-faint)',
  fontFamily: 'inherit',
  fontSize: '0.7rem',
  padding: '0.2rem 0',
}

const thumbnailStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: 160,
  objectFit: 'cover',
  borderRadius: 'var(--radius-md)',
}

const titleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 600,
  margin: 0,
  display: 'flex',
  alignItems: 'center',
}

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '0.65rem',
  color: 'var(--text-faint)',
}

const categoryBadge: React.CSSProperties = {
  padding: '0.1rem 0.35rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-3)',
  fontSize: '0.6rem',
  textTransform: 'capitalize',
}

const statStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
}

const descStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  lineHeight: 1.5,
  color: 'var(--text-secondary, var(--text-faint))',
  margin: 0,
}

const tagsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
}

const tagStyle: React.CSSProperties = {
  padding: '0.1rem 0.4rem',
  borderRadius: 'var(--radius-full, 999px)',
  background: 'var(--surface-3)',
  fontSize: '0.58rem',
  color: 'var(--text-faint)',
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 4,
}

const installBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '0.45rem 0.75rem',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--primary)',
  color: '#fff',
  fontFamily: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const likeBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'transparent',
  cursor: 'pointer',
}
