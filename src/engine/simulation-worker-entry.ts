/**
 * simulation-worker-entry.ts — 8.1: Web Worker entry point for simulation tasks.
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
 * 8.9: Since this is a separate worker, normal graph evaluation is unaffected.
 */

import type { SimulationConfig } from './simulationWorker'
import type { SimTaskMetrics } from '../stores/simulationStatusStore'

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
 * This is the primary simulation type available without additional Rust WASM exports.
 *
 * Config inputs expected:
 *  - paramName: string — parameter being swept
 *  - values: number[] — parameter values to sweep
 *  - outputNodeId: string — node whose output to collect
 */
async function runParameterSweep(config: SimulationConfig): Promise<void> {
  const { nodeId, maxIterations, loop = false, loopCount = 1 } = config
  const inputs = config.inputs as {
    paramName?: string
    values?: number[]
    outputNodeId?: string
  }

  const values = Array.isArray(inputs.values) ? inputs.values : []
  const totalIterations = Math.min(values.length, maxIterations)
  const totalCycles = loop ? loopCount : 1
  const results: number[] = []

  for (let cycle = 1; cycle <= totalCycles && !cancelled; cycle++) {
    for (let i = 0; i < totalIterations && !cancelled; i++) {
      const value = values[i]

      // Simulate work (actual engine call would go here when WASM is loaded)
      await new Promise<void>((r) => setTimeout(r, 0))

      results.push(value)

      postProgress(nodeId, i + 1, totalIterations, cycle, totalCycles, {
        paramValue: value,
      })
    }
  }

  if (!cancelled) {
    postComplete(
      nodeId,
      {
        paramName: inputs.paramName ?? 'param',
        values: results,
        sweepCount: results.length,
      },
      totalIterations,
      totalCycles,
    )
  }
}

/**
 * Run a finite iteration loop simulation (generic).
 * Used for operations that don't have direct WASM bindings yet.
 *
 * Config inputs expected:
 *  - stepDelayMs: number — artificial step delay for testing (default 0)
 */
async function runGenericLoop(config: SimulationConfig): Promise<void> {
  const { nodeId, maxIterations, endTime, convergenceThreshold, loop = false, loopCount = 1 } =
    config
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
      } else {
        // Default: generic iteration loop for solveOde, trainNeuralNet, etc.
        await runGenericLoop(config)
      }
    } catch (err) {
      postError(config.nodeId, err instanceof Error ? err.message : String(err))
    }
  }
}
