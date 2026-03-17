/**
 * CanvasArea — ReactFlow canvas with all Wave 1 features:
 *
 *  Connection rules:  isValidConnection enforces 1 edge per input handle.
 *  Inspector:         opens on node body CLICK (not drag); closes ESC / pane click.
 *  Dockable panels:   BlockLibrary (left) and Inspector (right) are resizable + hideable.
 *  Context menus:     right-click on canvas, node, or edge.
 *  Delete:            Delete/Backspace key removes selected elements.
 *  Snap to grid:      toggle button in toolbar.
 *  Mobile:            panels render as overlay drawers; touch-friendly targets.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  lazy,
  Suspense,
  type DragEvent,
  type MouseEvent,
} from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  type IsValidConnection,
  useOnViewportChange,
  NodeToolbar,
  Position as RFPosition,
  SelectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { SourceNode } from './nodes/SourceNode'
import { OperationNode } from './nodes/OperationNode'
import { DisplayNode } from './nodes/DisplayNode'
import { DataNode } from './nodes/DataNode'
import { PlotNode } from './nodes/PlotNode'
import { ListTableNode } from './nodes/ListTableNode'
import { GroupNode } from './nodes/GroupNode'
import { BlockLibrary } from './BlockLibrary'
import { DRAG_TYPE } from './blockLibraryUtils'
import { FloatingInspector, INSPECTOR_WINDOW_ID, INSPECTOR_DEFAULTS } from './FloatingInspector'
import { useWindowManager } from '../../contexts/WindowManagerContext'
import { ContextMenu, type ContextMenuTarget } from './ContextMenu'
import { ExpressionPanel } from './ExpressionPanel'
import { QuickAddPalette } from './QuickAddPalette'
import { ComputedContext, ComputedStoreContext } from '../../contexts/ComputedContext'
import { BindingContext } from '../../contexts/BindingContext'
import { useEngine } from '../../contexts/EngineContext'
import { useCanvasEngine } from '../../hooks/useCanvasEngine'
import { useGraphEngine } from '../../engine/useGraphEngine'
import { buildConstantsLookup } from '../../engine/resolveBindings'
import { computeEffectiveEdgesAnimated } from '../../engine/edgesAnimGate'
import { computeLodTier, type LodTier as LodTierGate } from '../../engine/lodGate'
import { useVariablesStore } from '../../stores/variablesStore'
import { usePublishedOutputsStore } from '../../stores/publishedOutputsStore'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { matchesBinding, DEFAULT_KEYBINDINGS } from '../../lib/keybindings'
import { BLOCK_REGISTRY, type NodeData } from '../../blocks/registry'
import { ANNOTATION_REGISTRY } from '../../annotations/annotationRegistry'
import { type Plan, getEntitlements, isBlockEntitled } from '../../lib/entitlements'
import { UpgradeModal } from '../UpgradeModal'
import {
  createGroup,
  ungroupNodes,
  collapseGroup,
  expandGroup,
  autoResizeGroup,
  getCanonicalSnapshot,
  insertTemplate,
  type TemplatePayload,
} from '../../lib/groups'
import { saveTemplate as saveTemplateApi } from '../../lib/templates'
import type { Template } from '../../lib/templates'
import { AnimatedEdge } from './edges/AnimatedEdge'
import { CanvasSettingsContext } from '../../contexts/CanvasSettingsContext'
import { PlanContext } from '../../contexts/PlanContext'
import { CanvasToolbar } from './CanvasToolbar'
import { ArtifactToolbar } from './ArtifactToolbar'
import { MinimapWrapper } from './MinimapWrapper'
import { useTranslation } from 'react-i18next'
import { autoLayout, type LayoutDirection, type AutoLayoutResult } from '../../lib/autoLayout'
import { useGraphHistory } from '../../hooks/useGraphHistory'
import { copyToClipboard, pasteFromClipboard, pasteFromSystemClipboard } from '../../lib/clipboard'
import { computeAlignment, type AlignOp } from '../../lib/alignmentHelpers'
import { parseCSVToTableData } from '../../lib/csvParser'
import { CommandPalette, type PaletteCommand } from './CommandPalette'
import { FormulaBar } from './FormulaBar'
import type { FormulaUpstreamVar } from './FormulaBar'
const LazyFindBlockDialog = lazy(() =>
  import('./FindBlockDialog').then((m) => ({ default: m.FindBlockDialog })),
)
const LazyDebugConsolePanel = lazy(() => import('./DebugConsolePanel'))
const LazyGraphHealthPanel = lazy(() => import('./GraphHealthPanel'))
const LazyOutputPanel = lazy(() => import('./OutputPanel'))
const LazyProblemsPanel = lazy(() => import('./ProblemsPanel'))
const LazyCanvasNotes = lazy(() =>
  import('./CanvasNotes').then((m) => ({ default: m.CanvasNotes })),
)
const LazyHistoryPanel = lazy(() =>
  import('./HistoryPanel').then((m) => ({ default: m.HistoryPanel })),
)
const LazyChannelsPanel = lazy(() =>
  import('./ChannelsPanel').then((m) => ({ default: m.ChannelsPanel })),
)
import { BottomDock, type DockPanel, type DockTab } from './BottomDock'
import { INITIAL_NODES, INITIAL_EDGES } from './canvasDefaults'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useBlockSnapping } from '../../hooks/useBlockSnapping'
import { SnapGuides } from './SnapGuides'
import { parseCsel } from '../../engine/csel/parser'
import { generateGraph } from '../../engine/csel/graphGen'
import { useLongPress } from '../../hooks/useLongPress'
import { BottomSheet } from '../ui/BottomSheet'
import { ValuePopoverContext, type ShowValuePopover } from '../../contexts/ValuePopoverContext'
const LazyValuePopover = lazy(() =>
  import('./ValuePopover').then((m) => ({ default: m.ValuePopover })),
)
import { PublishNode } from './nodes/PublishNode'
import { SubscribeNode } from './nodes/SubscribeNode'
import { AnnotationNode } from './nodes/AnnotationNode'
import { AnnotationToolbar } from './AnnotationToolbar'
import { MaterialNode } from './nodes/MaterialNode'
import { OptimizerNode } from './nodes/OptimizerNode'
import { MLModelNode } from './nodes/MLModelNode'
import { NeuralNetNode } from './nodes/NeuralNetNode'
import { copyValueToClipboard } from '../../engine/valueFormat'
import {
  computeGraphHealth,
  formatHealthReport,
  getCrossingEdgesForGroup,
} from '../../lib/graphHealth'
import { BUILD_VERSION, BUILD_SHA, BUILD_TIME, BUILD_ENV } from '../../lib/build-info'
import { useToast } from '../ui/useToast'
import { useProjectStore } from '../../stores/projectStore'
import { useStatusBarStore } from '../../stores/statusBarStore'
import { toEngineSnapshot } from '../../engine/bridge'
import { stableStringify } from '../../lib/pdf/stableStringify'
import { sha256Hex } from '../../lib/pdf/sha256'
import { buildAuditModel } from '../../lib/pdf/auditModel'
import type { CaptureResult } from '../../lib/pdf/captureCanvasImage'
import { getUnitMismatch } from '../../units/unitCompat'
import { getUnitSymbol } from '../../units/unitSymbols'
import { listNodeComments, type NodeComment } from '../../lib/nodeCommentsService'
import { NodeCommentsContext } from '../../contexts/NodeCommentsContext'
import { NodeCommentDialog } from './NodeCommentDialog'

// ── Node type registry ────────────────────────────────────────────────────────

const NODE_TYPES = {
  csSource: SourceNode,
  csOperation: OperationNode,
  csDisplay: DisplayNode,
  csData: DataNode,
  csPlot: PlotNode,
  csListTable: ListTableNode,
  csGroup: GroupNode,
  csProbe: DisplayNode, // V2-006: Probe removed; legacy nodes render as Display
  csPublish: PublishNode,
  csSubscribe: SubscribeNode,
  csAnnotation: AnnotationNode,
  csMaterial: MaterialNode,
  csOptimizer: OptimizerNode,
  csMLModel: MLModelNode,
  csNeuralNet: NeuralNetNode,
} as const

const EDGE_TYPES = {
  default: AnimatedEdge,
} as const

let nodeIdCounter = 100

// ── Public props interface ─────────────────────────────────────────────────────

export interface CanvasAreaProps {
  /** H7-1: Canvas ID for publish/subscribe cross-sheet value sharing. */
  canvasId?: string
  /** Nodes to hydrate on mount. When not provided, uses the built-in demo graph. */
  initialNodes?: Node<NodeData>[]
  /** Edges to hydrate on mount. When not provided, uses the built-in demo graph. */
  initialEdges?: Edge[]
  /**
   * Called when the graph changes (debounce is the caller's responsibility).
   * Skipped on the very first render so initial load does not trigger dirty state.
   */
  onGraphChange?: (nodes: Node<NodeData>[], edges: Edge[]) => void
  /** When true, the canvas is view-only: no adding, connecting, deleting, or dragging nodes. */
  readOnly?: boolean
  /** User's plan for entitlement gating of Pro blocks. */
  plan?: Plan

  /* ── Artifact entrypoints (D15-3) ───────────────────────────────────────── */
  /** Open the Variables management window/panel. */
  onOpenVariables?: () => void
  /** Open the Groups / Templates manager. */
  onOpenGroups?: () => void
  /** Open the Material Wizard. */
  onOpenMaterials?: () => void

  /* ── ChainSolve AI entrypoints (AI-3) ────────────────────────────────────── */
  /** Trigger "Fix with AI" from Graph Health panel. */
  onFixWithAi?: () => void
  /** Trigger "Explain issues" from Graph Health panel. */
  onExplainIssues?: () => void
  /** Trigger "Explain this node" from context menu. */
  onExplainNode?: (nodeId: string) => void
  /** Trigger "Insert blocks from prompt…" from context menu. */
  onInsertFromPrompt?: (x: number, y: number) => void

  /** K1-1: Fired when a node drag ends — used for cross-sheet transfer detection. */
  onNodeDragStop?: (event: React.MouseEvent, node: { id: string }) => void
  /**
   * Optional side panel rendered inside ReactFlowProvider alongside CanvasInner.
   * Use this to host components that need React Flow hooks (e.g. Inspector).
   */
  sidePanel?: React.ReactNode
}

/** Handle exposed by CanvasArea via forwardRef. */
export interface CanvasAreaHandle {
  getSnapshot: () => { nodes: Node<NodeData>[]; edges: Edge[] }
  /** AI-1: Replace the canvas state with new nodes/edges (used by ChainSolve AI patch apply). */
  setSnapshot: (nodes: Node<NodeData>[], edges: Edge[]) => void
  /** 6.02: Get computed values for AI context injection. nodeId → scalar or error string. */
  getComputedValues: () => Record<string, number | string>
  /** 5.10: Full computed value map for standalone HTML export. */
  getAllComputedValues: () => ReadonlyMap<string, import('../../engine/value').Value>
  fitView: () => void
  /** Pan/zoom to show specific nodes (used by VariablesPanel "jump to bound"). */
  fitViewToNodes: (nodeIds: string[]) => void
  zoomIn: () => void
  zoomOut: () => void
  toggleLibrary: () => void
  toggleInspector: () => void
  toggleSnap: () => void
  togglePan: () => void
  toggleLock: () => void
  toggleMinimap: () => void
  togglePause: () => void
  refresh: () => void
  autoOrganise: (direction?: LayoutDirection) => void
  undo: () => void
  redo: () => void
  cut: () => void
  copy: () => void
  paste: () => void
  deleteSelected: () => void
  selectAll: () => void
  openFind: () => void
  toggleAnimatedEdges: () => void
  toggleLod: () => void
  toggleDebugConsole: () => void
  toggleBadges: () => void
  toggleEdgeBadges: () => void
  toggleHealthPanel: () => void
  exportPdfAudit: () => Promise<void>
  exportXlsxAuditActive: () => Promise<void>
  captureViewportImage: (signal?: AbortSignal) => Promise<CaptureResult>
  hideSelected: () => void
  showAllHidden: () => void
  toggleHiddenView: () => void
  /** Open the block library with a main-category filter pre-selected. */
  openLibraryWithFilter: (mainCategoryId: string | null) => void
  /** Insert an annotation at the viewport center (used by AppHeader Insert menu). */
  insertAnnotationAtCenter: (annotationType: string) => void
}

// ── Formula bar persistence ──────────────────────────────────────────────────

const FORMULA_BAR_KEY = 'cs:formulaBar'

function getFormulaBarPref(): boolean {
  try {
    return localStorage.getItem(FORMULA_BAR_KEY) === 'true'
  } catch {
    return false
  }
}

function setFormulaBarPref(v: boolean) {
  try {
    localStorage.setItem(FORMULA_BAR_KEY, String(v))
  } catch {
    // ignore
  }
}

// ── Minimap persistence ──────────────────────────────────────────────────────

const MINIMAP_KEY = 'chainsolve.minimap'

function getMinimapPref(): boolean {
  try {
    return localStorage.getItem(MINIMAP_KEY) === 'true'
  } catch {
    return false
  }
}

function setMinimapPref(v: boolean) {
  try {
    localStorage.setItem(MINIMAP_KEY, String(v))
  } catch {
    // Ignore — private browsing
  }
}

// ── Animated-edges persistence ───────────────────────────────────────────────

const EDGES_ANIM_KEY = 'chainsolve.edgesAnimated'

