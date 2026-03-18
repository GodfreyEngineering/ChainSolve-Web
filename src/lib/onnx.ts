/**
 * onnx.ts — ONNX model session manager (2.96).
 *
 * Manages InferenceSession lifecycle for onnxruntime-web.
 * Sessions are keyed by a user-assigned node ID and cached in memory.
 *
 * Usage:
 *   const session = await loadOnnxSession(nodeId, arrayBuffer)
 *   const result = await runOnnxInference(session, inputData)
 */

import type { InferenceSession, Tensor } from 'onnxruntime-web'

// ── Session cache ─────────────────────────────────────────────────────────────

const sessionCache = new Map<string, InferenceSession>()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnnxModelInfo {
  inputNames: string[]
  outputNames: string[]
  inputShapes: Record<string, readonly (number | string | bigint)[]>
  outputShapes: Record<string, readonly (number | string | bigint)[]>
}

export interface OnnxResult {
  values: Float32Array
  shape: number[]
  outputName: string
}

// ── Session management ────────────────────────────────────────────────────────

/**
 * Load an ONNX model from an ArrayBuffer and cache the session by nodeId.
 * Re-loading the same nodeId replaces the existing session.
 */
export async function loadOnnxSession(
  nodeId: string,
  buffer: ArrayBuffer,
): Promise<{ session: InferenceSession; info: OnnxModelInfo }> {
  const { InferenceSession: OrtSession } = await import('onnxruntime-web')

  const existing = sessionCache.get(nodeId)
  if (existing) {
    try {
      await existing.release()
    } catch {
      /* ignore */
    }
  }

  const session = await OrtSession.create(buffer, {
    executionProviders: ['wasm'],
  })

  sessionCache.set(nodeId, session)

  const info: OnnxModelInfo = {
    inputNames: [...session.inputNames],
    outputNames: [...session.outputNames],
    inputShapes: {},
    outputShapes: {},
  }

  return { session, info }
}

/**
 * Run inference on a loaded session. Returns the first output tensor flattened.
 */
export async function runOnnxInference(
  nodeId: string,
  inputData: number[],
  inputShape?: number[],
): Promise<OnnxResult | null> {
  const session = sessionCache.get(nodeId)
  if (!session) return null

  const { Tensor: OrtTensor } = await import('onnxruntime-web')

  const inputName = session.inputNames[0]
  if (!inputName) return null

  const floatData = new Float32Array(inputData)
  const shape = inputShape ?? [1, inputData.length]
  const tensor = new OrtTensor('float32', floatData, shape)

  const feeds: Record<string, Tensor> = { [inputName]: tensor }
  const results = await session.run(feeds)

  const outputName = session.outputNames[0]
  if (!outputName) return null

  const output = results[outputName]
  if (!output) return null

  const data = output.data as Float32Array
  const dims = output.dims.map((d) => (typeof d === 'bigint' ? Number(d) : d)) as number[]

  return { values: data, shape: dims, outputName }
}

/**
 * Release a session and remove it from cache.
 */
export async function releaseOnnxSession(nodeId: string): Promise<void> {
  const session = sessionCache.get(nodeId)
  if (session) {
    try {
      await session.release()
    } catch {
      /* ignore */
    }
    sessionCache.delete(nodeId)
  }
}

/**
 * Returns true if a session is loaded for the given nodeId.
 */
export function hasOnnxSession(nodeId: string): boolean {
  return sessionCache.has(nodeId)
}
