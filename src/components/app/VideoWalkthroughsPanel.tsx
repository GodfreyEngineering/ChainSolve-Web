import { useState, useMemo } from 'react'
import { AppWindow } from '../ui/AppWindow'
import {
  VIDEO_WALKTHROUGHS,
  searchWalkthroughs,
  isPlaceholder,
  type VideoWalkthrough,
  type VideoChapter,
} from '../../docs/videoWalkthroughs'

export const VIDEO_WALKTHROUGHS_WINDOW_ID = 'video-walkthroughs'

// ── Main window ───────────────────────────────────────────────────────────────

export function VideoWalkthroughsPanel() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VideoWalkthrough | null>(null)

  const results = useMemo<VideoWalkthrough[]>(() => {
    if (!query.trim()) return VIDEO_WALKTHROUGHS
    return searchWalkthroughs(query)
  }, [query])

  // Group by feature area for the browse list
  const grouped = useMemo(() => {
    const map = new Map<string, VideoWalkthrough[]>()
    for (const v of results) {
      const existing = map.get(v.featureArea) ?? []
      map.set(v.featureArea, [...existing, v])
    }
    return [...map.entries()]
  }, [results])

  return (
    <AppWindow
      windowId={VIDEO_WALKTHROUGHS_WINDOW_ID}
      title="Video Walkthroughs"
      minWidth={420}
      minHeight={400}
    >
      <div style={rootStyle}>
        {selected ? (
          // ── Detail view: selected video
          <VideoDetail video={selected} onBack={() => setSelected(null)} />
        ) : (
          // ── Browse / search list
          <>
            <input
              style={inputStyle}
              type="search"
              placeholder="Search walkthroughs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label="Search video walkthroughs"
            />

            {results.length === 0 && <p style={emptyStyle}>No walkthroughs matching "{query}".</p>}

            <div style={listStyle}>
              {grouped.map(([area, videos]) => (
                <section key={area} aria-label={area}>
                  <h3 style={sectionHeadingStyle}>{area}</h3>
                  {videos.map((v) => (
                    <VideoListItem key={v.id} video={v} onSelect={setSelected} />
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </AppWindow>
  )
}

// ── List item ─────────────────────────────────────────────────────────────────

function VideoListItem({
  video,
  onSelect,
}: {
  video: VideoWalkthrough
  onSelect: (v: VideoWalkthrough) => void
}) {
  const placeholder = isPlaceholder(video.youtubeId)
  return (
    <button style={itemButtonStyle} onClick={() => onSelect(video)} aria-label={video.title}>
      {/* Thumbnail placeholder */}
      <div style={thumbStyle} aria-hidden="true">
        {placeholder ? (
          <span style={thumbIconStyle}>▶</span>
        ) : (
          <img
            src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
            loading="lazy"
          />
        )}
      </div>

      <div style={itemTextStyle}>
        <p style={itemTitleStyle}>{video.title}</p>
        <p style={itemMetaStyle}>
          {video.durationLabel}
          {placeholder && <span style={comingSoonStyle}> · Coming soon</span>}
        </p>
        <p style={itemDescStyle}>{video.description}</p>
      </div>
    </button>
  )
}

// ── Detail view ───────────────────────────────────────────────────────────────

function VideoDetail({ video, onBack }: { video: VideoWalkthrough; onBack: () => void }) {
  const placeholder = isPlaceholder(video.youtubeId)

  return (
    <div style={detailStyle}>
      <button style={backButtonStyle} onClick={onBack} aria-label="Back to list">
        ← Back
      </button>

      <h2 style={detailTitleStyle}>{video.title}</h2>
      <p style={detailDescStyle}>{video.description}</p>

      {/* Video embed or placeholder */}
      {placeholder ? (
        <PlaceholderEmbed />
      ) : (
        <VideoEmbed youtubeId={video.youtubeId} title={video.title} />
      )}

      {/* Chapter markers */}
      {video.chapters.length > 0 && (
        <div style={chaptersStyle}>
          <h3 style={chaptersHeadingStyle}>Chapters</h3>
          {video.chapters.map((ch) => (
            <ChapterItem key={ch.t} chapter={ch} youtubeId={video.youtubeId} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── VideoEmbed ────────────────────────────────────────────────────────────────

function VideoEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`
  return (
    <div style={embedWrapperStyle}>
      <iframe
        style={iframeStyle}
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

function PlaceholderEmbed() {
  return (
    <div style={placeholderEmbedStyle} aria-label="Video coming soon">
      <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎬</span>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Video walkthrough coming soon
      </p>
    </div>
  )
}

// ── Chapter item ──────────────────────────────────────────────────────────────

function ChapterItem({ chapter, youtubeId }: { chapter: VideoChapter; youtubeId: string }) {
  const placeholder = isPlaceholder(youtubeId)
  const href = placeholder
    ? undefined
    : `https://www.youtube.com/watch?v=${youtubeId}&t=${chapter.t}s`

  const mins = Math.floor(chapter.t / 60)
  const secs = String(chapter.t % 60).padStart(2, '0')
  const timestamp = `${mins}:${secs}`

  return placeholder ? (
    <div style={chapterItemStyle}>
      <span style={chapterTimestampStyle}>{timestamp}</span>
      <span style={chapterLabelStyle}>{chapter.label}</span>
    </div>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" style={chapterLinkStyle}>
      <span style={chapterTimestampStyle}>{timestamp}</span>
      <span style={chapterLabelStyle}>{chapter.label}</span>
    </a>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  padding: '1rem',
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.55rem 0.75rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  outline: 'none',
  marginBottom: '1rem',
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0.75rem 0 0.4rem 0',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--primary)',
}

const itemButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  width: '100%',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  padding: '0.5rem 0',
  cursor: 'pointer',
  color: 'inherit',
}

const thumbStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 80,
  height: 48,
  background: 'var(--card)',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}

const thumbIconStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  color: 'var(--primary)',
}

const itemTextStyle: React.CSSProperties = { flex: 1, minWidth: 0 }

const itemTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.88rem',
  fontWeight: 600,
  color: 'var(--text)',
}

const itemMetaStyle: React.CSSProperties = {
  margin: '0.1rem 0 0.25rem 0',
  fontSize: '0.75rem',
  color: 'var(--primary)',
}

const itemDescStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
  lineHeight: 1.4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}

const comingSoonStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontStyle: 'italic',
}

const emptyStyle: React.CSSProperties = {
  margin: '1.5rem 0',
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
}

const detailStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  overflowY: 'auto',
  flex: 1,
}

const backButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--primary)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: 0,
  alignSelf: 'flex-start',
}

const detailTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--text)',
}

const detailDescStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

const embedWrapperStyle: React.CSSProperties = {
  position: 'relative',
  paddingTop: '56.25%', // 16:9
  background: '#000',
  borderRadius: 6,
  overflow: 'hidden',
}

const iframeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  border: 'none',
}

const placeholderEmbedStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  background: 'var(--card)',
  borderRadius: 6,
  minHeight: 120,
}

const chaptersStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

const chaptersHeadingStyle: React.CSSProperties = {
  margin: '0 0 0.35rem 0',
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--primary)',
}

const chapterItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  padding: '0.2rem 0',
  fontSize: '0.82rem',
}

const chapterLinkStyle: React.CSSProperties = {
  ...chapterItemStyle,
  textDecoration: 'none',
  color: 'inherit',
}

const chapterTimestampStyle: React.CSSProperties = {
  color: 'var(--primary)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: 32,
  flexShrink: 0,
}

const chapterLabelStyle: React.CSSProperties = {
  color: 'var(--text)',
}
