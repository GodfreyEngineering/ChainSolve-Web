/**
 * simulationWorker.ts — 8.1/8.3/8.5/8.6/8.9: Dedicated simulation worker API.
 *
 * Wraps a separate Web Worker (loaded from the same worker.ts entry point as
 * the eval worker) for long-running simulation tasks such as ODE integration,
 * ML training, and parameter sweeps. This keeps simulation execution isolated
 * from the normal reactive eval worker so graph evaluation continues while
 * simulations run (requirement 8.9).
 *
 * Features:
 *  - Dedicated worker instance per simulation run (8.1)
 *  - All tasks are finite: maxIterations / endTime / convergenceThreshold (8.3)
 *  - Progress streaming via onProgress callback (8.5)
 *  - AbortController-based cancellation (8.6)
 *  - SimulationStatusStore integration (8.8)
 *
 * Usage:
 *   const api = new SimulationWorkerAPI()
 *   await api.run({
 *     nodeId: 'ode1',
 *     label: 'ODE RK45',
 *     op: 'solveOde',
 *     inputs: { ... },
 *     maxIterations: 10000,
 *     endTime: 10,
 *   }, {
 *     onProgress: (p) => console.log(p.iteration, p.metrics),
 *     signal: abortController.signal,
 *   })
 */

import { useSimulationStatusStore } from '../stores/simulationStatusStore'
import type { SimTaskMetrics } from '../stores/simulationStatusStore'

// ── Configuration ─────────────────────────────────────────────────────────────

/** 8.3: All tasks must specify at least one termination condition. */
export interface SimulationConfig {
  /** Node ID that owns this simulation (used as status store key). */
  nodeId: string
  /** Human-readable label shown in status bar. */
  label: string
  /** Operation type (e.g. 'solveOde', 'trainNeuralNet', 'runOptimiser'). */
  op: string
  /** Operation-specific inputs (ODE config, training params, etc.). */
  inputs: Record<string, unknown>
  /** Maximum number of iterations before forced stop. Required (8.3). */
  maxIterations: number
  /** For ODE tasks: stop at this time value. */
  endTime?: number
  /** For training tasks: stop when loss drops below this value. */
  convergenceThreshold?: number
  /** For training tasks: batch size per iteration. */
  batchSize?: number
  /** 8.4: When true, restart from initial conditions after each cycle. */
  loop?: boolean
  /** 8.4: Number of cycles to run when loop=true. */
  loopCount?: number
}

/** Progress message from the simulation worker. */
export interface SimulationProgress {
  nodeId: string
  iteration: number
  totalIterations: number
  cycle: number
  totalCycles: number
  /** Partial results from the latest batch. */
  partialResults?: unknown
  metrics: SimTaskMetrics
}

/** Options for running a simulation. */
export interface SimulationRunOptions {
  /** Called on each progress update from the worker. */
  onProgress?: (progress: SimulationProgress) => void
  /** AbortSignal to cancel the simulation (8.6). */
  signal?: AbortSignal
}

/** Result of a completed simulation. */
export interface SimulationResult {
  nodeId: string
  op: string
  outputs: Record<string, unknown>
  iterations: number
  cycles: number
  durationMs: number
}

// ── Worker message types ──────────────────────────────────────────────────────

interface SimWorkerProgressMessage {
  type: 'simulationProgress'
  nodeId: string
  iteration: number
  totalIterations: number
  cycle: number
  totalCycles: number
  partialResults?: unknown
  metrics: SimTaskMetrics
}

interface SimWorkerCompleteMessage {
  type: 'simulationComplete'
  nodeId: string
  outputs: Record<string, unknown>
  iterations: number
  cycles: number
}

interface SimWorkerErrorMessage {
  type: 'simulationError'
  nodeId: string
  error: string
}

type SimWorkerMessage = SimWorkerProgressMessage | SimWorkerCompleteMessage | SimWorkerErrorMessage

// ── SimulationWorkerAPI ────────────────────────────────────────────────────────

/**
 * 8.1: API wrapper for a dedicated simulation Web Worker.
 *
 * Each simulation run creates a new worker instance so that multiple
 * simulations can run concurrently without interfering with each other
 * or with the reactive eval workers.
 */
export class SimulationWorkerAPI {
  private worker: Worker | null = null
  private startTime = 0

  /**
   * Run a simulation task.
   *
   * 8.9: This uses a dedicated worker separate from the eval worker pool,
   * so normal graph evaluation is unaffected while the simulation runs.
   *
   * 8.3: The config MUST specify maxIterations; endTime and
   * convergenceThreshold are optional additional stop conditions.
   */
  async run(
    config: SimulationConfig,
    options: SimulationRunOptions = {},
  ): Promise<SimulationResult> {
    const { nodeId, label, maxIterations, loop = false, loopCount = 1 } = config
    const { onProgress, signal } = options
    const store = useSimulationStatusStore.getState()

    // Register in status store (8.8)
    store.startTask(nodeId, label, maxIterations, loop ? loopCount : 1)
    this.startTime = Date.now()

    return new Promise<SimulationResult>((resolve, reject) => {
      // 8.1: Dedicated worker (separate from eval worker pool)
      this.worker = new Worker(
        new URL('./simulation-worker-entry.ts', import.meta.url),
        { type: 'module' },
      )
      const worker = this.worker

      // 8.6: Cancellation via AbortSignal
      const onAbort = () => {
        worker.postMessage({ type: 'cancel', nodeId })
        worker.terminate()
        this.worker = null
        store.cancelTask(nodeId)
        reject(new DOMException('Simulation cancelled', 'AbortError'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      worker.onmessage = (e: MessageEvent<SimWorkerMessage>) => {
        const msg = e.data
        if (msg.type === 'simulationProgress') {
          // 8.5: Progress streaming
          const progress: SimulationProgress = {
            nodeId: msg.nodeId,
            iteration: msg.iteration,
            totalIterations: msg.totalIterations,
            cycle: msg.cycle,
            totalCycles: msg.totalCycles,
            partialResults: msg.partialResults,
            metrics: msg.metrics,
          }
          store.setProgress(nodeId, msg.iteration, msg.cycle, msg.metrics)
          onProgress?.(progress)
        } else if (msg.type === 'simulationComplete') {
          signal?.removeEventListener('abort', onAbort)
          worker.terminate()
          this.worker = null
          store.completeTask(nodeId)
          resolve({
            nodeId: msg.nodeId,
            op: config.op,
            outputs: msg.outputs,
            iterations: msg.iterations,
            cycles: msg.cycles,
            durationMs: Date.now() - this.startTime,
          })
        } else if (msg.type === 'simulationError') {
          signal?.removeEventListener('abort', onAbort)
          worker.terminate()
          this.worker = null
          store.failTask(nodeId, msg.error)
          reject(new Error(msg.error))
        }
      }

      worker.onerror = (e) => {
        signal?.removeEventListener('abort', onAbort)
        this.worker = null
        const msg = e.message ?? 'Simulation worker crashed'
        store.failTask(nodeId, msg)
        reject(new Error(msg))
      }

      // Start the simulation
      worker.postMessage({ type: 'runSimulation', config })
    })
  }

  /** Cancel the currently running simulation. */
  cancel(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'cancel' })
      this.worker.terminate()
      this.worker = null
    }
  }

  /** True if a simulation is currently running. */
  get isRunning(): boolean {
    return this.worker !== null
  }
}
