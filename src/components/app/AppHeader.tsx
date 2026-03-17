import { useCallback, useEffect, useMemo, useState, useRef, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { CONTACT } from '../../lib/brand'
import { useProjectStore } from '../../stores/projectStore'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { useSettingsModal } from '../../contexts/SettingsModalContext'
import { useWindowManager } from '../../contexts/WindowManagerContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../ui/useToast'
import { DropdownMenu, type MenuEntry } from '../ui/DropdownMenu'
import type { ConfirmAction } from './ConfirmDialog'
import { ABOUT_WINDOW_ID, DOCS_WINDOW_ID } from '../windowIds'
import { AI_WINDOW_ID } from '../../lib/ai/constants'

const LazyFeedbackModal = lazy(() =>
  import('../FeedbackModal').then((m) => ({ default: m.FeedbackModal })),
)
const LazyAboutWindow = lazy(() => import('./AboutModal').then((m) => ({ default: m.AboutWindow })))
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
const LazyDocsSearchWindow = lazy(() =>
  import('./DocsSearchModal').then((m) => ({ default: m.DocsSearchWindow })),
)
const LazyWhatsNewModal = lazy(() =>
  import('./WhatsNewModal').then((m) => ({ default: m.WhatsNewModal })),
)
const LazyOnboardingOverlay = lazy(() =>
  import('./OnboardingOverlay').then((m) => ({ default: m.OnboardingOverlay })),
)
const LazyProjectWizard = lazy(() =>
  import('./ProjectWizard').then((m) => ({ default: m.ProjectWizard })),
)
const LazyLlmGraphBuilderDialog = lazy(() =>
  import('../canvas/LlmGraphBuilderDialog').then((m) => ({ default: m.LlmGraphBuilderDialog })),
)
const LazyTemplateManagerDialog = lazy(() =>
  import('../canvas/TemplateManagerDialog').then((m) => ({ default: m.TemplateManagerDialog })),
)
const LazyPublishWizardModal = lazy(() =>
  import('./PublishWizardModal').then((m) => ({ default: m.PublishWizardModal })),
)
import { BLOCK_TAXONOMY } from '../../blocks/registry'
import { getRecentProjects } from '../../lib/recentProjects'
import { resetOnboarding } from '../../lib/onboardingState'
import { useIsMobile } from '../../hooks/useIsMobile'
import { flattenMenusToActions, type MenuDef } from '../../lib/actions'
import { computeSaveStatusLabel } from '../../lib/saveStatusLabel'
import type { CanvasAreaHandle } from '../canvas/CanvasArea'
import type { ThemeMode } from '../../contexts/ThemeContext'
import type { AiPatchOp } from '../../lib/ai/types'
import { ExportDialog } from './ExportDialog'

// ── Props ────────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  projectId: string | undefined
  projectName: string
  readOnly: boolean
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
  canvasRef: React.RefObject<CanvasAreaHandle | null>
  // Export (W14a.3 + W14b.2 + W14c.1) + Import (W14c.2)
  exportInProgress?: boolean
  onExportPdfProject?: (opts: { includeImages: boolean; pageSize?: string }) => void
  onExportExcelProject?: (opts: { includeTables: boolean }) => void
  onExportChainsolveJson?: () => void
  /** 5.11: Git-friendly .chainsolve export */
  onExportGitFriendly?: () => void
  onImportChainsolveJson?: () => void
  onCancelExport?: () => void
  /** Network status — drives offline badge and offline-queued retry action. */
  isOnline?: boolean
  onRetryOffline?: () => void
  /** L4-1: External trigger to open Save-As dialog (e.g. Ctrl+S in scratch mode). */
  saveAsRequested?: boolean
  onSaveAsRequestHandled?: () => void
  /** 6.03: Active canvas ID for LLM graph builder. */
  canvasId?: string
  /** 6.03: Apply AI-generated patch ops to the canvas. */
  onApplyPatch?: (ops: AiPatchOp[], summary: string) => void
}

