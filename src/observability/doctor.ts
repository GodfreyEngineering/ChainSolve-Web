/**
 * observability/doctor.ts — In-app health / self-test checks.
 *
 * runDoctorChecks() runs a set of non-destructive checks and returns
 * an array of DoctorCheck results. Each check is independent;
 * a failure in one does not prevent the others from running.
 *
 * Checks (W9.8):
 *   1. healthz  — GET /api/healthz (server up, no external deps)
 *   2. readyz   — GET /api/readyz  (Supabase reachable)
 *   3. wasm     — verify engine is initialized in window context
 *   4. storage  — verify Supabase storage bucket policy (best-effort)
 *
 * See docs/observability/doctor.md for usage + fix guidance.
 */

import type { DoctorCheck } from './types'

// ── Check runner ──────────────────────────────────────────────────────────────

async function check(name: string, fn: () => Promise<string>): Promise<DoctorCheck> {
  const t0 = performance.now()
  try {
    const message = await fn()
    return { name, ok: true, message, durationMs: Math.round(performance.now() - t0) }
  } catch (err) {
    return {
      name,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - t0),
    }
  }
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkHealthz(): Promise<string> {
  const resp = await fetch('/api/healthz', { method: 'GET' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const json = (await resp.json()) as { ok?: boolean; app_version?: string }
  if (!json.ok) throw new Error('healthz returned ok=false')
  return `ok — v${json.app_version ?? 'unknown'}`
}

async function checkReadyz(): Promise<string> {
  const resp = await fetch('/api/readyz', { method: 'GET' })
  if (resp.status === 503) {
    const json = (await resp.json()) as { checks?: Record<string, boolean> }
    const failing = Object.entries(json.checks ?? {})
      .filter(([, v]) => !v)
      .map(([k]) => k)
    throw new Error(`readyz failing: ${failing.join(', ')}`)
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return 'ok'
}

async function checkWasm(): Promise<string> {
  // The engine is created in main.tsx and attached to window for debug access
  const engine = (window as unknown as Record<string, unknown>).__chainsolve_engine
  if (!engine) throw new Error('Engine not initialized (WASM may still be loading)')
  const v = (engine as { engineVersion?: string }).engineVersion ?? 'unknown'
  return `engine v${v} ready`
}

async function checkStorage(): Promise<string> {
  // We cannot write to storage safely from doctor (it would create real objects).
  // Instead, we check that the Supabase client is reachable by hitting the REST
  // health endpoint (same host as VITE_SUPABASE_URL, /rest/v1/).
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not set')
  const url = `${supabaseUrl}/rest/v1/`
  const resp = await fetch(url, {
    method: 'GET',
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '' },
    signal: AbortSignal.timeout(5000),
  })
  // Supabase REST returns 200 or 400 for this endpoint; both mean "reachable"
  if (resp.status >= 500) throw new Error(`Supabase REST returned ${resp.status}`)
  return 'reachable'
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run all doctor checks and return results.
 * Never throws — each check handles its own errors.
 */
export async function runDoctorChecks(): Promise<DoctorCheck[]> {
  const results = await Promise.allSettled([
    check('healthz', checkHealthz),
    check('readyz', checkReadyz),
    check('wasm_engine', checkWasm),
    check('supabase_rest', checkStorage),
  ])
  return results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: 'unknown', ok: false, message: String(r.reason), durationMs: 0 },
  )
}
