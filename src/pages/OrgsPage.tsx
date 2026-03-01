/**
 * OrgsPage — P124: Org UI v0 (create org, invite, roles).
 *
 * Route: /orgs
 *
 * Features (v0):
 *   - List organizations the user belongs to
 *   - Create a new organization
 *   - View members of a selected org
 *   - Invite a member (by user ID)
 *   - Update a member's role
 *   - Remove a member / leave the org
 *   - Rename or dissolve the org (owner only)
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createOrg,
  listMyOrgs,
  listOrgMembers,
  inviteOrgMember,
  updateMemberRole,
  removeOrgMember,
  renameOrg,
  deleteOrg,
  getOrgPolicy,
  updateOrgPolicy,
  type Org,
  type OrgMember,
  type OrgRole,
  type OrgPolicy,
} from '../lib/orgsService'
import { getCurrentUser } from '../lib/auth'

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
    gap: '1rem',
    padding: '0 1.5rem',
    height: 56,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'var(--card-bg, #252525)',
  } satisfies React.CSSProperties,
  body: {
    maxWidth: 820,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  } satisfies React.CSSProperties,
  section: {
    background: 'var(--card-bg, #252525)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '1.25rem',
    marginBottom: '1.5rem',
  } satisfies React.CSSProperties,
  h2: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 1rem',
    color: 'var(--fg, #F4F4F3)',
  } satisfies React.CSSProperties,
  row: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '0.5rem',
  } satisfies React.CSSProperties,
  input: {
    flex: 1,
    padding: '0.45rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--fg, #F4F4F3)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
  } satisfies React.CSSProperties,
  btn: {
    padding: '0.45rem 1rem',
    borderRadius: 8,
    border: 'none',
    background: '#1CABB0',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  } satisfies React.CSSProperties,
  dangerBtn: {
    padding: '0.35rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(239,68,68,0.4)',
    background: 'transparent',
    color: '#ef4444',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  ghostBtn: {
    padding: '0.35rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(244,244,243,0.7)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  orgCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.15)',
    marginBottom: '0.5rem',
    cursor: 'pointer',
  } satisfies React.CSSProperties,
  orgCardActive: {
    border: '1px solid #1CABB0',
    background: 'rgba(28,171,176,0.08)',
  } satisfies React.CSSProperties,
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  } satisfies React.CSSProperties,
  roleBadge: (role: OrgRole): React.CSSProperties => ({
    padding: '0.15rem 0.5rem',
    borderRadius: 4,
    fontSize: '0.72rem',
    fontWeight: 600,
    background:
      role === 'owner'
        ? 'rgba(251,191,36,0.15)'
        : role === 'admin'
          ? 'rgba(99,102,241,0.15)'
          : 'rgba(255,255,255,0.08)',
    color: role === 'owner' ? '#fbbf24' : role === 'admin' ? '#818cf8' : 'rgba(244,244,243,0.6)',
  }),
  error: {
    color: '#ef4444',
    fontSize: '0.82rem',
    marginTop: '0.5rem',
  } satisfies React.CSSProperties,
  muted: {
    opacity: 0.5,
    fontSize: '0.88rem',
  } satisfies React.CSSProperties,
  select: {
    padding: '0.35rem 0.5rem',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--fg, #F4F4F3)',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
  } satisfies React.CSSProperties,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrgsPage() {
  const { t } = useTranslation()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [orgs, setOrgs] = useState<Org[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [orgsError, setOrgsError] = useState<string | null>(null)

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [inviteUserId, setInviteUserId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // E10-3: org policy state
  const [orgPolicy, setOrgPolicy] = useState<OrgPolicy | null>(null)
  const [policyLoading, setPolicyLoading] = useState(false)

  // ── Load current user ──────────────────────────────────────────────────────

  useEffect(() => {
    getCurrentUser()
      .then((user) => setCurrentUserId(user?.id ?? null))
      .catch(() => setCurrentUserId(null))
  }, [])

  // ── Load orgs ──────────────────────────────────────────────────────────────

  const loadOrgs = useCallback(async () => {
    setLoadingOrgs(true)
    setOrgsError(null)
    try {
      const list = await listMyOrgs()
      setOrgs(list)
    } catch {
      setOrgsError(t('orgs.errorLoad'))
    } finally {
      setLoadingOrgs(false)
    }
  }, [t])

  useEffect(() => {
    void loadOrgs()
  }, [loadOrgs])

  // ── Load members when org selected ────────────────────────────────────────

  const loadMembers = useCallback(async (orgId: string) => {
    setLoadingMembers(true)
    try {
      const list = await listOrgMembers(orgId)
      setMembers(list)
    } catch {
      setMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }, [])

  const loadPolicy = useCallback(async (orgId: string) => {
    setPolicyLoading(true)
    try {
      const p = await getOrgPolicy(orgId)
      setOrgPolicy(p)
    } catch {
      setOrgPolicy(null)
    } finally {
      setPolicyLoading(false)
    }
  }, [])

  const handleSelectOrg = useCallback(
    (orgId: string) => {
      setSelectedOrgId(orgId)
      setInviteError(null)
      setInviteUserId('')
      setOrgPolicy(null)
      void loadMembers(orgId)
      void loadPolicy(orgId)
    },
    [loadMembers, loadPolicy],
  )

  const handleTogglePolicy = useCallback(
    async (key: keyof OrgPolicy) => {
      if (!selectedOrgId || !orgPolicy) return
      const newVal = !orgPolicy[key]
      setOrgPolicy((prev) => (prev ? { ...prev, [key]: newVal } : prev))
      try {
        await updateOrgPolicy(selectedOrgId, { [key]: newVal })
      } catch {
        // Revert on failure
        setOrgPolicy((prev) => (prev ? { ...prev, [key]: !newVal } : prev))
      }
    },
    [selectedOrgId, orgPolicy],
  )

  // ── Create org ────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    setCreateError(null)
    if (!newOrgName.trim()) {
      setCreateError(t('orgs.nameRequired'))
      return
    }
    setCreating(true)
    try {
      await createOrg(newOrgName)
      setNewOrgName('')
      await loadOrgs()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('orgs.errorCreate'))
    } finally {
      setCreating(false)
    }
  }, [newOrgName, t, loadOrgs])

  // ── Invite member ─────────────────────────────────────────────────────────

  const handleInvite = useCallback(async () => {
    if (!selectedOrgId || !inviteUserId.trim()) return
    setInviteError(null)
    setInviting(true)
    try {
      await inviteOrgMember(selectedOrgId, inviteUserId.trim())
      setInviteUserId('')
      await loadMembers(selectedOrgId)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : t('orgs.errorInvite'))
    } finally {
      setInviting(false)
    }
  }, [selectedOrgId, inviteUserId, t, loadMembers])

  // ── Role change ───────────────────────────────────────────────────────────

  const handleRoleChange = useCallback(
    async (memberId: string, role: OrgRole) => {
      try {
        await updateMemberRole(memberId, role)
        if (selectedOrgId) await loadMembers(selectedOrgId)
      } catch {
        // Silently ignore — RLS will reject unauthorised role changes
      }
    },
    [selectedOrgId, loadMembers],
  )

  // ── Remove / leave ────────────────────────────────────────────────────────

  const handleRemoveMember = useCallback(
    async (member: OrgMember) => {
      const isSelf = member.user_id === currentUserId
      const msg = isSelf ? t('orgs.leaveConfirm') : t('orgs.removeConfirm')
      if (!window.confirm(msg)) return
      try {
        await removeOrgMember(member.id)
        if (isSelf) {
          setSelectedOrgId(null)
          setMembers([])
          await loadOrgs()
        } else if (selectedOrgId) {
          await loadMembers(selectedOrgId)
        }
      } catch {
        // Silently ignore — RLS will reject unauthorised removals
      }
    },
    [currentUserId, t, loadOrgs, loadMembers, selectedOrgId],
  )

  // ── Rename / dissolve ─────────────────────────────────────────────────────

  const handleRename = useCallback(
    async (org: Org) => {
      const newName = window.prompt(t('orgs.rename'), org.name)
      if (!newName) return
      try {
        await renameOrg(org.id, newName)
        await loadOrgs()
      } catch {
        // Silently ignore for v0
      }
    },
    [t, loadOrgs],
  )

  const handleDissolve = useCallback(
    async (org: Org) => {
      if (!window.confirm(t('orgs.dissolveConfirm'))) return
      try {
        await deleteOrg(org.id)
        setSelectedOrgId(null)
        setMembers([])
        await loadOrgs()
      } catch {
        // Silently ignore for v0
      }
    },
    [t, loadOrgs],
  )

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null
  const isOwner = selectedOrg?.owner_id === currentUserId

  const roleLabel = (role: OrgRole) =>
    role === 'owner'
      ? t('orgs.roleOwner')
      : role === 'admin'
        ? t('orgs.roleAdmin')
        : t('orgs.roleMember')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Nav */}
      <div style={s.nav}>
        <a
          href="/app"
          style={{ color: 'rgba(244,244,243,0.6)', textDecoration: 'none', fontSize: '0.85rem' }}
        >
          ← {t('orgs.backToOrgs')}
        </a>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{t('orgs.title')}</span>
      </div>

      <div style={s.body}>
        {/* Create org */}
        <section style={s.section}>
          <h2 style={s.h2}>{t('orgs.createOrg')}</h2>
          <div style={s.row}>
            <input
              style={s.input}
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
              placeholder={t('orgs.createOrgPlaceholder')}
              maxLength={80}
              data-testid="create-org-input"
            />
            <button
              style={s.btn}
              onClick={() => void handleCreate()}
              disabled={creating}
              data-testid="create-org-btn"
            >
              {creating ? t('orgs.creating') : t('orgs.createOrg')}
            </button>
          </div>
          {createError && <p style={s.error}>{createError}</p>}
        </section>

        {/* Org list */}
        <section style={s.section}>
          <h2 style={s.h2}>{t('orgs.title')}</h2>
          {loadingOrgs && <p style={s.muted}>…</p>}
          {orgsError && <p style={s.error}>{orgsError}</p>}
          {!loadingOrgs && orgs.length === 0 && <p style={s.muted}>{t('orgs.noOrgs')}</p>}
          {orgs.map((org) => (
            <div
              key={org.id}
              style={{ ...s.orgCard, ...(selectedOrgId === org.id ? s.orgCardActive : {}) }}
              onClick={() => handleSelectOrg(org.id)}
              data-testid={`org-card-${org.id}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSelectOrg(org.id)
              }}
            >
              <span style={{ fontWeight: 600 }}>{org.name}</span>
              {org.owner_id === currentUserId && (
                <span style={{ ...s.roleBadge('owner') }}>{t('orgs.roleOwner')}</span>
              )}
            </div>
          ))}
        </section>

        {/* Org detail */}
        {selectedOrg && (
          <section style={s.section}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <h2 style={{ ...s.h2, margin: 0 }}>
                {selectedOrg.name} — {t('orgs.members')}
              </h2>
              {isOwner && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={s.ghostBtn} onClick={() => void handleRename(selectedOrg)}>
                    {t('orgs.rename')}
                  </button>
                  <button style={s.dangerBtn} onClick={() => void handleDissolve(selectedOrg)}>
                    {t('orgs.dissolve')}
                  </button>
                </div>
              )}
            </div>

            {/* Invite */}
            <div style={s.row}>
              <input
                style={s.input}
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleInvite()
                }}
                placeholder={t('orgs.invitePlaceholder')}
                data-testid="invite-user-input"
              />
              <button
                style={s.btn}
                onClick={() => void handleInvite()}
                disabled={inviting}
                data-testid="invite-btn"
              >
                {inviting ? t('orgs.inviting') : t('orgs.invite')}
              </button>
            </div>
            {inviteError && <p style={s.error}>{inviteError}</p>}

            {/* Members list */}
            {loadingMembers ? (
              <p style={s.muted}>…</p>
            ) : (
              members.map((member) => {
                const isSelf = member.user_id === currentUserId
                return (
                  <div key={member.id} style={s.memberRow} data-testid={`member-row-${member.id}`}>
                    <span style={{ flex: 1, fontSize: '0.85rem', opacity: 0.7 }}>
                      {member.user_id}
                      {isSelf && ' (you)'}
                    </span>
                    <span style={s.roleBadge(member.role as OrgRole)}>
                      {roleLabel(member.role as OrgRole)}
                    </span>
                    {isOwner && member.role !== 'owner' && (
                      <select
                        style={s.select}
                        value={member.role}
                        onChange={(e) =>
                          void handleRoleChange(member.id, e.target.value as OrgRole)
                        }
                        aria-label={t('orgs.roleMember')}
                      >
                        <option value="admin">{t('orgs.roleAdmin')}</option>
                        <option value="member">{t('orgs.roleMember')}</option>
                      </select>
                    )}
                    <button
                      style={s.dangerBtn}
                      onClick={() => void handleRemoveMember(member)}
                      data-testid={`remove-member-${member.id}`}
                    >
                      {isSelf ? t('orgs.leave') : t('orgs.remove')}
                    </button>
                  </div>
                )
              })
            )}
          </section>
        )}

        {/* E10-3: Org policies (owner only) */}
        {selectedOrg && isOwner && (
          <section style={s.section} data-testid="org-policy-section">
            <h2 style={s.h2}>{t('orgs.policyTitle')}</h2>
            {policyLoading || !orgPolicy ? (
              <p style={s.muted}>…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {(
                  [
                    ['policy_explore_enabled', t('orgs.policyExplore')],
                    ['policy_installs_allowed', t('orgs.policyInstalls')],
                    ['policy_comments_allowed', t('orgs.policyComments')],
                  ] as [keyof OrgPolicy, string][]
                ).map(([key, label]) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={orgPolicy[key]}
                      onChange={() => void handleTogglePolicy(key)}
                      data-testid={`policy-${key}`}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