export function AppHeader({
  projectId,
  projectName,
  readOnly,
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
  canvasRef,
  exportInProgress,
  onExportPdfProject,
  onExportExcelProject,
  onExportChainsolveJson,
  onExportGitFriendly,
  onImportChainsolveJson,
  onCancelExport,
  isOnline = true,
  onRetryOffline,
  saveAsRequested,
  onSaveAsRequestHandled,
  canvasId,
  onApplyPatch,
}: AppHeaderProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { openSettings } = useSettingsModal()
  const { openWindow: openWin, isOpen: isWinOpen } = useWindowManager()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()

  const saveStatus = useProjectStore((s) => s.saveStatus)
  const isDirty = useProjectStore((s) => s.isDirty)
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)
  const errorMessage = useProjectStore((s) => s.errorMessage)

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<'bug' | 'suggestion' | 'block_request'>('bug')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsLoading, setSaveAsLoading] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    action: 'new' | 'open'
    targetId?: string
  } | null>(null)

  const isMobile = useIsMobile()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [clearCanvasConfirm, setClearCanvasConfirm] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [llmBuilderOpen, setLlmBuilderOpen] = useState(false)
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [publishWizardOpen, setPublishWizardOpen] = useState(false)

  const autosaveEnabled = usePreferencesStore((s) => s.autosaveEnabled)

  // L4-1: Open Save-As dialog when requested externally (Ctrl+S in scratch mode)
  useEffect(() => {
    if (saveAsRequested) {
      setSaveAsOpen(true)
      onSaveAsRequestHandled?.()
    }
  }, [saveAsRequested, onSaveAsRequestHandled])

  // UX-23: Listen for tour restart event dispatched from Settings
  useEffect(() => {
    const handler = () => setTourOpen(true)
    window.addEventListener('cs:restart-tour', handler)
    return () => window.removeEventListener('cs:restart-tour', handler)
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

  const handleToggleAutosave = useCallback(() => {
    usePreferencesStore.getState().update({ autosaveEnabled: !autosaveEnabled })
  }, [autosaveEnabled])

  const handleClearCanvas = useCallback(() => {
    if (!canvasRef.current) return
    setClearCanvasConfirm(true)
  }, [canvasRef])

  const handleClearCanvasConfirmed = useCallback(() => {
    setClearCanvasConfirm(false)
    if (!canvasRef.current) return
    canvasRef.current.selectAll()
    canvasRef.current.deleteSelected()
  }, [canvasRef])

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

  // ── Save status badge (PROJ-02: refresh every 30s for "N min ago") ─────────

  // Tick every 30 s so relative-time labels ("2 min ago") stay fresh.
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  const statusLabel = computeSaveStatusLabel(
    saveStatus,
    lastSavedAt,
    isDirty,
    projectId,
    projectName,
    fmtRelativeTime,
    t,
    errorMessage,
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
      { label: t('menu.newProject'), shortcut: 'Ctrl+N', onClick: handleNewProject },
      {
        label: t('menu.open'),
        shortcut: 'Ctrl+O',
        onClick: () => {
          setOpenMenu(null)
          setOpenDialogOpen(true)
        },
      },
      { separator: true },
      {
        label: projectId ? t('menu.save') : t('menu.saveAs'),
        shortcut: 'Ctrl+S',
        disabled: projectId ? readOnly || !isDirty : readOnly,
        onClick: projectId
          ? () => void onSave()
          : () => {
              setOpenMenu(null)
              setSaveAsOpen(true)
            },
      },
      {
        label: t('menu.saveAs'),
        shortcut: 'Ctrl+Shift+S',
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
        label: t('menu.export'),
        onClick: () => {
          setOpenMenu(null)
          setExportDialogOpen(true)
        },
      },
      { separator: true },
      {
        label: t('menu.publishToMarketplace', 'Publish to marketplace'),
        disabled: !projectId || readOnly,
        onClick: () => {
          setOpenMenu(null)
          setPublishWizardOpen(true)
        },
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
    onImportChainsolveJson,
    exportInProgress,
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
        label: t('menu.theme'),
        children: [
          {
            label: t('themeOption.system'),
            onClick: () => setThemeMode('system' as ThemeMode),
            disabled: themeMode === 'system',
          },
          {
            label: t('themeOption.light'),
            onClick: () => setThemeMode('light' as ThemeMode),
            disabled: themeMode === 'light',
          },
          {
            label: t('themeOption.dark'),
            onClick: () => setThemeMode('dark' as ThemeMode),
            disabled: themeMode === 'dark',
          },
        ],
      },
      {
        label: t('menu.perfHud'),
        onClick: () => {
          const url = new URL(window.location.href)
          const has = url.searchParams.has('perf')
          if (has) url.searchParams.delete('perf')
          else url.searchParams.set('perf', '1')
          window.history.replaceState(null, '', url.toString())
          window.location.reload()
        },
      },
    ],
    [t, canvasRef, themeMode, setThemeMode],
  )

  const insertItems = useMemo((): MenuEntry[] => {
    // V2-019: Drill-down categories from BLOCK_TAXONOMY
    const taxonomyEntries: MenuEntry[] = BLOCK_TAXONOMY.map((main) => ({
      label: main.label,
      children: main.subcategories.map((sub) => ({
        label: sub.label,
        onClick: () => canvasRef.current?.openLibraryWithFilter(main.id),
      })),
    }))
    // Annotations — non-block visual tools (V2-022)
    const annotationEntry: MenuEntry = {
      label: t('menu.insertAnnotations'),
      children: [
        {
          label: t('contextMenu.annotText'),
          onClick: () => canvasRef.current?.insertAnnotationAtCenter('annotation_text'),
        },
        {
          label: t('contextMenu.annotCallout'),
          onClick: () => canvasRef.current?.insertAnnotationAtCenter('annotation_callout'),
        },
        {
          label: t('contextMenu.annotHighlight'),
          onClick: () => canvasRef.current?.insertAnnotationAtCenter('annotation_highlight'),
        },
        {
          label: t('contextMenu.annotArrow'),
          onClick: () => canvasRef.current?.insertAnnotationAtCenter('annotation_arrow'),
        },
        {
          label: t('contextMenu.annotLeader'),
          onClick: () => canvasRef.current?.insertAnnotationAtCenter('annotation_leader'),
        },
      ],
    }
    return [...taxonomyEntries, { separator: true as const }, annotationEntry]
  }, [canvasRef, t])

  const toolsItems = useMemo(
    (): MenuEntry[] => [
      {
        label: t('menu.autoOrganise'),
        onClick: () => canvasRef.current?.autoOrganise(),
      },
      {
        label: t('menu.validateGraph'),
        onClick: () => {
          canvasRef.current?.toggleHealthPanel()
          setOpenMenu(null)
        },
      },
      {
        label: t('menu.clearCanvas'),
        onClick: () => {
          handleClearCanvas()
          setOpenMenu(null)
        },
      },
      { separator: true },
      {
        label: t('menu.canvasSettings'),
        onClick: () => {
          openSettings('general')
          setOpenMenu(null)
        },
      },
      { separator: true },
      {
        label: t('menu.buildWithAI'),
        onClick: () => {
          openWin(AI_WINDOW_ID, { width: 520, height: 560 })
          setOpenMenu(null)
        },
      },
      {
        label: t('menu.manageSavedGroups'),
        onClick: () => {
          setTemplateManagerOpen(true)
          setOpenMenu(null)
        },
      },
    ],
    [t, canvasRef, handleClearCanvas, openSettings, openWin],
  )

  const helpItems = useMemo(
    (): MenuEntry[] => [
      {
        label: t('menu.documentation'),
        onClick: () => {
          openWin(DOCS_WINDOW_ID, { width: 580, height: 500 })
          setOpenMenu(null)
        },
      },
      {
        label: t('menu.keyboardShortcuts'),
        onClick: () => {
          setShortcutsOpen(true)
          setOpenMenu(null)
        },
      },
      {
        label: t('menu.startTour'),
        onClick: () => {
          resetOnboarding()
          setTourOpen(true)
          setOpenMenu(null)
        },
      },
      {
        label: t('menu.projectWizard'),
        onClick: () => {
          setWizardOpen(true)
          setOpenMenu(null)
        },
      },
      { separator: true },
      {
        label: t('menu.feedback'),
        onClick: () => {
          setFeedbackType('bug')
          setFeedbackOpen(true)
          setOpenMenu(null)
        },
      },
      {
        label: t('menu.changelog'),
        onClick: () => {
          setWhatsNewOpen(true)
          setOpenMenu(null)
        },
      },
      {
        label: t('menu.contactSupport'),
        onClick: () => {
          window.location.href = `mailto:${CONTACT.support}`
          setOpenMenu(null)
        },
      },
      { separator: true },
      {
        label: t('menu.about'),
        onClick: () => {
          openWin(ABOUT_WINDOW_ID, { width: 380, height: 280 })
          setOpenMenu(null)
        },
      },
    ],
    [t, openWin],
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
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      } else if (mod && e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        handleNewProject()
      } else if (mod && e.key === 'o' && !e.shiftKey) {
        e.preventDefault()
        setOpenDialogOpen(true)
      } else if (mod && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        if (!readOnly) setSaveAsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNewProject, readOnly])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="cs-project-header">
        {/* ── Left: project identity + save controls ───────────────────── */}
        <div style={sectionStyle}>
          {/* Project name — double-click to rename */}
          {projectId && !nameEditing && (
            <span
              className="cs-project-name"
              data-readonly={readOnly}
              onDoubleClick={readOnly ? undefined : onStartNameEdit}
              title={readOnly ? undefined : t('canvas.doubleClickToRename')}
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
              {t('canvas.scratch')}
            </span>
          )}

          {/* Offline indicator */}
          {!isOnline && <span style={offlineStyle}>{t('canvas.offline')}</span>}

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
          {!readOnly && (
            <button
              className="cs-project-btn"
              data-variant={projectId ? (isDirty ? 'save' : undefined) : 'save'}
              onClick={projectId ? onSave : () => setSaveAsOpen(true)}
              disabled={projectId ? !isDirty || saveStatus === 'saving' : false}
              title={projectId ? t('canvas.saveTooltip') : t('canvas.saveAsTooltip')}
            >
              {projectId ? t('menu.save') : t('menu.saveAs')}
            </button>
          )}

          {/* Undo / Redo / Open / Save As (desktop only) */}
          {!isMobile && (
            <>
              <span className="cs-project-divider" />
              <button
                className="cs-project-icon-btn"
                onClick={() => canvasRef.current?.undo()}
                disabled={readOnly}
                title={`${t('menu.undo')} (Ctrl+Z)`}
                aria-label={t('menu.undo')}
              >
                {'\u21B6'}
              </button>
              <button
                className="cs-project-icon-btn"
                onClick={() => canvasRef.current?.redo()}
                disabled={readOnly}
                title={`${t('menu.redo')} (Ctrl+Shift+Z)`}
                aria-label={t('menu.redo')}
              >
                {'\u21B7'}
              </button>
              <span className="cs-project-divider" />
              <button
                className="cs-project-btn"
                onClick={() => setOpenDialogOpen(true)}
                title={`${t('menu.open')} (Ctrl+O)`}
                aria-label={t('menu.open')}
              >
                {t('menu.open')}
              </button>
              {!readOnly && (
                <button
                  className="cs-project-btn"
                  onClick={() => setSaveAsOpen(true)}
                  title={t('menu.saveAs')}
                  aria-label={t('menu.saveAs')}
                >
                  {t('menu.saveAs')}
                </button>
              )}

              {/* Autosave toggle */}
              {projectId && !readOnly && (
                <label style={autosaveToggleStyle} title={t('canvas.autosaveToggle')}>
                  <input
                    type="checkbox"
                    checked={autosaveEnabled}
                    onChange={handleToggleAutosave}
                    style={{ margin: 0, accentColor: 'var(--primary)' }}
                  />
                  <span style={autosaveLabelStyle}>{t('canvas.autosave')}</span>
                </label>
              )}
            </>
          )}
        </div>

        {/* ── Center: menus (desktop) / overflow (mobile) ──────────────── */}
        {!isMobile ? (
          <div role="menubar" aria-label={t('menu.menubar')} style={menuBarStyle}>
            {menus.map((m) => (
              <span key={m.id} {...(m.id === 'file' ? { 'data-tour': 'menu-file' } : {})}>
                <DropdownMenu
                  label={m.label}
                  items={m.items}
                  open={openMenu === m.id}
                  onOpenChange={(isOpen) => setOpenMenu(isOpen ? m.id : null)}
                  onHoverTrigger={openMenu ? () => setOpenMenu(m.id) : undefined}
                />
              </span>
            ))}
          </div>
        ) : (
          <div style={mobileMenuBarStyle}>
            <button
              onClick={() => setMobileDrawerOpen((v) => !v)}
              className="cs-project-btn"
              style={{ fontSize: '1.1rem', padding: '0.15rem 0.55rem', letterSpacing: '0.1em' }}
              aria-label={t('mobileNav.menu')}
              title={t('mobileNav.menu')}
              aria-expanded={mobileDrawerOpen}
            >
              {mobileDrawerOpen ? '\u2715' : '\u2630'}
            </button>
          </div>
        )}

        {/* ── Right: action cluster (desktop only) ─────────────────────── */}
        {!isMobile && (
          <div style={{ ...sectionStyle, justifyContent: 'flex-end' }}>
            {onImportChainsolveJson && !readOnly && (
              <button
                className="cs-project-btn"
                onClick={() => {
                  setOpenMenu(null)
                  onImportChainsolveJson()
                }}
                disabled={!!exportInProgress}
                title={t('canvas.importFile')}
              >
                {t('canvas.importFile')}
              </button>
            )}

            <button
              className="cs-project-btn"
              onClick={() => {
                setTemplateManagerOpen(true)
                setOpenMenu(null)
              }}
              title={t('canvas.templates')}
            >
              {t('canvas.templates')}
            </button>
          </div>
        )}
      </div>

      {/* K3-1: Mobile navigation drawer */}
      {isMobile && mobileDrawerOpen && (
        <>
          <div style={mobileBackdropStyle} onClick={() => setMobileDrawerOpen(false)} />
          <nav
            style={{
              ...mobileDrawerStyle,
              width: Math.min(280, window.innerWidth * 0.85),
            }}
            aria-label={t('mobileNav.menu')}
          >
            <MobileDrawerSection label={t('mobileNav.file')}>
              <MobileDrawerItem
                label={t('menu.undo')}
                icon={'\u21B6'}
                onClick={() => {
                  canvasRef.current?.undo()
                  setMobileDrawerOpen(false)
                }}
              />
              <MobileDrawerItem
                label={t('menu.redo')}
                icon={'\u21B7'}
                onClick={() => {
                  canvasRef.current?.redo()
                  setMobileDrawerOpen(false)
                }}
              />
              <MobileDrawerItem
                label={t('menu.open')}
                icon={'\u2750'}
                onClick={() => {
                  setOpenDialogOpen(true)
                  setMobileDrawerOpen(false)
                }}
              />
              {!readOnly && (
                <MobileDrawerItem
                  label={t('menu.saveAs')}
                  icon={'\u2913'}
                  onClick={() => {
                    setSaveAsOpen(true)
                    setMobileDrawerOpen(false)
                  }}
                />
              )}
              {onImportChainsolveJson && !readOnly && (
                <MobileDrawerItem
                  label={t('canvas.importFile')}
                  icon={'\u21e5'}
                  onClick={() => {
                    onImportChainsolveJson()
                    setMobileDrawerOpen(false)
                  }}
                />
              )}
            </MobileDrawerSection>

            <MobileDrawerSection label={t('mobileNav.canvas')}>
              <MobileDrawerItem
                label={t('canvas.templates')}
                icon={'\u26a1'}
                onClick={() => {
                  setTemplateManagerOpen(true)
                  setMobileDrawerOpen(false)
                }}
              />
              <MobileDrawerItem
                label={t('commandPalette.title')}
                icon={'\u2315'}
                onClick={() => {
                  setPaletteOpen(true)
                  setMobileDrawerOpen(false)
                }}
              />
            </MobileDrawerSection>

            <MobileDrawerSection label={t('mobileNav.navigate')}>
              <MobileDrawerItem
                label={t('nav.home', 'Home')}
                icon={'\u2302'}
                onClick={() => {
                  window.location.href = '/'
                  setMobileDrawerOpen(false)
                }}
              />
              <MobileDrawerItem
                label={t('home.explore')}
                icon={'\u2609'}
                onClick={() => {
                  window.location.href = '/app?tab=explore'
                  setMobileDrawerOpen(false)
                }}
              />
              <MobileDrawerItem
                label={t('nav.documentation')}
                icon={'\u2139'}
                onClick={() => {
                  window.open('/docs', '_blank', 'noopener')
                  setMobileDrawerOpen(false)
                }}
              />
              <MobileDrawerItem
                label={t('nav.settings')}
                icon={'\u2699'}
                onClick={() => {
                  openSettings()
                  setMobileDrawerOpen(false)
                }}
              />
            </MobileDrawerSection>
          </nav>
        </>
      )}

      {feedbackOpen && (
        <Suspense fallback={null}>
          <LazyFeedbackModal
            open
            onClose={() => setFeedbackOpen(false)}
            initialType={feedbackType}
          />
        </Suspense>
      )}
      {isWinOpen(ABOUT_WINDOW_ID) && (
        <Suspense fallback={null}>
          <LazyAboutWindow />
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
      {isWinOpen(DOCS_WINDOW_ID) && (
        <Suspense fallback={null}>
          <LazyDocsSearchWindow />
        </Suspense>
      )}
      {whatsNewOpen && (
        <Suspense fallback={null}>
          <LazyWhatsNewModal open onClose={() => setWhatsNewOpen(false)} />
        </Suspense>
      )}
      {tourOpen && (
        <Suspense fallback={null}>
          <LazyOnboardingOverlay mode="overlay" onClose={() => setTourOpen(false)} />
        </Suspense>
      )}
      {wizardOpen && (
        <Suspense fallback={null}>
          <LazyProjectWizard onClose={() => setWizardOpen(false)} />
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
      {clearCanvasConfirm && (
        <Suspense fallback={null}>
          <LazyConfirmDialog
            open
            onClose={() => setClearCanvasConfirm(false)}
            title={t('menu.clearCanvas')}
            message={t('menu.clearCanvasConfirm')}
            actions={[
              {
                label: t('ui.cancel', 'Cancel'),
                variant: 'muted',
                onClick: () => setClearCanvasConfirm(false),
              },
              {
                label: t('menu.clearCanvas'),
                variant: 'danger',
                onClick: handleClearCanvasConfirmed,
              },
            ]}
          />
        </Suspense>
      )}
      {paletteOpen && (
        <Suspense fallback={null}>
          <LazyCommandPalette actions={paletteActions} onClose={() => setPaletteOpen(false)} />
        </Suspense>
      )}
      {llmBuilderOpen && (
        <Suspense fallback={null}>
          <LazyLlmGraphBuilderDialog
            open
            onClose={() => setLlmBuilderOpen(false)}
            projectId={projectId}
            canvasId={canvasId}
            onApplyPatch={onApplyPatch ?? (() => {})}
          />
        </Suspense>
      )}
      {templateManagerOpen && (
        <Suspense fallback={null}>
          <LazyTemplateManagerDialog open onClose={() => setTemplateManagerOpen(false)} />
        </Suspense>
      )}
      {publishWizardOpen && projectId && (
        <Suspense fallback={null}>
          <LazyPublishWizardModal
            open
            projectId={projectId}
            projectName={projectName}
            onClose={() => setPublishWizardOpen(false)}
            onPublished={() => setPublishWizardOpen(false)}
          />
        </Suspense>
      )}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        hasProject={!!projectId}
        exportInProgress={!!exportInProgress}
        onExportPdf={({ includeImages: incImg, scope, pageSize }) => {
          if (scope === 'active') {
            toast(t('pdfExport.generating'), 'info')
            canvasRef.current
              ?.exportPdfAudit()
              .then(() => toast(t('pdfExport.success'), 'success'))
              .catch((err: unknown) => {
                console.error('[pdf-export]', err)
                toast(t('pdfExport.failed'), 'error')
              })
          } else if (onExportPdfProject) {
            toast(t('pdfExport.generatingAll'), 'info')
            onExportPdfProject({ includeImages: incImg, pageSize })
          }
        }}
        onExportXlsx={({ includeTables: incTbl, scope }) => {
          if (scope === 'active') {
            toast(t('excelExport.generating'), 'info')
            canvasRef.current
              ?.exportXlsxAuditActive()
              .then(() => toast(t('excelExport.success'), 'success'))
              .catch((err: unknown) => {
                console.error('[xlsx-export]', err)
                toast(t('excelExport.failed'), 'error')
              })
          } else if (onExportExcelProject) {
            toast(t('excelExport.generatingAll'), 'info')
            onExportExcelProject({ includeTables: incTbl })
          }
        }}
        onExportJson={() => {
          if (onExportChainsolveJson) {
            toast(t('chainsolveJsonExport.generating'), 'info')
            onExportChainsolveJson()
          }
        }}
        onExportGit={() => {
          if (onExportGitFriendly) {
            toast(t('chainsolveJsonExport.generating'), 'info')
            onExportGitFriendly()
          }
        }}
        onCancelExport={onCancelExport}
      />
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** PROJ-02: Show relative time for recent saves; absolute HH:MM for older. */
function fmtRelativeTime(d: Date): string {
  const elapsed = Date.now() - d.getTime()
  const mins = Math.floor(elapsed / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Styles ──────────────────────────────────────────────────────────────────

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

const nameInputStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.82rem',
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

const offlineStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  color: 'var(--danger)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const autosaveToggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  cursor: 'pointer',
  userSelect: 'none',
}

const autosaveLabelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
}

const mobileMenuBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
}

const mobileBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  top: 40,
  background: 'var(--overlay)',
  zIndex: 49,
}

const mobileDrawerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 40,
  right: 0,
  bottom: 0,
  background: 'var(--surface-1)',
  borderLeft: '1px solid var(--border)',
  zIndex: 50,
  overflowY: 'auto',
  padding: '0.5rem 0',
  animation: 'cs-fade-in 0.12s ease-out',
}

const drawerSectionHeaderStyle: React.CSSProperties = {
  padding: '0.35rem 0.75rem 0.2rem',
  fontSize: '0.62rem',
  fontWeight: 700,
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

// ── Mobile drawer helpers ────────────────────────────────────────────────────

function MobileDrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.25rem' }}>
      <div style={drawerSectionHeaderStyle}>{label}</div>
      {children}
    </div>
  )
}

function MobileDrawerItem({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: string
  onClick: () => void
}) {
  return (
    <button className="cs-mobile-drawer-btn" onClick={onClick}>
      <span style={{ width: 18, textAlign: 'center', opacity: 0.5, fontSize: '0.82rem' }}>
        {icon}
      </span>
      {label}
    </button>
  )
}
