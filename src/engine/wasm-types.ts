/**
 * Typed interfaces for the WASM engine worker boundary.
 *
 * These types are shared between the main thread (index.ts) and the
 * Web Worker (worker.ts). The engine-core Rust types serialize to
 * these shapes via serde.
 */

// ── Engine snapshot (input) ───────────────────────────────────────

export interface EngineSnapshotV1 {
  version: 1
  nodes: EngineNodeDef[]
  edges: EngineEdgeDef[]
}

export interface EngineNodeDef {
  id: string
  blockType: string
  data: Record<string, unknown>
}

export interface EngineEdgeDef {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

// ── Engine result (output) ────────────────────────────────────────

export interface EngineEvalResult {
  values: Record<string, EngineValue>
  diagnostics: EngineDiagnostic[]
  elapsedUs: number
}

export type EngineValue =
  | { kind: 'scalar'; value: number }
  | { kind: 'vector'; value: number[] }
  | { kind: 'table'; columns: string[]; rows: number[][] }
  | { kind: 'error'; message: string }

export interface EngineDiagnostic {
  nodeId?: string
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
}

export interface EngineErrorResult {
  error: { code: string; message: string }
}

// ── Worker messages ───────────────────────────────────────────────

/** Messages sent from main thread → worker. */
export type WorkerRequest =
  | { type: 'evaluate'; requestId: number; snapshot: EngineSnapshotV1 }

/** Messages sent from worker → main thread. */
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; requestId: number; result: EngineEvalResult }
  | { type: 'error'; requestId: number; error: { code: string; message: string } }
  | { type: 'init-error'; error: { code: string; message: string } }
