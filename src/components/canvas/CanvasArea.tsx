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
import { GroupNode } from './nodes/GroupNode'
import { BlockLibrary } from './BlockLibrary'
import { DRAG_TYPE } from './blockLibraryUtils'
import { Inspector } from './Inspector'
import { ContextMenu, type ContextMenuTarget } from './ContextMenu'
import { QuickAddPalette } from './QuickAddPalette'
import { ComputedContext } from '../../contexts/ComputedContext'
import { useEngine } from '../../contexts/EngineContext'
import { useGraphEngine } from '../../engine/useGraphEngine'
import { BLOCK_REGISTRY, type NodeData } from '../../blocks/registry'
import { type Plan, getEntitlements, isBlockEntitled } from '../../lib/entitlements'
import { UpgradeModal } from '../UpgradeModal'
import {
  createGroup,
  ungroupNodes,
  collapseGroup,
  expandGroup,
  getCanonicalSnapshot,
  insertTemplate,
  type TemplatePayload,
} from '../../lib/groups'
import { saveTemplate as saveTemplateApi } from '../../lib/templates'
import type { Template } from '../../lib/templates'
import { AnimatedEdge } from './edges/AnimatedEdge'
import { CanvasSettingsContext } from '../../contexts/CanvasSettingsContext'
import { BottomToolbar } from './BottomToolbar'
import { useTranslation } from 'react-i18next'
import { autoLayout, type LayoutDirection } from '../../lib/autoLayout'
import { useGraphHistory } from '../../hooks/useGraphHistory'
import { copyToClipboard, pasteFromClipboard } from '../../lib/clipboard'
import { FindBlockDialog } from './FindBlockDialog'
import { INITIAL_NODES, INITIAL_EDGES } from './canvasDefaults'
import { useIsMobile } from '../../hooks/useIsMobile'

// ── Node type registry ────────────────────────────────────────────────────────

const NODE_TYPES = {
  csSource: SourceNode,
  csOperation: OperationNode,
  csDisplay: DisplayNode,
  csData: DataNode,
  csPlot: PlotNode,
  csGroup: GroupNode,
} as const

const EDGE_TYPES = {
  default: AnimatedEdge,
} as const

let nodeIdCounter = 100

// ── Public props interface ─────────────────────────────────────────────────────

export interface CanvasAreaProps {
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
}

/** Handle exposed by CanvasArea via forwardRef. */
export interface CanvasAreaHandle {
  getSnapshot: () => { nodes: Node<NodeData>[]; edges: Edge[] }
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
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
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

type LodTier = 'full' | 'compact' | 'minimal'

function zoomToLodTier(zoom: number): LodTier {
  if (zoom > 0.7) return 'full'
  if (zoom >= 0.4) return 'compact'
  return 'minimal'
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
    const onMove = (me: globalThis.MouseEvent) => {
      const delta = (me.clientX - startX) * direction
      setWidth(clamp(startWidth + delta, min, max))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
}

// ── Toolbar button style ──────────────────────────────────────────────────────

const tbBtn: React.CSSProperties = {
  padding: '0.2rem 0.55rem',
  borderRadius: 5,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: '#F4F4F3',
  cursor: 'pointer',
  fontSize: '0.72rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  letterSpacing: '0.02em',
}

// ── Inner canvas (inside ReactFlowProvider) ───────────────────────────────────

const CanvasInner = forwardRef<CanvasAreaHandle, CanvasAreaProps>(function CanvasInner(
  { initialNodes, initialEdges, onGraphChange, readOnly, plan = 'free' },
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
    fitView: () => fitView({ padding: 0.15, duration: 300 }),
    zoomIn: () => zoomIn({ duration: 200 }),
    zoomOut: () => zoomOut({ duration: 200 }),
    toggleLibrary: () => setLibVisible((v) => !v),
    toggleInspector: () => setInspVisible((v) => !v),
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
  }))

  // Panel widths + visibility
  const [libWidth, setLibWidth] = useState(200)
  const [inspWidth, setInspWidth] = useState(260)
  const [libVisible, setLibVisible] = useState(() => !isMobile)
  const [inspVisible, setInspVisible] = useState(false)

  // Auto-close panels when switching to mobile
  useEffect(() => {
    if (isMobile) {
      setLibVisible(false)
      setInspVisible(false)
    }
  }, [isMobile])

  // Inspector state (open on click, not selection)
  const [inspectedId, setInspectedId] = useState<string | null>(null)

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

  // Auto-disable animation on large graphs (>400 edges)
  const effectiveEdgesAnimated = edgesAnimated && edges.length <= 400
  const effectiveLodTier: LodTier = lodEnabled ? lodTier : 'full'

  // Track zoom for LOD tier calculation
  useOnViewportChange({
    onChange: useCallback(({ zoom }: { zoom: number }) => {
      setLodTier((prev) => {
        const next = zoomToLodTier(zoom)
        return prev !== next ? next : prev
      })
    }, []),
  })

  const { t } = useTranslation()

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

