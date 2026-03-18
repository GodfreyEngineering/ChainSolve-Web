/**
 * tauriEngine.ts
 *
 * TypeScript wrapper around the Tauri native engine commands.
 * In the Tauri desktop app, evaluation is done by native Rust (engine-core)
 * instead of the WASM engine used in the browser.
 *
 * Uses lazy detection: `isTauri()` returns true when running inside Tauri.
 * All functions fall back gracefully to no-op / error if Tauri is unavailable.
 */

import type { EngineSnapshotV1 } from '../engine/wasm-types'

// ---------------------------------------------------------------------------
// Tauri detection
// ---------------------------------------------------------------------------

/** Returns true when running inside the Tauri desktop app. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ---------------------------------------------------------------------------
// Tauri invoke helper (avoids bundling @tauri-apps/api at build time)
// ---------------------------------------------------------------------------

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

function getInvoke(): TauriInvoke {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (w.__TAURI_INTERNALS__?.invoke) return w.__TAURI_INTERNALS__.invoke as TauriInvoke
  if (w.__TAURI__?.invoke) return w.__TAURI__.invoke as TauriInvoke
  throw new Error('[TAURI_ENGINE] invoke not available — not running in Tauri')
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/** Active session ID for incremental patch evaluation. */
let _sessionId: string | null = null

function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = `session_${Math.random().toString(36).slice(2)}`
  }
  return _sessionId
}

export function resetSession(): void {
  if (_sessionId && isTauri()) {
    getInvoke()('close_session', { sessionId: _sessionId }).catch(() => {})
  }
  _sessionId = null
}

// ---------------------------------------------------------------------------
// Evaluation commands
// ---------------------------------------------------------------------------

export interface NativeEvalResult {
  values: Record<string, unknown>
  diagnostics: unknown[]
  elapsed_us: number
  trace: unknown[]
  partial: boolean
}

/**
 * Evaluate a graph snapshot using the native Rust engine.
 * Returns parsed EvalResult.
 */
export async function nativeEvalSnapshot(
  snapshot: EngineSnapshotV1,
): Promise<NativeEvalResult> {
  if (!isTauri()) {
    throw new Error('[TAURI_ENGINE] Not running in Tauri desktop app')
  }
  const invoke = getInvoke()
  const json = JSON.stringify(snapshot)
  const result = await invoke('eval_snapshot', { snapshotJson: json })
  return JSON.parse(result as string) as NativeEvalResult
}

/**
 * Load a snapshot into the persistent session graph and evaluate.
 * More efficient than nativeEvalSnapshot for subsequent incremental patches.
 */
export async function nativeLoadSnapshot(
  snapshot: EngineSnapshotV1,
): Promise<NativeEvalResult> {
  if (!isTauri()) {
    throw new Error('[TAURI_ENGINE] Not running in Tauri desktop app')
  }
  const invoke = getInvoke()
  const json = JSON.stringify(snapshot)
  const result = await invoke('eval_load_snapshot', {
    sessionId: getSessionId(),
    snapshotJson: json,
  })
  return JSON.parse(result as string) as NativeEvalResult
}

/**
 * Apply a JSON patch to the session graph and return incremental results.
 */
export async function nativeEvalPatch(patchJson: string): Promise<NativeEvalResult> {
  if (!isTauri()) {
    throw new Error('[TAURI_ENGINE] Not running in Tauri desktop app')
  }
  const invoke = getInvoke()
  const result = await invoke('eval_patch', {
    sessionId: getSessionId(),
    patchJson,
  })
  return JSON.parse(result as string) as NativeEvalResult
}

// ---------------------------------------------------------------------------
// CUDA commands
// ---------------------------------------------------------------------------

/** Returns true if the desktop app was compiled with the `cuda` feature and a GPU is available. */
export async function nativeCudaAvailable(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const result = await getInvoke()('cuda_available')
    return result as boolean
  } catch {
    return false
  }
}

export interface CudaDeviceInfo {
  name: string
  total_memory_mb: number
  compute_capability: string
}

/** Returns CUDA device info, or null if unavailable. */
export async function nativeCudaDeviceInfo(): Promise<CudaDeviceInfo | null> {
  if (!isTauri()) return null
  try {
    const result = await getInvoke()('cuda_device_info')
    return (result as CudaDeviceInfo | null) ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Platform info
// ---------------------------------------------------------------------------

export interface PlatformInfo {
  os: 'windows' | 'macos' | 'linux'
  arch: string
  version: string
  cuda: boolean
}

export async function nativePlatformInfo(): Promise<PlatformInfo | null> {
  if (!isTauri()) return null
  try {
    return (await getInvoke()('platform_info')) as PlatformInfo
  } catch {
    return null
  }
}
