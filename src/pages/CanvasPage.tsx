/**
 * CanvasPage — full-page canvas editor with multi-canvas "Sheets" (W10.7).
 *
 * Route: /app/:projectId       (project mode — autosaved to Supabase storage)
 *        /app                 (scratch mode via WorkspacePage — no persistence)
 *
 * Lifecycle:
 *   1. Mount → load project row + canvases list from DB.
 *   2. If legacy (no canvases rows), migrate V3 graph to multi-canvas.
 *   3. Load active canvas graph from per-canvas storage.
 *   4. CanvasArea fires onGraphChange → dirty tracking + debounced autosave.
 *   5. Autosave writes to per-canvas storage + project-level conflict detection.
 *   6. Sheets tab bar (W10.7b) enables switching between canvases.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppHeader } from '../components/app/AppHeader'
import { CONTACT } from '../lib/brand'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import {
  CanvasArea,
  type CanvasAreaProps,
  type CanvasAreaHandle,
} from '../components/canvas/CanvasArea'
import { INITIAL_NODES, INITIAL_EDGES } from '../components/canvas/canvasDefaults'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/registry'
import type { ExportAsset } from '../lib/chainsolvejson/model'
import {
  loadProject,
  saveProject,
  saveProjectWithRetry,
  createProject,
  duplicateProject,
  listProjects,
  renameProject,
  readProjectRow,
  readUpdatedAt,
} from '../lib/projects'
import {
  listCanvases,
  loadCanvasGraph,
  saveCanvasGraph,
  setActiveCanvas,
  migrateProjectToMultiCanvas,
  createCanvas,
  renameCanvas,
  deleteCanvas,
  duplicateCanvas,
  reorderCanvases,
} from '../lib/canvases'
import { useProjectStore } from '../stores/projectStore'
import { useCanvasesStore } from '../stores/canvasesStore'
import { useVariablesStore } from '../stores/variablesStore'
import { usePublishedOutputsStore } from '../stores/publishedOutputsStore'
import { saveVariables } from '../lib/variablesService'
import { supabase } from '../lib/supabase'
import {
  isReadOnly,
  canCreateProject,
  canCreateCanvas,
  showBillingBanner,
  getEntitlements,
  resolveEffectivePlan,
  type Plan,
} from '../lib/entitlements'
import { useSessionGuard } from '../hooks/useSessionGuard'
import { isPerfHudEnabled } from '../lib/devFlags'
import { addRecentProject, removeRecentProject } from '../lib/recentProjects'
import { useToast } from '../components/ui/useToast'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { AutosaveScheduler } from '../lib/autosaveScheduler'
import { usePreferencesStore } from '../stores/preferencesStore'
import { SheetsBar } from '../components/app/SheetsBar'
import { TiledCanvasLayout } from '../components/canvas/TiledCanvasLayout'
const LazyAiDockPanel = lazy(() =>
  import('../components/app/AiDockPanel').then((m) => ({ default: m.AiDockPanel })),
)
import { ConflictBanner } from '../components/app/ConflictBanner'
import { UpgradeModal } from '../components/UpgradeModal'
import { useEngine } from '../contexts/EngineContext'
import { useWindowManager } from '../contexts/WindowManagerContext'
import { THEME_LIBRARY_WINDOW_ID, THEME_WIZARD_WINDOW_ID } from '../components/windowIds'
import { AI_COPILOT_WINDOW_ID } from '../lib/aiCopilot/constants'
import type { AiPatchOp } from '../lib/aiCopilot/types'
import { buildConstantsLookup } from '../engine/resolveBindings'
import { toEngineSnapshot } from '../engine/bridge'
import {
  buildCanvasAuditSection,
  buildProjectAuditModel,
  type ExportOptions,
} from '../lib/pdf/auditModel'
import { getCanonicalSnapshot } from '../lib/groups'
import { stableStringify } from '../lib/pdf/stableStringify'
import { sha256Hex } from '../lib/pdf/sha256'
import { computeGraphHealth, formatHealthReport } from '../lib/graphHealth'
import { BUILD_VERSION, BUILD_SHA, BUILD_TIME, BUILD_ENV } from '../lib/build-info'
import { listProjectAssets, downloadAssetBytes } from '../lib/storage'
import { addBreadcrumb, captureReactBoundary } from '../observability/client'
import { validateProjectName } from '../lib/validateProjectName'
import type { CaptureResult } from '../lib/pdf/captureCanvasImage'
import type { TableExport } from '../lib/xlsx/xlsxModel'
import { useStatusBarStore } from '../stores/statusBarStore'

const PerfHud = lazy(() =>
  import('../components/PerfHud.tsx').then((m) => ({ default: m.PerfHud })),
)
const LazyImportProjectDialog = lazy(() =>
  import('../components/app/ImportProjectDialog').then((m) => ({
    default: m.ImportProjectDialog,
  })),
)
const LazyVariablesPanel = lazy(() =>
  import('../components/canvas/VariablesPanel').then((m) => ({ default: m.VariablesPanel })),
)
const LazyTemplateManagerDialog = lazy(() =>
  import('../components/canvas/TemplateManagerDialog').then((m) => ({
    default: m.TemplateManagerDialog,
  })),
)
const LazyMaterialWizard = lazy(() =>
  import('../components/canvas/MaterialWizard').then((m) => ({ default: m.MaterialWizard })),
)
const LazyThemeLibraryWindow = lazy(() =>
  import('../components/ThemeLibraryWindow').then((m) => ({ default: m.ThemeLibraryWindow })),
)
const LazyThemeWizard = lazy(() =>
  import('../components/ThemeWizard').then((m) => ({ default: m.ThemeWizard })),
)
const LazyAiCopilotWindow = lazy(() =>
  import('../components/app/AiCopilotWindow').then((m) => ({ default: m.AiCopilotWindow })),
)

const LazySessionRevokedModal = lazy(() =>
  import('../components/ui/SessionRevokedModal').then((m) => ({
    default: m.SessionRevokedModal,
  })),
)

const EXPORT_SETTLE_MS = 300
const OFFLINE_RETRY_DELAYS = [3_000, 6_000, 12_000, 24_000, 60_000]

/** Controls exposed by CanvasPage to the parent WorkspacePage toolbar. */
export interface CanvasControls {
  projectName: string | null
  saveStatus: string
  saveProgress: number
  isDirty: boolean
  autosaveEnabled: boolean
  save: () => void
  saveAs: (name: string) => Promise<void>
  undo: () => void
  redo: () => void
  startNameEdit: () => void
  toggleAutosave: () => void
}

interface CanvasPageProps {
  /** When true, skip rendering AppHeader (WorkspacePage provides the shell). */
  embedded?: boolean
  /** Callback fired when canvas controls are ready or updated (embedded mode). */
  onControlsReady?: (controls: CanvasControls | null) => void
}

