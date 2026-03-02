/**
 * AppShell — Workbench Home (protected app shell).
 *
 * This is the default post-login landing page (/app).
 * When no project is open, it shows the "Workbench Home" view with:
 *  - Top nav (logo, user email, sign out)
 *  - Welcome header
 *  - Subscription / billing card
 *  - Project browser (create, open, rename, duplicate, export, delete, import)
 */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSettingsModal } from '../contexts/SettingsModalContext'
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
import {
  canCreateProject,
  getEntitlements,
  isPro,
  isReadOnly,
  resolveEffectivePlan,
  showBillingBanner,
  type Plan,
} from '../lib/entitlements'
import { BRAND } from '../lib/brand'
import { UpgradeModal } from '../components/UpgradeModal'
import { getRecentProjects } from '../lib/recentProjects'
import { getPinnedProjects, togglePinnedProject } from '../lib/pinnedProjects'
import { CURRENT_TERMS_VERSION } from '../lib/termsVersion'
import { initRememberMe } from '../lib/rememberMe'
import { touchSession } from '../lib/sessionService'

type SortMode = 'recent' | 'name' | 'created'
type FilterTab = 'all' | 'recent' | 'pinned'

const LazyAuthGate = lazy(() => import('../components/AuthGate'))

const LazyFirstRunModal = lazy(() =>
  import('../components/app/FirstRunModal').then((m) => ({ default: m.FirstRunModal })),
)

const ONBOARDED_KEY = 'cs:onboarded'

interface Profile {
  id: string
  email: string | null
  plan: Plan
  stripe_customer_id: string | null
  current_period_end: string | null
  /** E2-3: Semantic version of ToS the user accepted. */
  accepted_terms_version: string | null
  /** E2-3: Whether the user opted in to marketing. */
  marketing_opt_in: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  trialing: 'Trial',
  pro: 'Pro',
  enterprise: 'Enterprise',
  past_due: 'Past Due',
  canceled: 'Canceled',
}

const PLAN_COLORS: Record<Plan, string> = {
  free: '#6b7280',
  trialing: '#3b82f6',
  pro: '#22c55e',
  enterprise: '#8b5cf6',
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
  borderRadius: 'var(--radius-xl)',
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
  color: 'var(--danger)',
  borderRadius: 'var(--radius-lg)',
  padding: '0.65rem 0.85rem',
  marginBottom: '1rem',
  fontSize: '0.9rem',
}

