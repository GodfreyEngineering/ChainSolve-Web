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
import { ComputedContext } from '../../contexts/ComputedContext'
import { BindingContext } from '../../contexts/BindingContext'
import { useEngine } from '../../contexts/EngineContext'
import { useGraphEngine } from '../../engine/useGraphEngine'
import { buildConstantsLookup } from '../../engine/resolveBindings'
import { computeEffectiveEdgesAnimated } from '../../engine/edgesAnimGate'
import { computeLodTier, type LodTier as LodTierGate } from '../../engine/lodGate'
import { useVariablesStore } from '../../stores/variablesStore'
import { usePublishedOutputsStore } from '../../stores/publishedOutputsStore'
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
import { autoLayout, type LayoutDirection } from '../../lib/autoLayout'
import { useGraphHistory } from '../../hooks/useGraphHistory'
import { copyToClipboard, pasteFromClipboard, pasteFromSystemClipboard } from '../../lib/clipboard'
import { computeAlignment, type AlignOp } from '../../lib/alignmentHelpers'
import { CommandPalette, type PaletteCommand } from './CommandPalette'
const LazyFindBlockDialog = lazy(() =>
  import('./FindBlockDialog').then((m) => ({ default: m.FindBlockDialog })),
)
const LazyDebugConsolePanel = lazy(() => import('./DebugConsolePanel'))
const LazyGraphHealthPanel = lazy(() => import('./GraphHealthPanel'))
const LazyOutputPanel = lazy(() => import('./OutputPanel'))
const LazyProblemsPanel = lazy(() => import('./ProblemsPanel'))
import { BottomDock, type DockPanel, type DockTab } from './BottomDock'
import { INITIAL_NODES, INITIAL_EDGES } from './canvasDefaults'
import { useIsMobile } from '../../hooks/useIsMobile'
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

  /* ── AI Copilot entrypoints (AI-3) ───────────────────────────────────────── */
  /** Trigger "Fix with Copilot" from Graph Health panel. */
  onFixWithCopilot?: () => void
  /** Trigger "Explain issues" from Graph Health panel. */
  onExplainIssues?: () => void
  /** Trigger "Explain this node" from context menu. */
  onExplainNode?: (nodeId: string) => void
  /** Trigger "Insert blocks from prompt…" from context menu. */
  onInsertFromPrompt?: (x: number, y: number) => void

  /** K1-1: Fired when a node drag ends — used for cross-sheet transfer detection. */
  onNodeDragStop?: (event: React.MouseEvent, node: { id: string }) => void
}

/** Handle exposed by CanvasArea via forwardRef. */
export interface CanvasAreaHandle {
  getSnapshot: () => { nodes: Node<NodeData>[]; edges: Edge[] }
  /** AI-1: Replace the canvas state with new nodes/edges (used by AI Copilot patch apply). */
  setSnapshot: (nodes: Node<NodeData>[], edges: Edge[]) => void
  fitView: () => void
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
    onFixWithCopilot,
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
  const history = useGraphHistory(50)

  const { save: historySave, undo: historyUndo, redo: historyRedo } = history

  const doSaveHistory = useCallback(() => {
    historySave({ nodes: latestNodes.current, edges: latestEdges.current })
  }, [historySave])

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
    fitView: () => fitView({ padding: 0.15, duration: 300 }),
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
    togglePause: () => setPaused((v) => !v),
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

  // Bottom toolbar state
  const [panMode, setPanMode] = useState(false)
  const [locked, setLocked] = useState(false)
  const [minimap, setMinimap] = useState(getMinimapPref)
  const [paused, setPaused] = useState(false)
  const [engineKey, setEngineKey] = useState(0)

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
  const effectiveEdgesAnimated = computeEffectiveEdgesAnimated(
    edgesAnimated,
    edges.length,
    animAutoDisabledRef.current,
  )
  // Keep hysteresis state in sync.  We are "auto-disabled" any time the user
  // wants animation ON but the gate forced it OFF (either over the hard
  // threshold or in the hysteresis band).
  animAutoDisabledRef.current = !effectiveEdgesAnimated && edgesAnimated

