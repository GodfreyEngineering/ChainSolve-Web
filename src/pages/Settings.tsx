import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { BRAND } from '../lib/brand'
import type { User } from '@supabase/supabase-js'
import { ProfileSettings } from './settings/ProfileSettings'
import { BillingSettings } from './settings/BillingSettings'
import { PreferencesSettings } from './settings/PreferencesSettings'
import type { Profile } from '../lib/profilesService'

export type { Profile }

const TABS = ['profile', 'billing', 'preferences'] as const
type SettingsTab = (typeof TABS)[number]

const TAB_ICONS: Record<SettingsTab, string> = {
  profile: '\u{1F464}',
  billing: '\u{1F4B3}',
  preferences: '\u{2699}\uFE0F',
}

export default function Settings() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()

  const tab = (searchParams.get('tab') as SettingsTab) || 'profile'

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login')
        return
      }
      setUser(session.user)
      supabase
        .from('profiles')
        .select('id,email,plan,stripe_customer_id,current_period_end,is_developer,is_admin')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) setProfile(data as Profile)
          setLoading(false)
        })
    })
  }, [navigate])

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
        {t('ui.loading')}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={navStyle}>
        <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={BRAND.logoWideText} alt={t('app.name')} style={{ height: 28 }} />
        </a>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button style={backBtnStyle} onClick={() => navigate('/app')}>
            ← {t('nav.backToApp')}
          </button>
        </div>
      </nav>

      <div style={layoutStyle}>
        {/* Sidebar */}
        <aside style={sidebarStyle}>
          <h2 style={sidebarTitle}>{t('settings.title')}</h2>
          {TABS.map((key) => (
            <button
              key={key}
              onClick={() => setSearchParams({ tab: key })}
              style={tabBtnStyle(tab === key)}
            >
              <span style={{ fontSize: '1rem' }}>{TAB_ICONS[key]}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: tab === key ? 600 : 400 }}>{t(`settings.${key}`)}</div>
                <div style={tabDescStyle}>{t(`settings.${key}Desc`)}</div>
              </div>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main style={contentStyle}>
          {tab === 'profile' && <ProfileSettings user={user} profile={profile} />}
          {tab === 'billing' && <BillingSettings profile={profile} />}
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
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 1.5rem',
  height: 56,
  borderBottom: '1px solid var(--border)',
  background: 'var(--card-bg)',
}

const backBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: '0.4rem 0.85rem',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  borderRadius: 8,
  fontWeight: 500,
}

const layoutStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  maxWidth: 960,
  width: '100%',
  margin: '0 auto',
  padding: '2rem 1.5rem',
  gap: '2rem',
}

const sidebarStyle: React.CSSProperties = {
  width: 240,
  flexShrink: 0,
}

const sidebarTitle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    width: '100%',
    padding: '0.65rem 0.75rem',
    border: 'none',
    borderRadius: 8,
    background: active ? 'var(--primary-dim)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    marginBottom: '0.25rem',
    transition: 'background 0.15s',
    textAlign: 'left',
  }
}

const tabDescStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  opacity: 0.5,
  marginTop: '0.1rem',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
}
