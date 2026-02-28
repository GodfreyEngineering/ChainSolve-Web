import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'
import { useProjectStore } from '../../stores/projectStore'
import { useSettingsModal } from '../../contexts/SettingsModalContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../ui/useToast'
import { DropdownMenu, type MenuEntry } from '../ui/DropdownMenu'
import type { ConfirmAction } from './ConfirmDialog'

const LazyBugReportModal = lazy(() =>
  import('../BugReportModal').then((m) => ({ default: m.BugReportModal })),
)
const LazyAboutModal = lazy(() => import('./AboutModal').then((m) => ({ default: m.AboutModal })))
const LazyConfirmDialog = lazy(() =>
  import('./ConfirmDialog').then((m) => ({ default: m.ConfirmDialog })),
)
const LazyOpenProjectDialog = lazy(() =>
  import('./OpenProjectDialog').then((m) => ({ default: m.OpenProjectDialog })),
)
const LazySaveAsDialog = lazy(() =>
  import('./SaveAsDialog').then((m) => ({ default: m.SaveAsDialog })),
)
const LazyCommandPalette = lazy(() =>
  import('./CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
const LazyKeyboardShortcutsModal = lazy(() =>
  import('./KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })),
)
import { CATEGORY_ORDER, CATEGORY_LABELS } from '../../blocks/registry'
import { getCurrentUser } from '../../lib/auth'
import { getRecentProjects } from '../../lib/recentProjects'
import { useIsMobile } from '../../hooks/useIsMobile'
import { flattenMenusToActions, type MenuDef } from '../../lib/actions'
import { computeSaveStatusLabel } from '../../lib/saveStatusLabel'
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
  onSave: () => Promise<void>
  onNewProject: () => Promise<void>
  onOpenProject: (projectId: string) => Promise<void>
  onSaveAs: (name: string) => Promise<void>
  onNavigateBack: (e: React.MouseEvent<HTMLAnchorElement>) => void
  canvasRef: React.RefObject<CanvasAreaHandle | null>
  // Export (W14a.3 + W14b.2 + W14c.1) + Import (W14c.2)
  exportInProgress?: boolean
  onExportPdfProject?: (opts: { includeImages: boolean }) => void
  onExportExcelProject?: (opts: { includeTables: boolean }) => void
  onExportChainsolveJson?: () => void
  onImportChainsolveJson?: () => void
  onCancelExport?: () => void
  /** Network status — drives offline badge and offline-queued retry action. */
  isOnline?: boolean
  onRetryOffline?: () => void
}

const INCLUDE_IMAGES_KEY = 'cs:pdfExportIncludeImages'
const INCLUDE_TABLES_KEY = 'cs:xlsxExportIncludeTables'

function getIncludeImagesPref(): boolean {
  try {
    const v = localStorage.getItem(INCLUDE_IMAGES_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

function setIncludeImagesPref(v: boolean) {
  try {
    localStorage.setItem(INCLUDE_IMAGES_KEY, String(v))
  } catch {
    // Ignore — private browsing
  }
}

function getIncludeTablesPref(): boolean {
  try {
    const v = localStorage.getItem(INCLUDE_TABLES_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

function setIncludeTablesPref(v: boolean) {
  try {
    localStorage.setItem(INCLUDE_TABLES_KEY, String(v))
  } catch {
    // Ignore — private browsing
  }
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
  onNewProject,
  onOpenProject,
  onSaveAs,
  onNavigateBack,
  canvasRef,
  exportInProgress,
  onExportPdfProject,
  onExportExcelProject,
  onExportChainsolveJson,
  onImportChainsolveJson,
  onCancelExport,
  isOnline = true,
  onRetryOffline,
}: AppHeaderProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { openSettings } = useSettingsModal()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()

  const saveStatus = useProjectStore((s) => s.saveStatus)
  const isDirty = useProjectStore((s) => s.isDirty)
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)
  const errorMessage = useProjectStore((s) => s.errorMessage)

  const [includeImages, setIncludeImages] = useState(getIncludeImagesPref)
  const [includeTables, setIncludeTables] = useState(getIncludeTablesPref)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [bugReportOpen, setBugReportOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsLoading, setSaveAsLoading] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    action: 'new' | 'open'
    targetId?: string
  } | null>(null)

  const isMobile = useIsMobile()
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Fetch user email once for avatar
  useEffect(() => {
    getCurrentUser().then((user) => {
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

  const stub = useCallback(() => toast(t('menu.comingSoon'), 'info'), [toast, t])

  const handleExportPdfActive = useCallback(() => {
    setOpenMenu(null)
    toast(t('pdfExport.generating'), 'info')
    canvasRef.current
      ?.exportPdfAudit()
      .then(() => toast(t('pdfExport.success'), 'success'))
      .catch((err: unknown) => {
        console.error('[pdf-export]', err)
        toast(t('pdfExport.failed'), 'error')
      })
  }, [canvasRef, toast, t])

  const handleExportPdfAll = useCallback(() => {
    setOpenMenu(null)
    if (onExportPdfProject) {
      toast(t('pdfExport.generatingAll'), 'info')
      onExportPdfProject({ includeImages })
    }
  }, [onExportPdfProject, includeImages, toast, t])

  const handleExportExcelActive = useCallback(() => {
    setOpenMenu(null)
    toast(t('excelExport.generating'), 'info')
    canvasRef.current
      ?.exportXlsxAuditActive()
      .then(() => toast(t('excelExport.success'), 'success'))
      .catch((err: unknown) => {
        console.error('[xlsx-export]', err)
        toast(t('excelExport.failed'), 'error')
      })
  }, [canvasRef, toast, t])

  const handleToggleIncludeImages = useCallback(() => {
    setIncludeImages((v) => {
      const next = !v
      setIncludeImagesPref(next)
      return next
    })
  }, [])

  const handleExportExcelAll = useCallback(() => {
    setOpenMenu(null)
    if (onExportExcelProject) {
      toast(t('excelExport.generatingAll'), 'info')
      onExportExcelProject({ includeTables })
    }
  }, [onExportExcelProject, includeTables, toast, t])

  const handleToggleIncludeTables = useCallback(() => {
    setIncludeTables((v) => {
      const next = !v
      setIncludeTablesPref(next)
      return next
    })
  }, [])

  const handleExportChainsolveJson = useCallback(() => {
    setOpenMenu(null)
    if (onExportChainsolveJson) {
      toast(t('chainsolveJsonExport.generating'), 'info')
      onExportChainsolveJson()
    }
  }, [onExportChainsolveJson, toast, t])

  // ── File menu handlers ──────────────────────────────────────────────────────

  const handleNewProject = useCallback(() => {
    setOpenMenu(null)
    if (isDirty && projectId) {
      setConfirmState({ action: 'new' })
    } else {
      void onNewProject()
    }
  }, [isDirty, projectId, onNewProject])

  const handleSelectProject = useCallback(
    (id: string) => {
      setOpenDialogOpen(false)
      setOpenMenu(null)
      if (isDirty && projectId) {
        setConfirmState({ action: 'open', targetId: id })
      } else {
        void onOpenProject(id)
      }
    },
    [isDirty, projectId, onOpenProject],
  )

  const handleSaveAsConfirm = useCallback(
    async (name: string) => {
      setSaveAsLoading(true)
      try {
        await onSaveAs(name)
        setSaveAsOpen(false)
      } catch {
        // Error toasted by caller
      } finally {
        setSaveAsLoading(false)
      }
    },
    [onSaveAs],
  )

  const confirmProceed = useCallback(
    (state: NonNullable<typeof confirmState>) => {
      if (state.action === 'new') void onNewProject()
      else if (state.targetId) void onOpenProject(state.targetId)
    },
    [onNewProject, onOpenProject],
  )

  const confirmActions: ConfirmAction[] = useMemo(
    () => [
      {
        label: t('project.saveAndContinue'),
        variant: 'primary' as const,
        onClick: () => {
          const state = confirmState
          setConfirmState(null)
          if (!state) return
          void onSave().then(() => confirmProceed(state))
        },
      },
      {
        label: t('project.discardAndContinue'),
        variant: 'danger' as const,
        onClick: () => {
          const state = confirmState
          setConfirmState(null)
          if (state) confirmProceed(state)
        },
      },
      {
        label: t('project.cancel'),
        variant: 'muted' as const,
        onClick: () => setConfirmState(null),
      },
    ],
    [t, confirmState, onSave, confirmProceed],
  )

  // ── Save status badge ───────────────────────────────────────────────────────

  const statusLabel = computeSaveStatusLabel(
    saveStatus,
    lastSavedAt,
    isDirty,
    projectId,
    projectName,
    fmtTime,
    t,
  )

  // ── Menu definitions ────────────────────────────────────────────────────────

  const fileItems = useMemo((): MenuEntry[] => {
    const recents = getRecentProjects()
      .filter((r) => r.id !== projectId)
      .slice(0, 5)
    const recentChildren: MenuEntry[] =
      recents.length > 0
        ? recents.map((r) => ({ label: r.name, onClick: () => handleSelectProject(r.id) }))
        : [{ label: t('project.noRecent'), disabled: true, onClick: () => {} }]

    return [
      { label: t('menu.newProject'), onClick: handleNewProject },
      {
        label: t('menu.open'),
        onClick: () => {
          setOpenMenu(null)
          setOpenDialogOpen(true)
        },
      },
      { separator: true },
      {
        label: t('menu.save'),
        shortcut: 'Ctrl+S',
        disabled: readOnly || !isDirty,
        onClick: () => void onSave(),
      },
      {
        label: t('menu.saveAs'),
        disabled: readOnly,
        onClick: () => {
          setOpenMenu(null)
          setSaveAsOpen(true)
        },
      },
      { separator: true },
      {
        label: t('menu.importProject'),
        onClick: () => {
          setOpenMenu(null)
          onImportChainsolveJson?.()
        },
        disabled: readOnly || !!exportInProgress,
      },
      {
        label: t('menu.exportPdf'),
        children: [
          {
            label: t('pdfExport.scope.active'),
            onClick: handleExportPdfActive,
            disabled: !!exportInProgress,
          },
          {
            label: t('pdfExport.scope.project'),
            onClick: handleExportPdfAll,
            disabled: !projectId || !!exportInProgress,
          },
          { separator: true },
          {
            label: includeImages ? t('pdfExport.includeImages') : t('pdfExport.skipImages'),
            onClick: handleToggleIncludeImages,
          },
          ...(exportInProgress
            ? [
                { separator: true } as const,
                {
                  label: t('pdfExport.cancelExport'),
                  onClick: () => onCancelExport?.(),
                },
              ]
            : []),
        ],
      },
      {
        label: t('menu.exportExcel'),
        children: [
          {
            label: t('excelExport.scope.active'),
            onClick: handleExportExcelActive,
            disabled: !!exportInProgress,
          },
          {
            label: t('excelExport.scope.project'),
            onClick: handleExportExcelAll,
            disabled: !projectId || !!exportInProgress,
          },
          { separator: true },
          {
            label: includeTables ? t('excelExport.includeTables') : t('excelExport.skipTables'),
            onClick: handleToggleIncludeTables,
          },
          ...(exportInProgress
            ? [
                { separator: true } as const,
                {
                  label: t('pdfExport.cancelExport'),
                  onClick: () => onCancelExport?.(),
                },
              ]
            : []),
        ],
      },
      {
        label: t('menu.exportProject'),
        onClick: handleExportChainsolveJson,
        disabled: !projectId || !!exportInProgress,
      },
      { separator: true },
      { label: t('menu.recentProjects'), children: recentChildren },
    ]
  }, [
    t,
    readOnly,
    isDirty,
    onSave,
    projectId,
    handleNewProject,
    handleSelectProject,
    handleExportPdfActive,
    handleExportPdfAll,
    handleExportExcelActive,
    handleExportExcelAll,
    handleExportChainsolveJson,
    onImportChainsolveJson,
    handleToggleIncludeImages,
    handleToggleIncludeTables,
    includeImages,
    includeTables,
    exportInProgress,
    onCancelExport,
  ])

  const editItems = useMemo(
    (): MenuEntry[] => [
      {
        label: t('menu.undo'),
        shortcut: 'Ctrl+Z',
        disabled: readOnly,
        onClick: () => canvasRef.current?.undo(),
      },
      {
        label: t('menu.redo'),
        shortcut: 'Ctrl+Shift+Z',
        disabled: readOnly,
        onClick: () => canvasRef.current?.redo(),
      },
      { separator: true },
      {
        label: t('menu.cut'),
        shortcut: 'Ctrl+X',
        disabled: readOnly,
        onClick: () => canvasRef.current?.cut(),
      },
      { label: t('menu.copy'), shortcut: 'Ctrl+C', onClick: () => canvasRef.current?.copy() },
      {
        label: t('menu.paste'),
        shortcut: 'Ctrl+V',
        disabled: readOnly,
        onClick: () => canvasRef.current?.paste(),
      },
      { separator: true },
      {
        label: t('menu.selectAll'),
        shortcut: 'Ctrl+A',
        onClick: () => canvasRef.current?.selectAll(),
      },
      {
        label: t('menu.deleteSelected'),
        shortcut: 'Del',
        disabled: readOnly,
        onClick: () => canvasRef.current?.deleteSelected(),
      },
      { separator: true },
      {
        label: t('menu.findBlock'),
        shortcut: 'Ctrl+F',
        onClick: () => canvasRef.current?.openFind(),
      },
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
      {
        label: t('menu.toggleAnimatedEdges'),
        shortcut: 'Alt+E',
        onClick: () => canvasRef.current?.toggleAnimatedEdges(),
      },
      {
        label: t('menu.toggleLod'),
        shortcut: 'Alt+L',
        onClick: () => canvasRef.current?.toggleLod(),
      },
      {
        label: t('menu.toggleValueBadges'),
        shortcut: 'Ctrl+Shift+B',
        onClick: () => canvasRef.current?.toggleBadges(),
      },
      {
        label: t('menu.toggleEdgeBadges'),
        shortcut: 'Ctrl+Shift+E',
        onClick: () => canvasRef.current?.toggleEdgeBadges(),
      },
      { separator: true },
      {
        label: t('menu.toggleDebugConsole'),
        shortcut: 'Ctrl+Shift+D',
        onClick: () => canvasRef.current?.toggleDebugConsole(),
      },
      {
        label: t('menu.toggleGraphHealth'),
        shortcut: 'Ctrl+Shift+H',
        onClick: () => canvasRef.current?.toggleHealthPanel(),
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
      {
        label: t('menu.keyboardShortcuts'),
        onClick: () => {
          setShortcutsOpen(true)
          setOpenMenu(null)
        },
      },
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

  // ── Command palette ────────────────────────────────────────────────────────

  const paletteActions = useMemo(() => flattenMenusToActions(menus as MenuDef[]), [menus])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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

          {/* Offline indicator */}
          {!isOnline && (
            <span
              title={t('canvas.offline')}
              style={{
                fontSize: '0.68rem',
                color: '#ef4444',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              ⚡ {t('canvas.offline')}
            </span>
          )}

          {/* Save status badge */}
          {statusLabel && (
            <span
              title={statusLabel?.tooltip}
              onClick={
                saveStatus === 'error' && errorMessage
                  ? () => toast(errorMessage, 'error')
                  : saveStatus === 'offline-queued' && onRetryOffline
                    ? onRetryOffline
                    : undefined
              }
              style={{
                fontSize: '0.68rem',
                color: statusLabel.color,
                whiteSpace: 'nowrap',
                cursor: statusLabel.clickable ? 'pointer' : undefined,
              }}
            >
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
              {t('menu.save')}
            </button>
          )}
        </div>

        {/* ── Center section: menus (desktop) / overflow (mobile) ──────── */}
        {!isMobile ? (
          <div role="menubar" aria-label={t('menu.menubar')} style={menuBarStyle}>
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
        ) : (
          <div style={mobileMenuBarStyle}>
            <button
              onClick={() => setPaletteOpen(true)}
              style={overflowBtnStyle}
              aria-label={t('commandPalette.title')}
              title={t('commandPalette.title')}
            >
              &#x22EF;
            </button>
          </div>
        )}

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
            title={t('settings.title')}
            aria-label={t('settings.title')}
            style={iconButtonStyle}
          >
            &#x2699;
          </button>

          {/* User avatar */}
          <div title={userEmail ?? undefined} style={avatarStyle}>
            {initials}
          </div>
        </div>
      </div>

      {bugReportOpen && (
        <Suspense fallback={null}>
          <LazyBugReportModal open onClose={() => setBugReportOpen(false)} />
        </Suspense>
      )}
      {aboutOpen && (
        <Suspense fallback={null}>
          <LazyAboutModal open onClose={() => setAboutOpen(false)} />
        </Suspense>
      )}
      {shortcutsOpen && (
        <Suspense fallback={null}>
          <LazyKeyboardShortcutsModal
            open
            onClose={() => setShortcutsOpen(false)}
            actions={paletteActions}
          />
        </Suspense>
      )}
      {openDialogOpen && (
        <Suspense fallback={null}>
          <LazyOpenProjectDialog
            open
            onClose={() => setOpenDialogOpen(false)}
            onSelect={handleSelectProject}
          />
        </Suspense>
      )}
      {saveAsOpen && (
        <Suspense fallback={null}>
          <LazySaveAsDialog
            open
            onClose={() => setSaveAsOpen(false)}
            currentName={projectName}
            onConfirm={handleSaveAsConfirm}
            saving={saveAsLoading}
          />
        </Suspense>
      )}
      {!!confirmState && (
        <Suspense fallback={null}>
          <LazyConfirmDialog
            open
            onClose={() => setConfirmState(null)}
            title={t('project.unsavedTitle')}
            message={t('project.unsavedMessage')}
            actions={confirmActions}
          />
        </Suspense>
      )}
      {paletteOpen && (
        <Suspense fallback={null}>
          <LazyCommandPalette actions={paletteActions} onClose={() => setPaletteOpen(false)} />
        </Suspense>
      )}
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

const mobileMenuBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
}

const overflowBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: '1.1rem',
  padding: '0.15rem 0.55rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1,
  letterSpacing: '0.1em',
}
