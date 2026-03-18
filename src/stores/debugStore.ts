/**
 * debugStore — Breakpoint and step-execution state (3.36, 3.37).
 *
 * Breakpoints: a set of nodeIds where execution should "pause" (i.e.,
 * after evaluation, we display the trace up to that node).
 *
 * Step mode: when active, displays evaluation trace one node at a time.
 * The WASM engine evaluates the full graph with trace:true; the UI
 * then shows only the first N nodes' results, stepping through the trace.
 *
 * This is a post-hoc debug view — the engine always evaluates fully,
 * but the displayed state simulates pausing at breakpoints.
 */

import { create } from 'zustand'
import type { TraceEntry } from '../engine/wasm-types'

export interface DebugState {
  /** Set of nodeIds with active breakpoints. */
  breakpoints: ReadonlySet<string>

  /** Whether step-debug mode is active (trace collected on last eval). */
  active: boolean

  /** The full trace from the last evaluation (when active). */
  trace: TraceEntry[]

  /** Index into trace — the node the debugger is "paused at" (0 = before start). */
  stepIndex: number

  /** nodeId the debugger is currently paused at (null if not active or before start). */
  pausedAtNodeId: string | null

  // ── Actions ──────────────────────────────────────────────────────

  /** Toggle a breakpoint on a node. */
  toggleBreakpoint: (nodeId: string) => void

  /** Clear all breakpoints. */
  clearBreakpoints: () => void

  /** Activate debug mode with a trace from an evaluation. */
  activateWithTrace: (trace: TraceEntry[]) => void

  /** Deactivate debug mode. */
  deactivate: () => void

  /** Step to the next node in the trace. Returns true if there are more nodes. */
  stepForward: () => boolean

  /** Step to the previous node in the trace. */
  stepBackward: () => void

  /** Continue to next breakpoint (or end of trace). */
  continueToBreakpoint: () => void

  /** Continue to end of trace. */
  continueToEnd: () => void
}

export const useDebugStore = create<DebugState>((set, get) => ({
  breakpoints: new Set<string>(),
  active: false,
  trace: [],
  stepIndex: 0,
  pausedAtNodeId: null,

  toggleBreakpoint(nodeId) {
    set((s) => {
      const next = new Set(s.breakpoints)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return { breakpoints: next }
    })
  },

  clearBreakpoints() {
    set({ breakpoints: new Set<string>() })
  },

  activateWithTrace(trace) {
    const { breakpoints } = get()
    // Find first breakpoint in trace order
    let firstBreakIdx = trace.findIndex((e) => breakpoints.has(e.nodeId))
    if (firstBreakIdx === -1 && trace.length > 0) {
      // No breakpoints — start at node 0
      firstBreakIdx = 0
    }

    set({
      active: true,
      trace,
      stepIndex: Math.max(0, firstBreakIdx),
      pausedAtNodeId: trace[Math.max(0, firstBreakIdx)]?.nodeId ?? null,
    })
  },

  deactivate() {
    set({ active: false, trace: [], stepIndex: 0, pausedAtNodeId: null })
  },

  stepForward() {
    const { trace, stepIndex } = get()
    const next = stepIndex + 1
    if (next >= trace.length) return false
    set({
      stepIndex: next,
      pausedAtNodeId: trace[next]?.nodeId ?? null,
    })
    return true
  },

  stepBackward() {
    const { trace, stepIndex } = get()
    const prev = Math.max(0, stepIndex - 1)
    set({
      stepIndex: prev,
      pausedAtNodeId: trace[prev]?.nodeId ?? null,
    })
  },

  continueToBreakpoint() {
    const { trace, stepIndex, breakpoints } = get()
    // Find next breakpoint after current position
    const nextBpIdx = trace.findIndex((e, i) => i > stepIndex && breakpoints.has(e.nodeId))
    if (nextBpIdx === -1) {
      // No more breakpoints — go to end
      const end = trace.length - 1
      set({ stepIndex: end, pausedAtNodeId: trace[end]?.nodeId ?? null })
    } else {
      set({ stepIndex: nextBpIdx, pausedAtNodeId: trace[nextBpIdx].nodeId })
    }
  },

  continueToEnd() {
    const { trace } = get()
    const end = trace.length - 1
    set({ stepIndex: end, pausedAtNodeId: trace[end]?.nodeId ?? null })
  },
}))

/** Returns true if the given nodeId has a breakpoint. */
export function hasBreakpoint(nodeId: string): boolean {
  return useDebugStore.getState().breakpoints.has(nodeId)
}

/** Returns the set of nodeIds that have been evaluated up to the current step. */
export function getEvaluatedNodeIds(): ReadonlySet<string> {
  const { active, trace, stepIndex } = useDebugStore.getState()
  if (!active) return new Set()
  const ids = new Set<string>()
  for (let i = 0; i <= stepIndex; i++) {
    if (trace[i]) ids.add(trace[i].nodeId)
  }
  return ids
}
