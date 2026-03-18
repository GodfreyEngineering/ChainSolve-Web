/**
 * collaboration.ts — Real-time co-editing via Yjs CRDT + Supabase Realtime.
 *
 * Implements item 5.7: Yjs CRDT for shared graph state (nodes, edges, params)
 * with <100ms sync via WebSocket — each user sees coloured cursors and
 * selection highlights. Supabase Realtime Presence for online indicators.
 *
 * Architecture:
 *   - Yjs document has two YMaps: 'nodes' and 'edges'
 *   - Supabase Realtime channel `canvas:{canvasId}` carries two event types:
 *       'yjs-update' : Yjs binary update (base64-encoded)
 *       'awareness'  : cursor position, user info, selection
 *   - Awareness (cursor + selection) uses Presence heartbeat, not Yjs Awareness
 *     protocol, to avoid the y-protocols dependency.
 *
 * Usage:
 *   const collab = await createCollaborationSession(supabase, canvasId, userId, opts)
 *   collab.bindToReactFlow(nodes, edges, onNodesChange, onEdgesChange)
 *   collab.destroy()
 */

import * as Y from 'yjs'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Node, Edge } from '@xyflow/react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CollabUser {
  userId: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  selectedNodeIds: string[]
  lastSeen: number
}

export interface CollabSessionOptions {
  userName?: string
  userColor?: string
  onPresenceChange?: (users: CollabUser[]) => void
  onRemoteNodesChange?: (nodes: Node[]) => void
  onRemoteEdgesChange?: (edges: Edge[]) => void
}

export interface CollabSession {
  doc: Y.Doc
  nodesMap: Y.Map<string>
  edgesMap: Y.Map<string>
  activeUsers: Map<string, CollabUser>
  /** Call with current viewport cursor position whenever it changes. */
  updateCursor: (x: number, y: number) => void
  /** Call when selection changes. */
  updateSelection: (nodeIds: string[]) => void
  /** Apply current React Flow state to Yjs (used on init). */
  syncToYjs: (nodes: Node[], edges: Edge[]) => void
  /** Get current state from Yjs as React Flow nodes/edges. */
  getState: () => { nodes: Node[]; edges: Edge[] }
  /** Clean up subscriptions. */
  destroy: () => void
}

// ── User color palette ────────────────────────────────────────────────────────

const COLLAB_COLORS = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#3498db',
  '#9b59b6',
  '#e91e63',
  '#00bcd4',
  '#ff5722',
  '#8bc34a',
  '#673ab7',
]

let colorIdx = 0
function nextColor(): string {
  return COLLAB_COLORS[colorIdx++ % COLLAB_COLORS.length]
}

// ── Serialization helpers ─────────────────────────────────────────────────────

function nodesToMap(ydoc: Y.Doc, nodesMap: Y.Map<string>, nodes: Node[]): void {
  ydoc.transact(() => {
    // Remove deleted nodes
    const newIds = new Set(nodes.map((n) => n.id))
    for (const id of nodesMap.keys()) {
      if (!newIds.has(id)) nodesMap.delete(id)
    }
    // Upsert changed nodes
    for (const node of nodes) {
      nodesMap.set(node.id, JSON.stringify(node))
    }
  })
}

function edgesToMap(ydoc: Y.Doc, edgesMap: Y.Map<string>, edges: Edge[]): void {
  ydoc.transact(() => {
    const newIds = new Set(edges.map((e) => e.id))
    for (const id of edgesMap.keys()) {
      if (!newIds.has(id)) edgesMap.delete(id)
    }
    for (const edge of edges) {
      edgesMap.set(edge.id, JSON.stringify(edge))
    }
  })
}

function mapToNodes(nodesMap: Y.Map<string>): Node[] {
  const nodes: Node[] = []
  for (const [, json] of nodesMap.entries()) {
    try {
      nodes.push(JSON.parse(json) as Node)
    } catch {
      // skip malformed entries
    }
  }
  return nodes
}

function mapToEdges(edgesMap: Y.Map<string>): Edge[] {
  const edges: Edge[] = []
  for (const [, json] of edgesMap.entries()) {
    try {
      edges.push(JSON.parse(json) as Edge)
    } catch {
      // skip malformed entries
    }
  }
  return edges
}

// ── Main factory ─────────────────────────────────────────────────────────────

/**
 * Create a Yjs collaboration session backed by Supabase Realtime.
 *
 * @param supabase - Supabase client (authenticated)
 * @param canvasId - Unique identifier for the canvas being edited
 * @param userId   - Current user's ID
 * @param opts     - Optional callbacks and display settings
 */