export default function CanvasPage({ embedded, onControlsReady }: CanvasPageProps = {}) {
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()
  const engine = useEngine()
  const { openWindow, isOpen } = useWindowManager()

  // ── Project store selectors ────────────────────────────────────────────────
  const saveStatus = useProjectStore((s) => s.saveStatus)
  const saveProgress = useProjectStore((s) => s.saveProgress)
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)
  const projectName = useProjectStore((s) => s.projectName)
  const isDirty = useProjectStore((s) => s.isDirty)
  const autosaveEnabled = usePreferencesStore((s) => s.autosaveEnabled)
  const updatePrefs = usePreferencesStore((s) => s.update)

  const beginLoad = useProjectStore((s) => s.beginLoad)
  const markDirty = useProjectStore((s) => s.markDirty)
  const setSaveProgress = useProjectStore((s) => s.setSaveProgress)
  const beginSave = useProjectStore((s) => s.beginSave)
  const completeSave = useProjectStore((s) => s.completeSave)
  const failSave = useProjectStore((s) => s.failSave)
  const queueOffline = useProjectStore((s) => s.queueOffline)
  const detectConflict = useProjectStore((s) => s.detectConflict)
  const recoverStuckSave = useProjectStore((s) => s.recoverStuckSave)
  const setStoreName = useProjectStore((s) => s.setProjectName)
  const resetProject = useProjectStore((s) => s.reset)

  // ── Canvases store selectors ───────────────────────────────────────────────
  const canvases = useCanvasesStore((s) => s.canvases)
  const activeCanvasId = useCanvasesStore((s) => s.activeCanvasId)
  const setCanvases = useCanvasesStore((s) => s.setCanvases)
  const setActiveCanvasId = useCanvasesStore((s) => s.setActiveCanvasId)
  const addCanvasToStore = useCanvasesStore((s) => s.addCanvas)
  const removeCanvasFromStore = useCanvasesStore((s) => s.removeCanvas)
  const updateCanvasInStore = useCanvasesStore((s) => s.updateCanvas)
  const markCanvasDirty = useCanvasesStore((s) => s.markCanvasDirty)
  const markCanvasClean = useCanvasesStore((s) => s.markCanvasClean)
  const dirtyCanvasIds = useCanvasesStore((s) => s.dirtyCanvasIds)
  const viewMode = useCanvasesStore((s) => s.viewMode)
  const secondaryCanvasId = useCanvasesStore((s) => s.secondaryCanvasId)
  const setViewMode = useCanvasesStore((s) => s.setViewMode)
  const setSecondaryCanvasId = useCanvasesStore((s) => s.setSecondaryCanvasId)
  const resetCanvases = useCanvasesStore((s) => s.reset)

  // ── Variables store selectors ──────────────────────────────────────────────
  const loadVariablesStore = useVariablesStore((s) => s.load)
  const resetVariables = useVariablesStore((s) => s.reset)
  const markVariablesClean = useVariablesStore((s) => s.markClean)

  // ── Published outputs store (H7-1) ──────────────────────────────────────
  const resetPublishedOutputs = usePublishedOutputsStore((s) => s.reset)

  // ── Network status ─────────────────────────────────────────────────────────
  const { isOnline } = useNetworkStatus()

  // ── Plan awareness + auth state ────────────────────────────────────────────
  const [plan, setPlan] = useState<Plan>('free')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  // L3-1: Session revoked detection (poll + BroadcastChannel + visibility)
  // Skip when embedded (WorkspacePage handles session guard) or for developers
  const { sessionRevoked } = useSessionGuard({ skip: embedded })

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setIsAuthenticated(!!session)
      if (!session) return
      supabase
        .from('profiles')
        .select('email,plan,is_developer,is_admin,is_student')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data?.plan) {
            const row = data as {
              email?: string | null
              plan: Plan
              is_developer?: boolean
              is_admin?: boolean
              is_student?: boolean
            }
            setPlan(resolveEffectivePlan(row))
          }
        })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const readOnly = isReadOnly(plan) && !!projectId
  const bannerKind = showBillingBanner(plan)

  // ── Load state ──────────────────────────────────────────────────────────────
  const [loadPhase, setLoadPhase] = useState<'loading' | 'ready' | 'error'>(
    projectId ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [canvasLoadWarning, setCanvasLoadWarning] = useState<string | null>(null)
  const [loadRetryCount, setLoadRetryCount] = useState(0)
  const [initNodes, setInitNodes] = useState<Node<NodeData>[] | undefined>()
  const [initEdges, setInitEdges] = useState<Edge[] | undefined>()

  // ── L4-1: Scratch mode state ──────────────────────────────────────────────
  /** Tracks whether the user has modified the scratch canvas (for beforeunload). */
  const scratchDirtyRef = useRef(false)
  /** Bridges Ctrl+S in scratch mode → AppHeader Save-As dialog. */
  const [saveAsRequested, setSaveAsRequested] = useState(false)

  // ── Autosave / conflict refs ───────────────────────────────────────────────
  // doSaveRef holds the latest doSave callback so the scheduler can call it
  // without needing to be recreated when doSave's deps change.
  const doSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const autosaveScheduler = useRef(new AutosaveScheduler(() => void doSaveRef.current()))
  const canvasRef = useRef<CanvasAreaHandle>(null)
  const isSaving = useRef(false)
  const conflictServerTs = useRef<string | null>(null)
  const offlineRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const offlineRetryCount = useRef(0)
  // BUG-10: tracks which canvasId is currently being loaded so rapid tab
  // switching discards out-of-order resolved promises.
  const loadingCanvasRef = useRef<string | null>(null)

  // ── K1-1: Secondary canvas state for tiled mode ──────────────────────────
  const secondaryCanvasRef = useRef<CanvasAreaHandle>(null)
  const [secondaryNodes, setSecondaryNodes] = useState<Node<NodeData>[]>([])
  const [secondaryEdges, setSecondaryEdges] = useState<Edge[]>([])
  const [focusedCanvasId, setFocusedCanvasId] = useState<string | null>(null)
  const primaryPaneRef = useRef<HTMLDivElement>(null)
  const secondaryPaneRef = useRef<HTMLDivElement>(null)

  // K1-1: Track pane states (minimize/maximize) by canvas ID
  const [paneStates, setPaneStates] = useState<
    Record<string, 'normal' | 'minimized' | 'maximized'>
  >({})

  // ── Export state ──────────────────────────────────────────────────────────
  const exportingRef = useRef(false)
  const exportAbortRef = useRef<AbortController | null>(null)
  const [exportInProgress, setExportInProgress] = useState(false)

  const constantsLookup = useMemo(
    () => buildConstantsLookup(engine.constantValues),
    [engine.constantValues],
  )

  // ── Artifact panel state (D15-3) ──────────────────────────────────────────
  const [variablesPanelOpen, setVariablesPanelOpen] = useState(false)
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const [materialWizardOpen, setMaterialWizardOpen] = useState(false)

  // ── Inline project name editing ────────────────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // ── Flush pending autosave before navigating away (beforeunload) ──────────
  useEffect(() => {
    const handler = () => {
      // Best-effort flush: cancel the debounce and fire save immediately.
      // navigator.sendBeacon is not suitable for complex saves, so we rely on
      // the autosave scheduler being recent enough (2s debounce).
      if (autosaveScheduler.current.hasPending()) {
        autosaveScheduler.current.cancel()
        void doSaveRef.current()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ── Load project + canvases on mount ───────────────────────────────────────
  useEffect(() => {
    // Flush any pending autosave from the previous project before resetting
    if (autosaveScheduler.current.hasPending()) {
      autosaveScheduler.current.cancel()
      void doSaveRef.current()
    }

    resetProject()
    resetCanvases()
    resetVariables()
    resetPublishedOutputs()
    conflictServerTs.current = null
    scratchDirtyRef.current = false

    if (!projectId) {
      setLoadPhase('ready')
      return
    }

    setLoadPhase('loading')
    setLoadError(null)
    setCanvasLoadWarning(null)

    // Guard against stale async updates when projectId changes mid-load
    let cancelled = false

    async function load() {
      try {
        addBreadcrumb('canvas_load_start', { projectId: projectId! })

        // 1. Load project row + legacy project.json in parallel
        const [row, pj] = await Promise.all([readProjectRow(projectId!), loadProject(projectId!)])
        if (cancelled) return

        const dbUpdatedAt = row?.updated_at ?? pj.updatedAt
        const dbName = row?.name ?? pj.project.name
        beginLoad(projectId!, dbName, dbUpdatedAt, pj.formatVersion, pj.createdAt)
        addRecentProject(projectId!, dbName)

        // W12.2: Load project-level variables
        loadVariablesStore(row?.variables ?? {})

        // 2. Load canvases list
        let canvasList = await listCanvases(projectId!)
        if (cancelled) return

        // 3. If no canvases exist, migrate legacy V3 graph
        if (canvasList.length === 0) {
          await migrateProjectToMultiCanvas(projectId!, pj.graph.nodes, pj.graph.edges)
          canvasList = await listCanvases(projectId!)
          if (cancelled) return
        }

        setCanvases(canvasList)

        // 4. Determine active canvas
        let activeId = row?.active_canvas_id ?? null
        if (!activeId || !canvasList.find((c) => c.id === activeId)) {
          activeId = canvasList[0]?.id ?? null
          if (activeId) {
            const freshTs = await setActiveCanvas(projectId!, activeId)
            if (cancelled) return
            completeSave(freshTs)
          }
        }

        if (activeId) {
          setActiveCanvasId(activeId)

          // 5. Load active canvas graph — isolated try/catch so a corrupt or
          //    missing canvas file degrades gracefully to an empty canvas rather
          //    than crashing the entire project load.
          try {
            const canvasGraph = await loadCanvasGraph(projectId!, activeId)
            if (cancelled) return
            setInitNodes(canvasGraph.nodes as Node<NodeData>[])
            setInitEdges(canvasGraph.edges as Edge[])

            // Warn if canvas loaded empty but legacy project.json had content —
            // indicates a storage persistence issue.
            if (
              canvasGraph.nodes.length === 0 &&
              canvasGraph.edges.length === 0 &&
              pj.graph.nodes.length > 0
            ) {
              setCanvasLoadWarning(
                t('canvas.loadedEmptyWarning', 'Canvas loaded empty — the saved data may be missing'),
              )
            } else {
              addBreadcrumb('canvas_load_success', {
                projectId: projectId!,
                canvasId: activeId,
                nodeCount: String(canvasGraph.nodes.length),
              })
            }
          } catch (canvasErr: unknown) {
            if (cancelled) return
            const canvasMsg =
              canvasErr instanceof Error ? canvasErr.message : 'Canvas data could not be loaded'
            // Log to observability pipeline
            captureReactBoundary(
              canvasErr instanceof Error ? canvasErr : new Error(canvasMsg),
              `canvas_load projectId=${projectId!} canvasId=${activeId}`,
            )
            addBreadcrumb('canvas_load_error', {
              projectId: projectId!,
              canvasId: activeId,
              error: canvasMsg.slice(0, 120),
            })
            // Fall back to empty canvas — other canvases remain accessible
            setInitNodes([])
            setInitEdges([])
            setCanvasLoadWarning(
              t(
                'canvas.canvasLoadFailed',
                'Canvas data could not be loaded — starting with an empty canvas. Other sheets are unaffected.',
              ),
            )
          }
        } else {
          setInitNodes([])
          setInitEdges([])
        }

        setLoadPhase('ready')
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Failed to load project'
        // Remove stale MRU entry when the project no longer exists
        if (projectId && /not found/i.test(msg)) {
          removeRecentProject(projectId)
        }
        // Log to observability pipeline
        captureReactBoundary(
          err instanceof Error ? err : new Error(msg),
          `project_load projectId=${projectId!}`,
        )
        addBreadcrumb('project_load_error', {
          projectId: projectId!,
          error: msg.slice(0, 120),
        })
        setLoadError(msg)
        setLoadPhase('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, loadRetryCount])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    const scheduler = autosaveScheduler.current
    return () => {
      scheduler.cancel()
      if (offlineRetryTimer.current) clearTimeout(offlineRetryTimer.current)
    }
  }, [])

  // ── Core save function ──────────────────────────────────────────────────────
  // Saves to both per-canvas storage and project-level conflict detection.
  const doSave = useCallback(
    async (opts?: { forceKnownUpdatedAt?: string; manual?: boolean }) => {
      if (!projectId || isSaving.current) return

      const snapshot = canvasRef.current?.getSnapshot()
      if (!snapshot) return

      const state = useProjectStore.getState()
      const canvasesState = useCanvasesStore.getState()
      const knownUpdatedAt = opts?.forceKnownUpdatedAt ?? state.dbUpdatedAt
      if (!knownUpdatedAt) return

      isSaving.current = true
      beginSave()
      setSaveProgress(0.1)

      try {
        // E8-1: Conflict check BEFORE any writes.
        // saveVariables() bumps projects.updated_at, so checking after it
        // would cause false "open in another session" conflicts.
        if (!opts?.forceKnownUpdatedAt) {
          const dbTs = await readUpdatedAt(projectId)
          if (dbTs && new Date(dbTs) > new Date(knownUpdatedAt)) {
            conflictServerTs.current = dbTs
            detectConflict()
            isSaving.current = false
            return
          }
        }
        setSaveProgress(0.3)

        // W12.2: Save variables if dirty
        const varsState = useVariablesStore.getState()
        if (varsState.isDirty) {
          await saveVariables(projectId, varsState.variables)
          markVariablesClean()
        }

        // Save to per-canvas storage if the active canvas still exists in the store.
        // Guard: skip if the canvas was deleted (prevents orphaned storage blobs).
        const currentCanvasId = canvasesState.activeCanvasId
        const canvasExists = canvasesState.canvases.some((c) => c.id === currentCanvasId)
        if (currentCanvasId && canvasExists) {
          await saveCanvasGraph(projectId, currentCanvasId, snapshot.nodes, snapshot.edges, {
            verify: opts?.manual,
          })
          markCanvasClean(currentCanvasId)
        }
        setSaveProgress(0.5)

        // K1-1: Also save secondary canvas if in tiled mode and dirty
        const secId = canvasesState.secondaryCanvasId
        if (
          canvasesState.viewMode !== 'fullscreen' &&
          secId &&
          canvasesState.dirtyCanvasIds.has(secId) &&
          secondaryCanvasRef.current
        ) {
          const secSnap = secondaryCanvasRef.current.getSnapshot()
          const secExists = canvasesState.canvases.some((c) => c.id === secId)
          if (secExists) {
            await saveCanvasGraph(projectId, secId, secSnap.nodes, secSnap.edges)
            markCanvasClean(secId)
          }
        }
        setSaveProgress(0.7)

        // Save to project.json with automatic retry on transient errors
        const result = await saveProjectWithRetry(
          projectId,
          state.projectName,
          snapshot.nodes,
          snapshot.edges,
          knownUpdatedAt,
          {
            formatVersion: state.formatVersion,
            createdAt: state.createdAt ?? new Date().toISOString(),
          },
          true, // skipConflictCheck: already checked before writes
        )
        setSaveProgress(0.9)

        // Conflict should not trigger here since we checked above, but
        // handle it defensively in case of a concurrent write between
        // our check and the saveProject write.
        if (result.conflict) {
          conflictServerTs.current = result.updatedAt
          detectConflict()
        } else {
          conflictServerTs.current = null
          // Clear offline retry state on successful save
          if (offlineRetryTimer.current) clearTimeout(offlineRetryTimer.current)
          offlineRetryCount.current = 0
          completeSave(result.updatedAt)
          if (opts?.manual) {
            toast(t('canvas.projectSaved', 'Project saved'), 'success')
          }
        }
      } catch (err: unknown) {
        if (!navigator.onLine) {
          // Offline — queue for retry using exponential backoff
          queueOffline()
          if (offlineRetryTimer.current) clearTimeout(offlineRetryTimer.current)
          const delay =
            OFFLINE_RETRY_DELAYS[
              Math.min(offlineRetryCount.current, OFFLINE_RETRY_DELAYS.length - 1)
            ]
          offlineRetryTimer.current = setTimeout(() => {
            offlineRetryCount.current++
            void doSave()
          }, delay)
          // Only toast on the first failure (not on each retry)
          if (offlineRetryCount.current === 0) {
            toast(t('canvas.offlineQueued'), 'info', {
              label: t('canvas.retryNow'),
              onClick: () => {
                if (offlineRetryTimer.current) clearTimeout(offlineRetryTimer.current)
                void doSave()
              },
            })
          }
        } else {
          // Network is up but save failed — clear retry state and report error
          if (offlineRetryTimer.current) clearTimeout(offlineRetryTimer.current)
          offlineRetryCount.current = 0
          const errMsg = err instanceof Error ? err.message : 'Save failed'
          failSave(errMsg)
          toast(t('canvas.saveFailed', 'Save failed — your changes may not be saved'), 'error', {
            label: t('canvas.retryNow'),
            onClick: () => void doSave(),
          })
        }
      } finally {
        isSaving.current = false
      }
    },
    [
      projectId,
      setSaveProgress,
      beginSave,
      completeSave,
      failSave,
      queueOffline,
      detectConflict,
      markCanvasClean,
      markVariablesClean,
      toast,
      t,
    ],
  )

  // Keep the stable ref in sync so the scheduler always calls the latest doSave
  doSaveRef.current = doSave

  // ── Auto-retry when connection is restored ─────────────────────────────────
  useEffect(() => {
    if (!isOnline) return
    if (useProjectStore.getState().saveStatus !== 'offline-queued') return
    // Back online — clear the backoff timer and retry immediately
    if (offlineRetryTimer.current) clearTimeout(offlineRetryTimer.current)
    void doSave()
    toast(t('canvas.backOnline'), 'success')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // ── E8-2: Stuck-save watchdog — recover if save stays in 'saving' too long ─
  useEffect(() => {
    if (saveStatus !== 'saving') return
    const timer = setTimeout(() => recoverStuckSave(), 30_000) // 30 s
    return () => clearTimeout(timer)
  }, [saveStatus, recoverStuckSave])

  // ── onGraphChange — dirty tracking + debounced autosave ────────────────────
  const handleGraphChange: NonNullable<CanvasAreaProps['onGraphChange']> = useCallback(() => {
    // Suppress dirty/autosave during export canvas switching
    if (exportingRef.current) return
    markDirty()
    const currentCanvasId = useCanvasesStore.getState().activeCanvasId
    if (currentCanvasId) markCanvasDirty(currentCanvasId)
    // D8-1: autosave gated by user preference (default OFF)
    if (!readOnly && usePreferencesStore.getState().autosaveEnabled) {
      autosaveScheduler.current.schedule()
    }
  }, [markDirty, markCanvasDirty, readOnly])

  // L4-1: Lightweight graph change handler for scratch mode (tracks hasContent).
  const handleScratchGraphChange: NonNullable<CanvasAreaProps['onGraphChange']> =
    useCallback(() => {
      scratchDirtyRef.current = true
    }, [])

  // ── Flush save on tab close / refresh (best-effort) ────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // L4-1: Also warn when leaving scratch canvas with unsaved content
      const projectDirty = useProjectStore.getState().isDirty && !!projectId
      const scratchDirty = !projectId && scratchDirtyRef.current
      if (!projectDirty && !scratchDirty) return
      if (projectDirty) void doSave()
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [projectId, doSave])

  // ── Ctrl+S / Cmd+S → immediate save or Save-As in scratch mode ────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (projectId && !readOnly) void doSave({ manual: true })
        else if (!projectId && !readOnly) setSaveAsRequested(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [projectId, readOnly, doSave])

  // ── Route-leave: save before navigating back to /app ──────────────────────
  // ── Inline project name editing ────────────────────────────────────────────
  const startNameEdit = useCallback(() => {
    setNameInput(useProjectStore.getState().projectName)
    setNameEditing(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }, [])

  const commitNameEdit = useCallback(async () => {
    setNameEditing(false)
    const trimmed = nameInput.trim()
    const current = useProjectStore.getState().projectName
    if (!trimmed || !projectId || trimmed === current) return
    const validation = validateProjectName(trimmed)
    if (!validation.ok) {
      toast(validation.error ?? t('canvas.invalidProjectName', 'Invalid project name'), 'error')
      return
    }
    try {
      // renameProject updates projects.name which bumps projects.updated_at
      // via trigger — sync the timestamp to avoid false conflicts.
      const freshUpdatedAt = await renameProject(projectId, trimmed)
      setStoreName(trimmed)
      completeSave(freshUpdatedAt)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rename failed'
      toast(msg, 'error')
      // Revert displayed name to what's in the store
      setNameInput(useProjectStore.getState().projectName)
    }
  }, [nameInput, projectId, setStoreName, completeSave, toast, t])

  // ── Conflict resolution ─────────────────────────────────────────────────────
  const handleOverwrite = useCallback(() => {
    const serverTs = conflictServerTs.current
    if (!serverTs) return
    void doSave({ forceKnownUpdatedAt: serverTs })
  }, [doSave])

  const handleReload = useCallback(() => {
    window.location.reload()
  }, [])

  // ── Project operations (for AppHeader File menu) ──────────────────────────
  const handleNewProject = useCallback(async () => {
    try {
      const projects = await listProjects()
      if (!canCreateProject(plan, projects.length)) {
        toast(t('project.limitReached'), 'error')
        return
      }
      const proj = await createProject('Untitled project')
      navigate(`/app/${proj.id}`)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to create project', 'error')
    }
  }, [plan, navigate, toast, t])

  const handleOpenProject = useCallback(
    async (id: string) => {
      navigate(`/app/${id}`)
    },
    [navigate],
  )

  const handleSaveAs = useCallback(
    async (name: string) => {
      try {
        if (projectId) {
          const proj = await duplicateProject(projectId, name)
          addRecentProject(proj.id, proj.name)
          navigate(`/app/${proj.id}`)
        } else {
          // Scratch canvas → create new project with current graph.
          // Require authentication — prompt login if not signed in.
          if (isAuthenticated === false) {
            toast(t('canvas.signInToSave'), 'info')
            navigate('/login')
            return
          }
          const snapshot = canvasRef.current?.getSnapshot()
          if (!snapshot) return
          const proj = await createProject(name)
          await saveProject(proj.id, name, snapshot.nodes, snapshot.edges, proj.updated_at, {
            formatVersion: 1,
            createdAt: proj.created_at,
          })
          addRecentProject(proj.id, proj.name)
          navigate(`/app/${proj.id}`)
        }
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to save copy', 'error')
        throw err
      }
    },
    [projectId, navigate, toast, isAuthenticated, t],
  )

  // ── Publish controls to parent (Phase M) ────────────────────────────────────
  useEffect(() => {
    if (!embedded || !onControlsReady) return
    onControlsReady({
      projectName: projectName ?? null,
      saveStatus,
      saveProgress,
      isDirty,
      autosaveEnabled,
      save: () => void doSave({ manual: true }),
      saveAs: handleSaveAs,
      undo: () => canvasRef.current?.undo(),
      redo: () => canvasRef.current?.redo(),
      startNameEdit,
      toggleAutosave: () => updatePrefs({ autosaveEnabled: !autosaveEnabled }),
    })
    return () => onControlsReady(null)
  }, [
    embedded,
    onControlsReady,
    projectName,
    saveStatus,
    saveProgress,
    isDirty,
    autosaveEnabled,
    doSave,
    handleSaveAs,
    startNameEdit,
    updatePrefs,
  ])

  // ── Sheet / canvas operations ──────────────────────────────────────────────

  const handleSwitchCanvas = useCallback(
    async (canvasId: string) => {
      if (!projectId || canvasId === activeCanvasId) return

      // Cancel any pending autosave for the current canvas — we save explicitly below
      autosaveScheduler.current.cancel()

      // Save current canvas if dirty before switching — abort on failure to prevent data loss
      const canvasIsDirty =
        useProjectStore.getState().isDirty ||
        useCanvasesStore.getState().dirtyCanvasIds.has(activeCanvasId ?? '')
      if (canvasIsDirty) {
        try {
          await doSave()
        } catch {
          toast(
            t('canvas.saveBeforeSwitchFailed', 'Could not save current sheet. Please try again.'),
            'error',
          )
          return
        }
      }

      // Record which canvas we are loading — rapid switching will cancel stale resolves
      loadingCanvasRef.current = canvasId
      try {
        // Load the target canvas graph
        const canvasGraph = await loadCanvasGraph(projectId, canvasId)
        // Discard result if the user switched to a different tab while loading
        if (loadingCanvasRef.current !== canvasId) return
        // setActiveCanvas updates projects.active_canvas_id which bumps
        // projects.updated_at via trigger. We must capture the fresh timestamp
        // to keep the optimistic-lock reference in sync and avoid false conflicts.
        const freshUpdatedAt = await setActiveCanvas(projectId, canvasId)
        if (loadingCanvasRef.current !== canvasId) return
        // Set init data BEFORE changing activeCanvasId so that when CanvasArea
        // remounts (key={activeCanvasId}), it picks up the correct graph data
        // in a single render batch — preventing a flash of stale data.
        setInitNodes(canvasGraph.nodes as Node<NodeData>[])
        setInitEdges(canvasGraph.edges as Edge[])
        setActiveCanvasId(canvasId)
        // Sync store with the DB timestamp (includes the bump from setActiveCanvas)
        completeSave(freshUpdatedAt)
      } catch (err: unknown) {
        if (loadingCanvasRef.current === canvasId) {
          toast(err instanceof Error ? err.message : 'Failed to switch canvas', 'error')
        }
      }
    },
    [projectId, activeCanvasId, doSave, setActiveCanvasId, completeSave, toast, t],
  )

  const handleCreateCanvas = useCallback(async () => {
    if (!projectId) return
    if (!canCreateCanvas(plan, canvases.length)) {
      setUpgradeCanvasOpen(true)
      return
    }
    try {
      // Auto-increment name to avoid duplicates
      const existingNames = new Set(canvases.map((c) => c.name.toLowerCase()))
      let name = `Sheet ${canvases.length + 1}`
      if (existingNames.has(name.toLowerCase())) {
        for (let i = canvases.length + 2; i <= canvases.length + 100; i++) {
          name = `Sheet ${i}`
          if (!existingNames.has(name.toLowerCase())) break
        }
      }
      const row = await createCanvas(projectId, name)
      addCanvasToStore(row)
      // Switch to new canvas
      await handleSwitchCanvas(row.id)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to create sheet', 'error')
    }
  }, [projectId, plan, canvases, toast, addCanvasToStore, handleSwitchCanvas])

  const handleRenameCanvas = useCallback(
    async (canvasId: string, newName: string) => {
      if (!projectId) return
      try {
        await renameCanvas(canvasId, projectId, newName)
        updateCanvasInStore(canvasId, { name: newName })
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to rename sheet', 'error')
      }
    },
    [projectId, updateCanvasInStore, toast],
  )

  const handleDeleteCanvas = useCallback(
    async (canvasId: string) => {
      if (!projectId) return
      // Enforce at least one canvas
      if (canvases.length <= 1) {
        toast(t('sheets.cannotDeleteLast'), 'error')
        return
      }
      try {
        await deleteCanvas(canvasId, projectId)
        removeCanvasFromStore(canvasId)

        // If we deleted the active canvas, switch to the first remaining
        if (canvasId === activeCanvasId) {
          const remaining = useCanvasesStore.getState().canvases
          if (remaining.length > 0) {
            await handleSwitchCanvas(remaining[0].id)
          }
        }
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to delete sheet', 'error')
      }
    },
    [
      projectId,
      canvases.length,
      activeCanvasId,
      toast,
      t,
      removeCanvasFromStore,
      handleSwitchCanvas,
    ],
  )

  const handleDuplicateCanvas = useCallback(
    async (canvasId: string) => {
      if (!projectId) return
      if (!canCreateCanvas(plan, canvases.length)) {
        setUpgradeCanvasOpen(true)
        return
      }
      try {
        const source = canvases.find((c) => c.id === canvasId)
        const newName = `${source?.name ?? 'Sheet'} (copy)`
        const row = await duplicateCanvas(projectId, canvasId, newName)
        addCanvasToStore(row)
        await handleSwitchCanvas(row.id)
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to duplicate sheet', 'error')
      }
    },
    [projectId, plan, canvases, toast, addCanvasToStore, handleSwitchCanvas],
  )

  const handleReorderCanvases = useCallback(
    async (orderedIds: string[]) => {
      if (!projectId) return
      // E8-2: Save previous state for rollback on failure
      const prevCanvases = [...canvases]
      // Optimistic local update
      const reordered = orderedIds
        .map((id, i) => {
          const c = canvases.find((cv) => cv.id === id)
          return c ? { ...c, position: i } : null
        })
        .filter(Boolean) as typeof canvases
      setCanvases(reordered)
      try {
        await reorderCanvases(projectId, orderedIds)
      } catch (err: unknown) {
        // E8-2: Rollback to previous order on failure
        setCanvases(prevCanvases)
        toast(err instanceof Error ? err.message : 'Failed to reorder sheets', 'error')
      }
    },
    [projectId, canvases, setCanvases, toast],
  )

  // ── K1-1: Tiled view mode handlers ─────────────────────────────────────────

  // Load secondary canvas graph when entering tiled mode or switching secondary sheet
  useEffect(() => {
    if (viewMode === 'fullscreen' || !secondaryCanvasId || !projectId) return
    let cancelled = false
    void loadCanvasGraph(projectId, secondaryCanvasId).then((graph) => {
      if (cancelled) return
      setSecondaryNodes((graph.nodes ?? []) as Node<NodeData>[])
      setSecondaryEdges((graph.edges ?? []) as Edge[])
    })
    return () => {
      cancelled = true
    }
  }, [viewMode, secondaryCanvasId, projectId])

  // When the active canvas changes, set focused pane if not already set
  useEffect(() => {
    if (activeCanvasId && !focusedCanvasId) {
      setFocusedCanvasId(activeCanvasId)
    }
  }, [activeCanvasId, focusedCanvasId])

  const handleSetViewMode = useCallback(
    (mode: import('../stores/canvasesStore').ViewMode) => {
      if (mode === viewMode) return

      // Save secondary pane before exiting tiled mode
      if (mode === 'fullscreen' && viewMode !== 'fullscreen' && secondaryCanvasId && projectId) {
        const snap = secondaryCanvasRef.current?.getSnapshot()
        if (snap) {
          void saveCanvasGraph(projectId, secondaryCanvasId, snap.nodes, snap.edges)
          markCanvasClean(secondaryCanvasId)
        }
      }

      setViewMode(mode)
      setPaneStates({})

      // When entering tiled mode, auto-pick secondary canvas
      if (mode !== 'fullscreen' && !secondaryCanvasId) {
        const other = canvases.find((c) => c.id !== activeCanvasId)
        if (other) setSecondaryCanvasId(other.id)
      }
    },
    [
      viewMode,
      secondaryCanvasId,
      projectId,
      activeCanvasId,
      canvases,
      setViewMode,
      setSecondaryCanvasId,
      markCanvasClean,
    ],
  )

  const handleSecondaryGraphChange: NonNullable<CanvasAreaProps['onGraphChange']> =
    useCallback(() => {
      if (exportingRef.current) return
      markDirty()
      const secId = useCanvasesStore.getState().secondaryCanvasId
      if (secId) markCanvasDirty(secId)
      if (!readOnly && usePreferencesStore.getState().autosaveEnabled) {
        autosaveScheduler.current.schedule()
      }
    }, [markDirty, markCanvasDirty, readOnly])

  const handleToggleMinimize = useCallback((canvasId: string) => {
    setPaneStates((prev) => ({
      ...prev,
      [canvasId]: prev[canvasId] === 'minimized' ? 'normal' : 'minimized',
    }))
  }, [])

  const handleToggleMaximize = useCallback((canvasId: string) => {
    setPaneStates((prev) => ({
      ...prev,
      [canvasId]: prev[canvasId] === 'maximized' ? 'normal' : 'maximized',
    }))
  }, [])

  const handleClosePane = useCallback(() => {
    // Exit tiled mode → fullscreen on the focused canvas
    if (focusedCanvasId && focusedCanvasId !== activeCanvasId) {
      // If user was focused on secondary, switch active to it
      void handleSwitchCanvas(focusedCanvasId)
    }
    handleSetViewMode('fullscreen')
  }, [focusedCanvasId, activeCanvasId, handleSwitchCanvas, handleSetViewMode])

  // K1-1: Cross-sheet node transfer (drag block from one pane to another)
  const handleNodeDragStop = useCallback(
    (sourceCanvasId: string) => (event: React.MouseEvent) => {
      if (viewMode === 'fullscreen') return

      // Determine which pane the mouse landed in
      const targetCanvasId = sourceCanvasId === activeCanvasId ? secondaryCanvasId : activeCanvasId
      if (!targetCanvasId) return

      const targetPaneEl =
        sourceCanvasId === activeCanvasId ? secondaryPaneRef.current : primaryPaneRef.current
      if (!targetPaneEl) return

      const rect = targetPaneEl.getBoundingClientRect()
      const { clientX, clientY } = event
      const inTarget =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      if (!inTarget) return

      // Get source and target refs
      const sourceRef = sourceCanvasId === activeCanvasId ? canvasRef : secondaryCanvasRef
      const targetRef = sourceCanvasId === activeCanvasId ? secondaryCanvasRef : canvasRef
      if (!sourceRef.current || !targetRef.current) return

      const sourceSnap = sourceRef.current.getSnapshot()
      const targetSnap = targetRef.current.getSnapshot()

      // Transfer selected nodes
      const selectedNodes = sourceSnap.nodes.filter((n) => n.selected)
      if (selectedNodes.length === 0) return

      const nodeIdSet = new Set(selectedNodes.map((n) => n.id))

      // Internal edges (both endpoints in transfer set) move with nodes
      const internalEdges = sourceSnap.edges.filter(
        (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target),
      )

      // Remove transferred nodes and all connected edges from source
      const remainingNodes = sourceSnap.nodes.filter((n) => !nodeIdSet.has(n.id))
      const remainingEdges = sourceSnap.edges.filter(
        (e) => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target),
      )

      // Remap IDs to avoid collisions in target
      const existingTargetIds = new Set(targetSnap.nodes.map((n) => n.id))
      let nextId = Math.max(0, ...targetSnap.nodes.map((n) => parseInt(n.id) || 0)) + 1
      const idMap = new Map<string, string>()
      for (const n of selectedNodes) {
        if (existingTargetIds.has(n.id)) {
          let newId = String(nextId++)
          while (existingTargetIds.has(newId)) newId = String(nextId++)
          idMap.set(n.id, newId)
          existingTargetIds.add(newId)
        } else {
          idMap.set(n.id, n.id)
        }
      }

      const remappedNodes = selectedNodes.map((n) => ({
        ...n,
        id: idMap.get(n.id) ?? n.id,
        selected: false,
      }))

      let edgeCounter = 0
      const remappedEdges = internalEdges.map((e) => ({
        ...e,
        id: `transfer_${Date.now()}_${++edgeCounter}`,
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
      }))

      sourceRef.current.setSnapshot(remainingNodes, remainingEdges)
      targetRef.current.setSnapshot(
        [...targetSnap.nodes, ...remappedNodes],
        [...targetSnap.edges, ...remappedEdges],
      )

      // Mark both dirty
      markCanvasDirty(sourceCanvasId)
      markCanvasDirty(targetCanvasId)
      if (usePreferencesStore.getState().autosaveEnabled) {
        autosaveScheduler.current.schedule()
      }
    },
    [viewMode, activeCanvasId, secondaryCanvasId, markCanvasDirty],
  )

  // ── Export all-sheets orchestrator ─────────────────────────────────────────

  const handleExportAllSheets = useCallback(
    async (opts: { includeImages: boolean; pageSize?: string }) => {
      if (!projectId || exportingRef.current) return

      const { exportProjectAuditPdf } = await import('../lib/pdf/exportAuditPdf')

      const abort = new AbortController()
      exportAbortRef.current = abort
      exportingRef.current = true
      setExportInProgress(true)
      useStatusBarStore.getState().setExportProgress(t('pdfExport.generating'))

      // Save original state to restore at end
      const origCanvasId = useCanvasesStore.getState().activeCanvasId
      const origInitNodes = initNodes
      const origInitEdges = initEdges

      const canvasRows = [...useCanvasesStore.getState().canvases].sort(
        (a, b) => a.position - b.position,
      )
      const currentVariables = useVariablesStore.getState().variables
      const canvasSections: Awaited<ReturnType<typeof buildCanvasAuditSection>>[] = []
      const allHashInputs: string[] = []

      try {
        for (let i = 0; i < canvasRows.length; i++) {
          if (abort.signal.aborted) {
            toast(t('pdfExport.cancelled'), 'info')
            return
          }

          const row = canvasRows[i]
          const progressMsg = t('pdfExport.progress', { current: i + 1, total: canvasRows.length })
          toast(progressMsg, 'info')
          useStatusBarStore.getState().setExportProgress(progressMsg)

          const isActive = row.id === origCanvasId

          let canvasNodes: Node<NodeData>[]
          let canvasEdges: Edge[]

          if (isActive && canvasRef.current) {
            // Use live graph from current canvas
            const snap = canvasRef.current.getSnapshot()
            canvasNodes = snap.nodes
            canvasEdges = snap.edges
          } else {
            // Load from storage
            const graph = await loadCanvasGraph(projectId, row.id)
            canvasNodes = (graph.nodes ?? []) as Node<NodeData>[]
            canvasEdges = (graph.edges ?? []) as Edge[]
          }

          // Switch canvas for image capture (only if includeImages and not already active)
          let captureResult: CaptureResult = { bytes: null, rung: 'skipped' }

          if (opts.includeImages) {
            if (!isActive) {
              // Switch to this canvas for capture
              setActiveCanvasId(row.id)
              setInitNodes(canvasNodes as Node<NodeData>[])
              setInitEdges(canvasEdges as Edge[])
              // Wait for remount
              await new Promise((r) => setTimeout(r, EXPORT_SETTLE_MS))
            }

            if (canvasRef.current) {
              captureResult = await canvasRef.current.captureViewportImage(abort.signal)
            }
          }

          // Get canonical snapshot for eval
          const snap = getCanonicalSnapshot(canvasNodes, canvasEdges)

          // Evaluate graph
          const engineSnap = toEngineSnapshot(
            snap.nodes,
            snap.edges,
            constantsLookup,
            currentVariables,
          )
          const evalResult = await engine.evaluateGraph(engineSnap)

          // Compute snapshot hash
          const hashInput = stableStringify({
            nodes: snap.nodes.map((n) => ({
              id: n.id,
              data: n.data,
              position: n.position,
            })),
            edges: snap.edges.map((e) => ({
              id: e.id,
              source: e.source,
              sourceHandle: e.sourceHandle,
              target: e.target,
              targetHandle: e.targetHandle,
            })),
            variables: currentVariables,
          })
          const snapshotHash = await sha256Hex(hashInput)
          allHashInputs.push(hashInput)

          // Graph health
          const health = computeGraphHealth(snap.nodes, snap.edges)
          const healthSummary = formatHealthReport(health, t)

          canvasSections.push(
            buildCanvasAuditSection({
              canvasId: row.id,
              canvasName: row.name,
              position: row.position,
              nodes: snap.nodes,
              edges: snap.edges,
              evalResult,
              healthSummary,
              snapshotHash,
              graphImageBytes: captureResult.bytes,
              imageError: !opts.includeImages
                ? 'Images skipped (values-only mode)'
                : captureResult.rung === 'skipped'
                  ? (captureResult.error ?? 'Capture failed')
                  : undefined,
              captureRung: captureResult.rung,
            }),
          )
        }

        if (abort.signal.aborted) {
          toast(t('pdfExport.cancelled'), 'info')
          return
        }

        // Compute project hash
        const projectHashInput = stableStringify(allHashInputs)
        const projectHash = await sha256Hex(projectHashInput)

        const exportOptions: ExportOptions = {
          includeImages: opts.includeImages,
          scope: 'project',
        }

        const model = buildProjectAuditModel({
          projectName: useProjectStore.getState().projectName,
          projectId,
          exportTimestamp: new Date().toISOString(),
          buildVersion: BUILD_VERSION,
          buildSha: BUILD_SHA,
          buildTime: BUILD_TIME,
          buildEnv: BUILD_ENV,
          engineVersion: engine.engineVersion,
          contractVersion: engine.contractVersion,
          activeCanvasId: origCanvasId,
          projectHash,
          canvases: canvasSections,
          variables: currentVariables,
          exportOptions,
          pageSize: (opts.pageSize as 'A4' | 'Letter' | 'A3' | undefined) ?? 'A4',
        })

        await exportProjectAuditPdf(model, model.pageSize)
        toast(t('pdfExport.success'), 'success')
        useStatusBarStore.getState().addExportHistory({
          format: 'PDF',
          name: useProjectStore.getState().projectName,
        })
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error('[pdf-export-project]', err)
          toast(t('pdfExport.failed'), 'error')
        }
      } finally {
        // Restore original canvas
        if (origCanvasId && origCanvasId !== useCanvasesStore.getState().activeCanvasId) {
          toast(t('pdfExport.restoring'), 'info')
          setActiveCanvasId(origCanvasId)
          setInitNodes(origInitNodes)
          setInitEdges(origInitEdges)
        }
        exportingRef.current = false
        exportAbortRef.current = null
        setExportInProgress(false)
        useStatusBarStore.getState().setExportProgress(null)
      }
    },
    [projectId, initNodes, initEdges, setActiveCanvasId, engine, constantsLookup, toast, t],
  )

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort()
  }, [])

  // ── Excel all-sheets orchestrator ──────────────────────────────────────────

  const handleExportAllSheetsExcel = useCallback(
    async (opts: { includeTables: boolean }) => {
      if (!projectId || exportingRef.current) return

      const { exportAuditXlsxProject } = await import('../lib/xlsx/exportAuditXlsxProject')
      const { SAFE_MAX_TABLE_ROWS, SAFE_MAX_TABLE_COLS } = await import('../lib/xlsx/constants')

      const abort = new AbortController()
      exportAbortRef.current = abort
      exportingRef.current = true
      setExportInProgress(true)
      useStatusBarStore.getState().setExportProgress(t('excelExport.generating'))

      const canvasRows = [...useCanvasesStore.getState().canvases].sort(
        (a, b) => a.position - b.position,
      )
      const currentVariables = useVariablesStore.getState().variables
      const canvasSections: Awaited<ReturnType<typeof buildCanvasAuditSection>>[] = []
      const allHashInputs: string[] = []
      const allTables: TableExport[] = []

      try {
        for (let i = 0; i < canvasRows.length; i++) {
          if (abort.signal.aborted) {
            toast(t('excelExport.cancelled'), 'info')
            return
          }

          const row = canvasRows[i]
          const xlsxProgressMsg = t('excelExport.progress', {
            current: i + 1,
            total: canvasRows.length,
          })
          toast(xlsxProgressMsg, 'info')
          useStatusBarStore.getState().setExportProgress(xlsxProgressMsg)

          const origCanvasId = useCanvasesStore.getState().activeCanvasId
          const isActive = row.id === origCanvasId

          let canvasNodes: Node<NodeData>[]
          let canvasEdges: Edge[]

          if (isActive && canvasRef.current) {
            const snap = canvasRef.current.getSnapshot()
            canvasNodes = snap.nodes
            canvasEdges = snap.edges
          } else {
            const graph = await loadCanvasGraph(projectId, row.id)
            canvasNodes = (graph.nodes ?? []) as Node<NodeData>[]
            canvasEdges = (graph.edges ?? []) as Edge[]
          }

          // Get canonical snapshot for eval
          const snap = getCanonicalSnapshot(canvasNodes, canvasEdges)

          // Evaluate graph
          const engineSnap = toEngineSnapshot(
            snap.nodes,
            snap.edges,
            constantsLookup,
            currentVariables,
          )
          const evalResult = await engine.evaluateGraph(engineSnap)

          // Extract table values
          if (opts.includeTables) {
            for (const [nodeId, val] of Object.entries(evalResult.values)) {
              if (val && typeof val === 'object' && 'kind' in val && val.kind === 'table') {
                const tableVal = val as { kind: 'table'; columns: string[]; rows: number[][] }
                const node = snap.nodes.find((n) => n.id === nodeId)
                const data = node?.data as Record<string, unknown> | undefined
                const label = (data?.label as string) ?? nodeId
                const origRows = tableVal.rows.length
                const origCols = tableVal.columns.length
                const truncated = origRows > SAFE_MAX_TABLE_ROWS || origCols > SAFE_MAX_TABLE_COLS
                allTables.push({
                  canvasPosition: row.position,
                  canvasName: row.name,
                  canvasId: row.id,
                  nodeId,
                  nodeLabel: label,
                  columns: tableVal.columns.slice(0, SAFE_MAX_TABLE_COLS),
                  rows: tableVal.rows
                    .slice(0, SAFE_MAX_TABLE_ROWS)
                    .map((r) => r.slice(0, SAFE_MAX_TABLE_COLS)),
                  truncated,
                  originalRowCount: origRows,
                  originalColCount: origCols,
                })
              }
            }
          }

          // Compute snapshot hash
          const hashInput = stableStringify({
            nodes: snap.nodes.map((n) => ({
              id: n.id,
              data: n.data,
              position: n.position,
            })),
            edges: snap.edges.map((e) => ({
              id: e.id,
              source: e.source,
              sourceHandle: e.sourceHandle,
              target: e.target,
              targetHandle: e.targetHandle,
            })),
            variables: currentVariables,
          })
          const snapshotHash = await sha256Hex(hashInput)
          allHashInputs.push(hashInput)

          // Graph health
          const health = computeGraphHealth(snap.nodes, snap.edges)
          const healthSummary = formatHealthReport(health, t)

          canvasSections.push(
            buildCanvasAuditSection({
              canvasId: row.id,
              canvasName: row.name,
              position: row.position,
              nodes: snap.nodes,
              edges: snap.edges,
              evalResult,
              healthSummary,
              snapshotHash,
              graphImageBytes: null,
              imageError: 'Excel export (no images)',
            }),
          )
        }

        if (abort.signal.aborted) {
          toast(t('excelExport.cancelled'), 'info')
          return
        }

        // Compute project hash
        const projectHashInput = stableStringify(allHashInputs)
        const projectHash = await sha256Hex(projectHashInput)

        const model = buildProjectAuditModel({
          projectName: useProjectStore.getState().projectName,
          projectId,
          exportTimestamp: new Date().toISOString(),
          buildVersion: BUILD_VERSION,
          buildSha: BUILD_SHA,
          buildTime: BUILD_TIME,
          buildEnv: BUILD_ENV,
          engineVersion: engine.engineVersion,
          contractVersion: engine.contractVersion,
          activeCanvasId: useCanvasesStore.getState().activeCanvasId,
          projectHash,
          canvases: canvasSections,
        })

        await exportAuditXlsxProject(model, currentVariables, allTables)
        toast(t('excelExport.success'), 'success')
        useStatusBarStore.getState().addExportHistory({
          format: 'XLSX',
          name: useProjectStore.getState().projectName,
        })
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error('[xlsx-export-project]', err)
          toast(t('excelExport.failed'), 'error')
        }
      } finally {
        exportingRef.current = false
        exportAbortRef.current = null
        setExportInProgress(false)
        useStatusBarStore.getState().setExportProgress(null)
      }
    },
    [projectId, engine, constantsLookup, toast, t],
  )

  // ── .chainsolvejson export orchestrator ─────────────────────────────────────

  const handleExportChainsolveJson = useCallback(async () => {
    if (!projectId || exportingRef.current) return

    const { exportChainsolveJsonProject } =
      await import('../lib/chainsolvejson/exportChainsolveJson')

    const abort = new AbortController()
    exportAbortRef.current = abort
    exportingRef.current = true
    setExportInProgress(true)

    const canvasRows = [...useCanvasesStore.getState().canvases].sort(
      (a, b) => a.position - b.position,
    )
    const currentVariables = useVariablesStore.getState().variables

    try {
      const canvasInputs: {
        id: string
        name: string
        position: number
        graph: {
          schemaVersion: 4
          canvasId: string
          projectId: string
          nodes: unknown[]
          edges: unknown[]
          datasetRefs: string[]
        }
      }[] = []

      for (let i = 0; i < canvasRows.length; i++) {
        if (abort.signal.aborted) {
          toast(t('chainsolveJsonExport.cancelled'), 'info')
          return
        }

        const row = canvasRows[i]
        toast(
          t('chainsolveJsonExport.progress', { current: i + 1, total: canvasRows.length }),
          'info',
        )

        const isActive = row.id === useCanvasesStore.getState().activeCanvasId

        let nodes: unknown[]
        let edges: unknown[]

        if (isActive && canvasRef.current) {
          const snap = canvasRef.current.getSnapshot()
          nodes = snap.nodes
          edges = snap.edges
        } else {
          const graph = await loadCanvasGraph(projectId, row.id)
          nodes = graph.nodes
          edges = graph.edges
        }

        canvasInputs.push({
          id: row.id,
          name: row.name,
          position: row.position,
          graph: {
            schemaVersion: 4 as const,
            canvasId: row.id,
            projectId,
            nodes,
            edges,
            datasetRefs: [],
          },
        })
      }

      if (abort.signal.aborted) {
        toast(t('chainsolveJsonExport.cancelled'), 'info')
        return
      }

      // Load project assets from DB and embed/reference them
      const { buildEmbeddedAsset, buildReferencedAsset, EMBED_SIZE_LIMIT } =
        await import('../lib/chainsolvejson/model')

      const dbAssets = await listProjectAssets(projectId)
      const exportAssets: ExportAsset[] = []

      for (let ai = 0; ai < dbAssets.length; ai++) {
        if (abort.signal.aborted) break
        const a = dbAssets[ai]

        toast(
          t('chainsolveJsonExport.loadingAssets', { current: ai + 1, total: dbAssets.length }),
          'info',
        )

        if (a.size != null && a.size <= EMBED_SIZE_LIMIT) {
          const bytes = await downloadAssetBytes(a.storage_path)
          exportAssets.push(
            await buildEmbeddedAsset(a.name, a.mime_type ?? 'application/octet-stream', bytes),
          )
        } else {
          exportAssets.push(
            buildReferencedAsset(
              a.name,
              a.mime_type ?? 'application/octet-stream',
              a.size ?? 0,
              a.storage_path,
              a.sha256,
            ),
          )
        }
      }

      if (abort.signal.aborted) {
        toast(t('chainsolveJsonExport.cancelled'), 'info')
        return
      }

      const ps = useProjectStore.getState()

      await exportChainsolveJsonProject({
        exportedAt: new Date().toISOString(),
        appVersion: BUILD_VERSION,
        buildSha: BUILD_SHA,
        buildTime: BUILD_TIME,
        buildEnv: BUILD_ENV,
        engineVersion: engine.engineVersion,
        engineContractVersion: engine.contractVersion,
        projectId,
        projectName: ps.projectName,
        activeCanvasId: useCanvasesStore.getState().activeCanvasId,
        variables: currentVariables,
        createdAt: ps.createdAt,
        updatedAt: ps.dbUpdatedAt,
        canvases: canvasInputs,
        assets: exportAssets,
      })
      toast(t('chainsolveJsonExport.success'), 'success')
    } catch (err: unknown) {
      if (!abort.signal.aborted) {
        console.error('[chainsolvejson-export]', err)
        toast(t('chainsolveJsonExport.failed'), 'error')
      }
    } finally {
      exportingRef.current = false
      exportAbortRef.current = null
      setExportInProgress(false)
    }
  }, [projectId, engine, toast, t])

  // ── .chainsolvejson import ──────────────────────────────────────────────────

  const importFileRef = useRef<HTMLInputElement>(null)
  const [upgradeCanvasOpen, setUpgradeCanvasOpen] = useState(false)
  const [upgradeExportOpen, setUpgradeExportOpen] = useState(false)
  const [upgradeAiOpen, setUpgradeAiOpen] = useState(false)
  const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>()

  /** Open the AI Copilot panel, optionally prefilling a message. */
  const openAiPanel = useCallback(
    (message?: string) => {
      setAiInitialMessage(message)
      openWindow(AI_COPILOT_WINDOW_ID, { width: 520, height: 560 })
    },
    [openWindow],
  )
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importSummary, setImportSummary] = useState<null | {
    text: string
    fileName: string
    summary: import('../lib/chainsolvejson/import/report').ImportSummary
    model: import('../lib/chainsolvejson/model').ChainsolveJsonV1
    validation: import('../lib/chainsolvejson/import/validate').ValidationResult
  }>(null)
  const [importing, setImporting] = useState(false)

  const handleImportChainsolveJson = useCallback(() => {
    importFileRef.current?.click()
  }, [])

  const handleImportFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return

      toast(t('importProject.validating'), 'info')

      try {
        const text = await file.text()
        const { preImport } = await import('../lib/chainsolvejson/import/importProject')
        const result = await preImport(text)

        setImportSummary({
          text,
          fileName: file.name,
          summary: result.summary,
          model: result.model,
          validation: result.validation,
        })
        setImportDialogOpen(true)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse import file.'
        toast(msg, 'error')
      }
    },
    [toast, t],
  )

  const handleConfirmImport = useCallback(async () => {
    if (!importSummary) return
    setImporting(true)

    try {
      const { importChainsolveJsonAsNewProject } =
        await import('../lib/chainsolvejson/import/importProject')

      const result = await importChainsolveJsonAsNewProject(
        importSummary.text,
        importSummary.model,
        importSummary.validation,
        {
          fileName: importSummary.fileName,
          onProgress: (p) => {
            if (p.phase === 'canvases' && p.current && p.total) {
              toast(t('importProject.progress', { current: p.current, total: p.total }), 'info')
            } else if (p.phase === 'assets' && p.current && p.total) {
              toast(
                t('importProject.uploadingAssets', { current: p.current, total: p.total }),
                'info',
              )
            }
          },
        },
      )

      setImportDialogOpen(false)
      setImportSummary(null)

      if (result.ok && result.projectId) {
        toast(t('importProject.success'), 'success')
        navigate(`/app/${result.projectId}`)
      } else {
        toast(t('importProject.failed'), 'error')
        const { downloadImportReport } = await import('../lib/chainsolvejson/import/report')
        downloadImportReport(result.report)
      }
    } catch (err: unknown) {
      console.error('[chainsolvejson-import]', err)
      toast(t('importProject.failed'), 'error')
    } finally {
      setImporting(false)
    }
  }, [importSummary, toast, t, navigate])

  // D11-4: Gate export/import behind canExport entitlement
  const ent = getEntitlements(plan)

  const gatedExportPdf = useCallback(
    (opts: { includeImages: boolean; pageSize?: string }) => {
      if (!ent.canExport) {
        setUpgradeExportOpen(true)
        return
      }
      void handleExportAllSheets(opts)
    },
    [ent.canExport, handleExportAllSheets],
  )

  const gatedExportExcel = useCallback(
    (opts: { includeTables: boolean }) => {
      if (!ent.canExport) {
        setUpgradeExportOpen(true)
        return
      }
      void handleExportAllSheetsExcel(opts)
    },
    [ent.canExport, handleExportAllSheetsExcel],
  )

  const gatedExportJson = useCallback(() => {
    if (!ent.canExport) {
      setUpgradeExportOpen(true)
      return
    }
    void handleExportChainsolveJson()
  }, [ent.canExport, handleExportChainsolveJson])

  const gatedImportJson = useCallback(() => {
    if (!ent.canExport) {
      setUpgradeExportOpen(true)
      return
    }
    handleImportChainsolveJson()
  }, [ent.canExport, handleImportChainsolveJson])

  // ── Loading / error screens ────────────────────────────────────────────────
  if (loadPhase === 'loading') {
    return (
      <main>
        <LoadingScreen message={t('canvas.loadingProject', 'Loading project')} />
      </main>
    )
  }

  if (loadPhase === 'error') {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '2rem',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>⚠</div>
          <p style={{ color: '#ef4444', margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>
            {loadError}
          </p>
          <p style={{ color: 'rgba(244,244,243,0.5)', margin: 0, fontSize: '0.8rem' }}>
            {t(
              'canvas.loadErrorHint',
              'This may be a temporary network issue. Try reloading the project.',
            )}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => setLoadRetryCount((c) => c + 1)}
              style={{
                padding: '0.45rem 1.1rem',
                background: 'var(--primary)',
                border: 'none',
                borderRadius: 7,
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {t('canvas.retryLoad', 'Retry')}
            </button>
            <a
              href="/app"
              style={{
                padding: '0.45rem 1.1rem',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 7,
                color: 'rgba(244,244,243,0.7)',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              {t('canvas.goToProjectManager', 'Project Manager')}
            </a>
          </div>
          <p style={{ opacity: 0.35, fontSize: '0.75rem', margin: 0 }}>
            {t('canvas.needHelp', 'Need help?')}{' '}
            <a
              href={`mailto:${CONTACT.support}`}
              style={{ color: '#93c5fd', textDecoration: 'none' }}
            >
              {CONTACT.support}
            </a>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main
      id="cs-main-content"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: embedded ? '100%' : '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* Project header (hidden when embedded in WorkspacePage) */}
      {!embedded && (
        <AppHeader
          projectId={projectId}
          projectName={projectName}
          readOnly={readOnly}
          nameEditing={nameEditing}
          nameInput={nameInput}
          nameInputRef={nameInputRef}
          onStartNameEdit={startNameEdit}
          onNameInputChange={setNameInput}
          onCommitNameEdit={() => void commitNameEdit()}
          onCancelNameEdit={() => setNameEditing(false)}
          onSave={doSave}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onSaveAs={handleSaveAs}
          canvasRef={canvasRef}
          exportInProgress={exportInProgress}
          onExportPdfProject={gatedExportPdf}
          onCancelExport={handleCancelExport}
          onExportExcelProject={gatedExportExcel}
          onExportChainsolveJson={gatedExportJson}
          onImportChainsolveJson={gatedImportJson}
          isOnline={isOnline}
          onRetryOffline={() => {
            if (offlineRetryTimer.current) clearTimeout(offlineRetryTimer.current)
            void doSave()
          }}
          saveAsRequested={saveAsRequested}
          onSaveAsRequestHandled={() => setSaveAsRequested(false)}
        />
      )}

      {/* ── Read-only / billing banner ────────────────────────────────────── */}
      {readOnly && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            borderBottom: '1px solid rgba(239,68,68,0.3)',
            padding: '0.45rem 1rem',
            fontSize: '0.82rem',
            color: '#f87171',
            flexShrink: 0,
          }}
        >
          Your subscription has been canceled. This project is read-only.
        </div>
      )}
      {bannerKind === 'past_due' && (
        <div
          style={{
            background: 'rgba(245,158,11,0.1)',
            borderBottom: '1px solid rgba(245,158,11,0.3)',
            padding: '0.45rem 1rem',
            fontSize: '0.82rem',
            color: '#fbbf24',
            flexShrink: 0,
          }}
        >
          Your payment is past due. Please update your billing info to avoid losing access.
        </div>
      )}

      {/* ── Conflict banner ──────────────────────────────────────────────── */}
      {saveStatus === 'conflict' && (
        <ConflictBanner
          serverTs={conflictServerTs.current}
          lastSavedAt={lastSavedAt}
          readOnly={readOnly}
          onKeepMine={handleOverwrite}
          onReload={handleReload}
        />
      )}

      {/* ── Canvas load warning banner (PROJ-03) ─────────────────────────── */}
      {canvasLoadWarning && (
        <div
          style={{
            background: 'rgba(245,158,11,0.1)',
            borderBottom: '1px solid rgba(245,158,11,0.3)',
            padding: '0.45rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.82rem',
            color: '#fbbf24',
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1 }}>{canvasLoadWarning}</span>
          <button
            onClick={() => setCanvasLoadWarning(null)}
            style={{
              padding: '0.2rem 0.6rem',
              border: '1px solid rgba(245,158,11,0.3)',
              background: 'transparent',
              color: '#fbbf24',
              borderRadius: 5,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontFamily: 'inherit',
            }}
          >
            {t('canvas.dismiss', 'Dismiss')}
          </button>
        </div>
      )}

      {/* ── Sheets tab bar ────────────────────────────────────────────────── */}
      {projectId && canvases.length > 0 && (
        <SheetsBar
          canvases={canvases}
          activeCanvasId={activeCanvasId}
          plan={plan}
          readOnly={readOnly}
          onSwitchCanvas={handleSwitchCanvas}
          onCreateCanvas={handleCreateCanvas}
          onRenameCanvas={handleRenameCanvas}
          onDeleteCanvas={handleDeleteCanvas}
          onDuplicateCanvas={handleDuplicateCanvas}
          onReorderCanvases={readOnly ? undefined : handleReorderCanvases}
          dirtyCanvasIds={dirtyCanvasIds}
          viewMode={viewMode}
          onSetViewMode={handleSetViewMode}
        />
      )}

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {viewMode !== 'fullscreen' && secondaryCanvasId && activeCanvasId ? (
          /* K1-1: Tiled layout with two canvas panes */
          <TiledCanvasLayout
            direction={viewMode === 'tiled-h' ? 'horizontal' : 'vertical'}
            primaryPane={{
              canvasId: activeCanvasId,
              name: canvases.find((c) => c.id === activeCanvasId)?.name ?? '',
              state: paneStates[activeCanvasId] ?? 'normal',
            }}
            secondaryPane={{
              canvasId: secondaryCanvasId,
              name: canvases.find((c) => c.id === secondaryCanvasId)?.name ?? '',
              state: paneStates[secondaryCanvasId] ?? 'normal',
            }}
            focusedCanvasId={focusedCanvasId}
            onFocusPane={setFocusedCanvasId}
            onToggleMinimize={handleToggleMinimize}
            onToggleMaximize={handleToggleMaximize}
            onClosePane={handleClosePane}
            primaryPaneRef={primaryPaneRef}
            secondaryPaneRef={secondaryPaneRef}
            primaryContent={
              <CanvasArea
                ref={canvasRef}
                canvasId={activeCanvasId}
                key={activeCanvasId}
                initialNodes={initNodes ?? INITIAL_NODES}
                initialEdges={initEdges ?? INITIAL_EDGES}
                onGraphChange={
                  !readOnly ? (projectId ? handleGraphChange : handleScratchGraphChange) : undefined
                }
                readOnly={readOnly}
                plan={plan}
                onOpenVariables={() => setVariablesPanelOpen((v) => !v)}
                onOpenGroups={() => setTemplateManagerOpen(true)}
                onOpenMaterials={() => setMaterialWizardOpen(true)}
                onFixWithCopilot={() => openAiPanel()}
                onExplainIssues={() => openAiPanel()}
                onExplainNode={(nodeId) => openAiPanel(`Explain node ${nodeId}`)}
                onInsertFromPrompt={() => openAiPanel()}
                onNodeDragStop={handleNodeDragStop(activeCanvasId)}
              />
            }
            secondaryContent={
              <CanvasArea
                ref={secondaryCanvasRef}
                canvasId={secondaryCanvasId}
                key={secondaryCanvasId}
                initialNodes={secondaryNodes}
                initialEdges={secondaryEdges}
                onGraphChange={
                  !readOnly
                    ? projectId
                      ? handleSecondaryGraphChange
                      : handleScratchGraphChange
                    : undefined
                }
                readOnly={readOnly}
                plan={plan}
                onOpenVariables={() => setVariablesPanelOpen((v) => !v)}
                onOpenGroups={() => setTemplateManagerOpen(true)}
                onOpenMaterials={() => setMaterialWizardOpen(true)}
                onFixWithCopilot={() => openAiPanel()}
                onExplainIssues={() => openAiPanel()}
                onExplainNode={(nodeId) => openAiPanel(`Explain node ${nodeId}`)}
                onInsertFromPrompt={() => openAiPanel()}
                onNodeDragStop={handleNodeDragStop(secondaryCanvasId)}
              />
            }
          />
        ) : (
          /* Fullscreen: single canvas pane */
          <CanvasArea
            ref={canvasRef}
            canvasId={activeCanvasId ?? undefined}
            key={activeCanvasId ?? projectId ?? 'scratch'}
            initialNodes={initNodes ?? INITIAL_NODES}
            initialEdges={initEdges ?? INITIAL_EDGES}
            onGraphChange={
              !readOnly ? (projectId ? handleGraphChange : handleScratchGraphChange) : undefined
            }
            readOnly={readOnly}
            plan={plan}
            onOpenVariables={() => setVariablesPanelOpen((v) => !v)}
            onOpenGroups={() => setTemplateManagerOpen(true)}
            onOpenMaterials={() => setMaterialWizardOpen(true)}
            onFixWithCopilot={() => openAiPanel()}
            onExplainIssues={() => openAiPanel()}
            onExplainNode={(nodeId) => openAiPanel(`Explain node ${nodeId}`)}
            onInsertFromPrompt={() => openAiPanel()}
          />
        )}
        {/* G8-1: AI Copilot docked right panel — always visible, collapsed by default */}
        <Suspense fallback={<div style={{ width: 28, flexShrink: 0 }} />}>
          <LazyAiDockPanel
            open={isOpen(AI_COPILOT_WINDOW_ID)}
            onRequestOpen={() => openWindow(AI_COPILOT_WINDOW_ID, { width: 520, height: 560 })}
          >
            <Suspense fallback={null}>
              <LazyAiCopilotWindow
                docked
                plan={plan}
                projectId={projectId}
                canvasId={activeCanvasId ?? undefined}
                selectedNodeIds={
                  canvasRef.current
                    ? canvasRef.current
                        .getSnapshot()
                        .nodes.filter((n) => n.selected)
                        .map((n) => n.id)
                    : []
                }
                onApplyPatch={async (ops: AiPatchOp[]) => {
                  const snap = canvasRef.current?.getSnapshot()
                  if (!snap) return
                  const { applyPatchOps } = await import('../lib/aiCopilot/patchExecutor')
                  const result = applyPatchOps(ops, snap.nodes, snap.edges, true)
                  canvasRef.current?.setSnapshot(result.nodes, result.edges)
                  handleGraphChange(result.nodes, result.edges)
                }}
                onUpgrade={() => setUpgradeAiOpen(true)}
                initialMessage={aiInitialMessage}
              />
            </Suspense>
          </LazyAiDockPanel>
        </Suspense>
      </div>
      {/* ── Canvas limit upgrade modal ──────────────────────────────────── */}
      <UpgradeModal
        open={upgradeCanvasOpen}
        onClose={() => setUpgradeCanvasOpen(false)}
        reason="canvas_limit"
      />
      {/* ── D11-4: Export locked upgrade modal ────────────────────────────── */}
      <UpgradeModal
        open={upgradeExportOpen}
        onClose={() => setUpgradeExportOpen(false)}
        reason="export_locked"
      />
      {/* ── Import file input + dialog ────────────────────────────────────── */}
      <input
        ref={importFileRef}
        type="file"
        accept=".chainsolvejson,.json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => void handleImportFileSelected(e)}
      />
      <Suspense fallback={null}>
        <LazyImportProjectDialog
          open={importDialogOpen}
          onClose={() => {
            setImportDialogOpen(false)
            setImportSummary(null)
          }}
          onConfirm={() => void handleConfirmImport()}
          summary={importSummary?.summary ?? null}
          validation={importSummary?.validation ?? null}
          importing={importing}
        />
      </Suspense>
      {isPerfHudEnabled() && (
        <Suspense fallback={null}>
          <PerfHud />
        </Suspense>
      )}

      {/* ── Artifact panels (D15-3) ──────────────────────────────────────── */}
      <Suspense fallback={null}>
        <LazyVariablesPanel
          open={variablesPanelOpen}
          onClose={() => setVariablesPanelOpen(false)}
        />
      </Suspense>
      {templateManagerOpen && (
        <Suspense fallback={null}>
          <LazyTemplateManagerDialog open onClose={() => setTemplateManagerOpen(false)} />
        </Suspense>
      )}
      {materialWizardOpen && (
        <Suspense fallback={null}>
          <LazyMaterialWizard open onClose={() => setMaterialWizardOpen(false)} />
        </Suspense>
      )}
      {isOpen(THEME_LIBRARY_WINDOW_ID) && (
        <Suspense fallback={null}>
          <LazyThemeLibraryWindow plan={plan} />
        </Suspense>
      )}
      {isOpen(THEME_WIZARD_WINDOW_ID) && (
        <Suspense fallback={null}>
          <LazyThemeWizard />
        </Suspense>
      )}
      <UpgradeModal
        open={upgradeAiOpen}
        onClose={() => setUpgradeAiOpen(false)}
        reason="ai_locked"
      />
      {/* ── H9-1: Session revoked modal ── */}
      {sessionRevoked && (
        <Suspense fallback={null}>
          <LazySessionRevokedModal open />
        </Suspense>
      )}
    </main>
  )
}
