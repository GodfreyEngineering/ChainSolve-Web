import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { ProjectAsset } from '../lib/storage'
import { saveProjectJson, uploadCsv, listProjectAssets } from '../lib/storage'

type Plan = 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled'

interface Profile {
  id: string
  email: string | null
  plan: Plan
  stripe_customer_id: string | null
  current_period_end: string | null
}

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

const s = {
  shell: { minHeight: '100vh', display: 'flex', flexDirection: 'column' as const },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    height: '56px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--card-bg)',
  } as React.CSSProperties,
  navLogo: { fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.5px' } as React.CSSProperties,
  navActions: { display: 'flex', gap: '0.75rem', alignItems: 'center' } as React.CSSProperties,
  main: { flex: 1, padding: '2rem 1.5rem', maxWidth: '800px', width: '100%', margin: '0 auto' } as React.CSSProperties,
  card: {
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    background: 'var(--card-bg)',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  sectionLabel: {
    margin: '0 0 1rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.5,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '0.75rem' } as React.CSSProperties,
  metaBlock: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' } as React.CSSProperties,
  metaLabel: { fontSize: '0.8rem', opacity: 0.5 } as React.CSSProperties,
  metaValue: { fontWeight: 500 } as React.CSSProperties,
  planBadge: (plan: Plan): React.CSSProperties => ({
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 700,
    background: PLAN_COLORS[plan] + '22',
    color: PLAN_COLORS[plan],
    border: `1px solid ${PLAN_COLORS[plan]}44`,
  }),
  btnPrimary: {
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    border: 'none',
    background: '#646cff',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
  } as React.CSSProperties,
  btnSecondary: {
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.9rem',
  } as React.CSSProperties,
  btnDanger: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'transparent',
    color: '#f87171',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.85rem',
  } as React.CSSProperties,
  btnDisabled: { opacity: 0.55, cursor: 'not-allowed' } as React.CSSProperties,
  errorBox: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  } as React.CSSProperties,
  mono: { fontFamily: 'monospace', fontSize: '0.8rem', opacity: 0.7 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem', marginTop: '0.75rem' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.35rem 0.5rem', opacity: 0.5, fontWeight: 500, borderBottom: '1px solid var(--border)' } as React.CSSProperties,
  td: { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' } as React.CSSProperties,
  tdRight: { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right' as const } as React.CSSProperties,
  muted: { opacity: 0.4, fontSize: '0.85rem' } as React.CSSProperties,
}

export default function AppShell() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Billing
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  // Workspace / storage smoke-test
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null)
  const [assets, setAssets] = useState<ProjectAsset[]>([])
  const [storageLoading, setStorageLoading] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login')
        return
      }
      setUser(session.user)
      loadProfile(session.user.id)
    })
  }, [navigate])

  const loadProfile = async (userId: string) => {
    const { data, error: profileErr } = await supabase
      .from('profiles')
      .select('id,email,plan,stripe_customer_id,current_period_end')
      .eq('id', userId)
      .maybeSingle()
    if (!profileErr && data) setProfile(data as Profile)
    setLoading(false)
  }

  // ── Billing ───────────────────────────────────────────────────────────────

  const callBillingApi = async (endpoint: string) => {
    setBillingLoading(true)
    setBillingError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      // Always parse JSON — functions return { ok, url|error } in all cases.
      let json: Record<string, unknown>
      try {
        json = await res.json() as Record<string, unknown>
      } catch {
        throw new Error(`Server returned a non-JSON response (HTTP ${res.status})`)
      }

      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
      }
      if (typeof json.url !== 'string') throw new Error('No redirect URL returned by server')
      window.location.assign(json.url)
    } catch (err: unknown) {
      setBillingError(err instanceof Error ? err.message : 'Billing request failed')
      setBillingLoading(false)
    }
  }

  // ── Workspace / storage ───────────────────────────────────────────────────

  /**
   * 1. Insert a row into public.projects
   * 2. saveProjectJson → uploads {}.json to storage, stamps storage_key
   * 3. Set as active project and clear asset list
   */
  const handleCreateProject = async () => {
    setStorageLoading(true)
    setStorageError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const userId = session.user.id

      const projectName = `Test project ${new Date().toLocaleTimeString()}`

      const { data, error: projErr } = await supabase
        .from('projects')
        .insert({ owner_id: userId, name: projectName })
        .select('id,name')
        .single()

      if (projErr || !data) throw new Error(projErr?.message ?? 'Failed to create project row')
      const proj = data as { id: string; name: string }

      await saveProjectJson(proj.id, { nodes: [], edges: [], version: 1 })

      setActiveProjectId(proj.id)
      setActiveProjectName(proj.name)
      setAssets([])
    } catch (err: unknown) {
      setStorageError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setStorageLoading(false)
    }
  }

  /**
   * Hidden <input type="file"> onChange handler.
   * Uploads the chosen CSV then refreshes the asset list.
   */
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so the same file can be re-picked after an error
    e.target.value = ''
    if (!file || !activeProjectId) return

    setStorageLoading(true)
    setStorageError(null)
    try {
      await uploadCsv(activeProjectId, file)
      const loaded = await listProjectAssets(activeProjectId)
      setAssets(loaded)
    } catch (err: unknown) {
      setStorageError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setStorageLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
        Loading…
      </div>
    )
  }

  const plan = (profile?.plan ?? 'free') as Plan
  const canUpgrade = plan === 'free' || plan === 'canceled'
  const canManage = plan === 'trialing' || plan === 'pro' || plan === 'past_due'

  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div style={s.shell}>
      {/* Navbar */}
      <nav style={s.nav}>
        <span style={s.navLogo}>ChainSolve</span>
        <div style={s.navActions}>
          <a
            href="/canvas"
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'inherit',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            Open Canvas
          </a>
          <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>{user?.email}</span>
          <button style={s.btnDanger} onClick={handleLogout}>Sign out</button>
        </div>
      </nav>

      <main style={s.main}>
        {/* ── Billing card ── */}
        <div style={s.card}>
          <p style={s.sectionLabel}>Subscription</p>
          {billingError && <div style={s.errorBox}>{billingError}</div>}
          <div style={s.row}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={s.metaBlock}>
                <span style={s.metaLabel}>Current plan</span>
                <span style={s.planBadge(plan)}>{PLAN_LABELS[plan]}</span>
              </div>
              {periodEnd && (
                <div style={s.metaBlock}>
                  <span style={s.metaLabel}>{plan === 'trialing' ? 'Trial ends' : 'Renews'}</span>
                  <span style={s.metaValue}>{periodEnd}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {canUpgrade && (
                <button
                  style={{ ...s.btnPrimary, ...(billingLoading ? s.btnDisabled : {}) }}
                  disabled={billingLoading}
                  onClick={() => callBillingApi('/api/stripe/create-checkout-session')}
                >
                  {billingLoading ? 'Redirecting…' : 'Upgrade — £10/mo'}
                </button>
              )}
              {canManage && (
                <button
                  style={{ ...s.btnSecondary, ...(billingLoading ? s.btnDisabled : {}) }}
                  disabled={billingLoading}
                  onClick={() => callBillingApi('/api/stripe/create-portal-session')}
                >
                  {billingLoading ? 'Redirecting…' : 'Manage billing'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Workspace / storage smoke-test card ── */}
        <div style={s.card}>
          <p style={s.sectionLabel}>Workspace</p>

          {storageError && <div style={s.errorBox}>{storageError}</div>}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              style={{ ...s.btnPrimary, ...(storageLoading ? s.btnDisabled : {}) }}
              disabled={storageLoading}
              onClick={handleCreateProject}
            >
              {storageLoading && !activeProjectId ? 'Creating…' : 'Create project'}
            </button>

            {activeProjectId && (
              <>
                <button
                  style={{ ...s.btnSecondary, ...(storageLoading ? s.btnDisabled : {}) }}
                  disabled={storageLoading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {storageLoading ? 'Uploading…' : 'Upload CSV'}
                </button>
                {/* Hidden file input — triggered by button above */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>

          {activeProjectId && (
            <div style={{ marginTop: '1.25rem' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', opacity: 0.6 }}>
                Active:{' '}
                <span style={s.mono}>{activeProjectName}</span>
                {'  '}
                <span style={s.mono}>id: {activeProjectId.slice(0, 8)}…</span>
              </p>

              {assets.length === 0 ? (
                <p style={s.muted}>No assets yet — upload a CSV to see it here.</p>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Filename</th>
                      <th style={s.th}>Kind</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Size</th>
                      <th style={s.th}>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(a => (
                      <tr key={a.id}>
                        <td style={s.td}>{a.name}</td>
                        <td style={s.td}>{a.kind ?? '—'}</td>
                        <td style={s.tdRight}>
                          {a.size != null ? `${(a.size / 1024).toFixed(1)} KB` : '—'}
                        </td>
                        <td style={s.td}>
                          {new Date(a.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