function btnBase(extra?: React.CSSProperties): React.CSSProperties {
  return {
    fontFamily: 'inherit',
    cursor: 'pointer',
    fontSize: '0.9rem',
    borderRadius: 'var(--radius-lg)',
    ...extra,
  }
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

type GuideAction = 'scratch' | 'settings' | 'explore' | 'import'

const GUIDE_LINKS: { key: string; icon: string; action: GuideAction }[] = [
  { key: 'home.guideScratch', icon: '⟁', action: 'scratch' },
  { key: 'home.guideSettings', icon: '⚙', action: 'settings' },
  { key: 'home.guideExplore', icon: '◈', action: 'explore' },
  { key: 'home.guideImport', icon: '↥', action: 'import' },
]

// ── AppShell component ────────────────────────────────────────────────────────

export default function AppShell() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { openSettings } = useSettingsModal()

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
  const [upgradeReason, setUpgradeReason] = useState<'project_limit' | 'export_locked'>(
    'project_limit',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => getPinnedProjects())
  const [firstRunOpen, setFirstRunOpen] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDED_KEY)
    } catch {
      return false
    }
  })

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

  const recentIds = useMemo(() => {
    return new Set(getRecentProjects().map((r) => r.id))
  }, [projects]) // eslint-disable-line react-hooks/exhaustive-deps -- re-derive when projects change

  const filteredProjects = useMemo(() => {
    let list = projects

    // Apply filter tab
    if (filterTab === 'pinned') {
      list = list.filter((p) => pinnedIds.has(p.id))
    } else if (filterTab === 'recent') {
      const recent = getRecentProjects()
      const recentOrder = new Map(recent.map((r, i) => [r.id, i]))
      list = list.filter((p) => recentOrder.has(p.id))
      // Sort by MRU order for "recent" tab
      list = [...list].sort((a, b) => (recentOrder.get(a.id) ?? 0) - (recentOrder.get(b.id) ?? 0))
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }

    // Apply sort (skip if recent tab — already sorted by MRU)
    if (filterTab !== 'recent') {
      const sorted = [...list]
      switch (sortMode) {
        case 'name':
          sorted.sort((a, b) => a.name.localeCompare(b.name))
          break
        case 'created':
          sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          break
        case 'recent':
        default:
          sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          break
      }
      return sorted
    }
    return list
  }, [projects, searchQuery, sortMode, filterTab, pinnedIds])

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login')
        return
      }
      setUser(session.user)
      initRememberMe()
      void touchSession()
      supabase
        .from('profiles')
        .select(
          'id,email,plan,stripe_customer_id,current_period_end,is_developer,is_admin,accepted_terms_version,marketing_opt_in',
        )
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) setProfile(data as Profile)
          setLoading(false)
          void fetchProjects()
        })
    })
  }, [navigate, fetchProjects])

  // E2-3: Handle ToS acceptance from AuthGate
  const handleTermsAccepted = useCallback(
    async (version: string) => {
      // Dynamic import to keep acceptTerms out of the initial bundle
      const { acceptTerms } = await import('../lib/profilesService')
      await acceptTerms(version)
      // Re-fetch profile to reflect the acceptance
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select(
            'id,email,plan,stripe_customer_id,current_period_end,is_developer,is_admin,accepted_terms_version,marketing_opt_in',
          )
          .eq('id', user.id)
          .maybeSingle()
        if (data) setProfile(data as Profile)
      }
    },
    [user],
  )

  const handleNewProject = async () => {
    const plan = resolveEffectivePlan(profile)
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
    const plan = resolveEffectivePlan(profile)
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

  const handleTogglePin = useCallback((projectId: string) => {
    setPinnedIds(togglePinnedProject(projectId))
  }, [])

  const handleExport = async (proj: ProjectRow) => {
    setMenuOpen(null)
    // D11-4: Gate export behind canExport
    const plan = resolveEffectivePlan(profile)
    if (!getEntitlements(plan).canExport) {
      setUpgradeReason('export_locked')
      setUpgradeOpen(true)
      return
    }
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
    const plan = resolveEffectivePlan(profile)
    // D11-4: Gate import behind canExport
    if (!getEntitlements(plan).canExport) {
      setUpgradeReason('export_locked')
      setUpgradeOpen(true)
      return
    }
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

  // ── First-run onboarding ───────────────────────────────────────────────────

  const dismissFirstRun = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {
      // Ignore — private browsing
    }
    setFirstRunOpen(false)
  }, [])

  const handleFirstRunScratch = useCallback(() => {
    dismissFirstRun()
    navigate('/canvas')
  }, [dismissFirstRun, navigate])

  const handleFirstRunBrowseTemplates = useCallback(() => {
    dismissFirstRun()
    navigate('/explore')
  }, [dismissFirstRun, navigate])

  const handleFirstRunImport = useCallback(() => {
    dismissFirstRun()
    importRef.current?.click()
  }, [dismissFirstRun])

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

  // E2-3: Block access until email is verified and ToS accepted.
  // AuthGate checks email_confirmed_at and accepted_terms_version internally.
  if (user && profile) {
    const gateProfile = { accepted_terms_version: profile.accepted_terms_version ?? null }
    // AuthGate renders its own gate screens and only passes through when satisfied.
    // We wrap the entire UI below in AuthGate via an early return.
    // However, to avoid re-indenting 800+ lines, we check the two conditions
    // here and short-circuit to the gate screen if either fails.
    const needsGate =
      !user.email_confirmed_at || gateProfile.accepted_terms_version !== CURRENT_TERMS_VERSION
    if (needsGate) {
      return (
        <Suspense fallback={null}>
          <LazyAuthGate user={user} profile={gateProfile} onTermsAccepted={handleTermsAccepted}>
            {null}
          </LazyAuthGate>
        </Suspense>
      )
    }
  }

  const plan = resolveEffectivePlan(profile)
  const canUpgrade = plan === 'free' || plan === 'canceled'
  const canManage =
    plan === 'trialing' || plan === 'pro' || plan === 'enterprise' || plan === 'past_due'
  const readOnly = isReadOnly(plan)
  const bannerKind = showBillingBanner(plan)
  const allowCreate = canCreateProject(plan, projects.length)
  const ent = getEntitlements(plan)
  const projectCountLabel =
    ent.maxProjects === Infinity ? `${projects.length}` : `${projects.length} / ${ent.maxProjects}`
  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null
  const trialDaysLeft =
    plan === 'trialing' && profile?.current_period_end
      ? Math.ceil(
          (new Date(profile.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
      : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Upgrade modal ── */}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
      {/* ── First-run onboarding modal ── */}
      {firstRunOpen && !loading && (
        <Suspense fallback={null}>
          <LazyFirstRunModal
            open
            onClose={dismissFirstRun}
            onStartScratch={handleFirstRunScratch}
            onBrowseTemplates={handleFirstRunBrowseTemplates}
            onImport={handleFirstRunImport}
          />
        </Suspense>
      )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 28 }} />
          </a>
          <a
            href="/explore"
            style={{
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'rgba(244,244,243,0.6)',
              textDecoration: 'none',
            }}
          >
            {t('home.explore')}
          </a>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>{user?.email}</span>
          <button
            style={{
              ...btnSmall,
              fontSize: '1.1rem',
              padding: '0.25rem 0.55rem',
              lineHeight: 1,
            }}
            onClick={() => openSettings()}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
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
      {trialDaysLeft !== null && trialDaysLeft <= 7 && (
        <div
          style={{
            background: 'rgba(59,130,246,0.1)',
            borderBottom: '1px solid rgba(59,130,246,0.3)',
            padding: '0.55rem 1.5rem',
            fontSize: '0.85rem',
            color: '#93c5fd',
          }}
        >
          {trialDaysLeft <= 0
            ? 'Your trial has expired. Upgrade to keep full access.'
            : `Your trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}. Upgrade to keep full access.`}
        </div>
      )}

      <main
        style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 960, width: '100%', margin: '0 auto' }}
      >
        {/* ── Workbench Home header + hero CTAs ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.6rem',
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            {t('home.title')}
          </h1>
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '0.9rem',
              opacity: 0.5,
            }}
          >
            {t('home.subtitle')}
          </p>
        </div>

        {/* ── Hero CTAs ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <button
            style={{
              ...cardStyle,
              marginBottom: 0,
              cursor: projLoading || !allowCreate ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              opacity: projLoading || !allowCreate ? 0.55 : 1,
              border: '1px solid rgba(28,171,176,0.25)',
              fontFamily: 'inherit',
              color: 'inherit',
              textAlign: 'left',
              transition: 'border-color 0.15s',
            }}
            disabled={projLoading || !allowCreate}
            onClick={() => void handleNewProject()}
            onMouseOver={(e) => {
              if (!projLoading && allowCreate)
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,171,176,0.5)'
            }}
            onMouseOut={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,171,176,0.25)'
            }}
          >
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>+</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('home.createProject')}</div>
              <div style={{ fontSize: '0.78rem', opacity: 0.5, marginTop: '0.15rem' }}>
                {t('home.createProjectDesc')}
              </div>
            </div>
          </button>

          <button
            style={{
              ...cardStyle,
              marginBottom: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              border: '1px solid var(--border)',
              fontFamily: 'inherit',
              color: 'inherit',
              textAlign: 'left',
              transition: 'border-color 0.15s',
            }}
            onClick={() => navigate('/canvas')}
            onMouseOver={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,171,176,0.4)'
            }}
            onMouseOut={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>⟁</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('home.openScratch')}</div>
              <div style={{ fontSize: '0.78rem', opacity: 0.5, marginTop: '0.15rem' }}>
                {t('home.openScratchDesc')}
              </div>
            </div>
          </button>
        </div>

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

        {/* ── Projects directory ── */}
        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <p style={{ ...sectionLabel, margin: 0 }}>{t('home.directory')}</p>
              <span
                style={{ fontSize: '0.78rem', opacity: 0.45, fontVariantNumeric: 'tabular-nums' }}
              >
                {projectCountLabel}
              </span>
            </div>
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
                title={readOnly ? 'Read-only accounts cannot import projects' : undefined}
              >
                {t('projects.import')}
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
                    ? t('entitlements.canceledNoCreate')
                    : !allowCreate
                      ? t('entitlements.projectLimitMsg')
                      : undefined
                }
              >
                + {t('projects.newProject')}
              </button>
            </div>
          </div>

          {/* ── Filter tabs ── */}
          {projects.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '0.25rem',
                marginBottom: '0.75rem',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '0.5rem',
              }}
            >
              {(
                [
                  { key: 'all', label: t('home.filterAll'), count: projects.length },
                  { key: 'recent', label: t('home.filterRecent'), count: recentIds.size },
                  { key: 'pinned', label: t('home.filterPinned'), count: pinnedIds.size },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    border: 'none',
                    borderRadius: 6,
                    background: filterTab === tab.key ? 'rgba(28,171,176,0.15)' : 'transparent',
                    color: filterTab === tab.key ? 'rgba(28,171,176,1)' : 'rgba(244,244,243,0.55)',
                    fontFamily: 'inherit',
                    fontSize: '0.78rem',
                    fontWeight: filterTab === tab.key ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {tab.label}
                  <span
                    style={{
                      marginLeft: '0.35rem',
                      fontSize: '0.7rem',
                      opacity: 0.6,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Search + sort controls ── */}
          {projects.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('home.searchProjects')}
                style={{
                  flex: '1 1 160px',
                  padding: '0.45rem 0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'transparent',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: '0.82rem',
                }}
              />
              {filterTab !== 'recent' && (
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  style={{
                    padding: '0.45rem 0.6rem',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--card-bg)',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  <option value="recent">{t('home.sortRecent')}</option>
                  <option value="name">{t('home.sortName')}</option>
                  <option value="created">{t('home.sortCreated')}</option>
                </select>
              )}
            </div>
          )}

          {projError && <div style={errorBox}>{projError}</div>}

          {projLoading && projects.length === 0 ? (
            <p style={{ opacity: 0.4, fontSize: '0.85rem', margin: 0 }}>{t('projects.loading')}</p>
          ) : projects.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', opacity: 0.4 }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⟁</div>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 600 }}>
                {t('projects.noProjects')}
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>{t('projects.noProjectsHint')}</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={{ padding: '1.5rem 1rem', textAlign: 'center', opacity: 0.4 }}>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {filterTab === 'pinned'
                  ? t('home.noPinned')
                  : filterTab === 'recent'
                    ? t('home.noRecent')
                    : t('home.noSearchResults')}
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
              {filteredProjects.map((proj) => (
                <ProjectCard
                  key={proj.id}
                  project={proj}
                  pinned={pinnedIds.has(proj.id)}
                  onTogglePin={() => handleTogglePin(proj.id)}
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

        {/* ── Quick guide links ── */}
        <div style={cardStyle}>
          <p style={sectionLabel}>{t('home.quickStart')}</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '0.5rem',
            }}
          >
            {GUIDE_LINKS.map((link) => (
              <button
                key={link.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                }}
                onClick={() => {
                  switch (link.action) {
                    case 'scratch':
                      navigate('/canvas')
                      break
                    case 'settings':
                      openSettings('preferences')
                      break
                    case 'explore':
                      navigate('/explore')
                      break
                    case 'import':
                      importRef.current?.click()
                      break
                  }
                }}
                onMouseOver={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,171,176,0.4)'
                }}
                onMouseOut={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
                }}
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1, opacity: 0.7 }}>{link.icon}</span>
                <span style={{ fontWeight: 500 }}>{t(link.key)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Explore CTA ── */}
        <div
          style={{
            ...cardStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <p style={{ ...sectionLabel, margin: '0 0 0.35rem' }}>{t('home.explore')}</p>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>{t('home.exploreDesc')}</p>
          </div>
          {isPro(plan) ? (
            <button style={btnSecondary} onClick={() => navigate('/explore')}>
              {t('home.exploreCta')}
            </button>
          ) : (
            <button
              style={{ ...btnSecondary, opacity: 0.65, cursor: 'not-allowed' }}
              disabled
              title={t('home.exploreLocked')}
            >
              {t('home.exploreLocked')}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectRow
  pinned: boolean
  onTogglePin: () => void
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
  pinned,
  onTogglePin,
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
      {/* Icon + pin */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.4rem',
        }}
      >
        <span style={{ fontSize: '1.4rem', userSelect: 'none', lineHeight: 1 }}>⟁</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin()
          }}
          title={pinned ? 'Unpin project' : 'Pin project'}
          aria-label={pinned ? 'Unpin project' : 'Pin project'}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: pinned ? '#f59e0b' : 'rgba(244,244,243,0.25)',
            fontSize: '0.85rem',
            padding: '0.1rem 0.25rem',
            lineHeight: 1,
            fontFamily: 'inherit',
            transition: 'color 0.15s',
          }}
        >
          {pinned ? '\u2605' : '\u2606'}
        </button>
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
          aria-label="Project actions"
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
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
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
