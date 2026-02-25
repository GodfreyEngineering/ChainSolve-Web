/**
 * CanvasArea — wraps ReactFlow with:
 *  - Custom node types (csSource, csOperation, csDisplay)
 *  - Drag-to-add blocks from BlockLibrary
 *  - Live evaluation via useMemo → ComputedContext
 *  - Keyboard shortcut: Delete/Backspace removes selected elements
 *  - Toolbar: snap-to-grid toggle, fit-view button
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
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
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { SourceNode } from './nodes/SourceNode'
import { OperationNode } from './nodes/OperationNode'
import { DisplayNode } from './nodes/DisplayNode'
import { BlockLibrary, DRAG_TYPE } from './BlockLibrary'
import { Inspector } from './Inspector'
import { ComputedContext } from '../../contexts/ComputedContext'
import { evaluateGraph } from '../../engine/evaluate'
import { BLOCK_REGISTRY, type NodeData } from '../../blocks/registry'

// ── Node type map ─────────────────────────────────────────────────────────────

const NODE_TYPES = {
  csSource: SourceNode,
  csOperation: OperationNode,
  csDisplay: DisplayNode,
} as const

// ── Starter nodes (default graph on first load) ───────────────────────────────

const INITIAL_NODES: Node<NodeData>[] = [
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

const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n3', targetHandle: 'a', animated: true },
  { id: 'e2', source: 'n2', sourceHandle: 'out', target: 'n3', targetHandle: 'b', animated: true },
  { id: 'e3', source: 'n3', sourceHandle: 'out', target: 'n4', targetHandle: 'value', animated: true },
]

// ── Inner canvas component (needs to be inside ReactFlowProvider) ─────────────

let nodeIdCounter = 100

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  // ── Live evaluation ─────────────────────────────────────────────────────────

  const computed = useMemo(() => evaluateGraph(nodes, edges), [nodes, edges])

  // ── Selection ──────────────────────────────────────────────────────────────

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedNode(sel.length === 1 ? sel[0] : null)
  }, [])

  // ── Connection ────────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge({ ...params, animated: true }, eds),
      )
    },
    [setEdges],
  )

  // ── Drag-to-add ───────────────────────────────────────────────────────────

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

      const newNode: Node<NodeData> = {
        id,
        type: def.nodeKind,
        position,
        data: { ...def.defaultData },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes],
  )

  // ── Keyboard delete ───────────────────────────────────────────────────────

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setNodes((nds) => nds.filter((n) => !n.selected))
        setEdges((eds) => eds.filter((ed) => !ed.selected))
      }
    },
    [setNodes, setEdges],
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const toolbar = (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        gap: '0.4rem',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.3rem 0.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <button
        onClick={() => fitView({ padding: 0.15, duration: 300 })}
        style={toolbarBtnStyle}
        title="Fit view (Shift+1)"
      >
        Fit
      </button>
      <button
        onClick={() => setSnapToGrid((v) => !v)}
        style={{ ...toolbarBtnStyle, background: snapToGrid ? 'rgba(100,108,255,0.25)' : 'transparent' }}
        title="Toggle snap to grid"
      >
        Snap {snapToGrid ? 'On' : 'Off'}
      </button>
    </div>
  )

  return (
    <ComputedContext.Provider value={computed}>
      <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
        <BlockLibrary />

        <div
          ref={reactFlowWrapper}
          style={{ flex: 1, position: 'relative' }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={onKeyDown}
          tabIndex={0}
          // tabIndex needed for onKeyDown to fire on this div
        >
          {toolbar}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            snapToGrid={snapToGrid}
            snapGrid={[16, 16]}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={null}  // We handle delete ourselves
            minZoom={0.1}
            maxZoom={4}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
            <Controls />
          </ReactFlow>
        </div>

        <Inspector selectedNode={selectedNode} />
      </div>
    </ComputedContext.Provider>
  )
}

// ── Public export (wraps in ReactFlowProvider) ────────────────────────────────

export function CanvasArea() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toolbarBtnStyle: React.CSSProperties = {
  padding: '0.2rem 0.6rem',
  borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 500,
}
