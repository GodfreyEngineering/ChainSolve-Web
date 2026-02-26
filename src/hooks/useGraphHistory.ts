/**
 * Bounded undo/redo history for graph state.
 *
 * API is entirely explicit — the caller decides when to save a checkpoint.
 * Stacks are stored in refs (no re-render on push); canUndo/canRedo are
 * reactive state so consumers can observe them.
 */

import { useCallback, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/types'

export interface GraphSnapshot {
  nodes: Node<NodeData>[]
  edges: Edge[]
}

const DEFAULT_LIMIT = 50

export function useGraphHistory(limit = DEFAULT_LIMIT) {
  const undoStack = useRef<GraphSnapshot[]>([])
  const redoStack = useRef<GraphSnapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const sync = useCallback(() => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }, [])

  /** Push current state as an undo point. Clears redo stack. */
  const save = useCallback(
    (current: GraphSnapshot) => {
      undoStack.current.push(current)
      if (undoStack.current.length > limit) {
        undoStack.current.shift()
      }
      redoStack.current = []
      sync()
    },
    [limit, sync],
  )

  /** Undo: pop from undo stack, push current to redo, return previous state. */
  const undo = useCallback(
    (current: GraphSnapshot): GraphSnapshot | null => {
      if (undoStack.current.length === 0) return null
      const prev = undoStack.current.pop()!
      redoStack.current.push(current)
      sync()
      return prev
    },
    [sync],
  )

  /** Redo: pop from redo stack, push current to undo, return next state. */
  const redo = useCallback(
    (current: GraphSnapshot): GraphSnapshot | null => {
      if (redoStack.current.length === 0) return null
      const next = redoStack.current.pop()!
      undoStack.current.push(current)
      sync()
      return next
    },
    [sync],
  )

  /** Reset both stacks (e.g. on project load). */
  const clear = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    sync()
  }, [sync])

  return { save, undo, redo, canUndo, canRedo, clear }
}
