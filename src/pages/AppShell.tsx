/**
 * AppShell — protected app shell.
 *
 * Contains:
 *  - Top nav (logo, user email, sign out)
 *  - Subscription / billing card
 *  - Project browser (create, open, rename, duplicate, export, delete, import)
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import {
  listProjects,
  createProject,
  renameProject,
  deleteProject,
  duplicateProject,
  loadProject,
  importProject,
  type ProjectRow,
  type ProjectJSON,
} from '../lib/projects'
import { canCreateProject, isReadOnly, showBillingBanner, type Plan } from '../lib/entitlements'
import { BRAND } from '../lib/brand'
import { UpgradeModal } from '../components/UpgradeModal'

interface Profile {
  id: string
  email: string | null
  plan: Plan
  stripe_customer_id: string | null
  current_period_end: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  trialing: 'Trial',
  pro: 'Pro',
  past_due: 'Past Due',
  canceled: 'Canceled',
}

const PLAN_COLORS: Record<Plan, string> = {
  free: '#6b7280',
  trialing: '#3b82f6',
  pro: '#22c55e',
  past_due: '#f59e0b',
  canceled: '#ef4444',
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Shared style constants ────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.5rem',
  background: 'var(--card-bg)',
  marginBottom: '1.5rem',
}

const sectionLabel: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const errorBox: React.CSSProperties = {
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#f87171',
  borderRadius: 8,
  padding: '0.65rem 0.85rem',
  marginBottom: '1rem',
  fontSize: '0.9rem',
}

function btnBase(extra?: React.CSSProperties): React.CSSProperties {
  return { fontFamily: 'inherit', cursor: 'pointer', fontSize: '0.9rem', borderRadius: 8, ...extra }
}

const btnPrimary: React.CSSProperties = btnBase({
  padding: '0.6rem 1.25rem',
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
})

const btnSecondary: React.CSSProperties = btnBase({
  padding: '0.6rem 1.25rem',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'inherit',
  fontWeight: 500,
})

const btnDanger: React.CSSProperties = btnBase({
  padding: '0.5rem 1rem',
  border: '1px solid rgba(239,68,68,0.3)',
  background: 'transparent',
  color: '#f87171',
  fontWeight: 500,
  fontSize: '0.85rem',
})

const btnSmall: React.CSSProperties = {
  ...btnSecondary,
  padding: '0.4rem 0.85rem',
  fontSize: '0.82rem',
}
const btnSmallPrimary: React.CSSProperties = {
  ...btnPrimary,
  padding: '0.4rem 0.85rem',
  fontSize: '0.82rem',
}
const btnDisabled: React.CSSProperties = { opacity: 0.55, cursor: 'not-allowed' }

// ── AppShell component ────────────────────────────────────────────────────────

export default function AppShell() {
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Billing
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  // Projects
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [projLoading, setProjLoading] = useState(false)
  const [projError, setProjError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null) // projectId
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const importRef = useRef<HTMLInputElement>(null)

  // ── Projects ──────────────────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    setProjLoading(true)
    setProjError(null)
    try {
      setProjects(await listProjects())
    } catch (err: unknown) {
      setProjError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setProjLoading(false)
    }
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login')
        return
      }
      setUser(session.user)
      supabase
        .from('profiles')
        .select('id,email,plan,stripe_customer_id,current_period_end')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) setProfile(data as Profile)
          setLoading(false)
          void fetchProjects()
        })
    })
  }, [navigate, fetchProjects])

  const handleNewProject = async () => {
    const plan = (profile?.plan ?? 'free') as Plan
    if (!canCreateProject(plan, projects.length)) {
      setUpgradeOpen(true)
      return
    }
    const name = window.prompt('Project name:', 'Untitled project')
    if (!name?.trim()) return
    setProjLoading(true)
    setProjError(null)
    try {
      const proj = await createProject(name.trim())
      navigate(`/canvas/${proj.id}`)
    } catch (err: unknown) {
      setProjError(err instanceof Error ? err.message : 'Failed to create project')
      setProjLoading(false)
    }
  }

  const handleRename = async (proj: ProjectRow) => {
    setMenuOpen(null)
    const next = window.prompt('Rename project:', proj.name)
    if (!next?.trim() || next.trim() === proj.name) return
    try {
      await renameProject(proj.id, next.trim())
      void fetchProjects()
    } catch (err: unknown) {
      setProjError(err instanceof Error ? err.message : 'Rename failed')
    }
  }

  const handleDuplicate = async (proj: ProjectRow) => {
    setMenuOpen(null)
    const plan = (profile?.plan ?? 'free') as Plan
    if (!canCreateProject(plan, projects.length)) {
      setUpgradeOpen(true)
      return
    }
    setProjLoading(true)
    try {
      await duplicateProject(proj.id, `${proj.name} (copy)`)
      void fetchProjects()
    } catch (err: unknown) {
      setProjError(err instanceof Error ? err.message : 'Duplicate failed')
      setProjLoading(false)
    }
  }

  const handleDelete = async (proj: ProjectRow) => {
    setMenuOpen(null)
    if (!window.confirm(`Delete "${proj.name}"? This cannot be undone.`)) return
    try {
      await deleteProject(proj.id)
      void fetchProjects()
    } catch (err: unknown) {
      setProjError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleExport = async (proj: ProjectRow) => {
    setMenuOpen(null)
    try {
      const pj = await loadProject(proj.id)
      const blob = new Blob([JSON.stringify(pj, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${proj.name.replace(/[^a-z0-9]/gi, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setProjError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so same file can be re-picked
    if (!file) return
    const plan = (profile?.plan ?? 'free') as Plan
    if (!canCreateProject(plan, projects.length)) {
      setUpgradeOpen(true)
      return
    }
    try {
      const text = await file.text()
      const json = JSON.parse(text) as ProjectJSON
      const proj = await importProject(json)
      navigate(`/canvas/${proj.id}`)
    } catch (err: unknown) {
      setProjError(
        err instanceof Error
          ? err.message
          : 'Import failed — check the file is a valid project.json',
      )
    }
  }

  // ── Billing ───────────────────────────────────────────────────────────────

  const callBillingApi = async (endpoint: string) => {
    setBillingLoading(true)
    setBillingError(null)
    try {
      // Force a token refresh so the access_token is never stale
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshData.session) {
        await supabase.auth.signOut()
        navigate('/login')
        return
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshData.session.access_token}` },
      })
      let json: Record<string, unknown>
      try {
        json = (await res.json()) as Record<string, unknown>
      } catch {
        throw new Error(`Server returned a non-JSON response (HTTP ${res.status})`)
      }
      if (!res.ok)
        throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
      if (typeof json.url !== 'string') throw new Error('No redirect URL returned by server')
      window.location.assign(json.url)
    } catch (err: unknown) {
      setBillingError(err instanceof Error ? err.message : 'Billing request failed')
      setBillingLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.5,
        }}
      >
        Loading…
      </div>
    )
  }

  const plan = (profile?.plan ?? 'free') as Plan
  const canUpgrade = plan === 'free' || plan === 'canceled'
  const canManage = plan === 'trialing' || plan === 'pro' || plan === 'past_due'
  const readOnly = isReadOnly(plan)
  const bannerKind = showBillingBanner(plan)
  const allowCreate = canCreateProject(plan, projects.length)
  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Upgrade modal ── */}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="project_limit"
      />
      {/* Nav */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          height: 56,
          borderBottom: '1px solid var(--border)',
          background: 'var(--card-bg)',
        }}
      >
        <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 28 }} />
        </a>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>{user?.email}</span>
          <button style={btnSmall} onClick={() => navigate('/settings')}>
            Settings
          </button>
          <button style={btnDanger} onClick={() => void handleLogout()}>
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Billing banners ── */}
      {bannerKind === 'past_due' && (
        <div
          style={{
            background: 'rgba(245,158,11,0.1)',
            borderBottom: '1px solid rgba(245,158,11,0.3)',
            padding: '0.55rem 1.5rem',
            fontSize: '0.85rem',
            color: '#fbbf24',
          }}
        >
          Your payment is past due. Please update your billing info to avoid losing access.
        </div>
      )}
      {bannerKind === 'canceled' && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            borderBottom: '1px solid rgba(239,68,68,0.3)',
            padding: '0.55rem 1.5rem',
            fontSize: '0.85rem',
            color: '#f87171',
          }}
        >
          Your subscription has been canceled. Existing projects are read-only.
        </div>
      )}

      <main
        style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 960, width: '100%', margin: '0 auto' }}
      >
        {/* ── Subscription card ── */}
        <div style={cardStyle}>
          <p style={sectionLabel}>Subscription</p>
          {billingError && <div style={errorBox}>{billingError}</div>}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Current plan</span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 999,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: PLAN_COLORS[plan] + '22',
                    color: PLAN_COLORS[plan],
                    border: `1px solid ${PLAN_COLORS[plan]}44`,
                  }}
                >
                  {PLAN_LABELS[plan]}
                </span>
              </div>
              {periodEnd && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                    {plan === 'trialing' ? 'Trial ends' : 'Renews'}
                  </span>
                  <span style={{ fontWeight: 500 }}>{periodEnd}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {canUpgrade && (
                <button
                  style={{ ...btnPrimary, ...(billingLoading ? btnDisabled : {}) }}
                  disabled={billingLoading}
                  onClick={() => void callBillingApi('/api/stripe/create-checkout-session')}
                >
                  {billingLoading ? 'Redirecting…' : 'Upgrade — £10/mo'}
                </button>
              )}
              {canManage && (
                <button
                  style={{ ...btnSecondary, ...(billingLoading ? btnDisabled : {}) }}
                  disabled={billingLoading}
                  onClick={() => void callBillingApi('/api/stripe/create-portal-session')}
                >
                  {billingLoading ? 'Redirecting…' : 'Manage billing'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Projects card ── */}
        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            <p style={{ ...sectionLabel, margin: 0 }}>Projects</p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => void handleImportFile(e)}
              />
              <button
                style={{ ...btnSmall, ...(readOnly ? btnDisabled : {}) }}
                disabled={readOnly}
                onClick={() => importRef.current?.click()}
                title={readOnly ? 'Canceled accounts cannot import projects' : undefined}
              >
                Import .json
              </button>
              <button
                style={{
                  ...btnSmallPrimary,
                  ...(projLoading || !allowCreate ? btnDisabled : {}),
                }}
                disabled={projLoading || !allowCreate}
                onClick={() => void handleNewProject()}
                title={
                  readOnly
                    ? 'Canceled accounts cannot create projects'
                    : !allowCreate
                      ? 'Project limit reached — upgrade to Pro'
                      : undefined
                }
              >
                + New Project
              </button>
            </div>
          </div>

          {projError && <div style={errorBox}>{projError}</div>}

          {projLoading && projects.length === 0 ? (
            <p style={{ opacity: 0.4, fontSize: '0.85rem', margin: 0 }}>Loading…</p>
          ) : projects.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', opacity: 0.4 }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⟁</div>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 600 }}>
                No projects yet
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>
                Create your first project to get started.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {projects.map((proj) => (
                <ProjectCard
                  key={proj.id}
                  project={proj}
                  menuOpen={menuOpen === proj.id}
                  onOpenMenu={() => setMenuOpen(proj.id)}
                  onCloseMenu={() => setMenuOpen(null)}
                  onOpen={() => navigate(`/canvas/${proj.id}`)}
                  onRename={() => void handleRename(proj)}
                  onDuplicate={() => void handleDuplicate(proj)}
                  onDelete={() => void handleDelete(proj)}
                  onExport={() => void handleExport(proj)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectRow
  menuOpen: boolean
  onOpenMenu: () => void
  onCloseMenu: () => void
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExport: () => void
}

const menuActions = [
  { key: 'rename', label: 'Rename…' },
  { key: 'duplicate', label: 'Duplicate' },
  { key: 'export', label: 'Export .json' },
  { key: 'delete', label: 'Delete', danger: true },
] as const

function ProjectCard({
  project,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
}: ProjectCardProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        onCloseMenu()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen, onCloseMenu])

  const handleAction = (key: (typeof menuActions)[number]['key']) => {
    onCloseMenu()
    switch (key) {
      case 'rename':
        return onRename()
      case 'duplicate':
        return onDuplicate()
      case 'export':
        return onExport()
      case 'delete':
        return onDelete()
    }
  }

  return (
    <div
      onClick={onOpen}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: '#252525',
        padding: '0.85rem 1rem',
        cursor: 'pointer',
        position: 'relative',
        transition: 'border-color 0.15s',
      }}
      onMouseOver={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,171,176,0.4)'
      }}
      onMouseOut={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
      }}
    >
      {/* Icon */}
      <div
        style={{ fontSize: '1.4rem', marginBottom: '0.4rem', userSelect: 'none', lineHeight: 1 }}
      >
        ⟁
      </div>

      {/* Name */}
      <div
        style={{
          fontWeight: 600,
          fontSize: '0.88rem',
          marginBottom: '0.25rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingRight: '1.4rem', // space for ⋯ button
        }}
      >
        {project.name}
      </div>

      {/* Updated time */}
      <div style={{ fontSize: '0.72rem', opacity: 0.4 }}>{fmtDate(project.updated_at)}</div>

      {/* Three-dot menu */}
      <div
        ref={menuRef}
        style={{ position: 'absolute', top: '0.55rem', right: '0.55rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => {
            if (menuOpen) onCloseMenu()
            else onOpenMenu()
          }}
          title="Project actions"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(244,244,243,0.45)',
            fontSize: '1.1rem',
            padding: '0.1rem 0.35rem',
            borderRadius: 4,
            lineHeight: 1,
            fontFamily: 'inherit',
          }}
        >
          ⋯
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '115%',
              zIndex: 500,
              background: '#2c2c2c',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
              minWidth: 148,
              overflow: 'hidden',
            }}
          >
            {menuActions.map((item) => (
              <button
                key={item.key}
                onClick={() => handleAction(item.key)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.45rem 0.85rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontFamily: 'inherit',
                  color: 'danger' in item && item.danger ? '#f87171' : '#F4F4F3',
                }}
                onMouseOver={(e) => {
                  const isDanger = 'danger' in item && item.danger
                  ;(e.currentTarget as HTMLElement).style.background = isDanger
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(28,171,176,0.1)'
                }}
                onMouseOut={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