  const effectiveLodTier: LodTier = lodEnabled ? lodTier : 'full'

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
  // does not immediately mark the canvas as dirty.  Always fire regardless of
  // pause state so autosave keeps working; engine evaluation is gated separately
  // inside useGraphEngine.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onGraphChange?.(nodes, edges)
  }, [nodes, edges, onGraphChange])

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null)

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
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, zoomTo, getNode } = useReactFlow()

  // ── Computed values (incremental via WASM engine) ──────────────────────────
  const engine = useEngine()
  const variables = useVariablesStore((s) => s.variables)

  // W12.2: Build constants lookup + binding context from engine catalog
  const constantsLookup = useMemo(
    () => buildConstantsLookup(engine.constantValues),
    [engine.constantValues],
  )
  const bindingCtx = useMemo(
    () => ({ constants: constantsLookup, catalog: engine.catalog }),
    [constantsLookup, engine.catalog],
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

  const { computed } = useGraphEngine(
    nodes,
    edges,
    engine,
    undefined,
    engineKey,
    paused,
    constantsLookup,
    variables,
    publishedOutputs,
  )

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
      // Determine target: selected (≥2) or all non-group nodes
      const selected = nodes.filter((n) => n.selected && n.type !== 'csGroup')
      const targets = selected.length >= 2 ? selected : nodes.filter((n) => n.type !== 'csGroup')
      if (targets.length === 0) return

      const targetIds = new Set(targets.map((n) => n.id))
      const relevantEdges = edges.filter((e) => targetIds.has(e.source) && targetIds.has(e.target))

      const layoutNodes = targets.map((n) => ({
        id: n.id,
        width: (n.measured?.width as number | undefined) ?? DEFAULT_NODE_WIDTH,
        height: (n.measured?.height as number | undefined) ?? DEFAULT_NODE_HEIGHT,
      }))

      const positions = autoLayout(layoutNodes, relevantEdges, direction)

      doSaveHistory()
      setNodes((nds) =>
        nds.map((n) => {
          const pos = positions.get(n.id)
          return pos ? { ...n, position: pos } : n
        }),
      )

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
    [readOnly, ent, screenToFlowPosition, setNodes, doSaveHistory],
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
          n.id === nodeId
            ? { ...n, data: { ...n.data, userColor: color ?? undefined } }
            : n,
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
    // Delete selected edges
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
    pasteFromSystemClipboard().then((sys) => {
      if (!sys) return
      doSaveHistory()
      setNodes((nds) => [
        ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
        ...sys.nodes,
      ])
      setEdges((eds) => [...eds, ...sys.edges])
    }).catch(() => {})
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
      { id: 'undo', kind: 'action', label: 'Undo', hint: 'Reverse the last change', kbd: 'Ctrl+Z', icon: '↩', onExecute: handleUndo },
      { id: 'redo', kind: 'action', label: 'Redo', hint: 'Re-apply the last undone change', kbd: 'Ctrl+Shift+Z', icon: '↪', onExecute: handleRedo },
      { id: 'fitView', kind: 'action', label: 'Fit view', hint: 'Zoom to show all nodes', kbd: 'Ctrl+Shift+F', icon: '⊡', onExecute: () => fitView({ padding: 0.15, duration: 300 }) },
      { id: 'selectAll', kind: 'action', label: 'Select all', hint: 'Select all nodes', kbd: 'Ctrl+A', icon: '▣', onExecute: selectAll },
      { id: 'deleteSelected', kind: 'action', label: 'Delete selected', hint: 'Delete selected nodes and edges', kbd: 'Del', icon: '✕', onExecute: deleteSelected },
      { id: 'copy', kind: 'action', label: 'Copy', hint: 'Copy selected nodes to clipboard', kbd: 'Ctrl+C', icon: '⎘', onExecute: handleCopy },
      { id: 'paste', kind: 'action', label: 'Paste', hint: 'Paste nodes from clipboard', kbd: 'Ctrl+V', icon: '⎗', onExecute: handlePaste },
      { id: 'autoLayout', kind: 'action', label: 'Auto-layout', hint: 'Arrange nodes in a clean hierarchy', icon: '⊞', onExecute: () => handleAutoOrganise('LR') },
      { id: 'toggleLibrary', kind: 'action', label: 'Toggle block library', hint: 'Show or hide the block library panel', icon: '⊟', onExecute: () => setLibVisible((v) => !v) },
      { id: 'toggleSnap', kind: 'action', label: 'Toggle snap to grid', hint: 'Enable or disable snap to grid', icon: '⊞', onExecute: () => setSnapToGrid((v) => !v) },
      { id: 'toggleMinimap', kind: 'action', label: 'Toggle minimap', hint: 'Show or hide the minimap', icon: '⊟', onExecute: () => { setMinimap((v) => { setMinimapPref(!v); return !v }) } },
      { id: 'findBlock', kind: 'action', label: 'Find block', hint: 'Search and navigate to a block by label', kbd: 'Ctrl+F', icon: '⌕', onExecute: () => setFindOpen(true) },
      { id: 'groupSelection', kind: 'action', label: 'Group selection', hint: 'Wrap selected nodes in a group', kbd: 'Ctrl+G', icon: '▢', onExecute: groupSelection },
    ]
    return cmds
  }, [readOnly, handleUndo, handleRedo, fitView, selectAll, deleteSelected, handleCopy, handlePaste, handleAutoOrganise, groupSelection])

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
    },
    [nodes, setNodes, onNodeDragStopProp],
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

      // Ctrl+K: command palette (works even in input fields)
      if (ctrl && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      // Skip shortcuts when typing in form fields
      if (isInput) return

      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly) {
        deleteSelected()
      }

      // Ctrl+Z: Undo
      if (ctrl && e.key === 'z' && !e.shiftKey && !readOnly) {
        e.preventDefault()
        handleUndo()
      }

      // Ctrl+Shift+Z / Ctrl+Y: Redo
      if (ctrl && ((e.key === 'Z' && e.shiftKey) || e.key === 'y') && !readOnly) {
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

      // Ctrl+A: Select all
      if (ctrl && e.key === 'a') {
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

      // Ctrl+Shift+D: Toggle bottom dock
      if (ctrl && e.shiftKey && e.key === 'D') {
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

      // UX-20: Ctrl+0 fit all
      if (ctrl && e.key === '0' && !e.shiftKey) {
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
          const dx =
            e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy =
            e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
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
        content: (
          <Suspense fallback={null}>
            <LazyGraphHealthPanel
              docked
              nodes={nodes}
              edges={edges}
              onClose={() => setDockCollapsed(true)}
              onFixWithCopilot={onFixWithCopilot}
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
        content: (
          <Suspense fallback={null}>
            <LazyProblemsPanel />
          </Suspense>
        ),
      },
    ],
    [nodes, edges, t, onFixWithCopilot, onExplainIssues],
  )

  return (
    <PlanContext.Provider value={plan ?? 'free'}>
      <ComputedContext.Provider value={computed}>
        <BindingContext.Provider value={bindingCtx}>
          <CanvasSettingsContext.Provider value={canvasSettings}>
            <ValuePopoverContext.Provider value={showValuePopover}>
              {computed.size > 0 && (
                <div data-testid="canvas-computed" style={{ display: 'none' }} />
              )}
              <div
                data-edges-animated={effectiveEdgesAnimated ? 'true' : 'false'}
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
                {!readOnly && !isMobile && (
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
                >
                  {toolbar}
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
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                          onClick={() => {
                            const cx = window.innerWidth / 2
                            const cy = window.innerHeight / 2
                            const fp = screenToFlowPosition({ x: cx, y: cy })
                            setQuickAdd({ screenX: cx, screenY: cy - 60, flowX: fp.x, flowY: fp.y })
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
                          {t('canvas.emptyOrDoubleClick', 'or double-click anywhere on the canvas')}
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
                    panOnDrag={panMode || locked ? [0, 1, 2] : [1, 2]}
                    snapToGrid={snapToGrid}
                    snapGrid={[16, 16]}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    onMoveStart={onMoveStart}
                    deleteKeyCode={null}
                    minZoom={0.08}
                    maxZoom={4}
                    proOptions={{ hideAttribution: true }}
                  >
                    {bgDotsVisible && (
                      <>
                        <Background
                          id="grid-minor"
                          variant={BackgroundVariant.Dots}
                          gap={20}
                          size={1.5}
                          color={gridMinorColor}
                        />
                        <Background
                          id="grid-major"
                          variant={BackgroundVariant.Dots}
                          gap={100}
                          size={2}
                          color={gridMajorColor}
                        />
                      </>
                    )}
                  </ReactFlow>
                  {minimap && (
                    <MinimapWrapper bottomOffset={dockHeight}>
                      <MiniMap
                        pannable
                        zoomable
                        style={{
                          position: 'relative',
                          background: 'var(--surface-1)',
                          border: '1px solid var(--border)',
                        }}
                        nodeColor={(node) =>
                          node.type === 'csGroup' ? 'var(--primary)' : 'var(--text-muted)'
                        }
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
                    onTogglePause={() => setPaused((v) => !v)}
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
                    onAutoOrganise={(shiftKey) => handleAutoOrganise(shiftKey ? 'TB' : 'LR')}
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
                  />
                  {/* Bottom Dock — always visible with docking handle (G5-2) */}
                  <BottomDock
                    panels={dockPanels}
                    collapsed={dockCollapsed}
                    onToggleCollapsed={() => setDockCollapsed((v) => !v)}
                    onHeightChange={setDockHeight}
                  />
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
                    commands={paletteCommands}
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
          </CanvasSettingsContext.Provider>
        </BindingContext.Provider>
      </ComputedContext.Provider>
    </PlanContext.Provider>
  )
})

// ── Public export ─────────────────────────────────────────────────────────────

export const CanvasArea = forwardRef<CanvasAreaHandle, CanvasAreaProps>(
  function CanvasArea(props, ref) {
    return (
      <ReactFlowProvider>
        <CanvasInner {...props} ref={ref} />
      </ReactFlowProvider>
    )
  },
)
