/**
 * MainHeader — shared top-level navigation header (G7-1, V2-013).
 *
 * Always present on authenticated pages. Contains:
 *   Left:   Logo (link to /app)
 *   Middle: Home (/app), Explore (/explore), Documentation (/docs)
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
import { PlanBadge } from '../ui/PlanBadge'
import { displayNameStyle } from '../../lib/planStyles'

export const MAIN_HEADER_HEIGHT = 40

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

  const navClick = (e: React.MouseEvent, to: string) => {
    e.preventDefault()
    navigate(to)
  }

  return (
    <header style={headerStyle}>
      {/* ── Left: Logo ── */}
      <div style={leftStyle}>
        <a
          href="/app"
          onClick={(e) => navClick(e, '/app')}
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 22 }} />
        </a>
      </div>

      {/* ── Middle: Navigation links ── */}
      <nav style={navStyle}>
        <a
          href="/app"
          onClick={(e) => navClick(e, '/app')}
          className="cs-nav-link"
          data-active={isActive('/app')}
        >
          {t('nav.home', 'Home')}
        </a>
        <a
          href="/explore"
          onClick={(e) => navClick(e, '/explore')}
          className="cs-nav-link"
          data-active={isActive('/explore')}
        >
          {t('home.explore')}
        </a>
        <a
          href="/docs"
          onClick={(e) => navClick(e, '/docs')}
          className="cs-nav-link"
          data-active={isActive('/docs')}
        >
          {t('nav.documentation', 'Documentation')}
        </a>
      </nav>

      {/* ── Right: Plan badge, Settings, Avatar ── */}
      <div style={rightStyle}>
        <PlanBadge plan={plan} variant="compact" />

        <button
          className="cs-header-icon-btn"
          onClick={() => openSettings('general')}
          title={t('nav.settings')}
          aria-label={t('nav.settings')}
        >
          &#x2699;
        </button>

        <div ref={accountRef} style={{ position: 'relative' }}>
          <button
            className="cs-header-avatar"
            onClick={() => setAccountOpen((v) => !v)}
            title={userEmail ?? t('settings.account', 'Account')}
            aria-label={t('settings.account', 'Account')}
            aria-haspopup="true"
            aria-expanded={accountOpen}
          >
            {initials}
          </button>

          {accountOpen && (
            <div style={dropdownStyle}>
              <div style={dropdownHeaderStyle}>
                <span style={{ fontSize: '0.78rem', ...displayNameStyle(plan) }}>
                  {userEmail ?? ''}
                </span>
                <PlanBadge plan={plan} variant="compact" style={{ border: 'none', padding: 0 }} />
              </div>
              <div style={dropdownSepStyle} />
              <button
                className="cs-header-dropdown-item"
                onClick={() => {
                  setAccountOpen(false)
                  openSettings('profile')
                }}
              >
                {t('settings.profile', 'Profile')}
              </button>
              <button
                className="cs-header-dropdown-item"
                onClick={() => {
                  setAccountOpen(false)
                  openSettings('billing')
                }}
              >
                {t('settings.billing', 'Billing')}
              </button>
              <button
                className="cs-header-dropdown-item"
                onClick={() => {
                  setAccountOpen(false)
                  openSettings('security')
                }}
              >
                {t('settings.security', 'Security')}
              </button>
              <div style={dropdownSepStyle} />
              <button
                className="cs-header-dropdown-item"
                onClick={() => {
                  setAccountOpen(false)
                  openSettings('general')
                }}
              >
                {t('settings.preferences', 'Preferences')}
              </button>
              <div style={dropdownSepStyle} />
              <button className="cs-header-dropdown-item" onClick={handleSignOut}>
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

const rightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexShrink: 0,
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
