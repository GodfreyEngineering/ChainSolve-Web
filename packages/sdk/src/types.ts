/**
 * Core types for the ChainSolve SDK (10.7).
 *
 * These types mirror the engine-core Rust serialization format and the
 * internal `wasm-types.ts` definitions. Consumers can use these to build
 * typed graph snapshots and interpret evaluation results.
 */

// ── Graph snapshot (input) ────────────────────────────────────────────────────

/** A serializable graph snapshot in EngineSnapshotV1 format. */
export interface GraphSnapshot {
  version: 1
  nodes: NodeDef[]
  edges: EdgeDef[]
}

/** A single node definition within a graph snapshot. */
export interface NodeDef {
  id: string
  blockType: string
  data: Record<string, unknown>
}

/** A directed edge connecting two node ports. */
export interface EdgeDef {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

// ── Evaluation result (output) ────────────────────────────────────────────────

/** The result of executing a graph. */
export interface EvalResult {
  /** Map from node ID to evaluated value. */
  values: Record<string, Value>
  /** Non-fatal warnings/diagnostics. */
  diagnostics: Diagnostic[]
  /** Wall-clock evaluation time in microseconds. */
  elapsedUs: number
}

/** A typed value produced by evaluating a node. */
export type Value =
  | { kind: 'scalar'; value: number }
  | { kind: 'vector'; value: number[] }
  | { kind: 'matrix'; rows: number; cols: number; data: number[] }
  | { kind: 'table'; columns: string[]; rows: number[][] }
  | { kind: 'text'; value: string }
  | { kind: 'complex'; re: number; im: number }
  | { kind: 'interval'; lo: number; hi: number }
  | { kind: 'error'; message: string }

/** A diagnostic message attached to an evaluation. */
export interface Diagnostic {
  nodeId?: string
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
}

// ── Client options ────────────────────────────────────────────────────────────

/** Options for a graph execution request. */
export interface ExecuteOptions {
  /**
   * Override Number node values before execution.
   * Keys are node IDs, values are the replacement `f64` values.
   */
  params?: Record<string, number>
  /** Abort after this many milliseconds (default: no timeout). */
  timeoutMs?: number
}

/** Options for constructing a ChainSolveClient. */
export interface ClientOptions {
  /**
   * Base URL of the ChainSolve REST API.
   * Example: `"https://app.chainsolve.dev/api"` or `"http://localhost:8788/api"`.
   */
  baseUrl: string
  /**
   * Bearer token for authenticated API calls.
   * Obtain from Supabase Auth session: `session.access_token`.
   */
  accessToken?: string
  /**
   * Custom `fetch` implementation.
   * Defaults to the global `fetch`.
   */
  fetch?: typeof globalThis.fetch
}

// ── Errors ────────────────────────────────────────────────────────────────────

/** Thrown when the API returns an error response. */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Thrown when a typed accessor is called on the wrong value kind. */
export class ValueTypeError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(`Node '${nodeId}': expected ${expected}, got ${actual}`)
    this.name = 'ValueTypeError'
  }
}

/** Thrown when a node ID is not present in an EvalResult. */
export class NodeNotFoundError extends Error {
  constructor(public readonly nodeId: string) {
    super(`No node with id '${nodeId}' in result`)
    this.name = 'NodeNotFoundError'
  }
}
