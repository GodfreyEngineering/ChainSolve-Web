/**
 * useCollaboration — React hook for real-time co-editing (5.7).
 *
 * Manages a CollabSession lifecycle tied to a canvas and user session.
 * Returns presence state (active collaborators) and mutation callbacks.
 *
 * The hook is no-op when collaborationEnabled is false so that the rest
 * of the app compiles and runs unchanged in solo mode.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { CollabUser, CollabSession } from '../lib/collaboration'
import { supabase } from '../lib/supabase'

export interface UseCollaborationOptions {
  canvasId: string
  userId: string
  userName?: string
  userColor?: string
  enabled?: boolean
  onRemoteChange?: (nodes: Node[], edges: Edge[]) => void
}

export interface UseCollaborationReturn {
  /** All currently active collaborators (excludes self). */
  activeUsers: CollabUser[]
  /** Whether the collab session is connected. */
  connected: boolean
  /** Broadcast cursor position (call on React Flow mouse move). */
  updateCursor: (x: number, y: number) => void
  /** Broadcast selection change. */
  updateSelection: (nodeIds: string[]) => void
  /** Push local graph state into Yjs (call after any local node/edge change). */
  syncGraph: (nodes: Node[], edges: Edge[]) => void
  /** Pull latest Yjs state as React Flow nodes/edges. */
  getRemoteState: () => { nodes: Node[]; edges: Edge[] } | null
}

const NOOP = () => void 0

export function useCollaboration(opts: UseCollaborationOptions): UseCollaborationReturn {
  const { canvasId, userId, userName, userColor, enabled = false, onRemoteChange } = opts
  const sessionRef = useRef<CollabSession | null>(null)
  const [activeUsers, setActiveUsers] = useState<CollabUser[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !canvasId || !userId) return

    let cancelled = false

    const init = async () => {
      const { createCollaborationSession } = await import('../lib/collaboration')
      if (cancelled) return

      const session = createCollaborationSession(supabase, canvasId, userId, {
        userName,
        userColor,
        onPresenceChange: (users) => {
          if (!cancelled) setActiveUsers(users)
        },
        onRemoteNodesChange: (nodes) => {
          if (!cancelled && onRemoteChange) {
            const edges = session.getState().edges
            onRemoteChange(nodes, edges)
          }
        },
        onRemoteEdgesChange: (edges) => {
          if (!cancelled && onRemoteChange) {
            const nodes = session.getState().nodes
            onRemoteChange(nodes, edges)
          }
        },
      })

      sessionRef.current = session
      if (!cancelled) setConnected(true)
    }

    void init()

    return () => {
      cancelled = true
      setConnected(false)
      setActiveUsers([])
      sessionRef.current?.destroy()
      sessionRef.current = null
    }
  }, [enabled, canvasId, userId, userName, userColor]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateCursor = useCallback((x: number, y: number) => {
    sessionRef.current?.updateCursor(x, y)
  }, [])

  const updateSelection = useCallback((nodeIds: string[]) => {
    sessionRef.current?.updateSelection(nodeIds)
  }, [])

  const syncGraph = useCallback((nodes: Node[], edges: Edge[]) => {
    sessionRef.current?.syncToYjs(nodes, edges)
  }, [])

  const getRemoteState = useCallback((): { nodes: Node[]; edges: Edge[] } | null => {
    return sessionRef.current?.getState() ?? null
  }, [])

  if (!enabled) {
    return {
      activeUsers: [],
      connected: false,
      updateCursor: NOOP,
      updateSelection: NOOP,
      syncGraph: NOOP,
      getRemoteState: () => null,
    }
  }

  return { activeUsers, connected, updateCursor, updateSelection, syncGraph, getRemoteState }
}