function getEdgesAnimatedPref(): boolean {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return false
  }
  try {
    const v = localStorage.getItem(EDGES_ANIM_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

function setEdgesAnimatedPref(v: boolean) {
  try {
    localStorage.setItem(EDGES_ANIM_KEY, String(v))
  } catch {
    // Ignore — private browsing
  }
}

// ── LOD persistence ─────────────────────────────────────────────────────────

const LOD_KEY = 'chainsolve.lod'

function getLodPref(): boolean {
  try {
    const v = localStorage.getItem(LOD_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

function setLodPref(v: boolean) {
  try {
    localStorage.setItem(LOD_KEY, String(v))
  } catch {
    // Ignore — private browsing
  }
}

// LodTier re-exported from lodGate for use throughout this file.
type LodTier = LodTierGate

// ── Badge persistence ────────────────────────────────────────────────────────

const BADGES_KEY = 'chainsolve.badges'

function getBadgesPref(): boolean {
  try {
    return localStorage.getItem(BADGES_KEY) === 'true'
  } catch {
    return false
  }
}

function setBadgesPref(v: boolean) {
  try {
    localStorage.setItem(BADGES_KEY, String(v))
  } catch {
    // Ignore — private browsing
  }
}

const EDGE_BADGES_KEY = 'chainsolve.edgeBadges'

function getEdgeBadgesPref(): boolean {
  try {
    return localStorage.getItem(EDGE_BADGES_KEY) === 'true'
  } catch {
    return false
  }
}

function setEdgeBadgesPref(v: boolean) {
  try {
    localStorage.setItem(EDGE_BADGES_KEY, String(v))
  } catch {
    // Ignore — private browsing
  }
}

// ── Background dots persistence ──────────────────────────────────────────

const BG_DOTS_KEY = 'chainsolve.bgDots'

function getBgDotsPref(): boolean {
  try {
    const v = localStorage.getItem(BG_DOTS_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

function setBgDotsPref(v: boolean) {
  try {
    localStorage.setItem(BG_DOTS_KEY, String(v))
  } catch {
    // Ignore — private browsing
  }
}

// ── Default node dimensions for layout ───────────────────────────────────────

const DEFAULT_NODE_WIDTH = 168
const DEFAULT_NODE_HEIGHT = 60

// ── Resize-drag helpers ───────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

function makeResizeHandler(
  startWidth: number,
  setWidth: (w: number) => void,
  direction: 1 | -1, // 1 = dragging right grows, -1 = dragging right shrinks
  min = 160,
  max = 420,
) {
  return (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    let rafId = 0
    const onMove = (me: globalThis.MouseEvent) => {
      // G0-4: Throttle to one layout update per animation frame.
      // Prevents ResizeObserver loop errors caused by rapid setState → layout → observer churn.
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const delta = (me.clientX - startX) * direction
        setWidth(clamp(startWidth + delta, min, max))
      })
    }
    const onUp = () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
}

// ── Inner canvas (inside ReactFlowProvider) ───────────────────────────────────

const CanvasInner = forwardRef<CanvasAreaHandle, CanvasAreaProps>(function CanvasInner(
  {
    canvasId,
    initialNodes,
    initialEdges,
    onGraphChange,
    readOnly,
    plan = 'free',
    onOpenVariables,
    onOpenGroups,
    onOpenMaterials,
    onFixWithAi,
    onExplainIssues,
    onExplainNode,
    onInsertFromPrompt,
    onNodeDragStop: onNodeDragStopProp,
  },
  ref,
) {
  const isMobile = useIsMobile()
  const ent = getEntitlements(plan)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(
    initialNodes ?? INITIAL_NODES,
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? INITIAL_EDGES)

  // ── Graph history (undo/redo) ───────────────────────────────────────────────
  const history = useGraphHistory(50, canvasId)

  const {
    save: historySave,
    undo: historyUndo,
    redo: historyRedo,
    stackEntries,
    restoreToIndex: historyRestoreToIndex,
    clear: historyClear,
  } = history

  const doSaveHistory = useCallback(() => {
    historySave({ nodes: latestNodes.current, edges: latestEdges.current })
  }, [historySave])

  // 5.1: Save a named checkpoint from the HistoryPanel
  const handleSaveCheckpoint = useCallback(
    (label: string) => {
      historySave({ nodes: latestNodes.current, edges: latestEdges.current, label })
    },
    [historySave],
  )

  // 5.1: Rename a history entry label in-place
  const handleRenameHistoryEntry = useCallback(
    (displayIdx: number, newLabel: string) => {
      // stackEntries is newest-first; directly mutate the label on the snapshot
      const entry = stackEntries[displayIdx]
      if (entry) {
        ;(entry as { label?: string }).label = newLabel || undefined
      }
    },
    [stackEntries],
  )

  // Expose a live snapshot getter so the parent can read the authoritative
  // graph state at save time (instead of relying on stale refs).
  const latestNodes = useRef(nodes)
  const latestEdges = useRef(edges)
  latestNodes.current = nodes
  latestEdges.current = edges

  useImperativeHandle(ref, () => ({
    getSnapshot: () => getCanonicalSnapshot(latestNodes.current, latestEdges.current),
    setSnapshot: (newNodes: Node<NodeData>[], newEdges: Edge[]) => {
      // AI-1: Save current state as undo point, then replace
      historySave({ nodes: latestNodes.current, edges: latestEdges.current })
      setNodes(newNodes)
      setEdges(newEdges)
    },
    getComputedValues: () => {
      const result: Record<string, number | string> = {}
      for (const [nodeId, val] of computed) {
        if (val.kind === 'scalar') result[nodeId] = val.value
        else if (val.kind === 'error') result[nodeId] = val.message
      }
      return result
    },
    getAllComputedValues: () => computed,
    fitView: () => fitView({ padding: 0.15, duration: 300 }),
    fitViewToNodes: (nodeIds: string[]) =>
      fitView({ nodes: nodeIds.map((id) => ({ id })), padding: 0.4, duration: 400 }),
    zoomIn: () => zoomIn({ duration: 200 }),
    zoomOut: () => zoomOut({ duration: 200 }),
    toggleLibrary: () => setLibVisible((v) => !v),
    toggleInspector: () => {
      if (isWinOpen(INSPECTOR_WINDOW_ID)) closeWindow(INSPECTOR_WINDOW_ID)
      else openWindow(INSPECTOR_WINDOW_ID, INSPECTOR_DEFAULTS)
    },
    toggleSnap: () => setSnapToGrid((v) => !v),
    togglePan: () => setPanMode((v) => !v),
    toggleLock: () => setLocked((v) => !v),
    toggleMinimap: () => {
      setMinimap((v) => {
        setMinimapPref(!v)
        return !v
      })
    },
    togglePause: () => {
      setPaused((v) => {
        userPausedRef.current = !v
        return !v
      })
    },
    refresh: () => setEngineKey((k) => k + 1),
    autoOrganise: (direction?: LayoutDirection) => handleAutoOrganise(direction ?? 'LR'),
    undo: handleUndo,
    redo: handleRedo,
    cut: handleCut,
    copy: handleCopy,
    paste: handlePaste,
    deleteSelected: () => {
      doSaveHistory()
      deleteSelected()
    },
    selectAll,
    openFind: () => setFindOpen(true),
    toggleAnimatedEdges: () => {
      setEdgesAnimated((v) => {
        setEdgesAnimatedPref(!v)
        return !v
      })
    },
    toggleLod: () => {
      setLodEnabled((v) => {
        setLodPref(!v)
        return !v
      })
    },
    toggleDebugConsole: () => setDockCollapsed(false),
    toggleBadges: () => {
      setBadgesEnabled((v) => {
        setBadgesPref(!v)
        return !v
      })
    },
    toggleEdgeBadges: () => {
      setEdgeBadgesEnabled((v) => {
        setEdgeBadgesPref(!v)
        return !v
      })
    },
    toggleHealthPanel: () => setDockCollapsed(false),
    hideSelected: hideSelectedNodes,
    showAllHidden: showAllHiddenNodes,
    toggleHiddenView: () => setHiddenViewMode((v) => !v),
    openLibraryWithFilter: (mainCategoryId: string | null) => {
      setLibFilterMain(mainCategoryId)
      setLibVisible(true)
    },
    insertAnnotationAtCenter: onInsertAnnotationAtCenter,
    exportPdfAudit: async () => {
      const { exportAuditPdf } = await import('../../lib/pdf/exportAuditPdf')
      const { captureCanvasImage } = await import('../../lib/pdf/captureCanvasImage')

      const projectName = useProjectStore.getState().projectName
      const projectId = useProjectStore.getState().projectId

      // 1. Get canonical snapshot (expands collapsed groups)
      const snap = getCanonicalSnapshot(latestNodes.current, latestEdges.current)
      const currentVariables = useVariablesStore.getState().variables

      // 2. Build engine snapshot and evaluate
      const engineSnap = toEngineSnapshot(snap.nodes, snap.edges, constantsLookup, currentVariables)
      const evalResult = await engine.evaluateGraph(engineSnap)

      // 3. Compute snapshot hash
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

      // 4. Graph health
      const health = computeGraphHealth(snap.nodes, snap.edges)
      const healthSummary = formatHealthReport(health, t)

      // 5. Build audit model
      const model = buildAuditModel({
        projectName,
        projectId,
        exportTimestamp: new Date().toISOString(),
        buildVersion: BUILD_VERSION,
        buildSha: BUILD_SHA,
        buildTime: BUILD_TIME,
        buildEnv: BUILD_ENV,
        engineVersion: engine.engineVersion,
        contractVersion: engine.contractVersion,
        nodes: snap.nodes,
        edges: snap.edges,
        evalResult,
        healthSummary,
        snapshotHash,
      })

      // 6. Capture graph image via fallback ladder
      let graphImageBytes: Uint8Array | null = null
      const viewport = canvasWrapRef.current?.querySelector(
        '.react-flow__viewport',
      ) as HTMLElement | null
      if (viewport) {
        fitView({ padding: 0.15, duration: 0 })
        await new Promise((r) => setTimeout(r, 150))
        const result = await captureCanvasImage({
          element: viewport,
          backgroundColor:
            getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() ||
            '#1a1a2e',
        })
        graphImageBytes = result.bytes
      }

      // 7. Export PDF
      await exportAuditPdf(model, graphImageBytes)
    },

    exportXlsxAuditActive: async () => {
      const { exportAuditXlsx } = await import('../../lib/xlsx/exportAuditXlsx')

      const projectName = useProjectStore.getState().projectName
      const projectId = useProjectStore.getState().projectId

      // 1. Get canonical snapshot
      const snap = getCanonicalSnapshot(latestNodes.current, latestEdges.current)
      const currentVariables = useVariablesStore.getState().variables

      // 2. Build engine snapshot and evaluate
      const engineSnap = toEngineSnapshot(snap.nodes, snap.edges, constantsLookup, currentVariables)
      const evalResult = await engine.evaluateGraph(engineSnap)

      // 3. Compute snapshot hash
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

      // 4. Graph health
      const health = computeGraphHealth(snap.nodes, snap.edges)
      const healthSummary = formatHealthReport(health, t)

      // 5. Build audit model
      const model = buildAuditModel({
        projectName,
        projectId,
        exportTimestamp: new Date().toISOString(),
        buildVersion: BUILD_VERSION,
        buildSha: BUILD_SHA,
        buildTime: BUILD_TIME,
        buildEnv: BUILD_ENV,
        engineVersion: engine.engineVersion,
        contractVersion: engine.contractVersion,
        nodes: snap.nodes,
        edges: snap.edges,
        evalResult,
        healthSummary,
        snapshotHash,
      })

      // 6. Export XLSX
      await exportAuditXlsx(model, currentVariables)
    },

    captureViewportImage: async (signal?: AbortSignal) => {
      const { captureCanvasImage } = await import('../../lib/pdf/captureCanvasImage')

      const viewport = canvasWrapRef.current?.querySelector(
        '.react-flow__viewport',
      ) as HTMLElement | null

      if (!viewport) {
        return { bytes: null, rung: 'skipped' as const, error: 'Viewport element not found' }
      }

      fitView({ padding: 0.15, duration: 0 })
      await new Promise((r) => setTimeout(r, 300))

      return captureCanvasImage({
        element: viewport,
        backgroundColor:
          getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() ||
          '#1a1a2e',
        signal,
      })
    },
  }))

  // Panel widths + visibility (G5-1: persist width to localStorage)
  const [libWidth, setLibWidth] = useState(() => {
    const saved = localStorage.getItem('cs:libWidth')
    return saved ? Math.max(160, Math.min(420, Number(saved) || 200)) : 200
  })
  const [libVisible, setLibVisible] = useState(() => !isMobile)
  const [libFilterMain, setLibFilterMain] = useState<string | null>(null)

  // 8.01: Long-press on empty canvas opens block library on mobile
  const longPressHandlers = useLongPress(
    () => {
      if (!readOnly) setLibVisible(true)
    },
    { enabled: isMobile && !readOnly },
  )

  // Inspector state (select on click, open on double-click)
  const [inspectedId, setInspectedId] = useState<string | null>(null)
  const [inspPinned, setInspPinned] = useState(false)
  const { openWindow, closeWindow, isOpen: isWinOpen } = useWindowManager()
  const inspVisible = isWinOpen(INSPECTOR_WINDOW_ID)

  // V3-2.3: Sync inspected node ID to shared store for RightSidebar.
  const setSharedInspectedId = useStatusBarStore((s) => s.setInspectedNodeId)
  useEffect(() => {
    setSharedInspectedId(inspectedId)
  }, [inspectedId, setSharedInspectedId])

  // G5-1: Persist libWidth to localStorage
  useEffect(() => {
    localStorage.setItem('cs:libWidth', String(libWidth))
  }, [libWidth])

  // Auto-close panels when switching to mobile
  useEffect(() => {
    if (isMobile) {
      setLibVisible(false)
      closeWindow(INSPECTOR_WINDOW_ID)
    }
  }, [isMobile, closeWindow])

  // Snap-to-grid
  const [snapToGrid, setSnapToGrid] = useState(false)

  // Phase 10: Magnetic block-to-block snapping
  const [magneticSnap, _setMagneticSnap] = useState(() => {
    try {
      return localStorage.getItem('cs:magneticSnap') === 'true'
    } catch {
      return false
    }
  })
  const [snapGuides, setSnapGuides] = useState<import('../../hooks/useBlockSnapping').SnapGuide[]>(
    [],
  )
  const { computeSnap } = useBlockSnapping()

  // Formula bar (UX-16)
  const [formulaBarVisible, setFormulaBarVisible] = useState(getFormulaBarPref)

  // Presentation mode (UX-19)
  const [presentationMode, setPresentationMode] = useState(false)
  const [spotlightMode, setSpotlightMode] = useState(false)
  const [laserMode, setLaserMode] = useState(false)
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null)
  // 5.2: Entry announcement overlay
  const [showPresentationAnnouncement, setShowPresentationAnnouncement] = useState(false)

  // Bottom toolbar state
  const [panMode, setPanMode] = useState(false)
  const [locked, setLocked] = useState(false)
  const [minimap, setMinimap] = useState(getMinimapPref)
  const [paused, setPaused] = useState(false)
  const [engineKey, setEngineKey] = useState(0)

  // Phase 0: Track drag/interaction state to pause engine during drags.
  // Uses a ref (not state) so drag frames don't trigger re-renders.
  const isDraggingRef = useRef(false)
  const dragSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track whether the user manually paused via toolbar (so drag-unpause
  // doesn't override it).
  const userPausedRef = useRef(false)

  // Visual polish state (W12.1)
  const [edgesAnimated, setEdgesAnimated] = useState(getEdgesAnimatedPref)
  const [lodEnabled, setLodEnabled] = useState(getLodPref)
  const [lodTier, setLodTier] = useState<LodTier>('full')

  // Badge state (W12.4)
  const [badgesEnabled, setBadgesEnabled] = useState(getBadgesPref)
  const [edgeBadgesEnabled, setEdgeBadgesEnabled] = useState(getEdgeBadgesPref)

  // G5-2: Bottom dock collapsed state (persisted, default collapsed)
  const [dockCollapsed, setDockCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem('cs:dockCollapsed')
      // Default to collapsed when no preference saved
      return v === null ? true : v === 'true'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('cs:dockCollapsed', String(dockCollapsed))
    } catch {
      // ignore
    }
  }, [dockCollapsed])

  // Track dock height for minimap positioning
  const [dockHeight, setDockHeight] = useState(200)

  // Background dots (E7-2)
  const [bgDotsVisible, setBgDotsVisible] = useState(getBgDotsPref)

  // THEME-02: Canvas appearance preferences
  const canvasBgStyle = usePreferencesStore((s) => s.canvasBgStyle)
  const canvasGridSize = usePreferencesStore((s) => s.canvasGridSize)

  // SCI-06: Angle unit preference for trig blocks.
  const angleUnit = usePreferencesStore((s) => s.angleUnit)

  // 5.6: Auto-layout direction preference
  const autoLayoutDirection = usePreferencesStore((s) => s.autoLayoutDirection)

  // KB-01: User keybindings (read at render time so handler closure stays current)
  const keybindingOverrides = usePreferencesStore((s) => s.keybindings)

  // Grid dot colors from CSS variables (theme-aware)
  const gridMinorColor = useMemo(() => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--grid-minor-color')
      .trim()
    return v || 'rgba(255,255,255,0.18)'
  }, [bgDotsVisible]) // eslint-disable-line react-hooks/exhaustive-deps
  const gridMajorColor = useMemo(() => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--grid-major-color')
      .trim()
    return v || 'rgba(255,255,255,0.10)'
  }, [bgDotsVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  // K2-1: Hidden view mode — when true, hidden nodes are shown semi-transparent
  const [hiddenViewMode, setHiddenViewMode] = useState(false)
  // Track whether Space key triggered a drag (pan) to avoid accidental hide
  const spaceHeldRef = useRef(false)
  const spaceDraggedRef = useRef(false)

  // Value popover state (W12.4)
  const [popoverTarget, setPopoverTarget] = useState<{
    nodeId: string
    x: number
    y: number
  } | null>(null)

  // Auto-disable animation on large graphs with hysteresis (P083).
  // Ref persists whether animation was auto-disabled so we only re-enable
  // once the edge count drops below ANIM_EDGES_REENABLE_AT (< ANIM_EDGES_DISABLE_AT).
  const animAutoDisabledRef = useRef(false)
  const effectiveLodTier: LodTier = lodEnabled ? lodTier : 'full'

  const effectiveEdgesAnimated =
    // UI-PERF-01: disable animation at compact/minimal/nano (no benefit, only cost at low zoom)
    effectiveLodTier === 'full' &&
    computeEffectiveEdgesAnimated(edgesAnimated, edges.length, animAutoDisabledRef.current)
  // Keep hysteresis state in sync.  We are "auto-disabled" any time the user
  // wants animation ON but the gate forced it OFF (either over the hard
  // threshold or in the hysteresis band).
  animAutoDisabledRef.current = !effectiveEdgesAnimated && edgesAnimated

  // Perf-gate badges: auto-hide at >300 nodes
  const effectiveBadges = badgesEnabled && nodes.length <= 300
  const effectiveEdgeBadges = edgeBadgesEnabled && edges.length <= 200

  // Track zoom for LOD tier calculation (hysteresis via computeLodTier — P084).
  const setZoomPercent = useStatusBarStore((s) => s.setZoomPercent)
  useOnViewportChange({
    onChange: useCallback(
      ({ zoom }: { zoom: number }) => {
        setLodTier((prev) => computeLodTier(zoom, prev))
        setZoomPercent(Math.round(zoom * 100))
      },
      [setZoomPercent],
    ),
  })

  // V3-2.1: Sync node/edge counts and snap state to status bar store.
  const setStatusNodeCount = useStatusBarStore((s) => s.setNodeCount)
  const setStatusEdgeCount = useStatusBarStore((s) => s.setEdgeCount)
  const setStatusSnap = useStatusBarStore((s) => s.setSnapToGrid)
  useEffect(() => {
    setStatusNodeCount(nodes.length)
  }, [nodes.length, setStatusNodeCount])
  useEffect(() => {
    setStatusEdgeCount(edges.length)
  }, [edges.length, setStatusEdgeCount])
  useEffect(() => {
    setStatusSnap(snapToGrid)
  }, [snapToGrid, setStatusSnap])

  const { t } = useTranslation()
  const { toast } = useToast()

  // Notify parent of graph changes — skip the initial mount so loading a project
  // Notify parent of graph changes (for dirty marking + autosave).
  // Skip position-only changes to avoid unnecessary dirty-marking during node drags.
  // Engine evaluation is gated separately inside useGraphEngine (diffGraph).
  const isFirstRender = useRef(true)
  const prevNodesRef2 = useRef<readonly Node<NodeData>[]>([])
  const prevEdgesRef2 = useRef<readonly Edge[]>([])
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevNodesRef2.current = nodes
      prevEdgesRef2.current = edges
      return
    }
    const prevN = prevNodesRef2.current
    const prevE = prevEdgesRef2.current
    prevNodesRef2.current = nodes
    prevEdgesRef2.current = edges

    // Count change → structural change → always fire
    if (nodes.length !== prevN.length || edges.length !== prevE.length) {
      onGraphChange?.(nodes, edges)
      return
    }
    // Check if any node data changed (not just position)
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].data !== prevN[i]?.data || nodes[i].id !== prevN[i]?.id) {
        onGraphChange?.(nodes, edges)
        return
      }
    }
    // Check if any edge changed
    for (let i = 0; i < edges.length; i++) {
      if (edges[i].id !== prevE[i]?.id) {
        onGraphChange?.(nodes, edges)
        return
      }
    }
    // Position-only change — skip (don't dirty-mark or trigger autosave)
  }, [nodes, edges, onGraphChange])

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null)

  // ADV-04: Node comments
  const [comments, setComments] = useState<NodeComment[]>([])
  const [commentDialog, setCommentDialog] = useState<{
    nodeId: string
    x: number
    y: number
  } | null>(null)

  // Load comments whenever canvasId changes
  useEffect(() => {
    if (!canvasId) return
    let cancelled = false
    listNodeComments(canvasId)
      .then((data) => {
        if (!cancelled) setComments(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [canvasId])

  const refreshComments = useCallback(() => {
    if (!canvasId) return
    listNodeComments(canvasId)
      .then((data) => setComments(data))
      .catch(() => {})
  }, [canvasId])

  const commentCounts = useMemo((): ReadonlyMap<string, number> => {
    const map = new Map<string, number>()
    for (const c of comments) {
      if (!c.is_resolved) {
        map.set(c.node_id, (map.get(c.node_id) ?? 0) + 1)
      }
    }
    return map
  }, [comments])

  const openCommentThread = useCallback((nodeId: string) => {
    // Position dialog near center of viewport
    setCommentDialog({ nodeId, x: window.innerWidth / 2 - 150, y: 120 })
  }, [])

  const handleContextMenuComment = useCallback((nodeId: string) => {
    setCommentDialog({ nodeId, x: window.innerWidth / 2 - 150, y: 120 })
  }, [])

  // I2-1: Notation panel (chain-to-expression)
  const [notationTarget, setNotationTarget] = useState<{
    nodeId: string
    x: number
    y: number
  } | null>(null)

  // Quick-add palette (opened from canvas context menu "Add block here")
  const [quickAdd, setQuickAdd] = useState<{
    screenX: number
    screenY: number
    flowX: number
    flowY: number
  } | null>(null)

  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, zoomTo, getNode, getViewport } =
    useReactFlow()

  // UX-19: Presentation mode toggle
  const togglePresentationMode = useCallback(() => {
    setPresentationMode((prev) => {
      const next = !prev
      if (next) {
        setDockCollapsed(true)
        canvasWrapRef.current?.requestFullscreen().catch(() => {})
        // 5.2: Show entry announcement
        setShowPresentationAnnouncement(true)
        setTimeout(() => setShowPresentationAnnouncement(false), 1500)
      } else {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        setSpotlightMode(false)
        setLaserMode(false)
        setLaserPos(null)
        setShowPresentationAnnouncement(false)
      }
      return next
    })
  }, [])

  // ── Computed values (incremental via WASM engine) ──────────────────────────
  // ENG-04: primary engine provides catalog/constants; canvas-specific pool
  // engine handles evaluation so multiple canvases evaluate in parallel.
  const primaryEngine = useEngine()
  const { engine, engineSwitchCount } = useCanvasEngine(canvasId, primaryEngine)
  const variables = useVariablesStore((s) => s.variables)

  // W12.2: Build constants lookup + binding context from primary engine catalog
  // (catalog is identical across all pool workers).
  const constantsLookup = useMemo(
    () => buildConstantsLookup(primaryEngine.constantValues),
    [primaryEngine.constantValues],
  )
  const bindingCtx = useMemo(
    () => ({ constants: constantsLookup, catalog: primaryEngine.catalog }),
    [constantsLookup, primaryEngine.catalog],
  )

  // H7-1: Read published outputs for subscribe block resolution.
  // Flatten to channelName → number for the bridge.
  const publishedChannels = usePublishedOutputsStore((st) => st.channels)
  const publishedOutputs = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [name, ch] of Object.entries(publishedChannels)) {
      map[name] = ch.value
    }
    return map
  }, [publishedChannels])

  // ENG-04: when the engine switches (primary → dedicated), force a full
  // snapshot reload so the dedicated worker gets the current graph state.
  const combinedEngineKey = engineKey + engineSwitchCount

  // OBS-02: project ID for engine eval telemetry (read from store, not prop).
  const telemetryProjectId = useProjectStore((s) => s.projectId ?? undefined)
  const engineTelemetryOpts = useMemo(
    () => ({ projectId: telemetryProjectId, canvasId }),
    [telemetryProjectId, canvasId],
  )

  const { computed, computedStore, triggerEval, pendingPatchCount, engineDiagnostics } = useGraphEngine(
    nodes,
    edges,
    engine,
    undefined,
    combinedEngineKey,
    paused,
    constantsLookup,
    variables,
    publishedOutputs,
    engineTelemetryOpts,
    angleUnit,
  )

  // 3.22: Brief edge-flow pulse after each evaluation (particle-style animation).
  const [evalPulseActive, setEvalPulseActive] = useState(false)
  const evalPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (computed.size === 0) return
    // Fire a 1.2s animated pulse on each eval completion
    if (evalPulseTimerRef.current) clearTimeout(evalPulseTimerRef.current)
    setEvalPulseActive(true)
    evalPulseTimerRef.current = setTimeout(() => setEvalPulseActive(false), 1200)
  }, [computed]) // eslint-disable-line react-hooks/exhaustive-deps -- intentionally triggers on computed reference change

  // H7-1: After engine eval, update published outputs store with publish block values.
  const updateFromCanvas = usePublishedOutputsStore((st) => st.updateFromCanvas)
  useEffect(() => {
    if (!canvasId || computed.size === 0) return
    const entries: { channelName: string; value: number; sourceNodeId: string }[] = []
    for (const n of nodes) {
      const nd = n.data as NodeData
      if (nd.blockType === 'publish' && nd.publishChannelName) {
        const val = computed.get(n.id)
        if (val && val.kind === 'scalar') {
          entries.push({
            channelName: nd.publishChannelName,
            value: val.value,
            sourceNodeId: n.id,
          })
        }
      }
    }
    updateFromCanvas(canvasId, entries)
  }, [canvasId, computed, nodes, updateFromCanvas])

  // ── Auto-organise layout ──────────────────────────────────────────────────

  const handleAutoOrganise = useCallback(
    (direction: LayoutDirection = 'LR') => {
      // A.4: Include group nodes in layout targets so they get repositioned
      // alongside their children. Children's parentId is preserved.
      const selected = nodes.filter((n) => n.selected)
      const allTargets =
        selected.length >= 2
          ? // When selecting, also include parent groups of selected children
            (() => {
              const ids = new Set(selected.map((n) => n.id))
              // Add parent groups that have selected children
              for (const n of selected) {
                if (n.parentId && !ids.has(n.parentId)) {
                  const parent = nodes.find((p) => p.id === n.parentId)
                  if (parent) ids.add(parent.id)
                }
              }
              return nodes.filter((n) => ids.has(n.id))
            })()
          : nodes // layout all nodes including groups
      if (allTargets.length === 0) return

      const targetIds = new Set(allTargets.map((n) => n.id))
      const relevantEdges = edges.filter((e) => targetIds.has(e.source) && targetIds.has(e.target))

      const layoutNodes = allTargets.map((n) => ({
        id: n.id,
        width: (n.measured?.width as number | undefined) ?? DEFAULT_NODE_WIDTH,
        height: (n.measured?.height as number | undefined) ?? DEFAULT_NODE_HEIGHT,
        parentId: n.parentId,
        isGroup: n.type === 'csGroup',
      }))

      const result: AutoLayoutResult = autoLayout(layoutNodes, relevantEdges, direction)
      const { positions, groupSizes } = result

      doSaveHistory()
      // UX-05: Add CSS transition for smooth animated repositioning
      setNodes((nds) =>
        nds.map((n) => {
          const pos = positions.get(n.id)
          const groupSize = groupSizes.get(n.id)
          if (!pos && !groupSize) return n

          const updates: Record<string, unknown> = {
            ...n,
            style: {
              ...((n.style as React.CSSProperties | undefined) ?? {}),
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            },
          }

          // A.4: Apply position (already relative for children with parentId)
          if (pos) {
            updates.position = pos
          }

          // A.4: Resize group nodes to fit their children
          if (groupSize && n.type === 'csGroup') {
            updates.style = {
              ...((updates.style as React.CSSProperties | undefined) ?? {}),
              width: groupSize.width,
              height: groupSize.height,
            }
            // Also set width/height at top level for React Flow
            updates.width = groupSize.width
            updates.height = groupSize.height
          }

          return updates as typeof n
        }),
      )
      // Remove transition after animation completes
      setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) => {
            if (!positions.has(n.id) && !groupSizes.has(n.id)) return n
            const ns = { ...(n.style as React.CSSProperties | undefined) }
            delete (ns as Record<string, unknown>).transition
            return { ...n, style: Object.keys(ns).length ? ns : undefined }
          }),
        )
      }, 350)

      // Fit view after layout
      requestAnimationFrame(() => fitView({ padding: 0.15, duration: 300 }))
    },
    [nodes, edges, setNodes, fitView, doSaveHistory],
  )

  // ── Connection validation: 1 edge per input handle ──────────────────────────
  const isValidConnection = useCallback<IsValidConnection>(
    (conn) => !edges.some((e) => e.target === conn.target && e.targetHandle === conn.targetHandle),
    [edges],
  )

  const onConnect = useCallback(
    (params: Connection) => {
      doSaveHistory()
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges, doSaveHistory],
  )

  // ── Inspector: single-click selects, double-click opens inspector ───────────
  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      if (!inspPinned) setInspectedId(node.id)
    },
    [inspPinned],
  )

  const onNodeDoubleClick = useCallback(
    (_: MouseEvent, node: Node) => {
      if (!inspPinned) setInspectedId(node.id)
      openWindow(INSPECTOR_WINDOW_ID, INSPECTOR_DEFAULTS)
      if (isMobile) setLibVisible(false)
    },
    [isMobile, inspPinned, openWindow],
  )

  const onPaneClick = useCallback(() => {
    if (!inspPinned) setInspectedId(null)
    setNotationTarget(null)
    if (isMobile) {
      setLibVisible(false)
      closeWindow(INSPECTOR_WINDOW_ID)
    }
  }, [isMobile, inspPinned, closeWindow])

  const closeInspector = useCallback(() => {
    setInspectedId(null)
    closeWindow(INSPECTOR_WINDOW_ID)
  }, [closeWindow])

  // ── Drag-to-add from BlockLibrary ───────────────────────────────────────────
  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (readOnly) return

      // UX-12: OS file drop — CSV files create a tableInput block
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]
        const isCSV =
          file.type === 'text/csv' ||
          file.type === 'text/plain' ||
          file.name.toLowerCase().endsWith('.csv')
        if (isCSV) {
          const tableInputDef = BLOCK_REGISTRY.get('tableInput')
          if (tableInputDef?.proOnly && !isBlockEntitled(tableInputDef, ent)) {
            setShowUpgradeModal(true)
            return
          }
          const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          const reader = new FileReader()
          reader.onload = (ev) => {
            const text = ev.target?.result
            if (typeof text !== 'string') return
            const tableData = parseCSVToTableData(text)
            const id = `node_${++nodeIdCounter}`
            doSaveHistory()
            setNodes((nds) => [
              ...nds,
              {
                id,
                type: 'csData',
                position,
                data: {
                  blockType: 'tableInput',
                  label: file.name.replace(/\.csv$/i, ''),
                  tableData,
                },
              } as Node<NodeData>,
            ])
            toast(
              `CSV loaded: ${file.name} (${tableData.rows.length} rows \u00d7 ${tableData.columns.length} columns)`,
              'success',
            )
          }
          reader.readAsText(file)
        }
        return
      }

      // Block library drag
      const blockType = e.dataTransfer.getData(DRAG_TYPE)
      if (!blockType) return
      const def = BLOCK_REGISTRY.get(blockType)
      if (!def) return
      if (def.proOnly && !isBlockEntitled(def, ent)) {
        setShowUpgradeModal(true)
        return
      }
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const id = `node_${++nodeIdCounter}`
      doSaveHistory()
      setNodes((nds) => [
        ...nds,
        { id, type: def.nodeKind, position, data: { ...def.defaultData } } as Node<NodeData>,
      ])
    },
    [readOnly, ent, screenToFlowPosition, setNodes, doSaveHistory, toast],
  )

  // ── Context menus ───────────────────────────────────────────────────────────
  const onNodeContextMenu = useCallback(
    (e: MouseEvent, node: Node) => {
      e.preventDefault()
      const selectedCount = nodes.filter((n) => n.selected).length
      if (selectedCount > 1 && node.selected) {
        setContextMenu({
          kind: 'selection',
          x: e.clientX,
          y: e.clientY,
          selectedCount,
        })
      } else {
        setContextMenu({
          kind: 'node',
          x: e.clientX,
          y: e.clientY,
          nodeId: node.id,
          isLocked: node.draggable === false,
          isGroup: node.type === 'csGroup',
          isCollapsed: !!(node.data as NodeData).groupCollapsed,
          isAnnotation: node.type === 'csAnnotation',
        })
      }
    },
    [nodes],
  )

  const onEdgeContextMenu = useCallback(
    (e: MouseEvent, edge: Edge) => {
      e.preventDefault()
      // H1-2: Detect unit mismatch on the edge for context menu
      const srcNode = nodes.find((n) => n.id === edge.source)
      const tgtNode = nodes.find((n) => n.id === edge.target)
      const srcUnit = (srcNode?.data as NodeData | undefined)?.unit
      const tgtUnit = (tgtNode?.data as NodeData | undefined)?.unit
      const mm =
        srcUnit && tgtUnit && srcUnit !== tgtUnit ? getUnitMismatch(srcUnit, tgtUnit) : null
      setContextMenu({
        kind: 'edge',
        x: e.clientX,
        y: e.clientY,
        edgeId: edge.id,
        unitMismatch:
          mm && mm.sameDimension
            ? { sourceUnit: mm.sourceUnit, targetUnit: mm.targetUnit, factor: mm.factor }
            : undefined,
      })
    },
    [nodes],
  )

  const onPaneContextMenu = useCallback((e: MouseEvent | globalThis.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ kind: 'canvas', x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY })
  }, [])

  // ── Long-press context menu for touch devices ─────────────────────────────
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el || readOnly) return

    let timer: ReturnType<typeof setTimeout> | null = null
    let startPos: { x: number; y: number } | null = null
    let fired = false

    function findNodeId(target: EventTarget | null): string | null {
      let node = target as HTMLElement | null
      while (node && node !== el) {
        if (node.classList?.contains('react-flow__node')) {
          return node.dataset.id ?? null
        }
        node = node.parentElement
      }
      return null
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      startPos = { x: touch.clientX, y: touch.clientY }
      fired = false
      const nodeId = findNodeId(e.target)
      timer = setTimeout(() => {
        fired = true
        if (nodeId) {
          const n = nodes.find((nd) => nd.id === nodeId)
          if (n) {
            onNodeContextMenu(
              {
                clientX: startPos!.x,
                clientY: startPos!.y,
                preventDefault: () => {},
              } as unknown as MouseEvent,
              n as Node,
            )
          }
        } else {
          setContextMenu({ kind: 'canvas', x: startPos!.x, y: startPos!.y })
        }
      }, 500)
    }

    function onMove(e: TouchEvent) {
      if (!startPos || !timer) return
      const t = e.touches[0]
      if (Math.abs(t.clientX - startPos.x) > 10 || Math.abs(t.clientY - startPos.y) > 10) {
        clearTimeout(timer)
        timer = null
      }
    }

    function onEnd(e: TouchEvent) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (fired) e.preventDefault()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    return () => {
      if (timer) clearTimeout(timer)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [readOnly, nodes, onNodeContextMenu])

  // ── Context menu actions ────────────────────────────────────────────────────
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const src = nodes.find((n) => n.id === nodeId)
      if (!src) return
      const newId = `node_${++nodeIdCounter}`
      doSaveHistory()
      setNodes((nds) => [
        ...nds,
        {
          ...src,
          id: newId,
          position: { x: src.position.x + 24, y: src.position.y + 24 },
          selected: false,
        },
      ])
    },
    [nodes, setNodes, doSaveHistory],
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      doSaveHistory()
      setNodes((nds) => {
        // If deleting a group, also delete its children
        const node = nds.find((n) => n.id === nodeId)
        if (node?.type === 'csGroup') {
          const childIds = new Set(nds.filter((n) => n.parentId === nodeId).map((n) => n.id))
          childIds.add(nodeId)
          setEdges((eds) => eds.filter((e) => !childIds.has(e.source) && !childIds.has(e.target)))
          return nds.filter((n) => !childIds.has(n.id))
        }
        return nds.filter((n) => n.id !== nodeId)
      })
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      if (inspectedId === nodeId) setInspectedId(null)
    },
    [setNodes, setEdges, inspectedId, doSaveHistory],
  )

  const deleteEdge = useCallback(
    (edgeId: string) => {
      doSaveHistory()
      setEdges((eds) => eds.filter((e) => e.id !== edgeId))
    },
    [setEdges, doSaveHistory],
  )

  const inspectNode = useCallback(
    (nodeId: string) => {
      setInspectedId(nodeId)
      openWindow(INSPECTOR_WINDOW_ID, INSPECTOR_DEFAULTS)
    },
    [openWindow],
  )

  const inspectEdge = useCallback(
    (edgeId: string) => {
      const edge = latestEdges.current.find((e) => e.id === edgeId)
      if (edge) {
        setInspectedId(edge.source)
        openWindow(INSPECTOR_WINDOW_ID, INSPECTOR_DEFAULTS)
      }
    },
    [openWindow],
  )

  // H1-2: Insert a multiply-by-factor conversion node between two nodes on an edge
  const insertConversion = useCallback(
    (edgeId: string) => {
      const edge = latestEdges.current.find((e) => e.id === edgeId)
      if (!edge) return

      const srcNode = latestNodes.current.find((n) => n.id === edge.source)
      const tgtNode = latestNodes.current.find((n) => n.id === edge.target)
      if (!srcNode || !tgtNode) return

      const srcUnit = (srcNode.data as NodeData).unit
      const tgtUnit = (tgtNode.data as NodeData).unit
      if (!srcUnit || !tgtUnit) return

      const mm = getUnitMismatch(srcUnit, tgtUnit)
      if (!mm || !mm.sameDimension || mm.factor === undefined) return

      const convId = `node_${++nodeIdCounter}`
      const midX = (srcNode.position.x + tgtNode.position.x) / 2
      const midY = (srcNode.position.y + tgtNode.position.y) / 2

      const convLabel = `${getUnitSymbol(srcUnit)}\u2192${getUnitSymbol(tgtUnit)}`

      const convNode: Node<NodeData> = {
        id: convId,
        type: 'csOperation',
        position: { x: midX, y: midY },
        data: {
          blockType: 'multiply',
          label: convLabel,
          manualValues: { b: mm.factor },
          unit: tgtUnit,
        },
      }

      doSaveHistory()

      // Remove the old edge, add the conversion node, and two new edges
      setEdges((eds) => {
        const without = eds.filter((e) => e.id !== edgeId)
        const newEdge1: Edge = {
          id: `e_${edge.source}_${convId}`,
          source: edge.source,
          sourceHandle: edge.sourceHandle ?? 'out',
          target: convId,
          targetHandle: 'a',
        }
        const newEdge2: Edge = {
          id: `e_${convId}_${edge.target}`,
          source: convId,
          sourceHandle: 'out',
          target: edge.target,
          targetHandle: edge.targetHandle ?? 'value',
        }
        return [...without, newEdge1, newEdge2]
      })

      setNodes((nds) => [...nds, convNode])
    },
    [setNodes, setEdges, doSaveHistory],
  )

  // UX-15: Insert a Display probe node tapped off the edge source (non-destructive — original edge preserved)
  const addProbeNode = useCallback(
    (edgeId: string) => {
      const edge = latestEdges.current.find((e) => e.id === edgeId)
      if (!edge) return

      const srcNode = latestNodes.current.find((n) => n.id === edge.source)
      const tgtNode = latestNodes.current.find((n) => n.id === edge.target)
      if (!srcNode || !tgtNode) return

      const probeId = `node_${++nodeIdCounter}`
      // Position the probe below the midpoint of the edge
      const midX = (srcNode.position.x + tgtNode.position.x) / 2
      const midY = (srcNode.position.y + tgtNode.position.y) / 2 + 60

      const probeNode: Node<NodeData> = {
        id: probeId,
        type: 'csDisplay',
        position: { x: midX, y: midY },
        data: { blockType: 'display', label: 'Probe' },
      }

      const probeEdge: Edge = {
        id: `e_${edge.source}_${probeId}`,
        source: edge.source,
        sourceHandle: edge.sourceHandle ?? 'out',
        target: probeId,
        targetHandle: 'value',
      }

      doSaveHistory()
      setNodes((nds) => [...nds, probeNode])
      setEdges((eds) => [...eds, probeEdge])
    },
    [setNodes, setEdges, doSaveHistory],
  )

  // Rename: prompt for a new label then update node data directly
  const renameNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      const current = node?.data.label ?? ''
      const next = window.prompt('Rename block:', current)
      if (next !== null && next.trim()) {
        doSaveHistory()
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: next.trim() } } : n)),
        )
      }
    },
    [nodes, setNodes, doSaveHistory],
  )

  // Lock / unlock: toggles node.draggable (undefined = draggable, false = locked)
  const lockNode = useCallback(
    (nodeId: string) => {
      doSaveHistory()
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, draggable: n.draggable === false ? undefined : false } : n,
        ),
      )
    },
    [setNodes, doSaveHistory],
  )

  // UX-14: Set user accent color for a node (null clears it)
  const setNodeColor = useCallback(
    (nodeId: string, color: string | null) => {
      doSaveHistory()
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, userColor: color ?? undefined } } : n,
        ),
      )
    },
    [setNodes, doSaveHistory],
  )

  // UX-15: Disconnect all edges connected to a node
  const disconnectNode = useCallback(
    (nodeId: string) => {
      doSaveHistory()
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    },
    [setEdges, doSaveHistory],
  )

  // UX-15: Reset a node's data to its block's defaultData (preserves label)
  const resetNodeToDefault = useCallback(
    (nodeId: string) => {
      doSaveHistory()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const def = BLOCK_REGISTRY.get((n.data as NodeData).blockType)
          if (!def) return n
          return { ...n, data: { ...def.defaultData, label: (n.data as NodeData).label } }
        }),
      )
    },
    [setNodes, doSaveHistory],
  )

  // G6-2: Select all nodes and edges in the connected component of a given node
  const selectChain = useCallback(
    (seedId: string) => {
      const visited = new Set<string>()
      const queue = [seedId]
      while (queue.length > 0) {
        const id = queue.pop()!
        if (visited.has(id)) continue
        visited.add(id)
        for (const e of edges) {
          if (e.source === id && !visited.has(e.target)) queue.push(e.target)
          if (e.target === id && !visited.has(e.source)) queue.push(e.source)
        }
      }
      setNodes((nds) => nds.map((n) => ({ ...n, selected: visited.has(n.id) })))
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: visited.has(e.source) && visited.has(e.target),
        })),
      )
    },
    [edges, setNodes, setEdges],
  )

  // I2-1: Open notation panel for a node, positioned near the context menu click
  const showNotation = useCallback(
    (nodeId: string) => {
      const rect = canvasWrapRef.current?.getBoundingClientRect()
      const cx = contextMenu?.x ?? 0
      const cy = contextMenu?.y ?? 0
      setNotationTarget({
        nodeId,
        x: cx - (rect?.left ?? 0) + 12,
        y: cy - (rect?.top ?? 0) + 12,
      })
    },
    [contextMenu],
  )

  const deleteSelected = useCallback(() => {
    doSaveHistory()
    setEdges((eds) => {
      const selectedEdgeIds = new Set(eds.filter((e) => e.selected).map((e) => e.id))
      // Keep this set for node-deletion cascade below
      return selectedEdgeIds.size > 0 ? eds.filter((e) => !selectedEdgeIds.has(e.id)) : eds
    })
    setNodes((nds) => {
      const selected = nds.filter((n) => n.selected)
      const deleted = new Set(selected.map((n) => n.id))
      // Also cascade-delete children of selected groups
      for (const n of selected) {
        if (n.type === 'csGroup') {
          for (const child of nds) {
            if (child.parentId === n.id) deleted.add(child.id)
          }
        }
      }
      if (deleted.size === 0) return nds
      if (inspectedId && deleted.has(inspectedId)) setInspectedId(null)
      setEdges((eds) => eds.filter((e) => !deleted.has(e.source) && !deleted.has(e.target)))
      return nds.filter((n) => !deleted.has(n.id))
    })
  }, [setNodes, setEdges, inspectedId, doSaveHistory])

  // ── K2-1: Hide/show blocks ─────────────────────────────────────────────────

  const hideSelectedNodes = useCallback(() => {
    const selected = nodes.filter((n) => n.selected)
    if (selected.length === 0) return
    doSaveHistory()
    const selectedIds = new Set(selected.map((n) => n.id))
    setNodes((nds) =>
      nds.map((n) => (selectedIds.has(n.id) ? { ...n, hidden: true, selected: false } : n)),
    )
    // Also hide edges connected to hidden nodes
    setEdges((eds) =>
      eds.map((e) =>
        selectedIds.has(e.source) || selectedIds.has(e.target) ? { ...e, hidden: true } : e,
      ),
    )
  }, [nodes, doSaveHistory, setNodes, setEdges])

  const showAllHiddenNodes = useCallback(() => {
    const hasHidden = nodes.some((n) => n.hidden)
    if (!hasHidden) return
    doSaveHistory()
    setNodes((nds) => nds.map((n) => (n.hidden ? { ...n, hidden: false } : n)))
    // Restore edges: unhide edges whose both endpoints are now visible
    setEdges((eds) => eds.map((e) => (e.hidden ? { ...e, hidden: false } : e)))
  }, [nodes, doSaveHistory, setNodes, setEdges])

  const hasHiddenNodes = useMemo(() => nodes.some((n) => n.hidden), [nodes])

  // ── Group operations ──────────────────────────────────────────────────────
  const groupSelection = useCallback(() => {
    if (!ent.canUseGroups) {
      setShowUpgradeModal(true)
      return
    }
    const selectedIds = nodes.filter((n) => n.selected && n.type !== 'csGroup').map((n) => n.id)
    if (selectedIds.length < 2) return
    const { groupNode, updatedNodes } = createGroup(selectedIds, nodes)
    // Group node must come before its children in the array for React Flow parent rendering
    const nonSelected = updatedNodes.filter((n) => !selectedIds.includes(n.id))
    const selected = updatedNodes.filter((n) => selectedIds.includes(n.id))
    doSaveHistory()
    setNodes([...nonSelected, groupNode, ...selected] as Node<NodeData>[])
  }, [nodes, ent.canUseGroups, setNodes, doSaveHistory])

  const ungroupNode = useCallback(
    (groupId: string) => {
      if (!ent.canUseGroups) return
      // First expand if collapsed
      const group = nodes.find((n) => n.id === groupId)
      let currentNodes = nodes
      let currentEdges = edges
      if (group && (group.data as NodeData).groupCollapsed) {
        const expanded = expandGroup(groupId, currentNodes, currentEdges)
        currentNodes = expanded.nodes as Node<NodeData>[]
        currentEdges = expanded.edges
      }
      const result = ungroupNodes(groupId, currentNodes as Node<NodeData>[])
      doSaveHistory()
      setNodes(result)
      setEdges(currentEdges)
      if (inspectedId === groupId) setInspectedId(null)
    },
    [nodes, edges, ent.canUseGroups, setNodes, setEdges, inspectedId, doSaveHistory],
  )

  const toggleGroupCollapse = useCallback(
    (groupId: string) => {
      const group = nodes.find((n) => n.id === groupId)
      if (!group) return
      doSaveHistory()
      const isCollapsed = (group.data as NodeData).groupCollapsed
      if (isCollapsed) {
        const result = expandGroup(groupId, nodes, edges)
        setNodes(result.nodes as Node<NodeData>[])
        setEdges(result.edges)
      } else {
        // W12.5: Warn about boundary-crossing edges before collapsing
        const crossing = getCrossingEdgesForGroup(groupId, nodes, edges)
        if (crossing.length > 0) {
          toast(t('canvas.collapseCrossingWarn', { count: crossing.length }), 'info')
        }
        const result = collapseGroup(groupId, nodes, edges)
        setNodes(result.nodes as Node<NodeData>[])
        setEdges(result.edges)
      }
    },
    [nodes, edges, setNodes, setEdges, doSaveHistory, toast, t],
  )

  // Phase 11: Auto-resize group to fit member nodes
  const resizeGroupToFit = useCallback(
    (groupId: string) => {
      const resized = autoResizeGroup(groupId, nodes)
      if (!resized) return
      doSaveHistory()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== resized.id) return n
          return { ...n, position: resized.position, style: resized.style }
        }),
      )
    },
    [nodes, setNodes, doSaveHistory],
  )

  const saveAsTemplate = useCallback(
    (groupId: string) => {
      if (!ent.canUseGroups) return
      const group = nodes.find((n) => n.id === groupId)
      if (!group) return
      const nd = group.data as NodeData
      const name = window.prompt('Saved group name:', nd.label)
      if (!name?.trim()) return
      const memberNodes = nodes.filter((n) => n.parentId === groupId)
      const memberIds = new Set(memberNodes.map((n) => n.id))
      const internalEdges = edges.filter((e) => memberIds.has(e.source) && memberIds.has(e.target))
      // Normalize positions to origin
      let minX = Infinity,
        minY = Infinity
      for (const m of memberNodes) {
        if (m.position.x < minX) minX = m.position.x
        if (m.position.y < minY) minY = m.position.y
      }
      const payload: TemplatePayload = {
        nodes: memberNodes.map((n) => ({
          ...n,
          position: { x: n.position.x - minX, y: n.position.y - minY },
          parentId: undefined,
        })) as unknown as Record<string, unknown>[],
        edges: internalEdges as unknown as Record<string, unknown>[],
      }
      saveTemplateApi(name.trim(), nd.groupColor ?? '#1CABB0', payload).catch(() => {
        // Silently handle — template save failure is non-critical
      })
    },
    [nodes, edges, ent.canUseGroups],
  )

  const onInsertTemplate = useCallback(
    (template: Template) => {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      const {
        groupNode,
        memberNodes,
        edges: newEdges,
      } = insertTemplate(template.payload, center, template.name, template.color)
      doSaveHistory()
      setNodes((nds) => [...nds, groupNode, ...memberNodes] as Node<NodeData>[])
      setEdges((eds) => [...eds, ...newEdges])
    },
    [screenToFlowPosition, setNodes, setEdges, doSaveHistory],
  )

  // ── Undo / Redo handlers ──────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    const prev = historyUndo({ nodes: latestNodes.current, edges: latestEdges.current })
    if (!prev) return
    setNodes(prev.nodes)
    setEdges(prev.edges)
  }, [historyUndo, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    const next = historyRedo({ nodes: latestNodes.current, edges: latestEdges.current })
    if (!next) return
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [historyRedo, setNodes, setEdges])

  /** UX-16: Commit a new numeric value from the formula bar. */
  const handleFormulaCommit = useCallback(
    (nodeId: string, value: number) => {
      doSaveHistory()
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data as NodeData), value } } : n)),
      )
    },
    [doSaveHistory, setNodes],
  )

  // Phase 11: Handle CSEL expression submission — parse, generate blocks, add to canvas
  const handleExpressionSubmit = useCallback(
    (expression: string) => {
      const ast = parseCsel(expression)
      if (ast.length === 0) return

      // Get viewport center for positioning
      const vp = getViewport()
      const startX = (-vp.x + 200) / vp.zoom
      const startY = (-vp.y + 200) / vp.zoom

      const graph = generateGraph(ast, startX, startY)
      if (graph.nodes.length === 0) return

      doSaveHistory()

      // Convert generated nodes to React Flow format
      const newNodes = graph.nodes.map((gn) => ({
        id: gn.id,
        type: gn.type,
        position: gn.position,
        data: gn.data as NodeData,
      }))

      // Add nodes and edges
      setNodes((nds) => [...nds, ...newNodes])
      setEdges((eds) => [
        ...eds,
        ...graph.edges.map((ge) => ({
          id: ge.id,
          source: ge.source,
          sourceHandle: ge.sourceHandle,
          target: ge.target,
          targetHandle: ge.targetHandle,
        })),
      ])
    },
    [doSaveHistory, setNodes, setEdges, getViewport],
  )

  /** UX-10: Restore to a specific history entry (displayIdx 0 = most recent). */
  const handleRestoreHistory = useCallback(
    (displayIdx: number) => {
      const target = historyRestoreToIndex(displayIdx, {
        nodes: latestNodes.current,
        edges: latestEdges.current,
      })
      if (!target) return
      setNodes(target.nodes)
      setEdges(target.edges)
    },
    [historyRestoreToIndex, setNodes, setEdges],
  )

  // ── Clipboard handlers ──────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    const selected = latestNodes.current.filter((n) => n.selected)
    if (selected.length === 0) return
    copyToClipboard(selected, latestEdges.current)
  }, [])

  const handleCut = useCallback(() => {
    handleCopy()
    deleteSelected()
  }, [handleCopy, deleteSelected])

  const handlePaste = useCallback(() => {
    // Try in-memory clipboard first; fall back to system clipboard for cross-tab paste
    const inMemory = pasteFromClipboard()
    if (inMemory) {
      doSaveHistory()
      setNodes((nds) => [
        ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
        ...inMemory.nodes,
      ])
      setEdges((eds) => [...eds, ...inMemory.edges])
      return
    }
    // UX-04: Try system clipboard for cross-tab paste
    pasteFromSystemClipboard()
      .then((sys) => {
        if (!sys) return
        doSaveHistory()
        setNodes((nds) => [
          ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
          ...sys.nodes,
        ])
        setEdges((eds) => [...eds, ...sys.edges])
      })
      .catch(() => {})
  }, [doSaveHistory, setNodes, setEdges])

  // ── Select all ──────────────────────────────────────────────────────────

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
  }, [setNodes])

  // ── Alignment helpers (E7-2) ──────────────────────────────────────────────

  const alignSelection = useCallback(
    (op: AlignOp) => {
      const selected = latestNodes.current.filter((n) => n.selected)
      const positions = computeAlignment(selected, op)
      if (positions.size === 0) return
      doSaveHistory()
      setNodes((nds) =>
        nds.map((n) => {
          const pos = positions.get(n.id)
          return pos ? { ...n, position: pos } : n
        }),
      )
    },
    [doSaveHistory, setNodes],
  )

  // ── Find block ──────────────────────────────────────────────────────────

  const [findOpen, setFindOpen] = useState(false)
  // UX-09: IDs of nodes matching the current search query (null = no active search)
  const [searchMatchIds, setSearchMatchIds] = useState<string[] | null>(null)

  // UX-03: Command palette
  const [paletteOpen, setPaletteOpen] = useState(false)

  // UX-03: Build the commands list for the palette
  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    if (readOnly) return []
    const cmds: PaletteCommand[] = [
      {
        id: 'undo',
        kind: 'action',
        label: 'Undo',
        hint: 'Reverse the last change',
        kbd: 'Ctrl+Z',
        icon: '↩',
        onExecute: handleUndo,
      },
      {
        id: 'redo',
        kind: 'action',
        label: 'Redo',
        hint: 'Re-apply the last undone change',
        kbd: 'Ctrl+Shift+Z',
        icon: '↪',
        onExecute: handleRedo,
      },
      {
        id: 'fitView',
        kind: 'action',
        label: 'Fit view',
        hint: 'Zoom to show all nodes',
        kbd: 'Ctrl+Shift+F',
        icon: '⊡',
        onExecute: () => fitView({ padding: 0.15, duration: 300 }),
      },
      {
        id: 'selectAll',
        kind: 'action',
        label: 'Select all',
        hint: 'Select all nodes',
        kbd: 'Ctrl+A',
        icon: '▣',
        onExecute: selectAll,
      },
      {
        id: 'deleteSelected',
        kind: 'action',
        label: 'Delete selected',
        hint: 'Delete selected nodes and edges',
        kbd: 'Del',
        icon: '✕',
        onExecute: deleteSelected,
      },
      {
        id: 'copy',
        kind: 'action',
        label: 'Copy',
        hint: 'Copy selected nodes to clipboard',
        kbd: 'Ctrl+C',
        icon: '⎘',
        onExecute: handleCopy,
      },
      {
        id: 'paste',
        kind: 'action',
        label: 'Paste',
        hint: 'Paste nodes from clipboard',
        kbd: 'Ctrl+V',
        icon: '⎗',
        onExecute: handlePaste,
      },
      {
        id: 'autoLayout',
        kind: 'action',
        label: 'Auto-layout',
        hint: 'Arrange nodes in a clean hierarchy',
        icon: '⊞',
        onExecute: () => handleAutoOrganise('LR'),
      },
      {
        id: 'toggleLibrary',
        kind: 'action',
        label: 'Toggle block library',
        hint: 'Show or hide the block library panel',
        icon: '⊟',
        onExecute: () => setLibVisible((v) => !v),
      },
      {
        id: 'toggleSnap',
        kind: 'action',
        label: 'Toggle snap to grid',
        hint: 'Enable or disable snap to grid',
        icon: '⊞',
        onExecute: () => setSnapToGrid((v) => !v),
      },
      {
        id: 'toggleMinimap',
        kind: 'action',
        label: 'Toggle minimap',
        hint: 'Show or hide the minimap',
        icon: '⊟',
        onExecute: () => {
          setMinimap((v) => {
            setMinimapPref(!v)
            return !v
          })
        },
      },
      {
        id: 'toggleFormulaBar',
        kind: 'action',
        label: 'Toggle formula bar',
        hint: 'Show or hide the formula/expression bar',
        kbd: 'Ctrl+Shift+F',
        icon: '=',
        onExecute: () => {
          setFormulaBarVisible((v) => {
            setFormulaBarPref(!v)
            return !v
          })
        },
      },
      {
        id: 'findBlock',
        kind: 'action',
        label: 'Find block',
        hint: 'Search and navigate to a block by label',
        kbd: 'Ctrl+F',
        icon: '⌕',
        onExecute: () => setFindOpen(true),
      },
      {
        id: 'groupSelection',
        kind: 'action',
        label: 'Group selection',
        hint: 'Wrap selected nodes in a group',
        kbd: 'Ctrl+G',
        icon: '▢',
        onExecute: groupSelection,
      },
      {
        id: 'togglePresentation',
        kind: 'action',
        label: 'Toggle presentation mode',
        hint: 'Enter/exit fullscreen clean canvas view',
        kbd: 'Ctrl+Shift+P',
        icon: '⎙',
        onExecute: togglePresentationMode,
      },
    ]
    return cmds
  }, [
    readOnly,
    handleUndo,
    handleRedo,
    fitView,
    selectAll,
    deleteSelected,
    handleCopy,
    handlePaste,
    handleAutoOrganise,
    groupSelection,
    togglePresentationMode,
  ])

  // UX-03: Node labels for navigation search
  const paletteNodeLabels = useMemo(() => {
    return nodes
      .filter((n) => n.data?.label && !n.hidden)
      .map((n) => ({
        id: n.id,
        label: (n.data as NodeData).label,
        onJump: () => {
          setNodes((nds) => nds.map((nd) => ({ ...nd, selected: nd.id === n.id })))
          requestAnimationFrame(() => {
            fitView({ nodes: [{ id: n.id }], padding: 0.5, duration: 400 })
          })
        },
      }))
  }, [nodes, setNodes, fitView])

  const focusNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })))
      requestAnimationFrame(() => {
        fitView({ nodes: [{ id: nodeId }], padding: 0.5, duration: 400 })
      })
    },
    [setNodes, fitView],
  )

  const handleFindClose = useCallback(() => {
    setFindOpen(false)
    setSearchMatchIds(null)
  }, [])

  const handleMatchesChange = useCallback((ids: string[]) => {
    setSearchMatchIds(ids.length > 0 ? ids : null)
  }, [])

  // ── Value popover + context actions (W12.4) ─────────────────────────────

  const showValuePopover = useCallback<ShowValuePopover>(
    (nodeId, x, y) => setPopoverTarget({ nodeId, x, y }),
    [],
  )

  const copyNodeValue = useCallback(
    (nodeId: string) => {
      const v = computed.get(nodeId)
      copyValueToClipboard(v, 'compact')
    },
    [computed],
  )

  const jumpToNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })))
      requestAnimationFrame(() => {
        fitView({ nodes: [{ id: nodeId }], padding: 0.5, duration: 400 })
      })
    },
    [setNodes, fitView],
  )

  // ── Drag undo ──────────────────────────────────────────────────────────

  const onNodeDragStart = useCallback(() => {
    doSaveHistory()
    // Phase 0: Pause engine during drag for 60fps canvas interaction.
    isDraggingRef.current = true
    if (dragSettleTimerRef.current !== null) {
      clearTimeout(dragSettleTimerRef.current)
      dragSettleTimerRef.current = null
    }
    setPaused(true)
  }, [doSaveHistory])

  // Phase 11: Auto-resize parent group when a member is dragged
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      onNodeDragStopProp?.(event, node)
      // Find the dragged node's parentId to auto-resize its group
      const dragged = nodes.find((n) => n.id === node.id)
      if (dragged?.parentId) {
        const resized = autoResizeGroup(dragged.parentId, nodes)
        if (resized) {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id !== resized.id) return n
              return { ...n, position: resized.position, style: resized.style }
            }),
          )
        }
      }
      // Phase 10: Clear snap guides on drag stop
      setSnapGuides([])
      // Phase 0: Unpause engine after drag with 200ms settle delay.
      // This prevents thrashing on rapid drag-release-drag sequences.
      // Respects user's manual pause — if they paused via toolbar before
      // dragging, we don't unpause on drag stop.
      isDraggingRef.current = false
      if (dragSettleTimerRef.current !== null) {
        clearTimeout(dragSettleTimerRef.current)
      }
      dragSettleTimerRef.current = setTimeout(() => {
        dragSettleTimerRef.current = null
        if (!userPausedRef.current) {
          setPaused(false)
        }
      }, 200)
    },
    [nodes, setNodes, onNodeDragStopProp],
  )

  // Phase 10: Magnetic snap during drag
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
      if (!magneticSnap) {
        setSnapGuides([])
        return
      }
      const result = computeSnap(node.id, node.position.x, node.position.y, nodes)
      setSnapGuides(result.guides)
      if (result.snapped) {
        // Update node position to snapped position
        setNodes((nds) =>
          nds.map((n) => (n.id === node.id ? { ...n, position: { x: result.x, y: result.y } } : n)),
        )
      }
    },
    [magneticSnap, computeSnap, nodes, setNodes],
  )

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      // Escape always works
      if (e.key === 'Escape') {
        setContextMenu(null)
        setNotationTarget(null)
        setFindOpen(false)
        setPaletteOpen(false)
        closeInspector()
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      // KB-01: helper to get effective binding for an action
      const kb = (action: keyof typeof DEFAULT_KEYBINDINGS) =>
        keybindingOverrides[action] ?? DEFAULT_KEYBINDINGS[action]

      // Command palette (configurable, works even in input fields)
      if (matchesBinding(e, kb('commandPalette'))) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      // Ctrl+Shift+F: toggle formula bar (UX-16)
      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setFormulaBarVisible((v) => {
          setFormulaBarPref(!v)
          return !v
        })
        return
      }

      // Ctrl+Shift+P: toggle presentation mode (UX-19)
      if (ctrl && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        togglePresentationMode()
        return
      }

      // Escape: exit presentation mode if active (UX-19)
      if (e.key === 'Escape' && presentationMode) {
        e.preventDefault()
        togglePresentationMode()
        return
      }

      // Phase 1: Ctrl+Enter or F5 → trigger evaluation (Run)
      if ((ctrl && e.key === 'Enter') || e.key === 'F5') {
        e.preventDefault()
        triggerEval()
        return
      }

      // Skip shortcuts when typing in form fields
      if (isInput) return

      // Delete selection (configurable)
      if ((matchesBinding(e, kb('deleteSelection')) || e.key === 'Backspace') && !readOnly) {
        deleteSelected()
      }

      // Undo (configurable)
      if (matchesBinding(e, kb('undo')) && !readOnly) {
        e.preventDefault()
        handleUndo()
      }

      // Redo (configurable) — also keep Ctrl+Y fallback
      if ((matchesBinding(e, kb('redo')) || (ctrl && e.key === 'y')) && !readOnly) {
        e.preventDefault()
        handleRedo()
      }

      // Ctrl+C: Copy
      if (ctrl && e.key === 'c' && !e.shiftKey) {
        e.preventDefault()
        handleCopy()
      }

      // Ctrl+X: Cut
      if (ctrl && e.key === 'x' && !readOnly) {
        e.preventDefault()
        handleCut()
      }

      // Ctrl+V: Paste
      if (ctrl && e.key === 'v' && !readOnly) {
        e.preventDefault()
        handlePaste()
      }

      // Select all (configurable)
      if (matchesBinding(e, kb('selectAll'))) {
        e.preventDefault()
        selectAll()
      }

      // Ctrl+F: Find block
      if (ctrl && e.key === 'f') {
        e.preventDefault()
        setFindOpen(true)
      }

      // Ctrl+G: Group selected nodes
      if (ctrl && e.key === 'g' && !e.shiftKey && !readOnly) {
        e.preventDefault()
        groupSelection()
      }

      // Ctrl+Shift+G: Ungroup selected group
      if (ctrl && e.key === 'G' && e.shiftKey && !readOnly) {
        e.preventDefault()
        const selectedGroup = nodes.find((n) => n.selected && n.type === 'csGroup')
        if (selectedGroup) ungroupNode(selectedGroup.id)
      }

      // Alt+E: Toggle animated edges
      if (e.altKey && e.key === 'e') {
        e.preventDefault()
        setEdgesAnimated((v) => {
          setEdgesAnimatedPref(!v)
          return !v
        })
      }

      // Alt+L: Toggle LOD
      if (e.altKey && e.key === 'l') {
        e.preventDefault()
        setLodEnabled((v) => {
          setLodPref(!v)
          return !v
        })
      }

      // Ctrl+Shift+D: Toggle bottom dock (configurable)
      if (matchesBinding(e, kb('toggleBottomDock'))) {
        e.preventDefault()
        setDockCollapsed((v) => !v)
      }

      // Ctrl+Shift+B: Toggle value badges
      if (ctrl && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        setBadgesEnabled((v) => {
          setBadgesPref(!v)
          return !v
        })
      }

      // Ctrl+Shift+E: Toggle edge badges
      if (ctrl && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        setEdgeBadgesEnabled((v) => {
          setEdgeBadgesPref(!v)
          return !v
        })
      }

      // Ctrl+Alt+G: Toggle collapse on selected group (W12.5)
      if (ctrl && e.altKey && e.key === 'g' && !readOnly) {
        e.preventDefault()
        const selectedGroup = nodes.find((n) => n.selected && n.type === 'csGroup')
        if (selectedGroup) toggleGroupCollapse(selectedGroup.id)
      }

      // Ctrl+Shift+H: Toggle bottom dock
      if (ctrl && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        setDockCollapsed((v) => !v)
      }

      // UX-20: Ctrl+= or Ctrl++ zoom in
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomIn({ duration: 200 })
      }

      // UX-20: Ctrl+- zoom out
      if (ctrl && e.key === '-') {
        e.preventDefault()
        zoomOut({ duration: 200 })
      }

      // Zoom to fit (configurable)
      if (matchesBinding(e, kb('zoomFit'))) {
        e.preventDefault()
        fitView({ padding: 0.15, duration: 300 })
      }

      // UX-20: Ctrl+Shift+0 zoom to 100%
      if (ctrl && e.shiftKey && (e.key === '0' || e.key === ')')) {
        e.preventDefault()
        zoomTo(1, { duration: 300 })
      }

      // UX-20: Arrow keys — nudge selected nodes (1px, or 10px with Ctrl)
      if (
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown') &&
        !e.altKey &&
        !readOnly
      ) {
        const hasSelected = nodes.some((n) => n.selected)
        if (hasSelected) {
          e.preventDefault()
          const step = ctrl ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          setNodes((nds) =>
            nds.map((n) =>
              n.selected && n.draggable !== false
                ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                : n,
            ),
          )
        }
      }

      // K2-1: Space key down — mark held (hide happens on keyUp if no drag occurred)
      if (e.key === ' ' && !ctrl && !e.altKey && !e.shiftKey && !readOnly) {
        spaceHeldRef.current = true
        spaceDraggedRef.current = false
      }
    },
    [
      readOnly,
      closeInspector,
      deleteSelected,
      handleUndo,
      handleRedo,
      handleCopy,
      handleCut,
      handlePaste,
      selectAll,
      groupSelection,
      ungroupNode,
      toggleGroupCollapse,
      nodes,
      zoomIn,
      zoomOut,
      zoomTo,
      fitView,
      setNodes,
      presentationMode,
      togglePresentationMode,
      keybindingOverrides,
      triggerEval,
    ],
  )

  // K2-1: Space key up — hide selected if no drag occurred during Space hold
  const onKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' && spaceHeldRef.current) {
        spaceHeldRef.current = false
        if (!spaceDraggedRef.current && !readOnly) {
          const hasSelection = nodes.some((n) => n.selected)
          if (hasSelection) {
            hideSelectedNodes()
          }
        }
        spaceDraggedRef.current = false
      }
    },
    [readOnly, nodes, hideSelectedNodes],
  )

  // K2-1: Detect drag start during Space hold to distinguish pan from hide
  const onMoveStart = useCallback(() => {
    if (spaceHeldRef.current) {
      spaceDraggedRef.current = true
    }
    // Phase 0: Pause engine during viewport pan/zoom for smooth interaction.
    if (!isDraggingRef.current) {
      isDraggingRef.current = true
      if (dragSettleTimerRef.current !== null) {
        clearTimeout(dragSettleTimerRef.current)
        dragSettleTimerRef.current = null
      }
      setPaused(true)
    }
  }, [])

  const onMoveEnd = useCallback(() => {
    // Phase 0: Unpause engine after viewport pan/zoom with settle delay.
    isDraggingRef.current = false
    if (dragSettleTimerRef.current !== null) {
      clearTimeout(dragSettleTimerRef.current)
    }
    dragSettleTimerRef.current = setTimeout(() => {
      dragSettleTimerRef.current = null
      if (!userPausedRef.current) {
        setPaused(false)
      }
    }, 200)
  }, [])

  // Insert annotation at the canvas position where user right-clicked (G6-1)
  const onInsertAnnotation = useCallback(
    (screenX: number, screenY: number, annotationType: string) => {
      const aDef = ANNOTATION_REGISTRY.get(annotationType)
      if (!aDef) return
      const position = screenToFlowPosition({ x: screenX, y: screenY })
      const id = `node_${++nodeIdCounter}`
      doSaveHistory()
      setNodes((nds) => [
        ...nds,
        { id, type: 'csAnnotation', position, data: { ...aDef.defaultData } } as Node<NodeData>,
      ])
    },
    [screenToFlowPosition, setNodes, doSaveHistory],
  )

  // Insert annotation at the center of the viewport (toolbar action, I3-1)
  const onInsertAnnotationAtCenter = useCallback(
    (annotationType: string) => {
      const aDef = ANNOTATION_REGISTRY.get(annotationType)
      if (!aDef) return
      const rect = canvasWrapRef.current?.getBoundingClientRect()
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      const position = screenToFlowPosition({ x: cx, y: cy })
      const id = `node_${++nodeIdCounter}`
      doSaveHistory()
      setNodes((nds) => [
        ...nds,
        { id, type: 'csAnnotation', position, data: { ...aDef.defaultData } } as Node<NodeData>,
      ])
    },
    [screenToFlowPosition, setNodes, doSaveHistory],
  )

  // UX-22: Annotation insert commands for the command palette (defined after onInsertAnnotationAtCenter)
  const annotationPaletteCommands = useMemo<PaletteCommand[]>(
    () =>
      readOnly
        ? []
        : [
            {
              id: 'insertAnnotText',
              kind: 'action',
              label: 'Insert text annotation',
              hint: 'Add a text label to the canvas',
              icon: 'A',
              onExecute: () => onInsertAnnotationAtCenter('annotation_text'),
            },
            {
              id: 'insertAnnotCallout',
              kind: 'action',
              label: 'Insert callout box',
              hint: 'Add a callout note box to the canvas',
              icon: '▭',
              onExecute: () => onInsertAnnotationAtCenter('annotation_callout'),
            },
            {
              id: 'insertAnnotStickyNote',
              kind: 'action',
              label: 'Insert sticky note',
              hint: 'Add a sticky note to the canvas',
              icon: '📝',
              onExecute: () => onInsertAnnotationAtCenter('annotation_sticky_note'),
            },
            {
              id: 'insertAnnotHighlight',
              kind: 'action',
              label: 'Insert highlight region',
              hint: 'Add a highlight region to the canvas',
              icon: '◻',
              onExecute: () => onInsertAnnotationAtCenter('annotation_highlight'),
            },
            {
              id: 'insertAnnotArrow',
              kind: 'action',
              label: 'Insert arrow annotation',
              hint: 'Add an arrow to the canvas',
              icon: '→',
              onExecute: () => onInsertAnnotationAtCenter('annotation_arrow'),
            },
          ],
    [readOnly, onInsertAnnotationAtCenter],
  )

  // V3-5.1: Z-order annotation nodes
  const onAnnotationZOrder = useCallback(
    (nodeId: string, op: 'front' | 'back' | 'forward' | 'backward') => {
      doSaveHistory()
      setNodes((nds) => {
        // Collect annotation z-indices
        const annots = nds.filter((n) => n.type === 'csAnnotation')
        const zValues = annots.map((n) => (n.data as NodeData).annotationZIndex ?? 0)
        const maxZ = zValues.length > 0 ? Math.max(...zValues) : 0
        const minZ = zValues.length > 0 ? Math.min(...zValues) : 0

        return nds.map((n) => {
          if (n.id !== nodeId) return n
          const cur = (n.data as NodeData).annotationZIndex ?? 0
          let newZ = cur
          if (op === 'front') newZ = maxZ + 1
          else if (op === 'back') newZ = minZ - 1
          else if (op === 'forward') newZ = cur + 1
          else if (op === 'backward') newZ = cur - 1
          return {
            ...n,
            zIndex: newZ,
            data: { ...n.data, annotationZIndex: newZ },
          }
        })
      })
    },
    [setNodes, doSaveHistory],
  )

  // Add block at the canvas position where user right-clicked
  const onAddBlockAtCursor = useCallback(
    (screenX: number, screenY: number) => {
      const pos = screenToFlowPosition({ x: screenX, y: screenY })
      setQuickAdd({ screenX, screenY, flowX: pos.x, flowY: pos.y })
    },
    [screenToFlowPosition],
  )

  const onQuickAddBlock = useCallback(
    (blockType: string) => {
      if (!quickAdd) return
      const def = BLOCK_REGISTRY.get(blockType)
      if (!def) return
      const id = `node_${++nodeIdCounter}`
      doSaveHistory()
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: def.nodeKind,
          position: { x: quickAdd.flowX, y: quickAdd.flowY },
          data: { ...def.defaultData },
        } as Node<NodeData>,
      ])
      setQuickAdd(null)
    },
    [quickAdd, setNodes, doSaveHistory],
  )

  // UX-02: Insert a block at the canvas viewport center (keyboard/double-click from library)
  const insertBlockAtCenter = useCallback(
    (blockType: string) => {
      const def = BLOCK_REGISTRY.get(blockType)
      if (!def) return
      const rect = canvasWrapRef.current?.getBoundingClientRect()
      const screenX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const screenY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      const pos = screenToFlowPosition({ x: screenX, y: screenY })
      const id = `node_${++nodeIdCounter}`
      doSaveHistory()
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: def.nodeKind,
          position: pos,
          data: { ...def.defaultData },
        } as Node<NodeData>,
      ])
    },
    [screenToFlowPosition, setNodes, doSaveHistory],
  )

  // ── Panel resize start handlers ─────────────────────────────────────────────
  const onLibResizeStart = useCallback(
    (e: React.MouseEvent) => makeResizeHandler(libWidth, setLibWidth, 1)(e),
    [libWidth],
  )

  // ── Mobile panel width ────────────────────────────────────────────────────
  const mobileDrawerWidth = isMobile ? Math.min(280, window.innerWidth * 0.85) : 0

  // K2-1: In hidden-view mode, reveal hidden nodes as ghosts (opacity 0.3)
  const displayedNodes = useMemo(() => {
    if (!hiddenViewMode) return nodes
    return nodes.map((n) =>
      n.hidden
        ? {
            ...n,
            hidden: false,
            style: { ...n.style, opacity: 0.3, pointerEvents: 'none' as const },
          }
        : n,
    )
  }, [nodes, hiddenViewMode])

  const displayedEdges = useMemo(() => {
    if (!hiddenViewMode) return edges
    return edges.map((e) =>
      e.hidden ? { ...e, hidden: false, style: { ...e.style, opacity: 0.15 } } : e,
    )
  }, [edges, hiddenViewMode])

  // ── Artifact toolbar (Variables, Materials, Groups — snap to 8 positions) ──
  const toolbar = (
    <ArtifactToolbar
      onOpenVariables={onOpenVariables}
      onOpenMaterials={onOpenMaterials}
      onOpenGroups={onOpenGroups}
      readOnly={readOnly}
      isMobile={isMobile}
    />
  )

  // ── Drawer backdrop (mobile only — BottomSheet handles its own overlay) ────
  const showBackdrop = false

  const canvasSettings = useMemo(
    () => ({
      edgesAnimated: effectiveEdgesAnimated,
      badgesEnabled: effectiveBadges,
      edgeBadgesEnabled: effectiveEdgeBadges,
    }),
    [effectiveEdgesAnimated, effectiveBadges, effectiveEdgeBadges],
  )

  // ── Bottom dock panels (G5-2: always both tabs) ────────────────────────
  // Badge counts for bottom panel tabs
  const problemCount = useMemo(() => {
    let count = 0
    for (const v of computed.values()) {
      if ((v as { kind: string }).kind === 'error') count++
    }
    return count
  }, [computed])

  // Simple health warning count: disconnected nodes (no edges)
  const healthWarningCount = useMemo(() => {
    const connectedIds = new Set<string>()
    for (const e of edges) {
      connectedIds.add(e.source)
      connectedIds.add(e.target)
    }
    const realNodes = nodes.filter((n) => {
      const bt = (n.data as Record<string, unknown>).blockType as string
      return bt !== '__group__' && !bt.startsWith('annotation_')
    })
    let warnings = 0
    for (const n of realNodes) {
      if (!connectedIds.has(n.id)) warnings++
    }
    return warnings + problemCount
  }, [nodes, edges, problemCount])

  const dockPanels = useMemo<DockPanel[]>(
    () => [
      {
        id: 'console' as DockTab,
        label: t('debugConsole.title', 'Debug Console'),
        content: (
          <Suspense fallback={null}>
            <LazyDebugConsolePanel docked />
          </Suspense>
        ),
      },
      {
        id: 'health' as DockTab,
        label: t('toolbar.graphHealth', 'Graph Health'),
        badge: healthWarningCount,
        content: (
          <Suspense fallback={null}>
            <LazyGraphHealthPanel
              docked
              nodes={nodes}
              edges={edges}
              onClose={() => setDockCollapsed(true)}
              onFixWithAi={onFixWithAi}
              onExplainIssues={onExplainIssues}
            />
          </Suspense>
        ),
      },
      {
        id: 'output' as DockTab,
        label: t('dock.output', 'Output'),
        content: (
          <Suspense fallback={null}>
            <LazyOutputPanel />
          </Suspense>
        ),
      },
      {
        id: 'problems' as DockTab,
        label: t('dock.problems', 'Problems'),
        badge: problemCount,
        content: (
          <Suspense fallback={null}>
            <LazyProblemsPanel engineDiagnostics={engineDiagnostics} />
          </Suspense>
        ),
      },
      {
        id: 'history' as DockTab,
        label: t('dock.history', 'History'),
        content: (
          <Suspense fallback={null}>
            <LazyHistoryPanel
              entries={stackEntries}
              currentNodeCount={nodes.length}
              currentEdgeCount={edges.length}
              onRestore={handleRestoreHistory}
              onSaveCheckpoint={handleSaveCheckpoint}
              onClear={historyClear}
              onRenameEntry={handleRenameHistoryEntry}
            />
          </Suspense>
        ),
      },
      {
        id: 'channels' as DockTab,
        label: t('dock.channels', 'Channels'),
        content: (
          <Suspense fallback={null}>
            <LazyChannelsPanel />
          </Suspense>
        ),
      },
      ...(canvasId
        ? [
            {
              id: 'notes' as DockTab,
              label: t('dock.notes', 'Notes'),
              content: (
                <Suspense fallback={null}>
                  <LazyCanvasNotes canvasId={canvasId} />
                </Suspense>
              ),
            },
          ]
        : []),
    ],
    [
      nodes,
      edges,
      t,
      onFixWithAi,
      onExplainIssues,
      stackEntries,
      handleRestoreHistory,
      handleSaveCheckpoint,
      historyClear,
      handleRenameHistoryEntry,
      canvasId,
      healthWarningCount,
      problemCount,
    ],
  )

  return (
    <PlanContext.Provider value={plan ?? 'free'}>
      <ComputedStoreContext.Provider value={computedStore}>
        <ComputedContext.Provider value={computed}>
          <BindingContext.Provider value={bindingCtx}>
            <CanvasSettingsContext.Provider value={canvasSettings}>
              <NodeCommentsContext.Provider
                value={{ commentCounts, openThread: openCommentThread }}
              >
                <ValuePopoverContext.Provider value={showValuePopover}>
                  {computed.size > 0 && (
                    <div data-testid="canvas-computed" style={{ display: 'none' }} />
                  )}
                  <div
                    data-edges-animated={effectiveEdgesAnimated ? 'true' : 'false'}
                    data-eval-pulse={evalPulseActive ? 'true' : 'false'}
                    data-lod={effectiveLodTier}
                    data-badges={effectiveBadges ? 'true' : 'false'}
                    data-edge-badges={effectiveEdgeBadges ? 'true' : 'false'}
                    style={{
                      display: 'flex',
                      flex: 1,
                      height: '100%',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {/* Block library panel — desktop: always present with dock handle; mobile: overlay */}
                    {!readOnly && !isMobile && !presentationMode && (
                      <BlockLibrary
                        width={libWidth}
                        onResizeStart={onLibResizeStart}
                        plan={plan}
                        onProBlocked={() => setShowUpgradeModal(true)}
                        onInsertTemplate={onInsertTemplate}
                        collapsed={!libVisible}
                        onToggleCollapsed={() => setLibVisible((v) => !v)}
                        filterMainOverride={libFilterMain}
                        onInsertBlock={insertBlockAtCenter}
                      />
                    )}

                    {/* Canvas */}
                    <div
                      ref={canvasWrapRef}
                      data-tour="canvas-area"
                      style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      onKeyDown={onKeyDown}
                      onKeyUp={onKeyUp}
                      tabIndex={0}
                      {...longPressHandlers}
                      onMouseMove={(e) => {
                        if (!laserMode || !presentationMode) return
                        const rect = canvasWrapRef.current?.getBoundingClientRect()
                        if (rect) setLaserPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                      }}
                      onMouseLeave={() => {
                        if (laserMode) setLaserPos(null)
                      }}
                    >
                      {/* UX-19 / 5.2: Spotlight CSS — dims non-selected nodes with smooth transitions */}
                      {presentationMode && spotlightMode && (
                        <style>{`
                      .react-flow__node { opacity: 0.12 !important; transition: opacity 0.4s ease, filter 0.4s ease, transform 0.35s ease; }
                      .react-flow__node.selected { opacity: 1 !important; transition: opacity 0.4s ease, filter 0.4s ease, transform 0.35s ease; filter: drop-shadow(0 0 28px rgba(28,171,176,0.7)); }
                    `}</style>
                      )}

                      {/* UX-19: Laser pointer overlay */}
                      {presentationMode && laserMode && laserPos && (
                        <div
                          style={{
                            position: 'absolute',
                            left: laserPos.x - 18,
                            top: laserPos.y - 18,
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'rgba(255, 55, 55, 0.75)',
                            boxShadow: '0 0 24px 10px rgba(255,55,55,0.4)',
                            pointerEvents: 'none',
                            zIndex: 200,
                          }}
                        />
                      )}

                      {/* UX-19 / 5.2: Presentation mode floating control bar (polished) */}
                      {presentationMode && (
                        <>
                          {/* 5.2: Fade-in animation style */}
                          <style>{`
                            @keyframes cs-pres-fade-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                            @keyframes cs-pres-announce { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.02); } }
                          `}</style>
                          <div
                            style={{
                              position: 'absolute',
                              top: 14,
                              right: 14,
                              zIndex: 200,
                              display: 'flex',
                              gap: 6,
                              background: 'rgba(0,0,0,0.72)',
                              borderRadius: 12,
                              padding: '6px 10px',
                              backdropFilter: 'blur(16px)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                              animation: 'cs-pres-fade-in 0.35s ease-out',
                            }}
                          >
                            <button
                              onClick={() => setSpotlightMode((v) => !v)}
                              title={t(
                                'presentation.spotlightTooltip',
                                'Spotlight mode: click a node to spotlight it',
                              )}
                              style={{
                                padding: '4px 10px',
                                height: 32,
                                background: spotlightMode ? 'rgba(28,171,176,0.25)' : 'transparent',
                                border: `1px solid ${spotlightMode ? 'rgba(28,171,176,0.6)' : 'rgba(255,255,255,0.18)'}`,
                                borderRadius: 7,
                                color: spotlightMode ? 'var(--primary)' : 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {t('presentation.spotlight', 'Spotlight')}
                            </button>
                            <button
                              onClick={() => setLaserMode((v) => !v)}
                              title={t(
                                'presentation.laserTooltip',
                                'Laser pointer: move mouse to draw attention',
                              )}
                              style={{
                                padding: '4px 10px',
                                height: 32,
                                background: laserMode ? 'rgba(255,55,55,0.2)' : 'transparent',
                                border: `1px solid ${laserMode ? 'rgba(255,55,55,0.6)' : 'rgba(255,255,255,0.18)'}`,
                                borderRadius: 7,
                                color: laserMode ? '#ff6b6b' : 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {t('presentation.laser', 'Laser')}
                            </button>

                            {/* 5.2: Divider */}
                            <div
                              style={{
                                width: 1,
                                background: 'rgba(255,255,255,0.12)',
                                margin: '4px 2px',
                              }}
                            />

                            {/* 5.2: Zoom controls */}
                            <button
                              onClick={() => zoomIn({ duration: 200 })}
                              title={t('presentation.zoomIn', 'Zoom in')}
                              style={{
                                padding: '4px 8px',
                                height: 32,
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 7,
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              +
                            </button>
                            <button
                              onClick={() => zoomOut({ duration: 200 })}
                              title={t('presentation.zoomOut', 'Zoom out')}
                              style={{
                                padding: '4px 8px',
                                height: 32,
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 7,
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              &minus;
                            </button>
                            <button
                              onClick={() => fitView({ duration: 300 })}
                              title={t('presentation.fitView', 'Fit view')}
                              style={{
                                padding: '4px 8px',
                                height: 32,
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 7,
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              {t('presentation.fit', 'Fit')}
                            </button>

                            {/* 5.2: Divider */}
                            <div
                              style={{
                                width: 1,
                                background: 'rgba(255,255,255,0.12)',
                                margin: '4px 2px',
                              }}
                            />

                            <button
                              onClick={togglePresentationMode}
                              title={t(
                                'presentation.exitTooltip',
                                'Exit presentation mode (Ctrl+Shift+P or Esc)',
                              )}
                              style={{
                                padding: '4px 10px',
                                height: 32,
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 7,
                                color: 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {t('presentation.exit', 'Exit')}
                            </button>
                          </div>

                          {/* 5.2: Entry announcement overlay */}
                          {showPresentationAnnouncement && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 210,
                                padding: '16px 36px',
                                borderRadius: 14,
                                background: 'rgba(0,0,0,0.75)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.9)',
                                fontSize: '1.2rem',
                                fontWeight: 600,
                                letterSpacing: '0.02em',
                                pointerEvents: 'none',
                                animation: 'cs-pres-announce 1.5s ease-out forwards',
                              }}
                            >
                              {t('presentation.modeLabel', 'Presentation Mode')}
                            </div>
                          )}
                        </>
                      )}

                      {!presentationMode && toolbar}

                      {/* UX-16: Formula bar (Ctrl+Shift+F to toggle) */}
                      {!readOnly && formulaBarVisible && (
                        <FormulaBar
                          nodeId={inspectedId}
                          node={
                            inspectedId ? (nodes.find((n) => n.id === inspectedId) ?? null) : null
                          }
                          computedValue={inspectedId ? computed.get(inspectedId) : undefined}
                          onCommit={handleFormulaCommit}
                          upstreamVars={
                            // 6.06: Collect upstream variables for context-aware autocomplete
                            inspectedId
                              ? edges
                                  .filter((e) => e.target === inspectedId)
                                  .map((e) => {
                                    const srcNode = nodes.find((n) => n.id === e.source)
                                    const nd = srcNode?.data as Record<string, unknown> | undefined
                                    const label = (nd?.label as string) ?? e.source
                                    const cv = computed.get(e.source)
                                    const val =
                                      cv && 'value' in cv ? (cv.value as number) : undefined
                                    return {
                                      name: label,
                                      value: val,
                                      nodeId: e.source,
                                    } as FormulaUpstreamVar
                                  })
                              : undefined
                          }
                          onExpressionSubmit={handleExpressionSubmit}
                        />
                      )}

                      {paused && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 52,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 10,
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            padding: '0.2rem 0.7rem',
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
                            pointerEvents: 'none',
                          }}
                        >
                          {'\u23f8'} {t('toolbar.pausedBanner')}
                        </div>
                      )}
                      {nodes.length === 0 && !readOnly && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            zIndex: 1,
                          }}
                        >
                          <div
                            style={{
                              pointerEvents: 'auto',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.6rem',
                              userSelect: 'none',
                              textAlign: 'center',
                              padding: '2rem',
                              borderRadius: 16,
                              background: 'rgba(255,255,255,0.025)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              maxWidth: 320,
                            }}
                          >
                            <div style={{ fontSize: '2.2rem', opacity: 0.3, lineHeight: 1 }}>⬡</div>
                            <div
                              style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: 'rgba(255,255,255,0.35)',
                                letterSpacing: '0.01em',
                              }}
                            >
                              {t('canvas.emptyTitle', 'Start building')}
                            </div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'rgba(255,255,255,0.18)',
                                lineHeight: 1.7,
                              }}
                            >
                              {t('canvas.emptyHint')}
                            </div>
                            <button
                              style={{
                                marginTop: '0.3rem',
                                padding: '0.45rem 1.2rem',
                                borderRadius: 8,
                                background: 'var(--primary)',
                                border: 'none',
                                color: '#fff',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                opacity: 0.85,
                                transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
                              }}
                              onMouseLeave={(e) => {
                                ;(e.currentTarget as HTMLButtonElement).style.opacity = '0.85'
                              }}
                              onClick={() => {
                                const cx = window.innerWidth / 2
                                const cy = window.innerHeight / 2
                                const fp = screenToFlowPosition({ x: cx, y: cy })
                                setQuickAdd({
                                  screenX: cx,
                                  screenY: cy - 60,
                                  flowX: fp.x,
                                  flowY: fp.y,
                                })
                              }}
                            >
                              + {t('canvas.emptyAddBlock', 'Add first block')}
                            </button>
                            <div
                              style={{
                                fontSize: '0.65rem',
                                color: 'rgba(255,255,255,0.12)',
                              }}
                            >
                              {t(
                                'canvas.emptyOrDoubleClick',
                                'or double-click anywhere on the canvas',
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <ReactFlow
                        nodes={displayedNodes}
                        edges={displayedEdges}
                        nodeTypes={NODE_TYPES}
                        edgeTypes={EDGE_TYPES}
                        onNodesChange={readOnly ? undefined : onNodesChange}
                        onEdgesChange={readOnly ? undefined : onEdgesChange}
                        onConnect={readOnly ? undefined : onConnect}
                        isValidConnection={isValidConnection}
                        onNodeDragStart={readOnly ? undefined : onNodeDragStart}
                        onNodeDrag={readOnly ? undefined : onNodeDrag}
                        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
                        onNodeClick={onNodeClick}
                        onNodeDoubleClick={onNodeDoubleClick}
                        onPaneClick={onPaneClick}
                        onNodeContextMenu={readOnly ? undefined : onNodeContextMenu}
                        onEdgeContextMenu={readOnly ? undefined : onEdgeContextMenu}
                        onPaneContextMenu={readOnly ? undefined : onPaneContextMenu}
                        nodesConnectable={!readOnly && !locked}
                        nodesDraggable={!readOnly && !locked && !panMode}
                        elementsSelectable={!readOnly}
                        selectionOnDrag={!readOnly && !locked && !panMode}
                        selectionMode={SelectionMode.Partial}
                        panOnDrag={panMode || locked ? [0, 1] : [1]}
                        snapToGrid={snapToGrid}
                        snapGrid={[16, 16]}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        onMoveStart={onMoveStart}
                        onMoveEnd={onMoveEnd}
                        deleteKeyCode={null}
                        minZoom={0.08}
                        maxZoom={4}
                        zoomOnPinch
                        proOptions={{ hideAttribution: true }}
                        // UI-PERF-03: skip rendering nodes/edges outside the viewport
                        // on large graphs. React Flow's built-in culling avoids creating
                        // DOM elements for off-screen nodes, which dramatically reduces
                        // layout work when the canvas has hundreds/thousands of nodes.
                        onlyRenderVisibleElements={nodes.length > 500}
                      >
                        {bgDotsVisible && canvasBgStyle !== 'solid' && (
                          <>
                            {canvasBgStyle === 'dot-grid' && (
                              <>
                                <Background
                                  id="grid-minor"
                                  variant={BackgroundVariant.Dots}
                                  gap={canvasGridSize}
                                  size={1.5}
                                  color={gridMinorColor}
                                />
                                <Background
                                  id="grid-major"
                                  variant={BackgroundVariant.Dots}
                                  gap={canvasGridSize * 5}
                                  size={2}
                                  color={gridMajorColor}
                                />
                              </>
                            )}
                            {canvasBgStyle === 'line-grid' && (
                              <Background
                                id="grid"
                                variant={BackgroundVariant.Lines}
                                gap={canvasGridSize}
                                color={gridMinorColor}
                              />
                            )}
                            {canvasBgStyle === 'cross-grid' && (
                              <Background
                                id="grid"
                                variant={BackgroundVariant.Cross}
                                gap={canvasGridSize}
                                size={6}
                                color={gridMinorColor}
                              />
                            )}
                            {canvasBgStyle === 'large-dots' && (
                              <Background
                                id="grid"
                                variant={BackgroundVariant.Dots}
                                gap={canvasGridSize * 2}
                                size={3}
                                color={gridMinorColor}
                              />
                            )}
                          </>
                        )}
                        {/* ADV-04: Comment count badges rendered as NodeToolbar overlays */}
                        {Array.from(commentCounts.entries()).map(([nodeId, count]) =>
                          count > 0 ? (
                            <NodeToolbar
                              key={`comment-badge-${nodeId}`}
                              nodeId={nodeId}
                              isVisible
                              position={RFPosition.Top}
                              offset={4}
                            >
                              <button
                                className="nodrag"
                                title={`${count} comment${count !== 1 ? 's' : ''}`}
                                onClick={() => openCommentThread(nodeId)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  padding: '0.1rem 0.35rem',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  background: 'var(--primary)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 10,
                                  cursor: 'pointer',
                                  lineHeight: 1.4,
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                }}
                              >
                                💬 {count}
                              </button>
                            </NodeToolbar>
                          ) : null,
                        )}
                        {/* Phase 10: Magnetic snap guide lines */}
                        <SnapGuides guides={snapGuides} />
                      </ReactFlow>
                      {minimap && (
                        <MinimapWrapper
                          bottomOffset={dockHeight}
                          nodeCount={nodes.length}
                          onFitView={() => fitView({ padding: 0.15, duration: 300 })}
                        >
                          <MiniMap
                            pannable
                            zoomable
                            style={{
                              position: 'relative',
                              background: 'var(--surface-1)',
                              border: '1px solid var(--border)',
                              borderRadius: '0 0 4px 4px',
                            }}
                            nodeColor={(node) => {
                              // UX-11: color by node category
                              switch (node.type) {
                                case 'csSource':
                                  return '#1cabb0' // teal — input
                                case 'csOp':
                                  return '#6366f1' // indigo — function
                                case 'csDisplay':
                                  return '#f59e0b' // amber — output
                                case 'csPlot':
                                  return '#8b5cf6' // purple — plot
                                case 'csGroup':
                                  return '#22c55e' // green — group
                                case 'csAnnotation':
                                  return '#94a3b8' // gray — annotation
                                default:
                                  return '#64748b'
                              }
                            }}
                            maskColor="rgba(0,0,0,0.15)"
                          />
                        </MinimapWrapper>
                      )}
                      <CanvasToolbar
                        panMode={panMode}
                        locked={locked}
                        snapToGrid={snapToGrid}
                        minimap={minimap}
                        paused={paused}
                        inspVisible={inspVisible}
                        readOnly={!!readOnly}
                        onTogglePan={() => setPanMode((v) => !v)}
                        onToggleLock={() => setLocked((v) => !v)}
                        onToggleSnap={() => setSnapToGrid((v) => !v)}
                        onToggleMinimap={() => {
                          setMinimap((v) => {
                            setMinimapPref(!v)
                            return !v
                          })
                        }}
                        onTogglePause={() => {
                          setPaused((v) => {
                            userPausedRef.current = !v
                            return !v
                          })
                        }}
                        onRefresh={() => setEngineKey((k) => k + 1)}
                        onToggleInspector={() => {
                          if (inspVisible) {
                            setInspectedId(null)
                            closeWindow(INSPECTOR_WINDOW_ID)
                          } else {
                            openWindow(INSPECTOR_WINDOW_ID, INSPECTOR_DEFAULTS)
                          }
                          if (isMobile) setLibVisible(false)
                        }}
                        onAutoOrganise={(shiftKey) =>
                          handleAutoOrganise(
                            shiftKey
                              ? autoLayoutDirection === 'LR'
                                ? 'TB'
                                : 'LR'
                              : autoLayoutDirection,
                          )
                        }
                        edgesAnimated={edgesAnimated}
                        lodEnabled={lodEnabled}
                        onToggleEdgesAnimated={() => {
                          setEdgesAnimated((v) => {
                            setEdgesAnimatedPref(!v)
                            return !v
                          })
                        }}
                        onToggleLod={() => {
                          setLodEnabled((v) => {
                            setLodPref(!v)
                            return !v
                          })
                        }}
                        badgesEnabled={badgesEnabled}
                        onToggleBadges={() => {
                          setBadgesEnabled((v) => {
                            setBadgesPref(!v)
                            return !v
                          })
                        }}
                        edgeBadgesEnabled={edgeBadgesEnabled}
                        onToggleEdgeBadges={() => {
                          setEdgeBadgesEnabled((v) => {
                            setEdgeBadgesPref(!v)
                            return !v
                          })
                        }}
                        bgDotsVisible={bgDotsVisible}
                        onToggleBgDots={() => {
                          setBgDotsVisible((v) => {
                            setBgDotsPref(!v)
                            return !v
                          })
                        }}
                        onInsertAnnotation={onInsertAnnotationAtCenter}
                        hiddenViewMode={hiddenViewMode}
                        onToggleHiddenView={() => setHiddenViewMode((v) => !v)}
                        hasHiddenNodes={hasHiddenNodes}
                        onShowAllHidden={showAllHiddenNodes}
                        presentationMode={presentationMode}
                        onTogglePresentationMode={togglePresentationMode}
                        isMobile={isMobile}
                        onRun={triggerEval}
                        pendingPatchCount={pendingPatchCount}
                      />
                      {/* Bottom Dock — hidden in presentation mode */}
                      {!presentationMode && (
                        <BottomDock
                          panels={dockPanels}
                          collapsed={dockCollapsed}
                          onToggleCollapsed={() => setDockCollapsed((v) => !v)}
                          onHeightChange={setDockHeight}
                        />
                      )}
                      {/* V3-5.3: Floating annotation toolbar on annotation selection */}
                      {inspectedId &&
                        (() => {
                          const n = getNode(inspectedId)
                          return n?.type === 'csAnnotation' ? (
                            <AnnotationToolbar
                              nodeId={inspectedId}
                              onZOrder={readOnly ? undefined : onAnnotationZOrder}
                            />
                          ) : null
                        })()}
                    </div>

                    {/* Floating Inspector window (replaces sidebar + mobile drawer) */}
                    {inspVisible && (
                      <FloatingInspector
                        nodeId={inspectedId}
                        pinned={inspPinned}
                        onTogglePin={() => setInspPinned((v) => !v)}
                        onToggleCollapse={toggleGroupCollapse}
                        onUngroupNode={ungroupNode}
                        canUseGroups={ent.canUseGroups}
                      />
                    )}

                    {/* ── Mobile overlay drawers ──────────────────────────────────────────── */}
                    {showBackdrop && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'var(--overlay)',
                          zIndex: 19,
                        }}
                        onClick={() => {
                          setLibVisible(false)
                        }}
                      />
                    )}

                    {/* Phase 12: Floating action button for quick-add on mobile */}
                    {!readOnly && isMobile && !libVisible && (
                      <button
                        className="cs-mobile-fab"
                        onClick={() => setLibVisible(true)}
                        aria-label={t('canvas.mobileFabAdd')}
                        title={t('canvas.mobileFabAdd')}
                      >
                        +
                      </button>
                    )}

                    {!readOnly && isMobile && (
                      <BottomSheet
                        open={libVisible}
                        onClose={() => setLibVisible(false)}
                        title={t('dock.library', 'Library')}
                        height="full"
                      >
                        <BlockLibrary
                          width={mobileDrawerWidth}
                          onResizeStart={() => {}}
                          plan={plan}
                          onProBlocked={() => setShowUpgradeModal(true)}
                          onInsertTemplate={onInsertTemplate}
                          filterMainOverride={libFilterMain}
                          onInsertBlock={insertBlockAtCenter}
                        />
                      </BottomSheet>
                    )}

                    {/* Context menu */}
                    {contextMenu && (
                      <ContextMenu
                        target={contextMenu}
                        onClose={() => setContextMenu(null)}
                        onDuplicateNode={duplicateNode}
                        onDeleteNode={deleteNode}
                        onDeleteEdge={deleteEdge}
                        onInspectNode={inspectNode}
                        onRenameNode={renameNode}
                        onLockNode={lockNode}
                        onFitView={() => fitView({ padding: 0.15, duration: 300 })}
                        onAddBlockAtCursor={onAddBlockAtCursor}
                        onGroupSelection={groupSelection}
                        onUngroupNode={ungroupNode}
                        onToggleCollapse={toggleGroupCollapse}
                        onAutoResizeGroup={resizeGroupToFit}
                        onDeleteSelected={deleteSelected}
                        onSaveAsTemplate={saveAsTemplate}
                        canUseGroups={ent.canUseGroups}
                        onCopyNodeValue={copyNodeValue}
                        onJumpToNode={jumpToNode}
                        computed={computed}
                        onPaste={readOnly ? undefined : handlePaste}
                        onAutoLayout={readOnly ? undefined : () => handleAutoOrganise('LR')}
                        onInspectEdge={inspectEdge}
                        onInsertConversion={readOnly ? undefined : insertConversion}
                        onExplainNode={onExplainNode}
                        onInsertFromPrompt={onInsertFromPrompt}
                        onAlignSelection={readOnly ? undefined : alignSelection}
                        onInsertAnnotation={readOnly ? undefined : onInsertAnnotation}
                        snapToGrid={snapToGrid}
                        onToggleSnap={readOnly ? undefined : () => setSnapToGrid((v) => !v)}
                        onSelectChain={readOnly ? undefined : selectChain}
                        onShowNotation={showNotation}
                        onHideSelected={readOnly ? undefined : hideSelectedNodes}
                        onShowAllHidden={readOnly ? undefined : showAllHiddenNodes}
                        hasHiddenNodes={hasHiddenNodes}
                        onAnnotationZOrder={readOnly ? undefined : onAnnotationZOrder}
                        onSetNodeColor={readOnly ? undefined : setNodeColor}
                        onDisconnectNode={readOnly ? undefined : disconnectNode}
                        onResetNodeToDefault={readOnly ? undefined : resetNodeToDefault}
                        onAddProbeNode={readOnly ? undefined : addProbeNode}
                        onSelectAll={selectAll}
                        onAddComment={readOnly ? undefined : handleContextMenuComment}
                        onToggleMinimap={() => setMinimap((v) => !v)}
                        minimapVisible={minimap}
                      />
                    )}

                    {/* ADV-04: Node comment thread dialog */}
                    {commentDialog && (
                      <NodeCommentDialog
                        nodeId={commentDialog.nodeId}
                        nodeLabel={
                          nodes.find((n) => n.id === commentDialog.nodeId)?.data?.label as
                            | string
                            | undefined
                        }
                        projectId={useProjectStore.getState().projectId ?? ''}
                        canvasId={canvasId ?? ''}
                        comments={comments.filter((c) => c.node_id === commentDialog.nodeId)}
                        onRefresh={refreshComments}
                        onClose={() => setCommentDialog(null)}
                        x={commentDialog.x}
                        y={commentDialog.y}
                      />
                    )}

                    {/* I2-1: Notation panel */}
                    {notationTarget && (
                      <div
                        style={{
                          position: 'absolute',
                          left: notationTarget.x,
                          top: notationTarget.y,
                          zIndex: 1000,
                        }}
                      >
                        <ExpressionPanel
                          nodeId={notationTarget.nodeId}
                          nodes={nodes}
                          edges={edges}
                          computed={computed}
                          onClose={() => setNotationTarget(null)}
                        />
                      </div>
                    )}

                    {/* Quick-add palette */}
                    {quickAdd && (
                      <QuickAddPalette
                        screenX={quickAdd.screenX}
                        screenY={quickAdd.screenY}
                        onAdd={onQuickAddBlock}
                        onClose={() => setQuickAdd(null)}
                        plan={plan}
                        onProBlocked={() => {
                          setQuickAdd(null)
                          setShowUpgradeModal(true)
                        }}
                      />
                    )}
                    {/* Find block dialog */}
                    {findOpen && (
                      <Suspense fallback={null}>
                        <LazyFindBlockDialog
                          nodes={nodes}
                          onFocusNode={focusNode}
                          onClose={handleFindClose}
                          onMatchesChange={handleMatchesChange}
                        />
                      </Suspense>
                    )}
                    {/* UX-09: Dim non-matching nodes when search is active */}
                    {searchMatchIds !== null && (
                      <style>{`
                    .react-flow__node { opacity: 0.18 !important; transition: opacity 0.12s; }
                    ${searchMatchIds.map((id) => `.react-flow__node[data-id="${CSS.escape(id)}"]`).join(',\n')}
                    { opacity: 1 !important; }
                  `}</style>
                    )}
                    {/* Upgrade modal for Pro-only blocks */}
                    {showUpgradeModal && (
                      <UpgradeModal
                        open={showUpgradeModal}
                        onClose={() => setShowUpgradeModal(false)}
                        reason="feature_locked"
                      />
                    )}
                    {/* UX-03: Command palette */}
                    {paletteOpen && (
                      <CommandPalette
                        commands={[...paletteCommands, ...annotationPaletteCommands]}
                        nodeLabels={paletteNodeLabels}
                        onClose={() => setPaletteOpen(false)}
                        onInsertBlock={insertBlockAtCenter}
                      />
                    )}

                    {/* Value popover (W12.4) */}
                    {popoverTarget && (
                      <Suspense fallback={null}>
                        <LazyValuePopover
                          nodeId={popoverTarget.nodeId}
                          x={popoverTarget.x}
                          y={popoverTarget.y}
                          computed={computed}
                          onClose={() => setPopoverTarget(null)}
                          onJumpToNode={jumpToNode}
                        />
                      </Suspense>
                    )}
                  </div>
                </ValuePopoverContext.Provider>
              </NodeCommentsContext.Provider>
            </CanvasSettingsContext.Provider>
          </BindingContext.Provider>
        </ComputedContext.Provider>
      </ComputedStoreContext.Provider>
    </PlanContext.Provider>
  )
})

// ── Public export ─────────────────────────────────────────────────────────────

export const CanvasArea = forwardRef<CanvasAreaHandle, CanvasAreaProps>(function CanvasArea(
  { sidePanel, ...props },
  ref,
) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} ref={ref} />
      {sidePanel}
    </ReactFlowProvider>
  )
})
