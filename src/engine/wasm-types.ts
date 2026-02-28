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
  trace?: TraceEntry[]
  partial?: boolean
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

// ── Ops catalog (from Rust) ───────────────────────────────────────

export interface CatalogEntry {
  opId: string
  label: string
  category: string
  nodeKind: string
  inputs: { id: string; label: string }[]
  proOnly: boolean
}

// ── Patch operations (W9.2) ──────────────────────────────────────

export type PatchOp =
  | { op: 'addNode'; node: EngineNodeDef }
  | { op: 'removeNode'; nodeId: string }
  | { op: 'updateNodeData'; nodeId: string; data: Record<string, unknown> }
  | { op: 'addEdge'; edge: EngineEdgeDef }
  | { op: 'removeEdge'; edgeId: string }

// ── Incremental result (W9.2) ───────────────────────────────────

export interface IncrementalEvalResult {
  changedValues: Record<string, EngineValue>
  diagnostics: EngineDiagnostic[]
  elapsedUs: number
  evaluatedCount: number
  totalCount: number
  trace?: TraceEntry[]
  partial?: boolean
}

// ── Eval options (W9.3) ─────────────────────────────────────────

export interface EvalOptions {
  trace?: boolean
  maxTraceNodes?: number
  timeBudgetMs?: number
}

// ── Trace types (W9.3) ──────────────────────────────────────────

export type ValueSummary =
  | { kind: 'scalar'; value: number }
  | { kind: 'vector'; length: number; sample: number[] }
  | { kind: 'table'; rows: number; columns: number }
  | { kind: 'error'; message: string }

export interface TraceEntry {
  nodeId: string
  opId: string
  inputs: Record<string, ValueSummary>
  output: ValueSummary
  diagnostics: EngineDiagnostic[]
}

// ── Worker messages ───────────────────────────────────────────────

/** Messages sent from main thread → worker. */
export type WorkerRequest =
  | {
      type: 'evaluate'
      requestId: number
      snapshot: EngineSnapshotV1
      options?: EvalOptions
    }
  | {
      type: 'loadSnapshot'
      requestId: number
      snapshot: EngineSnapshotV1
      options?: EvalOptions
    }
  | { type: 'applyPatch'; requestId: number; ops: PatchOp[]; options?: EvalOptions }
  | {
      type: 'setInput'
      requestId: number
      nodeId: string
      portId: string
      value: number
    }
  | { type: 'registerDataset'; datasetId: string; buffer: ArrayBuffer }
  | { type: 'releaseDataset'; datasetId: string }
  | { type: 'cancel'; requestId: number }
  | { type: 'getStats'; requestId: number }

// ── Engine stats (W9.4) ──────────────────────────────────────────

export interface EngineStats {
  datasetCount: number
  datasetTotalBytes: number
}

/** Messages sent from worker → main thread. */
export type WorkerResponse =
  | {
      type: 'ready'
      catalog: CatalogEntry[]
      /** Pre-computed constant values for zero-input source blocks (W12.2). */
      constantValues: Record<string, number>
      engineVersion: string
      contractVersion: number
      /** Milliseconds taken to instantiate the WASM module. */
      initMs: number
    }
  | { type: 'result'; requestId: number; result: EngineEvalResult }
  | { type: 'incremental'; requestId: number; result: IncrementalEvalResult }
  | { type: 'error'; requestId: number; error: { code: string; message: string } }
  | { type: 'init-error'; error: { code: string; message: string } }
  | {
      type: 'progress'
      requestId: number
      evaluatedNodes: number
      totalNodesEstimate: number
      elapsedMs: number
    }
  | { type: 'stats'; requestId: number; stats: EngineStats }
