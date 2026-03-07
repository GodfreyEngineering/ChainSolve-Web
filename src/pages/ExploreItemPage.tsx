/**
 * ExploreItemPage — V3-7.3 full-page detail view for a marketplace item.
 *
 * Route: /explore/:itemId
 *
 * Left: screenshot gallery with lightbox. Right: title, author badge,
 * description, install/fork button, version, tags. Bottom: comments section.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Heart,
  MessageSquare,
  Send,
  Star,
  X,
} from 'lucide-react'
import {
  getItem,
  getItemComments,
  postComment,
  forkTemplate,
  installBlockPack,
  installTheme,
  getUserLikes,
  likeItem,
  unlikeItem,
  type MarketplaceItem,
  type MarketplaceComment,
} from '../lib/marketplaceService'

export function ExploreItemPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { itemId } = useParams<{ itemId: string }>()

  const [item, setItem] = useState<MarketplaceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState<MarketplaceComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [activeThumb, setActiveThumb] = useState(0)

  const commentInputRef = useRef<HTMLInputElement>(null)

  // Fetch item + likes + comments
  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    setLoading(true)
    void Promise.all([getItem(itemId), getUserLikes(), getItemComments(itemId)]).then(
      ([data, likes, cmts]) => {
        if (cancelled) return
        setItem(data)
        setLiked(likes.has(itemId))
        setComments(cmts.filter((c) => !c.is_flagged))
        setLoading(false)
      },
    )
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

  const handlePostComment = useCallback(async () => {
    if (!item || !commentText.trim() || posting) return
    setPosting(true)
    try {
      const newComment = await postComment(item.id, commentText.trim())
      setComments((prev) => [newComment, ...prev])
      setCommentText('')
    } catch {
      // Comment error
    } finally {
      setPosting(false)
    }
  }, [item, commentText, posting])

  const handleCommentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handlePostComment()
      }
    },
    [handlePostComment],
  )

  // Screenshots from item payload
  const screenshots: string[] =
    item && item.payload && typeof item.payload === 'object' && 'screenshots' in item.payload
      ? ((item.payload as { screenshots?: string[] }).screenshots ?? [])
      : []

  // Gallery images = thumbnail + screenshots
  const galleryImages: string[] = []
  if (item?.thumbnail_url) galleryImages.push(item.thumbnail_url)
  galleryImages.push(...screenshots)

  const handleBack = useCallback(() => {
    navigate('/explore')
  }, [navigate])

  if (loading) {
    return (
      <div style={page}>
        <div style={topBar}>
          <button style={backBtn} onClick={handleBack}>
            <ArrowLeft size={16} />
            {t('explore.back')}
          </button>
        </div>
        <div style={emptyState}>{t('explorePage.loading')}</div>
      </div>
    )
  }

  if (!item) {
    return (
      <div style={page}>
        <div style={topBar}>
          <button style={backBtn} onClick={handleBack}>
            <ArrowLeft size={16} />
            {t('explore.back')}
          </button>
        </div>
        <div style={emptyState}>{t('explore.notFound')}</div>
      </div>
    )
  }

  const installLabel =
    item.category === 'template' ? t('explore.useTemplate') : t('explore.install')

  return (
    <div style={page}>
      {/* Top bar with back button */}
      <div style={topBar}>
        <button style={backBtn} onClick={handleBack}>
          <ArrowLeft size={16} />
          {t('explore.back')}
        </button>
      </div>

      {/* Main content: gallery + details */}
      <div style={mainLayout}>
        {/* Left: gallery */}
        <div style={galleryCol}>
          {galleryImages.length > 0 ? (
            <>
              <div
                style={mainImage}
                onClick={() => setLightboxIdx(activeThumb)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setLightboxIdx(activeThumb)
                }}
              >
                <img
                  src={galleryImages[activeThumb]}
                  alt={item.name}
                  style={mainImg}
                  loading="lazy"
                />
              </div>
              {galleryImages.length > 1 && (
                <div style={thumbStrip}>
                  {galleryImages.map((url, i) => (
                    <button
                      key={i}
                      style={{
                        ...thumbBtn,
                        border:
                          i === activeThumb
                            ? '2px solid var(--primary)'
                            : '2px solid var(--border)',
                      }}
                      onClick={() => setActiveThumb(i)}
                    >
                      <img src={url} alt="" style={thumbBtnImg} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={placeholderThumb}>
              <span style={{ fontSize: '3rem', opacity: 0.2 }}>
                {item.category === 'template'
                  ? '\u{1F4C4}'
                  : item.category === 'theme'
                    ? '\u{1F3A8}'
                    : '\u{1F4E6}'}
              </span>
            </div>
          )}
        </div>

        {/* Right: details */}
        <div style={detailCol}>
          <h1 style={titleStyle}>
            {item.name}
            {item.is_official && (
              <Star size={16} style={{ color: 'var(--warning)', marginLeft: 8, flexShrink: 0 }} />
            )}
          </h1>

          <div style={metaRow}>
            <span style={categoryBadge}>
              {t(`explore.category_${item.category}`, item.category)}
            </span>
            {item.price_cents > 0 && (
              <span style={priceBadge}>${(item.price_cents / 100).toFixed(2)}</span>
            )}
            <span style={versionText}>v{item.version}</span>
          </div>

          <div style={statsRow}>
            <span style={statItem}>
              <Download size={14} /> {item.downloads_count} {t('exploreItemPage.downloads')}
            </span>
            <span style={statItem}>
              <Heart size={14} /> {item.likes_count} {t('exploreItemPage.likes')}
            </span>
            <span style={statItem}>
              <MessageSquare size={14} /> {item.comments_count} {t('exploreItemPage.comments')}
            </span>
          </div>

          {item.description && <p style={descStyle}>{item.description}</p>}

          {item.tags.length > 0 && (
            <div style={tagsRow}>
              {item.tags.map((tag) => (
                <span key={tag} style={tagPill}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={actionsRow}>
            <button style={installBtn} onClick={handleInstall} disabled={installing}>
              {item.category === 'template' ? <ExternalLink size={14} /> : <Download size={14} />}
              {installing ? t('explore.installing') : installLabel}
            </button>
            <button
              style={{
                ...likeBtn,
                color: liked ? 'var(--danger)' : 'var(--text-muted)',
              }}
              onClick={handleToggleLike}
              title={liked ? t('exploreItemPage.unlike') : t('exploreItemPage.like')}
            >
              <Heart size={18} />
            </button>
          </div>

          <div style={publishedDate}>
            {t('exploreItemPage.published')} {new Date(item.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Comments section */}
      <div style={commentsSection}>
        <h2 style={commentsTitle}>
          <MessageSquare size={18} />
          {t('exploreItemPage.commentsTitle')} ({comments.length})
        </h2>

        <div style={commentInputRow}>
          <input
            ref={commentInputRef}
            type="text"
            style={commentInput}
            placeholder={t('exploreItemPage.commentPlaceholder')}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleCommentKeyDown}
            maxLength={2000}
          />
          <button
            style={commentSendBtn}
            onClick={handlePostComment}
            disabled={posting || !commentText.trim()}
          >
            <Send size={14} />
          </button>
        </div>

        {comments.length === 0 ? (
          <p style={noComments}>{t('exploreItemPage.noComments')}</p>
        ) : (
          <div style={commentList}>
            {comments.map((c) => (
              <div key={c.id} style={commentCard}>
                <div style={commentMeta}>
                  <span style={commentUser}>{c.user_id.slice(0, 8)}</span>
                  <span style={commentDate}>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p style={commentContent}>{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && galleryImages.length > 0 && (
        <div
          style={lightboxOverlay}
          onClick={() => setLightboxIdx(null)}
          role="dialog"
          aria-modal="true"
        >
          <div style={lightboxInner} onClick={(e) => e.stopPropagation()}>
            <button style={lightboxClose} onClick={() => setLightboxIdx(null)}>
              <X size={20} />
            </button>
            {galleryImages.length > 1 && (
              <button
                style={{ ...lightboxNav, left: 8 }}
                onClick={() =>
                  setLightboxIdx((lightboxIdx - 1 + galleryImages.length) % galleryImages.length)
                }
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <img src={galleryImages[lightboxIdx]} alt={item.name} style={lightboxImg} />
            {galleryImages.length > 1 && (
              <button
                style={{ ...lightboxNav, right: 8 }}
                onClick={() => setLightboxIdx((lightboxIdx + 1) % galleryImages.length)}
              >
                <ChevronRight size={24} />
              </button>
            )}
            <div style={lightboxCounter}>
              {lightboxIdx + 1} / {galleryImages.length}
            </div>
          </div>
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

const topBar: React.CSSProperties = {
  padding: '1rem 2rem',
  borderBottom: '1px solid var(--border)',
}

const backBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  padding: 0,
}

const mainLayout: React.CSSProperties = {
  display: 'flex',
  gap: 32,
  padding: '2rem',
  maxWidth: 1100,
  margin: '0 auto',
  flexWrap: 'wrap',
}

const galleryCol: React.CSSProperties = {
  flex: '1 1 400px',
  minWidth: 280,
}

const mainImage: React.CSSProperties = {
  width: '100%',
  aspectRatio: '16/10',
  borderRadius: 10,
  overflow: 'hidden',
  background: 'var(--surface-1)',
  cursor: 'zoom-in',
}

const mainImg: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const thumbStrip: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 10,
  overflowX: 'auto',
  paddingBottom: 4,
}

const thumbBtn: React.CSSProperties = {
  width: 64,
  height: 40,
  borderRadius: 6,
  overflow: 'hidden',
  cursor: 'pointer',
  background: 'var(--surface-1)',
  padding: 0,
  flexShrink: 0,
}

const thumbBtnImg: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const placeholderThumb: React.CSSProperties = {
  width: '100%',
  aspectRatio: '16/10',
  borderRadius: 10,
  background: 'var(--surface-1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const detailCol: React.CSSProperties = {
  flex: '1 1 300px',
  minWidth: 260,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const titleStyle: React.CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 800,
  margin: 0,
  display: 'flex',
  alignItems: 'center',
}

const metaRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const categoryBadge: React.CSSProperties = {
  padding: '0.2rem 0.6rem',
  borderRadius: 6,
  background: 'var(--surface-3)',
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'capitalize',
}

const priceBadge: React.CSSProperties = {
  padding: '0.2rem 0.6rem',
  borderRadius: 6,
  background: 'var(--primary)',
  color: '#fff',
  fontSize: '0.72rem',
  fontWeight: 700,
}

const versionText: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
}

const statsRow: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
}

const statItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
}

const descStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  lineHeight: 1.6,
  color: 'var(--text)',
  margin: 0,
}

const tagsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
}

const tagPill: React.CSSProperties = {
  padding: '0.2rem 0.6rem',
  borderRadius: 999,
  background: 'var(--surface-3)',
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
}

const actionsRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 8,
}

const installBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '0.65rem 1.5rem',
  border: 'none',
  borderRadius: 8,
  background: 'var(--primary)',
  color: '#fff',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  fontSize: '0.88rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const likeBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'transparent',
  cursor: 'pointer',
}

const publishedDate: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
}

// ── Comments ─────────────────────────────────────────────────────────────────

const commentsSection: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '0 2rem 3rem',
  borderTop: '1px solid var(--border)',
  paddingTop: '1.5rem',
}

const commentsTitle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  margin: '0 0 1rem',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const commentInputRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 16,
}

const commentInput: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: '0.85rem',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  outline: 'none',
}

const commentSendBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  border: 'none',
  borderRadius: 8,
  background: 'var(--primary)',
  color: '#fff',
  cursor: 'pointer',
}

const noComments: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
  textAlign: 'center',
  padding: '2rem 0',
}

const commentList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const commentCard: React.CSSProperties = {
  padding: '0.75rem 1rem',
  background: 'var(--surface-2)',
  borderRadius: 8,
  border: '1px solid var(--border)',
}

const commentMeta: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
}

const commentUser: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text)',
}

const commentDate: React.CSSProperties = {
  fontSize: '0.68rem',
  color: 'var(--text-muted)',
}

const commentContent: React.CSSProperties = {
  fontSize: '0.82rem',
  lineHeight: 1.5,
  margin: 0,
  color: 'var(--text)',
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

const lightboxOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.85)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const lightboxInner: React.CSSProperties = {
  position: 'relative',
  maxWidth: '90vw',
  maxHeight: '90vh',
}

const lightboxClose: React.CSSProperties = {
  position: 'absolute',
  top: -40,
  right: 0,
  background: 'none',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
}

const lightboxNav: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'rgba(0,0,0,0.5)',
  border: 'none',
  color: '#fff',
  borderRadius: '50%',
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 1,
}

const lightboxImg: React.CSSProperties = {
  maxWidth: '90vw',
  maxHeight: '85vh',
  objectFit: 'contain',
  borderRadius: 8,
}

const lightboxCounter: React.CSSProperties = {
  textAlign: 'center',
  color: '#fff',
  fontSize: '0.8rem',
  marginTop: 8,
}

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '4rem 2rem',
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
}
