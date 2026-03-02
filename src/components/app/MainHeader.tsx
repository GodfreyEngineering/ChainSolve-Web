/**
 * MainHeader — shared top-level navigation header (G7-1).
 *
 * Always present on authenticated pages. Contains:
 *   Left:   Logo (link to /app)
 *   Middle: Explore, Projects, Documentation links
 *   Right:  Plan badge, Settings gear, User avatar/dropdown
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'
import { useSettingsModal } from '../../contexts/SettingsModalContext'
import { getCurrentUser, signOut } from '../../lib/auth'
import { removeCurrentSession } from '../../lib/sessionService'
import { clearReauth } from '../../lib/reauth'
import type { Plan } from '../../lib/entitlements'

export const MAIN_HEADER_HEIGHT = 40

const PLAN_COLORS: Record<string, string> = {
  free: '#6b7280',
  trialing: '#3b82f6',
  pro: '#22c55e',
  past_due: '#f59e0b',
  canceled: '#ef4444',
}

interface MainHeaderProps {
  plan: Plan
}

export function MainHeader({ plan }: MainHeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { openSettings } = useSettingsModal()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCurrentUser().then((u) => setUserEmail(u?.email ?? null))
  }, [])

  // Close account dropdown on outside click
  useEffect(() => {
    if (!accountOpen) return
    const handler = (e: globalThis.MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [accountOpen])

  const handleSignOut = useCallback(async () => {
    setAccountOpen(false)
    clearReauth()
    removeCurrentSession()
    await signOut()
    navigate('/login')
  }, [navigate])

  const initials = userEmail ? userEmail.split('@')[0].slice(0, 2).toUpperCase() : '?'

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <header style={headerStyle}>
      {/* ── Left: Logo ── */}
      <div style={leftStyle}>
        <a
          href="/app"
          onClick={(e) => {
            e.preventDefault()
            navigate('/app')
          }}
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 22 }} />
        </a>
      </div>

      {/* ── Middle: Navigation links ── */}
      <nav style={navStyle}>
        <a
          href="/explore"
          onClick={(e) => {
            e.preventDefault()
            navigate('/explore')
          }}
          style={navLinkStyle(isActive('/explore'))}
        >
          {t('home.explore')}
        </a>
        <a
          href="/app"
          onClick={(e) => {
            e.preventDefault()
            navigate('/app')
          }}
          style={navLinkStyle(isActive('/app'))}
        >
          {t('nav.projects', 'Projects')}
        </a>
        <a
          href="/docs"
          onClick={(e) => {
            e.preventDefault()
            // Documentation opens in the current page's docs window or navigates
            navigate('/app')
            // TODO: open docs modal when available globally
          }}
          style={navLinkStyle(false)}
        >
          {t('nav.documentation', 'Documentation')}
        </a>
      </nav>

      {/* ── Right: Plan badge, Settings, Avatar ── */}
      <div style={rightStyle}>
        {/* Plan badge */}
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: PLAN_COLORS[plan] ?? PLAN_COLORS.free,
            padding: '0.1rem 0.35rem',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`,
            opacity: 0.8,
          }}
        >
          {t(`plans.${plan}`)}
        </span>

        {/* Settings gear */}
        <button
          onClick={() => openSettings('preferences')}
          title={t('nav.settings')}
          aria-label={t('nav.settings')}
          style={iconBtnStyle}
        >
          &#x2699;
        </button>

        {/* User avatar + dropdown */}
        <div ref={accountRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAccountOpen((v) => !v)}
            title={userEmail ?? t('settings.account', 'Account')}
            aria-label={t('settings.account', 'Account')}
            aria-haspopup="true"
            aria-expanded={accountOpen}
            style={avatarStyle}
          >
            {initials}
          </button>

          {accountOpen && (
            <div style={dropdownStyle}>
              <div style={dropdownHeaderStyle}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{userEmail ?? ''}</span>
                <span
                  style={{
                    fontSize: '0.58rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: PLAN_COLORS[plan] ?? PLAN_COLORS.free,
                  }}
                >
                  {t(`plans.${plan}`)}
                </span>
              </div>
              <div style={dropdownSepStyle} />
              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setAccountOpen(false)
                  openSettings('profile')
                }}
              >
                {t('settings.profile', 'Profile')}
              </button>
              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setAccountOpen(false)
                  openSettings('billing')
                }}
              >
                {t('settings.billing', 'Billing')}
              </button>
              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setAccountOpen(false)
                  openSettings('preferences')
                }}
              >
                {t('settings.preferences', 'Preferences')}
              </button>
              <div style={dropdownSepStyle} />
              <button style={dropdownItemStyle} onClick={handleSignOut}>
                {t('nav.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: MAIN_HEADER_HEIGHT,
  padding: '0 1rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--card-bg)',
  flexShrink: 0,
  gap: '0.75rem',
}

const leftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  flex: 1,
  justifyContent: 'center',
}

function navLinkStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: active ? 'var(--primary)' : 'rgba(244,244,243,0.55)',
    textDecoration: 'none',
    padding: '0.25rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    background: active ? 'var(--primary-dim)' : 'transparent',
    transition: 'color 0.15s, background 0.15s',
  }
}

const rightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexShrink: 0,
}

const iconBtnStyle: React.CSSProperties = {
  padding: '0.2rem 0.4rem',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '1rem',
  lineHeight: 1,
  opacity: 0.65,
}

const avatarStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  border: '1px solid var(--border)',
  background: 'var(--primary-dim)',
  color: 'var(--primary)',
  fontSize: '0.6rem',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  letterSpacing: '0.02em',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 32,
  zIndex: 100,
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.3rem',
  minWidth: 180,
  boxShadow: 'var(--shadow-lg)',
}

const dropdownHeaderStyle: React.CSSProperties = {
  padding: '0.5rem 0.7rem 0.3rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
}

const dropdownSepStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '0.2rem 0',
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.4rem 0.7rem',
  fontSize: '0.8rem',
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
