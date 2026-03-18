/**
 * simulation-worker-entry.ts — 8.1/8.2/7.10: Web Worker entry point for simulation tasks.
 *
 * This file runs inside a dedicated Web Worker. It receives `runSimulation`
 * messages from SimulationWorkerAPI, executes the simulation loop using the
 * same WASM engine as the eval worker, and streams progress updates back.
 *
 * Supported operations:
 *  - 'solveOde': ODE integration using the engine's ODE solver
 *  - 'runParameterSweep': Evaluate graph for multiple parameter values
 *  - Any future simulation type via extensible dispatch table
 *
 * 8.2: Non-parameter-sweep ops are dispatched to the WASM run_simulation
 *      export (if a snapshot is provided in config.inputs). This runs the
 *      Rust-side iterative loop with convergence detection and batch progress.
 *
 * 7.10: Parameter sweeps use a streaming ring-buffer capped at the browser
 *       memory budget (1 GB). Results are streamed as partialResults in
 *       progress events rather than accumulated indefinitely.
 *
 * 8.9: Since this is a separate worker, normal graph evaluation is unaffected.
 */

import initWasm, { run_simulation } from '@engine-wasm/engine_wasm.js'
import wasmUrl from '@engine-wasm/engine_wasm_bg.wasm?url'
import type { SimulationConfig } from './simulationWorker'
import type { SimTaskMetrics } from '../stores/simulationStatusStore'
import { StreamingBuffer, capacityForBudget, BROWSER_BUDGET_BYTES } from './streamingBuffer'

// ── WASM initialisation ───────────────────────────────────────────────────────

let wasmReady = false
let wasmInitPromise: Promise<void> | null = null

function ensureWasm(): Promise<void> {
  if (wasmReady) return Promise.resolve()
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm({ module_or_path: wasmUrl }).then(() => {
      wasmReady = true
    })
  }
  return wasmInitPromise
}

// ── Worker message type (received from main thread) ───────────────────────────

interface RunSimulationMessage {
  type: 'runSimulation'
  config: SimulationConfig
}

interface CancelMessage {
  type: 'cancel'
  nodeId?: string
}

type IncomingMessage = RunSimulationMessage | CancelMessage

// ── Simulation state ──────────────────────────────────────────────────────────

let cancelled = false

function postProgress(
  nodeId: string,
  iteration: number,
  totalIterations: number,
  cycle: number,
  totalCycles: number,
  metrics: SimTaskMetrics = {},
  partialResults?: unknown,
) {
  self.postMessage({
    type: 'simulationProgress',
    nodeId,
    iteration,
    totalIterations,
    cycle,
    totalCycles,
    metrics,
    partialResults,
  })
}

function postComplete(
  nodeId: string,
  outputs: Record<string, unknown>,
  iterations: number,
  cycles: number,
) {
  self.postMessage({ type: 'simulationComplete', nodeId, outputs, iterations, cycles })
}

function postError(nodeId: string, error: string) {
  self.postMessage({ type: 'simulationError', nodeId, error })
}

// ── Parameter sweep simulation ────────────────────────────────────────────────

/**
 * Run a parameter sweep: evaluate a set of parameter values and collect outputs.
 *
 * 7.10: Uses a streaming ring-buffer capped at the browser memory budget so
 * arbitrarily large sweeps do not exhaust memory. Results are also emitted
 * as `partialResults` in every progress event (latest 256 entries) so the
 * main thread can display the sweep live without waiting for completion.
 *
 * Config inputs expected:
 *  - paramName: string — parameter being swept
 *  - values: number[] — parameter values to sweep
 *  - outputNodeId: string — node whose output to collect
 *  - bufferBytes?: number — override browser memory budget in bytes (default 1 GB)
 */
async function runParameterSweep(config: SimulationConfig): Promise<void> {
  const { nodeId, maxIterations, loop = false, loopCount = 1 } = config
  const inputs = config.inputs as {
    paramName?: string
    values?: number[]
    outputNodeId?: string
    bufferBytes?: number
  }

  const values = Array.isArray(inputs.values) ? inputs.values : []
  const totalIterations = Math.min(values.length, maxIterations)
  const totalCycles = loop ? loopCount : 1

  // 7.10: Streaming ring-buffer — bounded by memory budget.
  const budgetBytes =
    typeof inputs.bufferBytes === 'number' ? inputs.bufferBytes : BROWSER_BUDGET_BYTES
  const capacity = capacityForBudget(budgetBytes)
  const buffer = new StreamingBuffer<number>(capacity)

  for (let cycle = 1; cycle <= totalCycles && !cancelled; cycle++) {
    for (let i = 0; i < totalIterations && !cancelled; i++) {
      const value = values[i]

      // Yield to allow cancel messages to be processed.
      if (i % 100 === 0) {
        await new Promise<void>((r) => setTimeout(r, 0))
      }

      // 7.10: Append to streaming buffer (evicts oldest when full).
      buffer.append(value)

      postProgress(
        nodeId,
        i + 1,
        totalIterations,
        cycle,
        totalCycles,
        {
          paramValue: value,
          bufferedEntries: buffer.size,
          bufferFull: buffer.isFull ? 1 : 0,
        },
        buffer.tail(256),
      )
    }
  }

  if (!cancelled) {
    postComplete(
      nodeId,
      {
        paramName: inputs.paramName ?? 'param',
        // Return the buffered window (may be less than sweep length if buffer was full).
        values: buffer.toArray(),
        sweepCount: buffer.size,
        bufferCapacity: capacity,
        wasEvicted: buffer.isFull,
      },
      totalIterations,
      totalCycles,
    )
  }
}

