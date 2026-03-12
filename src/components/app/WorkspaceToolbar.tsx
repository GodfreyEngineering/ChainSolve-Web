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
import {
  PanelLeft,
  PanelLeftClose,
  BookOpen,
  Settings,
  LogOut,
  Save,
  Undo2,
  Redo2,
} from 'lucide-react'
import type { CanvasControls } from '../../pages/CanvasPage'
import type { SaveStatus } from '../../stores/projectStore'
import { BRAND } from '../../lib/brand'
import { SaveProgressBar } from '../ui/SaveProgressBar'
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
  /** Canvas controls exposed by CanvasPage in embedded mode. */
  canvasControls?: CanvasControls | null
}

export function WorkspaceToolbar({
  plan,
  sidebarOpen,
  onToggleSidebar,
  projectName,
  canvasControls,
}: WorkspaceToolbarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { openSettings } = useSettingsModal()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const isMac = navigator.platform?.includes('Mac')
  const shortcutLabel = isMac ? '⌘B' : 'Ctrl+B'

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

      {/* ── Center: Project controls ── */}
      <div style={centerStyle}>
        {canvasControls ? (
          <div style={projectControlsStyle}>
            {/* Undo / Redo */}
            <Tooltip content={t('menu.undo')} side="bottom" shortcut={isMac ? '⌘Z' : 'Ctrl+Z'}>
              <button
                className="cs-header-icon-btn"
                onClick={canvasControls.undo}
                style={iconBtn}
                aria-label={t('menu.undo')}
              >
                <Icon icon={Undo2} size={14} />
              </button>
            </Tooltip>
            <Tooltip
              content={t('menu.redo')}
              side="bottom"
              shortcut={isMac ? '⌘⇧Z' : 'Ctrl+Shift+Z'}
            >
              <button
                className="cs-header-icon-btn"
                onClick={canvasControls.redo}
                style={iconBtn}
                aria-label={t('menu.redo')}
              >
                <Icon icon={Redo2} size={14} />
              </button>
            </Tooltip>

            <div style={thinSepStyle} />

            {/* Project name (click to rename) */}
            <Tooltip content={t('canvas.clickToRename')} side="bottom">
              <button
                className="cs-header-icon-btn"
                onClick={canvasControls.startNameEdit}
                style={projectNameBtn}
              >
                {canvasControls.projectName || t('canvas.untitled', 'Untitled')}
              </button>
            </Tooltip>

            <div style={thinSepStyle} />

            {/* Save */}
            <Tooltip
              content={t('canvas.saveTooltip')}
              side="bottom"
              shortcut={isMac ? '⌘S' : 'Ctrl+S'}
            >
              <button
                data-tour="btn-save"
                className="cs-header-icon-btn"
                onClick={canvasControls.save}
                style={{ ...iconBtn, position: 'relative' }}
                aria-label={t('menu.save')}
              >
                <Icon icon={Save} size={14} />
                {canvasControls.isDirty && <span style={dirtyDotStyle} />}
              </button>
            </Tooltip>

            {/* Autosave toggle */}
            <Tooltip content={t('canvas.autosaveToggle')} side="bottom">
              <button
                className="cs-header-icon-btn"
                onClick={canvasControls.toggleAutosave}
                style={{
                  ...autosaveBtn,
                  color: canvasControls.autosaveEnabled ? 'var(--primary)' : 'var(--text-faint)',
                }}
              >
                {t('canvas.autosave')}
              </button>
            </Tooltip>
          </div>
        ) : projectName ? (
          <span style={{ fontSize: '0.78rem', fontWeight: 500, opacity: 0.8 }}>{projectName}</span>
        ) : null}
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

      {/* Save progress bar — thin animated strip at the bottom of the toolbar */}
      {canvasControls && (
        <SaveProgressBar
          progress={canvasControls.saveProgress}
          status={canvasControls.saveStatus as SaveStatus}
        />
      )}
    </header>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  position: 'relative',
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

const projectControlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.2rem',
}

const thinSepStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: 'var(--border)',
  margin: '0 0.15rem',
  flexShrink: 0,
}

const projectNameBtn: React.CSSProperties = {
  height: 28,
  padding: '0 0.5rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  maxWidth: 200,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const dirtyDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: 'var(--primary)',
}

const autosaveBtn: React.CSSProperties = {
  height: 28,
  padding: '0 0.35rem',
  fontSize: '0.62rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
}
