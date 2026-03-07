import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import {
  listMyOrgs,
  listOrgMembers,
  getOrgPolicy,
  updateOrgPolicy,
  getOrgSeatUsage,
  type Org,
  type OrgMember,
  type OrgRole,
  type OrgPolicy,
  type OrgSeatUsage,
} from '../../lib/orgsService'
import { getCurrentUser } from '../../lib/auth'

interface Props {
  cardStyle: React.CSSProperties
  subheadingStyle: React.CSSProperties
  checkRowStyle: React.CSSProperties
  checkboxStyle: React.CSSProperties
  checkLabelStyle: React.CSSProperties
  checkHintStyle: React.CSSProperties
}

export function OrgSettings({
  cardStyle,
  subheadingStyle,
  checkRowStyle,
  checkboxStyle,
  checkLabelStyle,
  checkHintStyle,
}: Props) {
  const { t } = useTranslation()
  const [userId, setUserId] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [policy, setPolicy] = useState<OrgPolicy | null>(null)
  const [seatUsage, setSeatUsage] = useState<OrgSeatUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getCurrentUser().then((u) => {
        setUserId(u?.id ?? null)
        return u
      }),
      listMyOrgs(),
    ])
      .then(([, orgList]) => {
        setOrgs(orgList)
        if (orgList.length > 0) {
          setSelectedOrg(orgList[0])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Load members + policy when org is selected
  useEffect(() => {
    if (!selectedOrg) return
    Promise.all([
      listOrgMembers(selectedOrg.id),
      getOrgPolicy(selectedOrg.id),
      getOrgSeatUsage(selectedOrg.id),
    ])
      .then(([m, p, s]) => {
        setMembers(m)
        setPolicy(p)
        setSeatUsage(s)
      })
      .catch(() => {})
  }, [selectedOrg])

  const handleTogglePolicy = useCallback(
    async (key: keyof OrgPolicy) => {
      if (!selectedOrg || !policy) return
      const cur = policy[key]
      if (typeof cur !== 'boolean') return
      const newVal = !cur
      setPolicy((prev) => (prev ? { ...prev, [key]: newVal } : prev))
      try {
        await updateOrgPolicy(selectedOrg.id, { [key]: newVal } as Partial<OrgPolicy>)
      } catch {
        setPolicy((prev) => (prev ? { ...prev, [key]: !newVal } : prev))
      }
    },
    [selectedOrg, policy],
  )

  const isOwnerOrAdmin =
    selectedOrg &&
    members.some((m) => m.user_id === userId && (m.role === 'owner' || m.role === 'admin'))

  const userRole = members.find((m) => m.user_id === userId)?.role ?? 'member'

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>...</p>
      </div>
    )
  }

  if (orgs.length === 0) {
    return (
      <div style={cardStyle}>
        <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>{t('orgs.noOrgs')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Org overview */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <InfoRow label={t('settings.orgName')} value={selectedOrg?.name ?? ''} />
          <InfoRow label={t('settings.orgRole')} value={roleLabel(userRole, t)} />
          <InfoRow
            label={t('settings.orgMembers')}
            value={
              seatUsage
                ? seatUsage.max
                  ? `${seatUsage.used} / ${seatUsage.max}`
                  : `${seatUsage.used}`
                : String(members.length)
            }
          />
        </div>
        {orgs.length > 1 && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {orgs.map((org) => (
              <Button
                key={org.id}
                variant={org.id === selectedOrg?.id ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedOrg(org)}
              >
                {org.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Members */}
      <h3 style={subheadingStyle}>{t('orgs.members')}</h3>
      <div style={cardStyle}>
        {members.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {members.map((member) => (
              <div key={member.id} style={memberRowStyle}>
                <span style={memberIdStyle}>
                  {member.user_id.slice(0, 8)}...
                  {member.user_id === userId && (
                    <span style={{ opacity: 0.5 }}> ({t('settings.orgYou')})</span>
                  )}
                </span>
                <span style={roleBadgeStyle(member.role as OrgRole)}>
                  {roleLabel(member.role as OrgRole, t)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Policies (owner/admin only) */}
      {isOwnerOrAdmin && policy && (
        <>
          <h3 style={subheadingStyle}>{t('orgs.policyTitle')}</h3>
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {POLICY_KEYS.map(([key, labelKey]) => (
                <label key={key} style={checkRowStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(policy[key])}
                    onChange={() => void handleTogglePolicy(key)}
                    style={checkboxStyle}
                  />
                  <div>
                    <span style={checkLabelStyle}>{t(labelKey)}</span>
                    <span style={checkHintStyle}>{t(`${labelKey}Hint`)}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const POLICY_KEYS: [keyof OrgPolicy, string][] = [
  ['policy_explore_enabled', 'orgs.policyExplore'],
  ['policy_installs_allowed', 'orgs.policyInstalls'],
  ['policy_comments_allowed', 'orgs.policyComments'],
  ['policy_ai_enabled', 'orgs.policyAi'],
  ['policy_export_enabled', 'orgs.policyExport'],
  ['policy_custom_fns_enabled', 'orgs.policyCustomFns'],
]

function roleLabel(role: OrgRole | string, t: (key: string) => string): string {
  if (role === 'owner') return t('orgs.roleOwner')
  if (role === 'admin') return t('orgs.roleAdmin')
  return t('orgs.roleMember')
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

const memberRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.35rem 0',
  borderBottom: '1px solid var(--border)',
}

const memberIdStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontFamily: "'JetBrains Mono', monospace",
  opacity: 0.7,
}

function roleBadgeStyle(role: OrgRole): React.CSSProperties {
  const colors: Record<OrgRole, { bg: string; fg: string }> = {
    owner: { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24' },
    admin: { bg: 'rgba(99,102,241,0.15)', fg: '#818cf8' },
    member: { bg: 'rgba(255,255,255,0.08)', fg: 'var(--text-muted)' },
  }
  const c = colors[role] ?? colors.member
  return {
    padding: '0.1rem 0.4rem',
    borderRadius: 4,
    fontSize: '0.68rem',
    fontWeight: 600,
    background: c.bg,
    color: c.fg,
  }
}
