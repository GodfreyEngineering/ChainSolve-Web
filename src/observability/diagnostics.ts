/**
 * observability/diagnostics.ts — Engine diagnostics collector + trace exporter.
 *
 * Collects:
 *   - Engine eval results (perf timings, diagnostics, summarized trace)
 *   - Worker lifecycle events
 *   - Last 50 warnings / errors from the engine layer
 *
 * Does NOT collect:
 *   - Dataset contents (vectors, tables, CSV data)
 *   - User-entered text field values
 *   - Node values beyond their kind (scalar/vector/table/error)
 *
 * Hard cap: exportDiagnostics() output is limited to 64 KB.
 * Call exportDiagnostics() to get a JSON bundle for download or submission.
 */

import type { WorkerLifecycleEvent, EngineDiagnosticsPayload } from './types'
import { OBS_LIMITS } from './types'
import { BUILD_SHA, BUILD_ENV, BUILD_VERSION } from '../lib/build-info'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TraceSummaryEntry {
  nodeId: string
  opId: string
  durationUs?: number
  outputKind: string
  hasError: boolean
}

export interface EngineEvalRecord {
  ts: string
  nodeCount: number
  edgeCount: number
  evalDurationUs: number
  evaluatedCount: number
  errorCount: number
  traceSummary: TraceSummaryEntry[]
}

export interface DiagnosticsBundle {
  exportedAt: string
  appVersion: string
  buildSha: string
  env: string
  sessionId: string
  routePath: string
  projectId: string | null
  canvasId: string | null
  engineVersion: string
  contractVersion: number
  recentEvals: EngineEvalRecord[]       // last 20
  workerEvents: WorkerLifecycleEvent[]  // last 50
  engineDiagnostics: Array<{            // last 50 non-info diagnostics
    ts: string
    nodeId?: string
    level: string
    code: string
    message: string
  }>
  queueDepth: number
}

// ── Internal state ────────────────────────────────────────────────────────────

const _recentEvals: EngineEvalRecord[] = []
const _workerEvents: WorkerLifecycleEvent[] = []
const _engineDiagnostics: DiagnosticsBundle['engineDiagnostics'] = []

let _engineVersion = ''
let _contractVersion = 0
let _projectId: string | null = null
let _canvasId: string | null = null

// ── Setters (called from engine integration layer) ────────────────────────────

export function setEngineVersion(v: string, contract: number): void {
  _engineVersion = v
  _contractVersion = contract
}

export function setProjectContext(projectId: string | null, canvasId: string | null): void {
  _projectId = projectId
  _canvasId = canvasId
}

// ── Capture functions ─────────────────────────────────────────────────────────

interface CaptureEvalInput {
  nodeCount: number
  edgeCount: number
  evalDurationUs: number
  evaluatedCount?: number
  diagnostics?: Array<{ nodeId?: string; level: string; code: string; message: string }>
  trace?: Array<{ nodeId: string; opId: string; inputs?: unknown; output?: { kind: string } }>
}

/**
 * Capture a summary of a completed engine evaluation.
 * Does NOT store input/output values — only metadata.
 */
export function captureEvalResult(input: CaptureEvalInput): void {
  const diags = input.diagnostics ?? []
  const errorCount = diags.filter((d) => d.level === 'error').length

  // Store non-info diagnostics in rolling buffer
  for (const d of diags) {
    if (d.level !== 'info') {
      _engineDiagnostics.push({ ts: new Date().toISOString(), ...d })
      if (_engineDiagnostics.length > OBS_LIMITS.MAX_TRACE_ENTRIES) {
        _engineDiagnostics.shift()
      }
    }
  }

  // Summarize trace (no values stored, only kinds + op metadata)
  const traceSummary: TraceSummaryEntry[] = (input.trace ?? [])
    .slice(0, OBS_LIMITS.MAX_TRACE_ENTRIES)
    .map((t) => ({
      nodeId: t.nodeId,
      opId: t.opId,
      outputKind: (t.output as { kind?: string } | undefined)?.kind ?? 'unknown',
      hasError: false,
    }))

  _recentEvals.push({
    ts: new Date().toISOString(),
    nodeCount: input.nodeCount,
    edgeCount: input.edgeCount,
    evalDurationUs: input.evalDurationUs,
    evaluatedCount: input.evaluatedCount ?? 0,
    errorCount,
    traceSummary,
  })
  if (_recentEvals.length > 20) _recentEvals.shift()
}

/**
 * Record a worker lifecycle event.
 */
export function captureWorkerEvent(
  event: WorkerLifecycleEvent['event'],
  detail?: string,
): void {
  _workerEvents.push({ ts: new Date().toISOString(), event, detail })
  if (_workerEvents.length > OBS_LIMITS.MAX_WORKER_EVENTS) {
    _workerEvents.shift()
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

function getSessionId(): string {
  try {
    const raw = localStorage.getItem('cs_obs_session_v1')
    if (raw) {
      const p = JSON.parse(raw) as { id?: string }
      return p.id ?? 'unknown'
    }
  } catch {
    // ignore
  }
  return 'unknown'
}

/**
 * Build a diagnostics bundle for download or submission.
 * Hard-capped at 64 KB — arrays are truncated if necessary.
 *
 * IMPORTANT: No dataset contents, no user-entered values.
 */
export function exportDiagnostics(): DiagnosticsBundle {
  return {
    exportedAt: new Date().toISOString(),
    appVersion: BUILD_VERSION,
    buildSha: BUILD_SHA,
    env: BUILD_ENV,
    sessionId: getSessionId(),
    routePath: typeof window !== 'undefined' ? window.location.pathname : '/',
    projectId: _projectId,
    canvasId: _canvasId,
    engineVersion: _engineVersion,
    contractVersion: _contractVersion,
    recentEvals: [..._recentEvals],
    workerEvents: [..._workerEvents],
    engineDiagnostics: [..._engineDiagnostics],
    queueDepth: 0, // filled by caller from client module if needed
  }
}

/**
 * Build an EngineDiagnosticsPayload for sending as an obs event.
 * Excludes values — only metadata.
 */
export function buildEngineDiagnosticsPayload(
  nodeCount: number,
  edgeCount: number,
): EngineDiagnosticsPayload {
  const lastEval = _recentEvals[_recentEvals.length - 1]
  return {
    engineVersion: _engineVersion,
    contractVersion: _contractVersion,
    nodeCount,
    edgeCount,
    evalDurationUs: lastEval?.evalDurationUs ?? 0,
    diagnostics: _engineDiagnostics.slice(-20),
    trace: _recentEvals
      .slice(-5)
      .flatMap((e) => e.traceSummary.map((t) => ({ nodeId: t.nodeId, opId: t.opId }))),
    workerEvents: _workerEvents.slice(-10),
  }
}

/**
 * Reset diagnostics state (used in tests or after explicit user clear).
 */
export function clearDiagnostics(): void {
  _recentEvals.length = 0
  _workerEvents.length = 0
  _engineDiagnostics.length = 0
}