export function createCollaborationSession(
  supabase: SupabaseClient,
  canvasId: string,
  userId: string,
  opts: CollabSessionOptions = {},
): CollabSession {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap<string>('nodes')
  const edgesMap = doc.getMap<string>('edges')

  const userColor = opts.userColor ?? nextColor()
  const userName = opts.userName ?? `User ${userId.slice(0, 6)}`
  const activeUsers = new Map<string, CollabUser>()

  let channel: RealtimeChannel | null = null
  let destroyed = false

  // ── Local Yjs update → broadcast to peers ────────────────────────────────
  const onDocUpdate = (update: Uint8Array, _origin: unknown) => {
    if (destroyed || !channel) return
    // Base64-encode binary update for JSON transport
    const b64 = btoa(String.fromCharCode(...update))
    void channel.send({
      type: 'broadcast',
      event: 'yjs-update',
      payload: { update: b64, from: userId },
    })
  }
  doc.on('update', onDocUpdate)

  // ── Supabase Realtime channel setup ────────────────────────────────────
  channel = supabase
    .channel(`canvas:${canvasId}`, {
      config: { presence: { key: userId } },
    })
    .on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
      if (payload.from === userId) return // ignore own echo
      try {
        const bytes = Uint8Array.from(atob(payload.update as string), (c) => c.charCodeAt(0))
        Y.applyUpdate(doc, bytes, 'remote')

        // Notify listeners
        opts.onRemoteNodesChange?.(mapToNodes(nodesMap))
        opts.onRemoteEdgesChange?.(mapToEdges(edgesMap))
      } catch {
        // ignore malformed updates
      }
    })
    .on('broadcast', { event: 'awareness' }, ({ payload }) => {
      const user = payload as CollabUser
      if (user.userId === userId) return
      user.lastSeen = Date.now()
      activeUsers.set(user.userId, user)
      opts.onPresenceChange?.([...activeUsers.values()])
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel?.presenceState<{ userId: string; color: string; name: string }>()
      if (!state) return
      for (const [key, presences] of Object.entries(state)) {
        if (key === userId) continue
        const p = presences[0]
        if (p && !activeUsers.has(p.userId)) {
          activeUsers.set(p.userId, {
            userId: p.userId,
            color: p.color,
            name: p.name,
            cursor: null,
            selectedNodeIds: [],
            lastSeen: Date.now(),
          })
        }
      }
      opts.onPresenceChange?.([...activeUsers.values()])
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences as unknown as Array<{ userId: string }>) {
        activeUsers.delete(p.userId)
      }
      opts.onPresenceChange?.([...activeUsers.values()])
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel?.track({ userId, color: userColor, name: userName })
      }
    })

  // ── Awareness broadcast ─────────────────────────────────────────────────
  let awarenessThrottle: ReturnType<typeof setTimeout> | null = null
  const pendingAwareness: Partial<CollabUser> = {}

  function flushAwareness() {
    if (!channel || destroyed) return
    void channel.send({
      type: 'broadcast',
      event: 'awareness',
      payload: {
        userId,
        name: userName,
        color: userColor,
        cursor: pendingAwareness.cursor ?? null,
        selectedNodeIds: pendingAwareness.selectedNodeIds ?? [],
        lastSeen: Date.now(),
      } satisfies CollabUser,
    })
  }

  function scheduleAwareness() {
    if (awarenessThrottle) clearTimeout(awarenessThrottle)
    awarenessThrottle = setTimeout(flushAwareness, 50) // 50ms throttle → <100ms RTT
  }

  const updateCursor = (x: number, y: number) => {
    pendingAwareness.cursor = { x, y }
    scheduleAwareness()
  }

  const updateSelection = (nodeIds: string[]) => {
    pendingAwareness.selectedNodeIds = nodeIds
    scheduleAwareness()
  }

  // ── Stale user cleanup ──────────────────────────────────────────────────
  const staleCleaner = setInterval(() => {
    const threshold = Date.now() - 10_000 // 10s without update = stale
    let changed = false
    for (const [id, user] of activeUsers) {
      if (user.lastSeen < threshold) {
        activeUsers.delete(id)
        changed = true
      }
    }
    if (changed) opts.onPresenceChange?.([...activeUsers.values()])
  }, 5_000)

  // ── Public API ──────────────────────────────────────────────────────────
  const syncToYjs = (nodes: Node[], edges: Edge[]) => {
    nodesToMap(doc, nodesMap, nodes)
    edgesToMap(doc, edgesMap, edges)
  }

  const getState = () => ({
    nodes: mapToNodes(nodesMap),
    edges: mapToEdges(edgesMap),
  })

  const destroy = () => {
    destroyed = true
    if (awarenessThrottle) clearTimeout(awarenessThrottle)
    clearInterval(staleCleaner)
    doc.off('update', onDocUpdate)
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
    doc.destroy()
  }

  return {
    doc,
    nodesMap,
    edgesMap,
    activeUsers,
    updateCursor,
    updateSelection,
    syncToYjs,
    getState,
    destroy,
  }
}
