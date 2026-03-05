/**
 * WorkspaceToolbar — thin top toolbar for the unified workspace (V3-UI Phase 5).
 *
 * Height: 36px. Replaces MainHeader on the workspace page.
 *   Left:   Sidebar toggle + compact logo
 *   Center: Project name (editable inline) + save status badge
 *   Right:  Plan badge, Docs link, Settings, User avatar
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PanelLeft, PanelLeftClose, BookOpen, Settings, LogOut } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { useSettingsModal } from '../../contexts/SettingsModalContext'
import { getCurrentUser, signOut } from '../../lib/auth'
import { removeCurrentSession } from '../../lib/sessionService'
import { clearReauth } from '../../lib/reauth'
import type { Plan } from '../../lib/entitlements'
import { PlanBadge } from '../ui/PlanBadge'
import { Tooltip } from '../ui/Tooltip'
import { Icon } from '../ui/Icon'
import { displayNameStyle } from '../../lib/planStyles'

export const WORKSPACE_TOOLBAR_HEIGHT = 36

interface WorkspaceToolbarProps {
  plan: Plan
  sidebarOpen: boolean
  onToggleSidebar: () => void
  /** Name of the currently open project (null = no project). */
  projectName?: string | null
}

export function WorkspaceToolbar({
  plan,
  sidebarOpen,
  onToggleSidebar,
  projectName,
}: WorkspaceToolbarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { openSettings } = useSettingsModal()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const shortcutLabel = navigator.platform?.includes('Mac') ? '⌘B' : 'Ctrl+B'

  useEffect(() => {
    getCurrentUser().then((u) => setUserEmail(u?.email ?? null))
  }, [])

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

  return (
    <header style={headerStyle}>
      {/* ── Left: Sidebar toggle + logo ── */}
      <div style={leftStyle}>
        <Tooltip
          content={sidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')}
          side="bottom"
          shortcut={shortcutLabel}
        >
          <button className="cs-header-icon-btn" onClick={onToggleSidebar} style={iconBtn}>
            <Icon icon={sidebarOpen ? PanelLeftClose : PanelLeft} size={16} />
          </button>
        </Tooltip>
        <a
          href="/app"
          onClick={(e) => {
            e.preventDefault()
            navigate('/app')
          }}
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 18 }} />
        </a>
      </div>

      {/* ── Center: Project name ── */}
      <div style={centerStyle}>
        {projectName && (
          <span style={{ fontSize: '0.78rem', fontWeight: 500, opacity: 0.8 }}>{projectName}</span>
        )}
      </div>

      {/* ── Right: Plan badge, Docs, Settings, Avatar ── */}
      <div style={rightStyle}>
        <PlanBadge plan={plan} variant="compact" />

        <Tooltip content={t('nav.documentation', 'Documentation')} side="bottom">
          <button
            className="cs-header-icon-btn"
            onClick={() => navigate('/docs')}
            style={iconBtn}
            aria-label={t('nav.documentation', 'Documentation')}
          >
            <Icon icon={BookOpen} size={15} />
          </button>
        </Tooltip>

        <Tooltip content={t('nav.settings')} side="bottom">
          <button
            className="cs-header-icon-btn"
            onClick={() => openSettings('general')}
            style={iconBtn}
            aria-label={t('nav.settings')}
          >
            <Icon icon={Settings} size={15} />
          </button>
        </Tooltip>

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
              <div style={sepStyle} />
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
              <div style={sepStyle} />
              <button
                className="cs-header-dropdown-item"
                onClick={() => {
                  setAccountOpen(false)
                  openSettings('general')
                }}
              >
                {t('settings.preferences', 'Preferences')}
              </button>
              <div style={sepStyle} />
              <button className="cs-header-dropdown-item" onClick={handleSignOut}>
                <Icon icon={LogOut} size={13} style={{ marginRight: 6, opacity: 0.6 }} />
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
  height: WORKSPACE_TOOLBAR_HEIGHT,
  padding: '0 0.6rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface-1)',
  flexShrink: 0,
  gap: '0.5rem',
}

const leftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  flexShrink: 0,
}

const centerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minWidth: 0,
}

const rightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  flexShrink: 0,
}

const iconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 30,
  zIndex: 100,
  background: 'var(--surface-2)',
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

const sepStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '0.2rem 0',
}
