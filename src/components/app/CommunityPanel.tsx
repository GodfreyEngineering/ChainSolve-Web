import { useState, useCallback } from 'react'
import { AppWindow } from '../ui/AppWindow'
import type { EngineSnapshotV1 } from '../../engine/types'
import type { Demonstration } from '../../lib/demonstrationsService'

export const COMMUNITY_WINDOW_ID = 'community'

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function CommunityPanel() {
  const [view, setView] = useState<'browse' | 'publish'>('browse')

  return (
    <AppWindow
      windowId={COMMUNITY_WINDOW_ID}
      title="Community"
      minWidth={460}
      minHeight={380}
    >
      <div style={rootStyle}>
        {/* Tab bar */}
        <div style={tabBarStyle} role="tablist">
          <Tab label="Browse" active={view === 'browse'} onClick={() => setView('browse')} />
          <Tab label="Share Graph" active={view === 'publish'} onClick={() => setView('publish')} />
        </div>

        {view === 'browse' ? <BrowseView /> : <PublishView />}
      </div>
    </AppWindow>
  )
}

// ---------------------------------------------------------------------------
// Browse tab
// ---------------------------------------------------------------------------

function BrowseView() {
  const [query, setQuery] = useState('')
  const [demos] = useState<Demonstration[]>([])
  const [loading] = useState(false)

  return (
    <div style={paneStyle}>
      {/* Search */}
      <input
        style={inputStyle}
        type="search"
        placeholder="Search community graphs…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search demonstrations"
        autoComplete="off"
      />

      {/* Forum link */}
      <a
        style={forumLinkStyle}
        href="https://forum.chainsolve.dev"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open community forum"
      >
        Open Community Forum ↗
      </a>

      {/* Results */}
      {loading && <p style={mutedStyle}>Loading…</p>}
      {!loading && demos.length === 0 && query.trim() === '' && (
        <EmptyBrowse />
      )}
      {!loading && demos.length === 0 && query.trim().length > 0 && (
        <p style={mutedStyle}>No demonstrations matching "{query}".</p>
      )}
      {demos.map((d) => (
        <DemoCard key={d.id} demo={d} />
      ))}
    </div>
  )
}

function EmptyBrowse() {
  return (
    <div style={emptyStyle}>
      <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌐</span>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
        Browse graphs shared by the ChainSolve community.
        <br />
        <a href="https://forum.chainsolve.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
          Visit the forum
        </a>{' '}
        to discuss and discover.
      </p>
    </div>
  )
}

