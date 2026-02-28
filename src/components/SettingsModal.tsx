import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { getSession } from '../lib/auth'
import { getProfile } from '../lib/profilesService'
import { useSettingsModal } from '../contexts/SettingsModalContext'
import type { SettingsTab } from '../contexts/SettingsModalContext'
import { ProfileSettings } from '../pages/settings/ProfileSettings'
import { PreferencesSettings } from '../pages/settings/PreferencesSettings'
import { BillingAuthGate } from './BillingAuthGate'
import { AppWindow } from './ui/AppWindow'
import { SETTINGS_WINDOW_ID } from './SettingsModalProvider'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../lib/profilesService'

// ── Mobile breakpoint ──────────────────────────────────────────────────────
const mql = typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)') : null

function subscribeNarrow(cb: () => void) {
  mql?.addEventListener('change', cb)
  return () => mql?.removeEventListener('change', cb)
}

function getNarrow() {
  return mql?.matches ?? false
}

// ── Tab config ─────────────────────────────────────────────────────────────
const TABS: { key: SettingsTab; icon: string }[] = [
  { key: 'profile', icon: '\u{1F464}' },
  { key: 'billing', icon: '\u{1F4B3}' },
  { key: 'preferences', icon: '\u{2699}\uFE0F' },
]

export function SettingsModal() {
  const { open, tab, closeSettings, setTab } = useSettingsModal()
  const { t } = useTranslation()
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow)

  // ── Data loading ───────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!open) return
    getSession().then((session) => {
      if (!session) return
      setUser(session.user)
      getProfile(session.user.id).then((data) => {
        if (data) setProfile(data)
      })
    })
  }, [open])

  return (
    <AppWindow windowId={SETTINGS_WINDOW_ID} title={t('settings.title')} minWidth={400}>
      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          height: '100%',
        }}
      >
        {/* ── Sidebar / tab bar ────────────────────────────────────────── */}
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
              <h2 style={sidebarTitle}>{t('settings.title')}</h2>
              <button onClick={closeSettings} style={closeBtnStyle} aria-label="Close">
                ✕
              </button>
            </div>
          )}
          {TABS.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={narrow ? narrowTabStyle(tab === key) : tabBtnStyle(tab === key)}
            >
              <span style={{ fontSize: narrow ? '1rem' : '0.95rem' }}>{icon}</span>
              {!narrow && (
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: tab === key ? 600 : 400 }}>{t(`settings.${key}`)}</div>
                  <div style={tabDescStyle}>{t(`settings.${key}Desc`)}</div>
                </div>
              )}
            </button>
          ))}
          {narrow && (
            <button
              onClick={closeSettings}
              style={{ ...narrowTabStyle(false), marginLeft: 'auto' }}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </nav>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <main style={contentStyle}>
          {tab === 'profile' && <ProfileSettings user={user} profile={profile} />}
          {tab === 'billing' && <BillingAuthGate profile={profile} />}
          {tab === 'preferences' && (
            <PreferencesSettings
              plan={
                (profile?.plan as
                  | 'free'
                  | 'trialing'
                  | 'pro'
                  | 'enterprise'
                  | 'past_due'
                  | 'canceled') ?? 'free'
              }
            />
          )}
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
