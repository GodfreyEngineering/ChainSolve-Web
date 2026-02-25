/**
 * CanvasArea — ReactFlow canvas with all Wave 1 features:
 *
 *  Connection rules:  isValidConnection enforces 1 edge per input handle.
 *  Inspector:         opens on node body CLICK (not drag); closes ESC / pane click.
 *  Dockable panels:   BlockLibrary (left) and Inspector (right) are resizable + hideable.
 *  Context menus:     right-click on canvas, node, or edge.
 *  Delete:            Delete/Backspace key removes selected elements.
 *  Snap to grid:      toggle button in toolbar.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  type IsValidConnection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { SourceNode } from './nodes/SourceNode'
import { OperationNode } from './nodes/OperationNode'
import { DisplayNode } from './nodes/DisplayNode'
import { BlockLibrary, DRAG_TYPE } from './BlockLibrary'
import { Inspector } from './Inspector'
import { ContextMenu, type ContextMenuTarget } from './ContextMenu'
import { QuickAddPalette } from './QuickAddPalette'
import { ComputedContext } from '../../contexts/ComputedContext'
import { evaluateGraph } from '../../engine/evaluate'
import { BLOCK_REGISTRY, type NodeData } from '../../blocks/registry'

// ── Node type registry ────────────────────────────────────────────────────────

const NODE_TYPES = {
  csSource: SourceNode,
  csOperation: OperationNode,
  csDisplay: DisplayNode,
} as const

// ── Default graph ─────────────────────────────────────────────────────────────

export const INITIAL_NODES: Node<NodeData>[] = [
  {
    id: 'n1',
    type: 'csSource',
    position: { x: 80, y: 120 },
    data: { blockType: 'number', label: 'Number', value: 3 },
  },
  {
    id: 'n2',
    type: 'csSource',
    position: { x: 80, y: 240 },
    data: { blockType: 'number', label: 'Number', value: 4 },
  },
  {
    id: 'n3',
    type: 'csOperation',
    position: { x: 320, y: 160 },
    data: { blockType: 'add', label: 'Add' },
  },
  {
    id: 'n4',
    type: 'csDisplay',
    position: { x: 540, y: 180 },
    data: { blockType: 'display', label: 'Result' },
  },
]

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n3', targetHandle: 'a', animated: true },
  { id: 'e2', source: 'n2', sourceHandle: 'out', target: 'n3', targetHandle: 'b', animated: true },
  {
    id: 'e3',
    source: 'n3',
    sourceHandle: 'out',
    target: 'n4',
    targetHandle: 'value',
    animated: true,
  },
]

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
}

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

function CanvasInner({ initialNodes, initialEdges, onGraphChange }: CanvasAreaProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(
    initialNodes ?? INITIAL_NODES,
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? INITIAL_EDGES)

  // Notify parent of graph changes — skip the initial mount so loading a project
  // does not immediately mark the canvas as dirty.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onGraphChange?.(nodes, edges)
  }, [nodes, edges, onGraphChange])

  // Panel widths + visibility
  const [libWidth, setLibWidth] = useState(200)
  const [inspWidth, setInspWidth] = useState(260)
  const [libVisible, setLibVisible] = useState(true)
  const [inspVisible, setInspVisible] = useState(false)

  // Inspector state (open on click, not selection)
  const [inspectedId, setInspectedId] = useState<string | null>(null)

  // Snap-to-grid
  const [snapToGrid, setSnapToGrid] = useState(false)

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
  const { screenToFlowPosition, fitView } = useReactFlow()

  // ── Computed values ─────────────────────────────────────────────────────────
  const computed = useMemo(() => evaluateGraph(nodes, edges), [nodes, edges])

  // ── Connection validation: 1 edge per input handle ──────────────────────────
  const isValidConnection = useCallback<IsValidConnection>(
    (conn) => !edges.some((e) => e.target === conn.target && e.targetHandle === conn.targetHandle),
    [edges],
  )

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  )

  // ── Inspector: open on node body click, NOT on drag ────────────────────────
  const onNodeClick = useCallback((_: MouseEvent, node: Node) => {
    setInspectedId(node.id)
    setInspVisible(true)
  }, [])

  const onPaneClick = useCallback(() => {
    setInspectedId(null)
  }, [])

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
      const blockType = e.dataTransfer.getData(DRAG_TYPE)
      if (!blockType) return
      const def = BLOCK_REGISTRY.get(blockType)
      if (!def) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const id = `node_${++nodeIdCounter}`
      setNodes((nds) => [
        ...nds,
        { id, type: def.nodeKind, position, data: { ...def.defaultData } } as Node<NodeData>,
      ])
    },
    [screenToFlowPosition, setNodes],
  )

  // ── Keyboard: Delete/Backspace removes selected ─────────────────────────────
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setNodes((nds) => {
          const deleted = new Set(nds.filter((n) => n.selected).map((n) => n.id))
          if (inspectedId && deleted.has(inspectedId)) setInspectedId(null)
          return nds.filter((n) => !n.selected)
        })
        setEdges((eds) => eds.filter((ed) => !ed.selected))
      }
      if (e.key === 'Escape') {
        setContextMenu(null)
        closeInspector()
      }
    },
    [setNodes, setEdges, closeInspector, inspectedId],
  )

  // ── Context menus ───────────────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((e: MouseEvent, node: Node) => {
    e.preventDefault()
    setContextMenu({
      kind: 'node',
      x: e.clientX,
      y: e.clientY,
      nodeId: node.id,
      isLocked: node.draggable === false,
    })
  }, [])

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
    [nodes, setNodes],
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      if (inspectedId === nodeId) setInspectedId(null)
    },
    [setNodes, setEdges, inspectedId],
  )

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId))
    },
    [setEdges],
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
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: next.trim() } } : n)),
        )
      }
    },
    [nodes, setNodes],
  )

  // Lock / unlock: toggles node.draggable (undefined = draggable, false = locked)
  const lockNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, draggable: n.draggable === false ? undefined : false } : n,
        ),
      )
    },
    [setNodes],
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
    [quickAdd, setNodes],
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
      <button
        onClick={() => setLibVisible((v) => !v)}
        style={{
          ...tbBtn,
          background: libVisible ? 'rgba(28,171,176,0.15)' : 'transparent',
          borderColor: libVisible ? '#1CABB0' : undefined,
          color: libVisible ? '#1CABB0' : undefined,
        }}
        title="Toggle block library"
      >
        ☰ Blocks
      </button>

      <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 0.1rem' }} />

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

      <button
        onClick={() => {
          setInspVisible((v) => !v)
          if (!inspVisible) return
          setInspectedId(null)
        }}
        style={{
          ...tbBtn,
          background: inspVisible ? 'rgba(28,171,176,0.15)' : 'transparent',
          borderColor: inspVisible ? '#1CABB0' : undefined,
          color: inspVisible ? '#1CABB0' : undefined,
        }}
        title="Toggle inspector"
      >
        ⊟ Inspector
      </button>
    </div>
  )

  return (
    <ComputedContext.Provider value={computed}>
      <div
        style={{
          display: 'flex',
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Block library panel */}
        {libVisible && <BlockLibrary width={libWidth} onResizeStart={onLibResizeStart} />}

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
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
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
            <Controls />
          </ReactFlow>
        </div>

        {/* Inspector panel */}
        {inspVisible && (
          <Inspector
            nodeId={inspectedId}
            width={inspWidth}
            onClose={closeInspector}
            onResizeStart={onInspResizeStart}
          />
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
          />
        )}

        {/* Quick-add palette */}
        {quickAdd && (
          <QuickAddPalette
            screenX={quickAdd.screenX}
            screenY={quickAdd.screenY}
            onAdd={onQuickAddBlock}
            onClose={() => setQuickAdd(null)}
          />
        )}
      </div>
    </ComputedContext.Provider>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────

export function CanvasArea(props: CanvasAreaProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
