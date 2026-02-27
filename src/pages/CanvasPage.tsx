/**
 * CanvasPage — full-page canvas editor with multi-canvas "Sheets" (W10.7).
 *
 * Route: /canvas/:projectId   (project mode — autosaved to Supabase storage)
 *        /canvas              (scratch mode — no persistence)
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
  createProject,
  duplicateProject,
  listProjects,
  renameProject,
  readProjectRow,
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
} from '../lib/canvases'
import { useProjectStore } from '../stores/projectStore'
import { useCanvasesStore } from '../stores/canvasesStore'
import { useVariablesStore } from '../stores/variablesStore'
import { saveVariables } from '../lib/variablesService'
import { supabase } from '../lib/supabase'
import {
  isReadOnly,
  canCreateProject,
  canCreateCanvas,
  showBillingBanner,
  type Plan,
} from '../lib/entitlements'
import { isPerfHudEnabled } from '../lib/devFlags'
import { addRecentProject } from '../lib/recentProjects'
import { useToast } from '../components/ui/useToast'
import { SheetsBar } from '../components/app/SheetsBar'
import { useEngine } from '../contexts/EngineContext'
import { buildConstantsLookup } from '../engine/resolveBindings'
import { toEngineSnapshot } from '../engine/bridge'
import { getCanonicalSnapshot } from '../lib/groups'
import { stableStringify } from '../lib/pdf/stableStringify'
import { sha256Hex } from '../lib/pdf/sha256'
import { computeGraphHealth, formatHealthReport } from '../lib/graphHealth'
import {
  buildCanvasAuditSection,
  buildProjectAuditModel,
  type ExportOptions,
} from '../lib/pdf/auditModel'
import type { CaptureResult } from '../lib/pdf/captureCanvasImage'
import type { TableExport } from '../lib/xlsx/xlsxModel'

const PerfHud = lazy(() =>
  import('../components/PerfHud.tsx').then((m) => ({ default: m.PerfHud })),
)
const LazyImportProjectDialog = lazy(() =>
  import('../components/app/ImportProjectDialog').then((m) => ({
    default: m.ImportProjectDialog,
  })),
)

const AUTOSAVE_DELAY_MS = 2000
const EXPORT_SETTLE_MS = 300

export default function CanvasPage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()
  const engine = useEngine()

  // ── Project store selectors ────────────────────────────────────────────────
  const saveStatus = useProjectStore((s) => s.saveStatus)
  const projectName = useProjectStore((s) => s.projectName)

  const beginLoad = useProjectStore((s) => s.beginLoad)
  const markDirty = useProjectStore((s) => s.markDirty)
  const beginSave = useProjectStore((s) => s.beginSave)
  const completeSave = useProjectStore((s) => s.completeSave)
  const failSave = useProjectStore((s) => s.failSave)
  const detectConflict = useProjectStore((s) => s.detectConflict)
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
  const resetCanvases = useCanvasesStore((s) => s.reset)

  // ── Variables store selectors ──────────────────────────────────────────────
  const loadVariablesStore = useVariablesStore((s) => s.load)
  const resetVariables = useVariablesStore((s) => s.reset)
  const markVariablesClean = useVariablesStore((s) => s.markClean)

  // ── Plan awareness ─────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<Plan>('free')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return
      supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data?.plan) setPlan(data.plan as Plan)
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
  const [initNodes, setInitNodes] = useState<Node<NodeData>[] | undefined>()
  const [initEdges, setInitEdges] = useState<Edge[] | undefined>()

  // ── Autosave / conflict refs ───────────────────────────────────────────────
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef = useRef<CanvasAreaHandle>(null)
  const isSaving = useRef(false)
  const conflictServerTs = useRef<string | null>(null)

  // ── Export state ──────────────────────────────────────────────────────────
  const exportingRef = useRef(false)
  const exportAbortRef = useRef<AbortController | null>(null)
  const [exportInProgress, setExportInProgress] = useState(false)

  const constantsLookup = useMemo(
    () => buildConstantsLookup(engine.constantValues),
    [engine.constantValues],
  )

  // ── Inline project name editing ────────────────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // ── Load project + canvases on mount ───────────────────────────────────────
  useEffect(() => {
    resetProject()
    resetCanvases()
    resetVariables()
    conflictServerTs.current = null

    if (!projectId) {
      setLoadPhase('ready')
      return
    }

    setLoadPhase('loading')
    setLoadError(null)

    async function load() {
      try {
        // 1. Load project row + legacy project.json in parallel
        const [row, pj] = await Promise.all([readProjectRow(projectId!), loadProject(projectId!)])

        const dbUpdatedAt = row?.updated_at ?? pj.updatedAt
        const dbName = row?.name ?? pj.project.name
        beginLoad(projectId!, dbName, dbUpdatedAt, pj.formatVersion, pj.createdAt)
        addRecentProject(projectId!, dbName)

        // W12.2: Load project-level variables
        loadVariablesStore(row?.variables ?? {})

        // 2. Load canvases list
        let canvasList = await listCanvases(projectId!)

        // 3. If no canvases exist, migrate legacy V3 graph
        if (canvasList.length === 0) {
          await migrateProjectToMultiCanvas(projectId!, pj.graph.nodes, pj.graph.edges)
          canvasList = await listCanvases(projectId!)
        }

        setCanvases(canvasList)

        // 4. Determine active canvas
        let activeId = row?.active_canvas_id ?? null
        if (!activeId || !canvasList.find((c) => c.id === activeId)) {
          activeId = canvasList[0]?.id ?? null
          if (activeId) {
            await setActiveCanvas(projectId!, activeId)
          }
        }

        if (activeId) {
          setActiveCanvasId(activeId)

          // 5. Load active canvas graph
          const canvasGraph = await loadCanvasGraph(projectId!, activeId)
          setInitNodes(canvasGraph.nodes as Node<NodeData>[])
          setInitEdges(canvasGraph.edges as Edge[])
        } else {
          setInitNodes([])
          setInitEdges([])
        }

        setLoadPhase('ready')
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load project')
        setLoadPhase('error')
      }
    }

    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [])

  // ── Core save function ──────────────────────────────────────────────────────
  // Saves to both per-canvas storage and project-level conflict detection.
  const doSave = useCallback(
    async (opts?: { forceKnownUpdatedAt?: string }) => {
      if (!projectId || isSaving.current) return

      const snapshot = canvasRef.current?.getSnapshot()
      if (!snapshot) return

      const state = useProjectStore.getState()
      const canvasesState = useCanvasesStore.getState()
      const knownUpdatedAt = opts?.forceKnownUpdatedAt ?? state.dbUpdatedAt
      if (!knownUpdatedAt) return

      isSaving.current = true
      beginSave()

      try {
        // W12.2: Save variables if dirty
        const varsState = useVariablesStore.getState()
        if (varsState.isDirty) {
          await saveVariables(projectId, varsState.variables)
          markVariablesClean()
        }

        // Save to per-canvas storage if we have an active canvas
        const currentCanvasId = canvasesState.activeCanvasId
        if (currentCanvasId) {
          await saveCanvasGraph(projectId, currentCanvasId, snapshot.nodes, snapshot.edges)
          markCanvasClean(currentCanvasId)
        }

        // Also save to legacy project.json for backward compat + conflict detection
        const result = await saveProject(
          projectId,
          state.projectName,
          snapshot.nodes,
          snapshot.edges,
          knownUpdatedAt,
          {
            formatVersion: state.formatVersion,
            createdAt: state.createdAt ?? new Date().toISOString(),
          },
        )

        if (result.conflict) {
          conflictServerTs.current = result.updatedAt
          detectConflict()
        } else {
          conflictServerTs.current = null
          completeSave(result.updatedAt)
        }
      } catch (err: unknown) {
        failSave(err instanceof Error ? err.message : 'Save failed')
      } finally {
        isSaving.current = false
      }
    },
    [
      projectId,
      beginSave,
      completeSave,
      failSave,
      detectConflict,
      markCanvasClean,
      markVariablesClean,
    ],
  )

  // ── onGraphChange — dirty tracking + debounced autosave ────────────────────
  const handleGraphChange: NonNullable<CanvasAreaProps['onGraphChange']> = useCallback(() => {
    // Suppress dirty/autosave during export canvas switching
    if (exportingRef.current) return
    markDirty()
    const currentCanvasId = useCanvasesStore.getState().activeCanvasId
    if (currentCanvasId) markCanvasDirty(currentCanvasId)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      void doSave()
    }, AUTOSAVE_DELAY_MS)
  }, [markDirty, markCanvasDirty, doSave])

  // ── Flush save on tab close / refresh (best-effort) ────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!useProjectStore.getState().isDirty || !projectId) return
      void doSave()
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [projectId, doSave])

  // ── Ctrl+S / Cmd+S → immediate save ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (projectId && !readOnly) void doSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [projectId, readOnly, doSave])

  // ── Route-leave: save before navigating back to /app ──────────────────────
  const handleBackToProjects = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      if (useProjectStore.getState().isDirty && projectId) {
        await doSave()
      }
      navigate('/app')
    },
    [projectId, doSave, navigate],
  )

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
    try {
      await renameProject(projectId, trimmed)
      setStoreName(trimmed)
    } catch {
      // Silently revert — the store still holds the old name
    }
  }, [nameInput, projectId, setStoreName])

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
      navigate(`/canvas/${proj.id}`)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to create project', 'error')
    }
  }, [plan, navigate, toast, t])

  const handleOpenProject = useCallback(
    async (id: string) => {
      navigate(`/canvas/${id}`)
    },
    [navigate],
  )

  const handleSaveAs = useCallback(
    async (name: string) => {
      try {
        if (projectId) {
          const proj = await duplicateProject(projectId, name)
          addRecentProject(proj.id, proj.name)
          navigate(`/canvas/${proj.id}`)
        } else {
          // Scratch canvas → create new project with current graph
          const snapshot = canvasRef.current?.getSnapshot()
          if (!snapshot) return
          const proj = await createProject(name)
          await saveProject(proj.id, name, snapshot.nodes, snapshot.edges, proj.updated_at, {
            formatVersion: 1,
            createdAt: proj.created_at,
          })
          addRecentProject(proj.id, proj.name)
          navigate(`/canvas/${proj.id}`)
        }
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to save copy', 'error')
        throw err
      }
    },
    [projectId, navigate, toast],
  )

  // ── Sheet / canvas operations ──────────────────────────────────────────────

  const handleSwitchCanvas = useCallback(
    async (canvasId: string) => {
      if (!projectId || canvasId === activeCanvasId) return

      // Save current canvas if dirty before switching
      if (useProjectStore.getState().isDirty) {
        await doSave()
      }

      try {
        // Load the target canvas graph
        const canvasGraph = await loadCanvasGraph(projectId, canvasId)
        setActiveCanvasId(canvasId)
        await setActiveCanvas(projectId, canvasId)
        setInitNodes(canvasGraph.nodes as Node<NodeData>[])
        setInitEdges(canvasGraph.edges as Edge[])
        // Force CanvasArea remount by updating the key (via initNodes/initEdges change)
        // Reset dirty state for new canvas
        const state = useProjectStore.getState()
        if (state.dbUpdatedAt) {
          completeSave(state.dbUpdatedAt)
        }
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to switch canvas', 'error')
      }
    },
    [projectId, activeCanvasId, doSave, setActiveCanvasId, completeSave, toast],
  )

  const handleCreateCanvas = useCallback(async () => {
    if (!projectId) return
    if (!canCreateCanvas(plan, canvases.length)) {
      toast(t('sheets.limitReached'), 'error')
      return
    }
    try {
      const name = `Sheet ${canvases.length + 1}`
      const row = await createCanvas(projectId, name)
      addCanvasToStore(row)
      // Switch to new canvas
      await handleSwitchCanvas(row.id)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to create sheet', 'error')
    }
  }, [projectId, plan, canvases.length, toast, t, addCanvasToStore, handleSwitchCanvas])

  const handleRenameCanvas = useCallback(
    async (canvasId: string, newName: string) => {
      try {
        await renameCanvas(canvasId, newName)
        updateCanvasInStore(canvasId, { name: newName })
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to rename sheet', 'error')
      }
    },
    [updateCanvasInStore, toast],
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
        toast(t('sheets.limitReached'), 'error')
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
    [projectId, plan, canvases, toast, t, addCanvasToStore, handleSwitchCanvas],
  )

  // ── Export all-sheets orchestrator ─────────────────────────────────────────

  const handleExportAllSheets = useCallback(
    async (opts: { includeImages: boolean }) => {
      if (!projectId || exportingRef.current) return

      const { BUILD_VERSION, BUILD_SHA, BUILD_TIME, BUILD_ENV } = await import('../lib/build-info')
      const { exportProjectAuditPdf } = await import('../lib/pdf/exportAuditPdf')

      const abort = new AbortController()
      exportAbortRef.current = abort
      exportingRef.current = true
      setExportInProgress(true)

      // Save original state to restore at end
      const origCanvasId = useCanvasesStore.getState().activeCanvasId
      const origInitNodes = initNodes
      const origInitEdges = initEdges

      const canvasRows = [...useCanvasesStore.getState().canvases].sort(
        (a, b) => a.position - b.position,
      )
      const currentVariables = useVariablesStore.getState().variables
      const canvasSections: ReturnType<typeof buildCanvasAuditSection>[] = []
      const allHashInputs: string[] = []

      try {
        for (let i = 0; i < canvasRows.length; i++) {
          if (abort.signal.aborted) {
            toast(t('pdfExport.cancelled'), 'info')
            return
          }

          const row = canvasRows[i]
          toast(t('pdfExport.progress', { current: i + 1, total: canvasRows.length }), 'info')

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
          exportOptions,
        })

        await exportProjectAuditPdf(model)
        toast(t('pdfExport.success'), 'success')
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

      const { BUILD_VERSION, BUILD_SHA, BUILD_TIME, BUILD_ENV } = await import('../lib/build-info')
      const { exportAuditXlsxProject } = await import('../lib/xlsx/exportAuditXlsxProject')
      const { SAFE_MAX_TABLE_ROWS, SAFE_MAX_TABLE_COLS } = await import('../lib/xlsx/constants')

      const abort = new AbortController()
      exportAbortRef.current = abort
      exportingRef.current = true
      setExportInProgress(true)

      const canvasRows = [...useCanvasesStore.getState().canvases].sort(
        (a, b) => a.position - b.position,
      )
      const currentVariables = useVariablesStore.getState().variables
      const canvasSections: ReturnType<typeof buildCanvasAuditSection>[] = []
      const allHashInputs: string[] = []
      const allTables: TableExport[] = []

      try {
        for (let i = 0; i < canvasRows.length; i++) {
          if (abort.signal.aborted) {
            toast(t('excelExport.cancelled'), 'info')
            return
          }

          const row = canvasRows[i]
          toast(t('excelExport.progress', { current: i + 1, total: canvasRows.length }), 'info')

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
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error('[xlsx-export-project]', err)
          toast(t('excelExport.failed'), 'error')
        }
      } finally {
        exportingRef.current = false
        exportAbortRef.current = null
        setExportInProgress(false)
      }
    },
    [projectId, engine, constantsLookup, toast, t],
  )

  // ── .chainsolvejson export orchestrator ─────────────────────────────────────

  const handleExportChainsolveJson = useCallback(async () => {
    if (!projectId || exportingRef.current) return

    const { BUILD_VERSION, BUILD_SHA, BUILD_TIME, BUILD_ENV } = await import('../lib/build-info')
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
      const { listProjectAssets, downloadAssetBytes } = await import('../lib/storage')
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
        navigate(`/canvas/${result.projectId}`)
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

  // ── Loading / error screens ────────────────────────────────────────────────
  if (loadPhase === 'loading') {
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
        Loading project…
      </div>
    )
  }

  if (loadPhase === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
        }}
      >
        <p style={{ color: '#ef4444', margin: 0 }}>{loadError}</p>
        <a href="/app" style={{ opacity: 0.6, fontSize: '0.85rem', color: 'inherit' }}>
          ← Back to projects
        </a>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* ── App header ──────────────────────────────────────────────────────── */}
      <AppHeader
        projectId={projectId}
        projectName={projectName}
        readOnly={readOnly}
        plan={plan}
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
        onNavigateBack={handleBackToProjects}
        canvasRef={canvasRef}
        exportInProgress={exportInProgress}
        onExportPdfProject={handleExportAllSheets}
        onCancelExport={handleCancelExport}
        onExportExcelProject={handleExportAllSheetsExcel}
        onExportChainsolveJson={handleExportChainsolveJson}
        onImportChainsolveJson={handleImportChainsolveJson}
      />

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
          <span>Another session saved this project — your local changes may conflict.</span>
          <button
            onClick={handleOverwrite}
            style={{
              padding: '0.2rem 0.75rem',
              border: '1px solid rgba(245,158,11,0.4)',
              background: 'transparent',
              color: '#fbbf24',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontFamily: 'inherit',
            }}
          >
            Keep mine (overwrite)
          </button>
          <button
            onClick={handleReload}
            style={{
              padding: '0.2rem 0.75rem',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(244,244,243,0.65)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontFamily: 'inherit',
            }}
          >
            Reload from server
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
        />
      )}

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <CanvasArea
          ref={canvasRef}
          key={activeCanvasId ?? projectId ?? 'scratch'}
          initialNodes={initNodes ?? INITIAL_NODES}
          initialEdges={initEdges ?? INITIAL_EDGES}
          onGraphChange={projectId && !readOnly ? handleGraphChange : undefined}
          readOnly={readOnly}
          plan={plan}
        />
      </div>
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
    </div>
  )
}
