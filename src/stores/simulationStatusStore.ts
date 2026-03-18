/**
 * simulationStatusStore — 8.8: Zustand store for simulation task status.
 *
 * Tracks the status of one or more long-running simulation tasks (ODE, ML
 * training, optimisation sweeps). Each task is keyed by nodeId.
 *
 * StatusBar and SimulationProgressBar components subscribe to read progress.
 * SimulationWorkerAPI writes status updates here via setStatus/setProgress.
 *
 * Status lifecycle: idle → running → (paused →) completed | error | cancelled
 */

import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SimTaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled'

export interface SimTaskMetrics {
  /** Latest loss / residual value for ML or optimisation tasks. */
  loss?: number
  /** Current time value for ODE tasks. */
  time?: number
  /** Best fitness value for genetic/evolutionary tasks. */
  bestFitness?: number
  /** Additional domain-specific metrics. */
  [key: string]: number | undefined
}

export interface SimTaskState {
  /** Node ID that owns this simulation task. */
  nodeId: string
  /** Human-readable task label, e.g. "ODE RK45" or "Training Neural Net". */
  label: string
  status: SimTaskStatus
  /** Current iteration (0-based). */
  iteration: number
  /** Total iterations planned (-1 = unknown). */
  totalIterations: number
  /** Current loop cycle (1-based, for looping simulations). */
  cycle: number
  /** Total cycles planned (-1 = unknown). */
  totalCycles: number
  /** Domain-specific scalar metrics for the latest iteration. */
  metrics: SimTaskMetrics
  /** Error message when status === 'error'. */
  errorMessage?: string
  /** ISO timestamp of when the task started. */
  startedAt: string
  /** ISO timestamp of when the task ended (completed/error/cancelled). */
  endedAt?: string
}

// ── Store interface ────────────────────────────────────────────────────────────

interface SimulationStatusStore {
  /** Active tasks keyed by nodeId. */
  tasks: Record<string, SimTaskState>

  /** Register a new task (sets status to 'running'). */
  startTask: (
    nodeId: string,
    label: string,
    totalIterations?: number,
    totalCycles?: number,
  ) => void

  /** Update progress for a running task. */
  setProgress: (
    nodeId: string,
    iteration: number,
    cycle?: number,
    metrics?: SimTaskMetrics,
  ) => void

  /** Mark a task as completed. */
  completeTask: (nodeId: string) => void

  /** Mark a task as errored. */
  failTask: (nodeId: string, errorMessage: string) => void

  /** Mark a task as cancelled. */
  cancelTask: (nodeId: string) => void

  /** Remove a task entry entirely (cleanup). */
  removeTask: (nodeId: string) => void

  /** Convenience: true if any task is currently running. */
  hasRunningTasks: () => boolean

  /** Get all currently running tasks. */
  getRunningTasks: () => SimTaskState[]
}

// ── Store implementation ───────────────────────────────────────────────────────

export const useSimulationStatusStore = create<SimulationStatusStore>((set, get) => ({
  tasks: {},

  startTask: (nodeId, label, totalIterations = -1, totalCycles = -1) => {
    set((s) => ({
      tasks: {
        ...s.tasks,
        [nodeId]: {
          nodeId,
          label,
          status: 'running',
          iteration: 0,
          totalIterations,
          cycle: 1,
          totalCycles,
          metrics: {},
          startedAt: new Date().toISOString(),
        },
      },
    }))
  },

  setProgress: (nodeId, iteration, cycle = 1, metrics = {}) => {
    set((s) => {
      const task = s.tasks[nodeId]
      if (!task) return s
      return {
        tasks: {
          ...s.tasks,
          [nodeId]: { ...task, iteration, cycle, metrics },
        },
      }
    })
  },

  completeTask: (nodeId) => {
    set((s) => {
      const task = s.tasks[nodeId]
      if (!task) return s
      return {
        tasks: {
          ...s.tasks,
          [nodeId]: { ...task, status: 'completed', endedAt: new Date().toISOString() },
        },
      }
    })
  },

  failTask: (nodeId, errorMessage) => {
    set((s) => {
      const task = s.tasks[nodeId]
      if (!task) return s
      return {
        tasks: {
          ...s.tasks,
          [nodeId]: { ...task, status: 'error', errorMessage, endedAt: new Date().toISOString() },
        },
      }
    })
  },

  cancelTask: (nodeId) => {
    set((s) => {
      const task = s.tasks[nodeId]
      if (!task) return s
      return {
        tasks: {
          ...s.tasks,
          [nodeId]: { ...task, status: 'cancelled', endedAt: new Date().toISOString() },
        },
      }
    })
  },

  removeTask: (nodeId) => {
    set((s) => {
      const { [nodeId]: _, ...rest } = s.tasks
      return { tasks: rest }
    })
  },

  hasRunningTasks: () => {
    return Object.values(get().tasks).some((t) => t.status === 'running')
  },

  getRunningTasks: () => {
    return Object.values(get().tasks).filter((t) => t.status === 'running')
  },
}))
