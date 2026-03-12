import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { getSession } from '../lib/auth'
import { getProfile } from '../lib/profilesService'
import { listMyOrgs } from '../lib/orgsService'
import { resolveEffectivePlan, isDeveloper } from '../lib/entitlements'
import { useSettingsModal } from '../contexts/SettingsModalContext'
import type { AccountTab, AppTab } from '../contexts/SettingsModalContext'
import { ProfileSettings } from '../pages/settings/ProfileSettings'
import { PreferencesSettings } from '../pages/settings/PreferencesSettings'
import { SecuritySettings } from '../pages/settings/SecuritySettings'
import { NotificationSettings } from '../pages/settings/NotificationSettings'
import { BillingAuthGate } from './BillingAuthGate'
import { AppWindow } from './ui/AppWindow'
import { ACCOUNT_SETTINGS_WINDOW_ID, APP_SETTINGS_WINDOW_ID } from './SettingsModalProvider'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../lib/profilesService'

/** J2-1: Which settings window to render. */
export type SettingsKind = 'account' | 'app'

// ── Mobile breakpoint ──────────────────────────────────────────────────────
const mql = typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)') : null

function subscribeNarrow(cb: () => void) {
  mql?.addEventListener('change', cb)
  return () => mql?.removeEventListener('change', cb)
}

function getNarrow() {
  return mql?.matches ?? false
}

// ── Tab configs per kind ────────────────────────────────────────────────────
const ACCOUNT_TABS: { key: AccountTab; icon: string }[] = [
  { key: 'profile', icon: '\u2302' },
  { key: 'billing', icon: '\u00A4' },
  { key: 'security', icon: '\u2616' },
  { key: 'notifications', icon: '\u{1F514}' },
]

const APP_TABS_BASE: { key: AppTab; icon: string; devOnly?: boolean; orgOnly?: boolean }[] = [
  { key: 'general', icon: '\u2699' },
  { key: 'appearance', icon: '\u25D1' },
  { key: 'editor', icon: '\u25A6' },
  { key: 'formatting', icon: '#' },
  { key: 'export', icon: '\u21E9' },
  { key: 'shortcuts', icon: '\u2328' },
  { key: 'organization', icon: '\u{1F3E2}', orgOnly: true },
  { key: 'developer', icon: '\u{1F6E0}', devOnly: true },
]

interface Props {
  kind: SettingsKind
}

