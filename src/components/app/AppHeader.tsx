import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'
import { useProjectStore } from '../../stores/projectStore'
import { useSettingsModal } from '../../contexts/SettingsModalContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../ui/useToast'
import { DropdownMenu, type MenuEntry } from '../ui/DropdownMenu'
import { BugReportModal } from '../BugReportModal'
import { AboutModal } from './AboutModal'
import { CATEGORY_ORDER, CATEGORY_LABELS } from '../../blocks/registry'
import { supabase } from '../../lib/supabase'
import type { CanvasAreaHandle } from '../canvas/CanvasArea'
import type { Plan } from '../../lib/entitlements'
import type { ThemeMode } from '../../contexts/ThemeContext'

// ── Plan badge colors (matches ProfileSettings) ─────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  free: '#6b7280',
  trialing: '#3b82f6',
  pro: '#22c55e',
  past_due: '#f59e0b',
  canceled: '#ef4444',
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  projectId: string | undefined
  projectName: string
  readOnly: boolean
  plan: Plan
  // Name editing
  nameEditing: boolean
  nameInput: string
  nameInputRef: React.RefObject<HTMLInputElement | null>
  onStartNameEdit: () => void
  onNameInputChange: (value: string) => void
  onCommitNameEdit: () => void
  onCancelNameEdit: () => void
  // Actions
  onSave: () => void
  onNavigateBack: (e: React.MouseEvent<HTMLAnchorElement>) => void
  canvasRef: React.RefObject<CanvasAreaHandle | null>
}