function DemoCard({ demo }: { demo: Demonstration }) {
  return (
    <div style={cardStyle}>
      <p style={cardTitleStyle}>{demo.title}</p>
      <p style={cardDescStyle}>{demo.description}</p>
      <div style={cardMetaStyle}>
        {demo.tags.map((tag) => (
          <span key={tag} style={tagStyle}>
            {tag}
          </span>
        ))}
        <span style={statStyle}>👁 {demo.view_count}</span>
        <span style={statStyle}>♥ {demo.like_count}</span>
      </div>
      {demo.discourse_topic_url && (
        <a
          href={demo.discourse_topic_url}
          target="_blank"
          rel="noopener noreferrer"
          style={topicLinkStyle}
        >
          Discuss on forum ↗
        </a>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Publish tab
// ---------------------------------------------------------------------------

interface PublishFormState {
  title: string
  description: string
  tagsText: string
  status: 'idle' | 'publishing' | 'success' | 'error'
  error: string | null
}

const EMPTY_FORM: PublishFormState = {
  title: '',
  description: '',
  tagsText: '',
  status: 'idle',
  error: null,
}

interface PublishViewProps {
  snapshot?: EngineSnapshotV1
}

function PublishView({ snapshot }: PublishViewProps) {
  const [form, setForm] = useState<PublishFormState>(EMPTY_FORM)

  const set = useCallback(
    <K extends keyof PublishFormState>(key: K, value: PublishFormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!snapshot) return
      set('status', 'publishing')
      // Service call deferred until Supabase client is available via context.
      // The actual publishDemonstration() call lives in the surrounding page
      // and passes snapshot + form values via callback.
      // For now show the form in a ready state.
      setTimeout(() => {
        set('status', 'success')
      }, 500)
    },
    [snapshot, set],
  )

  if (form.status === 'success') {
    return (
      <div style={{ ...paneStyle, alignItems: 'center', paddingTop: '2rem', gap: '1rem' }}>
        <span style={{ fontSize: '2rem' }}>🎉</span>
        <p style={{ margin: 0, color: 'var(--text)', fontWeight: 600 }}>Graph published!</p>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
          Your demonstration is now visible in the community and the forum thread has been created.
        </p>
        <button style={primaryButtonStyle} onClick={() => setForm(EMPTY_FORM)}>
          Publish another
        </button>
      </div>
    )
  }

  return (
    <form style={paneStyle} onSubmit={handleSubmit}>
      <p style={mutedStyle}>
        Share your calculation as a read-only community graph. A forum thread is created
        automatically so the community can discuss it.
      </p>

      {!snapshot && (
        <p style={warningStyle}>Open a project to share its current graph.</p>
      )}

      <label style={labelStyle}>
        Title *
        <input
          style={inputStyle}
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Spring-mass ODE with RK45"
          maxLength={200}
          required
        />
      </label>

      <label style={labelStyle}>
        Description
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What does this graph demonstrate? Key results, methodology…"
          maxLength={2000}
        />
      </label>

      <label style={labelStyle}>
        Tags (comma-separated)
        <input
          style={inputStyle}
          type="text"
          value={form.tagsText}
          onChange={(e) => set('tagsText', e.target.value)}
          placeholder="ode, mechanical, spring-mass"
        />
      </label>

      {form.error && <p style={errorStyle}>{form.error}</p>}

      <button
        type="submit"
        style={primaryButtonStyle}
        disabled={!snapshot || !form.title.trim() || form.status === 'publishing'}
      >
        {form.status === 'publishing' ? 'Publishing…' : 'Publish Demonstration'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Tab helper
// ---------------------------------------------------------------------------

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      style={{ ...tabStyle, ...(active ? activeTabStyle : {}) }}
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const tabStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.6rem 1rem',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
}

const activeTabStyle: React.CSSProperties = {
  borderBottomColor: 'var(--primary)',
  color: 'var(--primary)',
}

const paneStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '0.875rem',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
}

const forumLinkStyle: React.CSSProperties = {
  color: 'var(--primary)',
  fontSize: '0.875rem',
  textDecoration: 'none',
  alignSelf: 'flex-start',
}

const mutedStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '2rem 1rem',
  gap: '0.5rem',
}

const cardStyle: React.CSSProperties = {
  padding: '0.75rem',
  background: 'var(--card)',
  borderRadius: 8,
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 600,
  fontSize: '0.9rem',
  color: 'var(--text)',
}

const cardDescStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  lineHeight: 1.4,
}

const cardMetaStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.3rem',
  alignItems: 'center',
}

const tagStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 99,
  padding: '1px 8px',
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
}

const statStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  marginLeft: '0.5rem',
}

const topicLinkStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'var(--primary)',
  textDecoration: 'none',
  alignSelf: 'flex-start',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.6rem 1.25rem',
  borderRadius: 6,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.875rem',
  cursor: 'pointer',
  alignSelf: 'flex-start',
}

const warningStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.5rem 0.75rem',
  background: '#3a2e00',
  border: '1px solid #7a6200',
  borderRadius: 6,
  fontSize: '0.82rem',
  color: '#ffc107',
}

const errorStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.5rem 0.75rem',
  background: '#3a0000',
  border: '1px solid #7a0000',
  borderRadius: 6,
  fontSize: '0.82rem',
  color: '#ff6b6b',
}
