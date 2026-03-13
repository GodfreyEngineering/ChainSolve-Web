/**
 * Bounded undo/redo history for graph state.
 *
 * API is entirely explicit — the caller decides when to save a checkpoint.
 * Stacks are stored in refs (no re-render on push); canUndo/canRedo/stackEntries
 * are reactive state so consumers can observe them.
 *
 * 4.15: Per-canvas history cache — history survives tab switches by caching
 * stacks in a module-level Map keyed by canvasId. On unmount, stacks are
 * saved; on mount with a known canvasId, they are restored.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/types'

export interface GraphSnapshot {
  nodes: Node<NodeData>[]
  edges: Edge[]
  /** Auto-set by save() if not provided. */
  timestamp?: number
  /** Optional human-readable label for the action. */
  label?: string
}

/** Stored snapshot always has a timestamp (assigned on save). */
interface StoredSnapshot extends GraphSnapshot {
  timestamp: number
}

const DEFAULT_LIMIT = 50

// 4.15: Module-level cache for per-canvas history stacks
interface CachedStacks {
  undo: StoredSnapshot[]
  redo: StoredSnapshot[]
}
const historyCache = new Map<string, CachedStacks>()

/** Clear cached history for a canvas (call on project close). */
export function clearHistoryCache(canvasId?: string) {
  if (canvasId) historyCache.delete(canvasId)
  else historyCache.clear()
}

export function useGraphHistory(limit = DEFAULT_LIMIT, canvasId?: string) {
  const undoStack = useRef<StoredSnapshot[]>([])
  const redoStack = useRef<StoredSnapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  /** Reactive copy of undo stack, newest first (for HistoryPanel display). */
  const [stackEntries, setStackEntries] = useState<StoredSnapshot[]>([])

  // 4.15: Restore cached history on mount
  const cacheKeyRef = useRef(canvasId)
  useEffect(() => {
    if (!canvasId) return
    const cached = historyCache.get(canvasId)
    if (cached) {
      undoStack.current = cached.undo
      redoStack.current = cached.redo
      setCanUndo(cached.undo.length > 0)
      setCanRedo(cached.redo.length > 0)
      setStackEntries([...cached.undo].reverse())
    }
    cacheKeyRef.current = canvasId
    // Save to cache on unmount
    return () => {
      if (cacheKeyRef.current) {
        historyCache.set(cacheKeyRef.current, {
          undo: [...undoStack.current],
          redo: [...redoStack.current],
        })
      }
    }
  }, [canvasId])

  const sync = useCallback(() => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
    setStackEntries([...undoStack.current].reverse())
  }, [])

  /** Push current state as an undo point. Clears redo stack. */
  const save = useCallback(
    (current: GraphSnapshot) => {
      const entry: StoredSnapshot = {
        ...current,
        timestamp: current.timestamp ?? Date.now(),
      }
      undoStack.current.push(entry)
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
    (current: GraphSnapshot): StoredSnapshot | null => {
      if (undoStack.current.length === 0) return null
      const prev = undoStack.current.pop()!
      redoStack.current.push({ ...current, timestamp: current.timestamp ?? Date.now() })
      sync()
      return prev
    },
    [sync],
  )

  /** Redo: pop from redo stack, push current to undo, return next state. */
  const redo = useCallback(
    (current: GraphSnapshot): StoredSnapshot | null => {
      if (redoStack.current.length === 0) return null
      const next = redoStack.current.pop()!
      undoStack.current.push({ ...current, timestamp: current.timestamp ?? Date.now() })
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

  /**
   * Restore to a specific undo stack entry (displayIdx 0 = most recent).
   * Entries after the target are moved to the redo stack so they remain accessible.
   * Returns the snapshot to restore, or null if out of bounds.
   */
  const restoreToIndex = useCallback(
    (displayIdx: number, current: GraphSnapshot): StoredSnapshot | null => {
      const stackLen = undoStack.current.length
      if (displayIdx < 0 || displayIdx >= stackLen) return null

      // displayIdx 0 = top of stack (most recent) → actualIdx = stackLen - 1
      const actualIdx = stackLen - 1 - displayIdx
      const target = undoStack.current[actualIdx]

      // Entries after target (more recent ones) go to redo stack
      // Redo stack is popped from end → push in reverse so oldest-first entries pop first
      const superseded = undoStack.current.slice(actualIdx + 1) // oldest→newest
      const stored: StoredSnapshot = { ...current, timestamp: current.timestamp ?? Date.now() }
      // redo stack order: [current, newest_superseded, ..., oldest_superseded]
      // So oldest_superseded (D) is at end → popped first on redo ✓
      redoStack.current = [stored, ...superseded.slice().reverse()]
      undoStack.current = undoStack.current.slice(0, actualIdx)

      sync()
      return target
    },
    [sync],
  )

  return { save, undo, redo, canUndo, canRedo, clear, stackEntries, restoreToIndex }
}