export function AppHeader({
  projectId,
  projectName,
  readOnly,
  plan,
  nameEditing,
  nameInput,
  nameInputRef,
  onStartNameEdit,
  onNameInputChange,
  onCommitNameEdit,
  onCancelNameEdit,
  onSave,
  onNavigateBack,
  canvasRef,
}: AppHeaderProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { openSettings } = useSettingsModal()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()

  const saveStatus = useProjectStore((s) => s.saveStatus)
  const isDirty = useProjectStore((s) => s.isDirty)
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [bugReportOpen, setBugReportOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Fetch user email once for avatar
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  // Close menus on Escape
  useEffect(() => {
    if (!openMenu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openMenu])

  // Close menus on outside click
  useEffect(() => {
    if (!openMenu) return
    const handler = () => setOpenMenu(null)
    // Delay so menu item clicks process first
    const id = setTimeout(() => {
      document.addEventListener('click', handler)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('click', handler)
    }
  }, [openMenu])

  const stub = useCallback(
    () => toast(t('menu.comingSoon'), 'info'),
    [toast, t],
  )

  // ── Save status badge ───────────────────────────────────────────────────────

  const statusLabel: { text: string; color: string } | null = (() => {
    if (!projectId) return null
    switch (saveStatus) {
      case 'saving':
        return { text: 'Saving\u2026', color: 'rgba(244,244,243,0.45)' }
      case 'saved':
        return {
          text: `Saved${lastSavedAt ? ' \u00b7 ' + fmtTime(lastSavedAt) : ''}`,
          color: '#22c55e',
        }
      case 'conflict':
        return { text: '\u26a0 Conflict', color: '#f59e0b' }
      case 'error':
        return { text: '\u26a0 Save failed', color: '#ef4444' }
      default:
        return isDirty ? { text: 'Unsaved', color: 'rgba(244,244,243,0.45)' } : null
    }
  })()

  // ── Menu definitions ────────────────────────────────────────────────────────

  const fileItems = useMemo(
    (): MenuEntry[] => [
      { label: t('menu.newProject'), onClick: stub },
      { label: t('menu.open'), onClick: stub },
      { separator: true },
      {
        label: t('menu.save'),
        shortcut: 'Ctrl+S',
        disabled: readOnly || !isDirty,
        onClick: onSave,
      },
      { label: t('menu.saveAs'), onClick: stub },
      { separator: true },
      { label: t('menu.import'), onClick: stub },
      { label: t('menu.exportPdf'), onClick: stub },
      { label: t('menu.exportExcel'), onClick: stub },
      { separator: true },
      { label: t('menu.recentProjects'), disabled: true, onClick: stub },
    ],
    [t, stub, readOnly, isDirty, onSave],
  )

  const editItems = useMemo(
    (): MenuEntry[] => [
      { label: t('menu.undo'), shortcut: 'Ctrl+Z', disabled: readOnly, onClick: () => canvasRef.current?.undo() },
      { label: t('menu.redo'), shortcut: 'Ctrl+Shift+Z', disabled: readOnly, onClick: () => canvasRef.current?.redo() },
      { separator: true },
      { label: t('menu.cut'), shortcut: 'Ctrl+X', disabled: readOnly, onClick: () => canvasRef.current?.cut() },
      { label: t('menu.copy'), shortcut: 'Ctrl+C', onClick: () => canvasRef.current?.copy() },
      { label: t('menu.paste'), shortcut: 'Ctrl+V', disabled: readOnly, onClick: () => canvasRef.current?.paste() },
      { separator: true },
      { label: t('menu.selectAll'), shortcut: 'Ctrl+A', onClick: () => canvasRef.current?.selectAll() },
      { label: t('menu.deleteSelected'), shortcut: 'Del', disabled: readOnly, onClick: () => canvasRef.current?.deleteSelected() },
      { separator: true },
      { label: t('menu.findBlock'), shortcut: 'Ctrl+F', onClick: () => canvasRef.current?.openFind() },
    ],
    [t, readOnly, canvasRef],
  )

  const viewItems = useMemo(
    (): MenuEntry[] => [
      {
        label: t('menu.zoomIn'),
        shortcut: 'Ctrl++',
        onClick: () => canvasRef.current?.zoomIn(),
      },
      {
        label: t('menu.zoomOut'),
        shortcut: 'Ctrl+-',
        onClick: () => canvasRef.current?.zoomOut(),
      },
      {
        label: t('menu.fitToScreen'),
        onClick: () => canvasRef.current?.fitView(),
      },
      { separator: true },
      {
        label: t('menu.toggleLibrary'),
        onClick: () => canvasRef.current?.toggleLibrary(),
      },
      {
        label: t('menu.toggleInspector'),
        onClick: () => canvasRef.current?.toggleInspector(),
      },
      {
        label: t('menu.toggleMinimap'),
        onClick: () => canvasRef.current?.toggleMinimap(),
      },
      { separator: true },
      {
        label: t('menu.theme'),
        children: [
          {
            label: 'System',
            onClick: () => setThemeMode('system' as ThemeMode),
            disabled: themeMode === 'system',
          },
          {
            label: 'Light',
            onClick: () => setThemeMode('light' as ThemeMode),
            disabled: themeMode === 'light',
          },
          {
            label: 'Dark',
            onClick: () => setThemeMode('dark' as ThemeMode),
            disabled: themeMode === 'dark',
          },
        ],
      },
      { label: t('menu.perfHud'), onClick: stub },
    ],
    [t, stub, canvasRef, themeMode, setThemeMode],
  )

  const insertItems = useMemo(
    (): MenuEntry[] =>
      CATEGORY_ORDER.map((cat) => ({
        label: CATEGORY_LABELS[cat],
        children: [
          {
            label: `Open library \u2192 ${CATEGORY_LABELS[cat]}`,
            onClick: () => {
              canvasRef.current?.toggleLibrary()
              // Toggle opens the library; category search is a future enhancement
            },
          },
        ],
      })),
    [canvasRef],
  )

  const toolsItems = useMemo(
    (): MenuEntry[] => [
      {
        label: t('menu.autoOrganise'),
        onClick: () => canvasRef.current?.autoOrganise(),
      },
      { label: t('menu.validateGraph'), onClick: stub },
      { label: t('menu.clearCanvas'), onClick: stub },
      { separator: true },
      { label: t('menu.canvasSettings'), onClick: stub },
    ],
    [t, stub, canvasRef],
  )

  const helpItems = useMemo(
    (): MenuEntry[] => [
      { label: t('menu.documentation'), onClick: stub },
      { label: t('menu.keyboardShortcuts'), onClick: stub },
      { separator: true },
      {
        label: t('menu.bugReport'),
        onClick: () => {
          setBugReportOpen(true)
          setOpenMenu(null)
        },
      },
      { label: t('menu.changelog'), onClick: stub },
      { separator: true },
      {
        label: t('menu.about'),
        onClick: () => {
          setAboutOpen(true)
          setOpenMenu(null)
        },
      },
    ],
    [t, stub],
  )

  const menus = useMemo(
    () => [
      { id: 'file', label: t('menu.file'), items: fileItems },
      { id: 'edit', label: t('menu.edit'), items: editItems },
      { id: 'view', label: t('menu.view'), items: viewItems },
      { id: 'insert', label: t('menu.insert'), items: insertItems },
      { id: 'tools', label: t('menu.tools'), items: toolsItems },
      { id: 'help', label: t('menu.help'), items: helpItems },
    ],
    [t, fileItems, editItems, viewItems, insertItems, toolsItems, helpItems],
  )

  // ── User avatar initials ────────────────────────────────────────────────────

  const initials = userEmail
    ? userEmail
        .split('@')[0]
        .split(/[._-]/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('')
    : '?'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={headerStyle}>
        {/* ── Left section ─────────────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <a
            href="/app"
            onClick={onNavigateBack}
            style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <img src={BRAND.logoWideText} alt="ChainSolve" style={{ height: 22 }} />
          </a>

          <div style={dividerStyle} />

          {/* Project name — click to rename */}
          {projectId && !nameEditing && (
            <span
              onClick={readOnly ? undefined : onStartNameEdit}
              title={readOnly ? undefined : 'Click to rename'}
              style={projectNameStyle(readOnly)}
            >
              {projectName}
            </span>
          )}
          {projectId && nameEditing && (
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={(e) => onNameInputChange(e.target.value)}
              onBlur={onCommitNameEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitNameEdit()
                if (e.key === 'Escape') onCancelNameEdit()
              }}
              style={nameInputStyle}
            />
          )}
          {!projectId && (
            <span style={{ fontWeight: 600, fontSize: '0.82rem', opacity: 0.4 }}>
              Scratch canvas
            </span>
          )}

          {/* Save status badge */}
          {statusLabel && (
            <span style={{ fontSize: '0.68rem', color: statusLabel.color, whiteSpace: 'nowrap' }}>
              {statusLabel.text}
            </span>
          )}

          {/* Save button */}
          {projectId && !readOnly && (
            <button
              onClick={onSave}
              disabled={!isDirty || saveStatus === 'saving'}
              style={saveButtonStyle(isDirty)}
              title="Save now (Ctrl+S)"
            >
              Save
            </button>
          )}
        </div>

        {/* ── Center section: menus ────────────────────────────────────────── */}
        <div role="menubar" style={menuBarStyle}>
          {menus.map((m) => (
            <DropdownMenu
              key={m.id}
              label={m.label}
              items={m.items}
              open={openMenu === m.id}
              onOpenChange={(isOpen) => setOpenMenu(isOpen ? m.id : null)}
              onHoverTrigger={openMenu ? () => setOpenMenu(m.id) : undefined}
            />
          ))}
        </div>

        {/* ── Right section ────────────────────────────────────────────────── */}
        <div style={{ ...sectionStyle, justifyContent: 'flex-end' }}>
          {/* Plan badge */}
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: PLAN_COLORS[plan] ?? PLAN_COLORS.free,
              padding: '0.15rem 0.4rem',
              borderRadius: 4,
              border: `1px solid ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`,
              opacity: 0.8,
            }}
          >
            {t(`plans.${plan}`)}
          </span>

          {/* Notifications (stub) */}
          <button
            onClick={stub}
            title={t('menu.notifications')}
            aria-label={t('menu.notifications')}
            style={iconButtonStyle}
          >
            &#x1F514;
          </button>

          {/* Settings gear */}
          <button
            onClick={() => openSettings()}
            title="Settings"
            aria-label="Settings"
            style={iconButtonStyle}
          >
            &#x2699;
          </button>

          {/* User avatar */}
          <div
            title={userEmail ?? undefined}
            style={avatarStyle}
          >
            {initials}
          </div>
        </div>
      </div>

      <BugReportModal open={bugReportOpen} onClose={() => setBugReportOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 40,
  padding: '0 0.75rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--card-bg)',
  flexShrink: 0,
  gap: '0.5rem',
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flex: 1,
  minWidth: 0,
}

const menuBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.15rem',
  flexShrink: 0,
}

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: 'var(--border)',
  flexShrink: 0,
}

function projectNameStyle(readOnly: boolean): React.CSSProperties {
  return {
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '-0.3px',
    cursor: readOnly ? 'default' : 'text',
    borderBottom: '1px solid transparent',
    userSelect: 'none',
    paddingBottom: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  }
}

const nameInputStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.85rem',
  letterSpacing: '-0.3px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--primary)',
  outline: 'none',
  color: 'inherit',
  width: 180,
  padding: 0,
  fontFamily: 'inherit',
}

function saveButtonStyle(dirty: boolean): React.CSSProperties {
  return {
    padding: '0.12rem 0.45rem',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.12)',
    background: dirty ? 'rgba(28,171,176,0.15)' : 'transparent',
    color: dirty ? '#1CABB0' : 'rgba(244,244,243,0.35)',
    cursor: dirty ? 'pointer' : 'default',
    fontSize: '0.68rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  }
}

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
  padding: '0.15rem 0.3rem',
  borderRadius: 4,
  fontFamily: 'inherit',
  lineHeight: 1,
}

const avatarStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: 'var(--primary-dim)',
  color: 'var(--primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  flexShrink: 0,
  userSelect: 'none',
}