  // Quick-add palette (opened from canvas context menu "Add block here")
  const [quickAdd, setQuickAdd] = useState<{
    screenX: number
    screenY: number
    flowX: number
    flowY: number
  } | null>(null)

  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow()

  // ── Computed values (incremental via WASM engine) ──────────────────────────
  const engine = useEngine()
  const { computed } = useGraphEngine(nodes, edges, engine, undefined, engineKey, paused)

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

  // ── Inspector: open on node body click, NOT on drag ────────────────────────
  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      setInspectedId(node.id)
      setInspVisible(true)
      // On mobile, close library when opening inspector
      if (isMobile) setLibVisible(false)
    },
    [isMobile],
  )

  const onPaneClick = useCallback(() => {
    setInspectedId(null)
    if (isMobile) {
      setLibVisible(false)
      setInspVisible(false)
    }
  }, [isMobile])

  const closeInspector = useCallback(() => {
    setInspectedId(null)
    setInspVisible(false)
  }, [])

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
        })
      }
    },
    [nodes],
  )

  const onEdgeContextMenu = useCallback((e: MouseEvent, edge: Edge) => {
    e.preventDefault()
    setContextMenu({ kind: 'edge', x: e.clientX, y: e.clientY, edgeId: edge.id })
  }, [])

  const onPaneContextMenu = useCallback((e: MouseEvent | globalThis.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ kind: 'canvas', x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY })
  }, [])

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

  const inspectNode = useCallback((nodeId: string) => {
    setInspectedId(nodeId)
    setInspVisible(true)
  }, [])

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

  const deleteSelected = useCallback(() => {
    doSaveHistory()
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
      if (inspectedId && deleted.has(inspectedId)) setInspectedId(null)
      setEdges((eds) => eds.filter((e) => !deleted.has(e.source) && !deleted.has(e.target)))
      return nds.filter((n) => !deleted.has(n.id))
    })
  }, [setNodes, setEdges, inspectedId, doSaveHistory])

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
        const result = collapseGroup(groupId, nodes, edges)
        setNodes(result.nodes as Node<NodeData>[])
        setEdges(result.edges)
      }
    },
    [nodes, edges, setNodes, setEdges, doSaveHistory],
  )

  const saveAsTemplate = useCallback(
    (groupId: string) => {
      if (!ent.canUseGroups) return
      const group = nodes.find((n) => n.id === groupId)
      if (!group) return
      const nd = group.data as NodeData
      const name = window.prompt('Template name:', nd.label)
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
    const result = pasteFromClipboard()
    if (!result) return
    doSaveHistory()
    setNodes((nds) => [
      ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
      ...result.nodes,
    ])
    setEdges((eds) => [...eds, ...result.edges])
  }, [doSaveHistory, setNodes, setEdges])

  // ── Select all ──────────────────────────────────────────────────────────

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
  }, [setNodes])

  // ── Find block ──────────────────────────────────────────────────────────

  const [findOpen, setFindOpen] = useState(false)

  const focusNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })))
      setFindOpen(false)
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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      // Escape always works
      if (e.key === 'Escape') {
        setContextMenu(null)
        setFindOpen(false)
        closeInspector()
        return
      }

      // Skip shortcuts when typing in form fields
      if (isInput) return

      const ctrl = e.ctrlKey || e.metaKey

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
      nodes,
    ],
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

  // ── Panel resize start handlers ─────────────────────────────────────────────
  const onLibResizeStart = useCallback(
    (e: React.MouseEvent) => makeResizeHandler(libWidth, setLibWidth, 1)(e),
    [libWidth],
  )

  const onInspResizeStart = useCallback(
    (e: React.MouseEvent) => makeResizeHandler(inspWidth, setInspWidth, -1)(e),
    [inspWidth],
  )

  // ── Mobile panel width ────────────────────────────────────────────────────
  const mobileDrawerWidth = isMobile ? Math.min(280, window.innerWidth * 0.85) : 0

  // ── Toolbar ─────────────────────────────────────────────────────────────────
  const toolbar = (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        gap: '0.3rem',
        background: '#383838',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '0.28rem 0.45rem',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
      }}
    >
      {!readOnly && (
        <button
          onClick={() => {
            setLibVisible((v) => !v)
            if (isMobile) setInspVisible(false)
          }}
          style={{
            ...tbBtn,
            background: libVisible ? 'rgba(28,171,176,0.15)' : 'transparent',
            borderColor: libVisible ? '#1CABB0' : undefined,
            color: libVisible ? '#1CABB0' : undefined,
            minHeight: isMobile ? 36 : undefined,
            padding: isMobile ? '0.3rem 0.65rem' : tbBtn.padding,
          }}
          title="Toggle block library"
        >
          ☰ Blocks
        </button>
      )}

      {!isMobile && (
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 0.1rem' }} />
      )}

      {!isMobile && (
        <>
          <button
            onClick={() => fitView({ padding: 0.15, duration: 300 })}
            style={tbBtn}
            title="Fit view"
          >
            ⊡ Fit
          </button>
          <button
            onClick={() => setSnapToGrid((v) => !v)}
            style={{
              ...tbBtn,
              background: snapToGrid ? 'rgba(28,171,176,0.15)' : 'transparent',
              borderColor: snapToGrid ? '#1CABB0' : undefined,
              color: snapToGrid ? '#1CABB0' : undefined,
            }}
            title="Snap to 16×16 grid"
          >
            ⊞ Snap
          </button>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 0.1rem' }} />
        </>
      )}

      <button
        onClick={() => {
          setInspVisible((v) => {
            if (v) setInspectedId(null)
            return !v
          })
          if (isMobile) setLibVisible(false)
        }}
        style={{
          ...tbBtn,
          background: inspVisible ? 'rgba(28,171,176,0.15)' : 'transparent',
          borderColor: inspVisible ? '#1CABB0' : undefined,
          color: inspVisible ? '#1CABB0' : undefined,
          minHeight: isMobile ? 36 : undefined,
          padding: isMobile ? '0.3rem 0.65rem' : tbBtn.padding,
        }}
        title="Toggle inspector"
      >
        ⊟ Inspector
      </button>
    </div>
  )

  // ── Drawer backdrop (mobile only) ──────────────────────────────────────────
  const showBackdrop = isMobile && (libVisible || inspVisible)

  const canvasSettings = useMemo(
    () => ({ edgesAnimated: effectiveEdgesAnimated }),
    [effectiveEdgesAnimated],
  )

  return (
    <ComputedContext.Provider value={computed}>
      <CanvasSettingsContext.Provider value={canvasSettings}>
      {computed.size > 0 && <div data-testid="canvas-computed" style={{ display: 'none' }} />}
      <div
        data-edges-animated={effectiveEdgesAnimated ? 'true' : 'false'}
        data-lod={effectiveLodTier}
        style={{
          display: 'flex',
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Block library panel — desktop inline, mobile overlay */}
        {libVisible && !readOnly && !isMobile && (
          <BlockLibrary
            width={libWidth}
            onResizeStart={onLibResizeStart}
            plan={plan}
            onProBlocked={() => setShowUpgradeModal(true)}
            onInsertTemplate={onInsertTemplate}
          />
        )}

        {/* Canvas */}
        <div
          ref={canvasWrapRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={onKeyDown}
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
                background: 'var(--card-bg)',
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
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={readOnly ? undefined : onConnect}
            isValidConnection={isValidConnection}
            onNodeDragStart={readOnly ? undefined : onNodeDragStart}
            onNodeClick={onNodeClick}
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
            deleteKeyCode={null}
            minZoom={0.08}
            maxZoom={4}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(255,255,255,0.06)"
            />
            {minimap && (
              <MiniMap
                pannable
                zoomable
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
                nodeColor={(node) =>
                  node.type === 'csGroup' ? 'var(--primary)' : 'var(--text-muted)'
                }
                maskColor="rgba(0,0,0,0.15)"
              />
            )}
          </ReactFlow>
          <BottomToolbar
            panMode={panMode}
            locked={locked}
            snapToGrid={snapToGrid}
            minimap={minimap}
            paused={paused}
            libVisible={libVisible}
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
            onToggleLibrary={() => {
              setLibVisible((v) => !v)
              if (isMobile) setInspVisible(false)
            }}
            onToggleInspector={() => {
              setInspVisible((v) => {
                if (v) setInspectedId(null)
                return !v
              })
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
          />
        </div>

        {/* Inspector panel — desktop inline */}
        {inspVisible && !isMobile && (
          <Inspector
            nodeId={inspectedId}
            width={inspWidth}
            onClose={closeInspector}
            onResizeStart={onInspResizeStart}
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
              background: 'rgba(0,0,0,0.5)',
              zIndex: 19,
            }}
            onClick={() => {
              setLibVisible(false)
              setInspVisible(false)
            }}
          />
        )}

        {libVisible && !readOnly && isMobile && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 20,
              width: mobileDrawerWidth,
            }}
          >
            <BlockLibrary
              width={mobileDrawerWidth}
              onResizeStart={() => {}}
              plan={plan}
              onProBlocked={() => setShowUpgradeModal(true)}
              onInsertTemplate={onInsertTemplate}
            />
          </div>
        )}

        {inspVisible && isMobile && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: 20,
              width: mobileDrawerWidth,
            }}
          >
            <Inspector
              nodeId={inspectedId}
              width={mobileDrawerWidth}
              onClose={closeInspector}
              onResizeStart={() => {}}
              onToggleCollapse={toggleGroupCollapse}
              onUngroupNode={ungroupNode}
              canUseGroups={ent.canUseGroups}
            />
          </div>
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
            onDeleteSelected={deleteSelected}
            onSaveAsTemplate={saveAsTemplate}
            canUseGroups={ent.canUseGroups}
          />
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
          <FindBlockDialog
            nodes={nodes}
            onFocusNode={focusNode}
            onClose={() => setFindOpen(false)}
          />
        )}
        {/* Upgrade modal for Pro-only blocks */}
        {showUpgradeModal && (
          <UpgradeModal
            open={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            reason="feature_locked"
          />
        )}
      </div>
    </CanvasSettingsContext.Provider>
    </ComputedContext.Provider>
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