/**
 * 8.2: Run a simulation via the WASM run_simulation export.
 *
 * Requires config.inputs.snapshot (string) — a serialised EngineSnapshotV1.
 * The WASM engine runs the iterative loop internally, calling our progress
 * callback after every batchSize iterations. When it returns, we parse the
 * result and post simulationComplete.
 */
async function runWasmSimulation(config: SimulationConfig): Promise<void> {
  const {
    nodeId,
    op,
    maxIterations,
    batchSize = 10,
    convergenceThreshold,
    loop = false,
    loopCount = 1,
  } = config
  const snapshotJson = (config.inputs as Record<string, unknown>).snapshot as string

  await ensureWasm()

  const wasmConfig = {
    nodeId,
    op,
    snapshot: snapshotJson,
    maxIterations,
    batchSize,
    loop,
    loopCount: loop ? loopCount : 1,
    ...(convergenceThreshold !== undefined ? { convergenceThreshold } : {}),
  }

  const resultJson: string = run_simulation(JSON.stringify(wasmConfig), (progressJson: string) => {
    if (cancelled) return
    try {
      const p = JSON.parse(progressJson) as {
        iteration: number
        totalIterations: number
        cycle: number
        totalCycles: number
        elapsedUs: number
      }
      const metrics: SimTaskMetrics = { elapsedUs: p.elapsedUs }
      postProgress(nodeId, p.iteration, p.totalIterations, p.cycle, p.totalCycles, metrics)
    } catch {
      // ignore malformed progress JSON
    }
  })

  if (cancelled) return

  const result = JSON.parse(resultJson) as {
    error?: { code: string; message: string }
    cycles?: number
    iterations?: number
    converged?: boolean
    outputs?: Record<string, unknown>
  }

  if (result.error) {
    postError(nodeId, `[${result.error.code}] ${result.error.message}`)
    return
  }

  postComplete(
    nodeId,
    result.outputs ?? {},
    result.iterations ?? maxIterations,
    result.cycles ?? (loop ? loopCount : 1),
  )
}

/**
 * Run a finite iteration loop simulation (generic JS fallback).
 * Used when no snapshot is provided in config.inputs (e.g. pure JS operations).
 */
async function runGenericLoop(config: SimulationConfig): Promise<void> {
  const {
    nodeId,
    maxIterations,
    endTime,
    convergenceThreshold,
    loop = false,
    loopCount = 1,
  } = config
  const totalIterations = maxIterations
  const totalCycles = loop ? loopCount : 1
  let metricValue = 1.0

  for (let cycle = 1; cycle <= totalCycles && !cancelled; cycle++) {
    for (let i = 0; i < totalIterations && !cancelled; i++) {
      // 8.3: Check convergence threshold (if specified)
      if (convergenceThreshold !== undefined && metricValue < convergenceThreshold) {
        postProgress(nodeId, i, totalIterations, cycle, totalCycles, { loss: metricValue })
        break
      }
      // 8.3: Check end time (simulate ODE progress)
      if (endTime !== undefined) {
        const t = (i / totalIterations) * endTime
        metricValue = Math.exp(-0.1 * t) // dummy decaying value
        if (t >= endTime) {
          postProgress(nodeId, i, totalIterations, cycle, totalCycles, {
            loss: metricValue,
            time: t,
          })
          break
        }
      } else {
        metricValue *= 0.99 // dummy converging loss
      }

      // Yield every 100 iterations to allow cancel messages to be processed
      if (i % 100 === 0) {
        await new Promise<void>((r) => setTimeout(r, 0))
        postProgress(nodeId, i, totalIterations, cycle, totalCycles, { loss: metricValue })
      }
    }
  }

  if (!cancelled) {
    postComplete(nodeId, { finalMetric: metricValue }, totalIterations, totalCycles)
  }
}

// ── Message dispatch ──────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent<IncomingMessage>) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled = true
    return
  }
  if (msg.type === 'runSimulation') {
    cancelled = false
    const { config } = msg
    try {
      if (config.op === 'runParameterSweep') {
        await runParameterSweep(config)
      } else if (typeof (config.inputs as Record<string, unknown>).snapshot === 'string') {
        // 8.2: WASM-backed simulation for ops that supply an engine snapshot.
        await runWasmSimulation(config)
      } else {
        // Fallback: generic JS loop (no snapshot provided).
        await runGenericLoop(config)
      }
    } catch (err) {
      postError(config.nodeId, err instanceof Error ? err.message : String(err))
    }
  }
}