export function SettingsModal({ kind }: Props) {
  const {
    accountOpen,
    appOpen,
    accountTab,
    setAccountTab,
    closeAccountSettings,
    appTab,
    setAppTab,
    closeAppSettings,
  } = useSettingsModal()
  const { t } = useTranslation()
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow)

  const isOpen = kind === 'account' ? accountOpen : appOpen
  const windowId = kind === 'account' ? ACCOUNT_SETTINGS_WINDOW_ID : APP_SETTINGS_WINDOW_ID
  const title = kind === 'account' ? t('settings.accountTitle') : t('settings.appTitle')
  const closeHandler = kind === 'account' ? closeAccountSettings : closeAppSettings

  // ── Data loading ───────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [hasOrg, setHasOrg] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    getSession().then((session) => {
      if (!session) return
      setUser(session.user)
      getProfile(session.user.id).then((data) => {
        if (data) setProfile(data)
      })
      listMyOrgs()
        .then((orgs) => setHasOrg(orgs.length > 0))
        .catch(() => setHasOrg(false))
    })
  }, [isOpen])

  // V3-3.2/3.3: Filter app tabs — conditionally show developer + organization
  const appTabs = useMemo(() => {
    const showDev = isDeveloper(profile)
    return APP_TABS_BASE.filter((tab) => {
      if (tab.devOnly && !showDev) return false
      if (tab.orgOnly && !hasOrg) return false
      return true
    })
  }, [profile, hasOrg])

  // ── Account Settings window ─────────────────────────────────────────────
  if (kind === 'account') {
    return (
      <AppWindow windowId={windowId} title={title} minWidth={400}>
        <div
          style={{
            display: 'flex',
            flexDirection: narrow ? 'column' : 'row',
            height: '100%',
          }}
        >
          {/* Sidebar / tab bar */}
          <nav
            style={
              narrow
                ? {
                    display: 'flex',
                    gap: '0.25rem',
                    borderBottom: '1px solid var(--border)',
                    padding: '0.5rem 0.75rem',
                    flexShrink: 0,
                  }
                : sidebarStyle
            }
          >
            {!narrow && (
              <div style={sidebarHeader}>
                <h2 style={sidebarTitle}>{title}</h2>
                <button onClick={closeHandler} style={closeBtnStyle} aria-label={t('ui.close')}>
                  ✕
                </button>
              </div>
            )}
            {ACCOUNT_TABS.map(({ key, icon }) => (
              <button
                key={key}
                onClick={() => setAccountTab(key)}
                style={
                  narrow ? narrowTabStyle(accountTab === key) : tabBtnStyle(accountTab === key)
                }
              >
                <span style={{ fontSize: narrow ? '1rem' : '0.95rem' }}>{icon}</span>
                {!narrow && (
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: accountTab === key ? 600 : 400 }}>
                      {t(`settings.${key}`)}
                    </div>
                    <div style={tabDescStyle}>{t(`settings.${key}Desc`)}</div>
                  </div>
                )}
              </button>
            ))}
            {narrow && (
              <button
                onClick={closeHandler}
                style={{ ...narrowTabStyle(false), marginLeft: 'auto' }}
                aria-label={t('ui.close')}
              >
                ✕
              </button>
            )}
          </nav>

          {/* Content */}
          <main style={contentStyle}>
            {accountTab === 'profile' && <ProfileSettings user={user} profile={profile} />}
            {accountTab === 'billing' && <BillingAuthGate profile={profile} />}
            {accountTab === 'security' && <SecuritySettings />}
            {accountTab === 'notifications' && <NotificationSettings />}
          </main>
        </div>
      </AppWindow>
    )
  }

  // ── App Settings window ─────────────────────────────────────────────────
  return (
    <AppWindow windowId={windowId} title={title} minWidth={400}>
      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          height: '100%',
        }}
      >
        {/* Sidebar */}
        <nav
          style={
            narrow
              ? {
                  display: 'flex',
                  gap: '0.25rem',
                  borderBottom: '1px solid var(--border)',
                  padding: '0.5rem 0.75rem',
                  flexShrink: 0,
                }
              : sidebarStyle
          }
        >
          {!narrow && (
            <div style={sidebarHeader}>
              <h2 style={sidebarTitle}>{title}</h2>
              <button onClick={closeHandler} style={closeBtnStyle} aria-label={t('ui.close')}>
                ✕
              </button>
            </div>
          )}
          {appTabs.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setAppTab(key)}
              style={narrow ? narrowTabStyle(appTab === key) : tabBtnStyle(appTab === key)}
            >
              <span style={{ fontSize: narrow ? '1rem' : '0.95rem' }}>{icon}</span>
              {!narrow && (
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: appTab === key ? 600 : 400 }}>
                    {t(`settings.tab_${key}`)}
                  </div>
                  <div style={tabDescStyle}>{t(`settings.tab_${key}Desc`)}</div>
                </div>
              )}
            </button>
          ))}
          {narrow && (
            <button
              onClick={closeHandler}
              style={{ ...narrowTabStyle(false), marginLeft: 'auto' }}
              aria-label={t('ui.close')}
            >
              ✕
            </button>
          )}
        </nav>

        {/* Content */}
        <main style={contentStyle}>
          <PreferencesSettings
            plan={resolveEffectivePlan(profile)}
            tab={appTab}
            profile={profile}
          />
        </main>
      </div>
    </AppWindow>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sidebarStyle: React.CSSProperties = {
  width: 200,
  flexShrink: 0,
  padding: '1.25rem 0.75rem',
  borderRight: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
}

const sidebarHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.75rem',
}

const sidebarTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '1rem',
  padding: '0.15rem 0.4rem',
  borderRadius: 6,
  lineHeight: 1,
  fontFamily: 'inherit',
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    width: '100%',
    padding: '0.55rem 0.65rem',
    border: 'none',
    borderRadius: 8,
    background: active ? 'var(--primary-dim)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
    textAlign: 'left',
  }
}

function narrowTabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.4rem 0.65rem',
    border: 'none',
    borderRadius: 6,
    background: active ? 'var(--primary-dim)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    lineHeight: 1,
  }
}

const tabDescStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  opacity: 0.5,
  marginTop: '0.1rem',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '1.5rem',
  overflowY: 'auto',
}
