/**
 * HTTP API client for the ChainSolve REST API (10.7).
 *
 * Connects to the server-side REST API (item 10.3) to execute graphs
 * remotely.  Works in Node.js, Deno, browser, and edge runtimes.
 *
 * ## Usage
 *
 * ```typescript
 * import { ChainSolveClient, GraphBuilder } from '@chainsolve/sdk'
 *
 * const client = new ChainSolveClient({
 *   baseUrl: 'https://app.chainsolve.dev/api',
 *   accessToken: session.access_token,
 * })
 *
 * const snapshot = new GraphBuilder()
 *   .number('a', 3)
 *   .number('b', 4)
 *   .op('sum', 'add', { inputs: ['a', 'b'] })
 *   .build()
 *
 * const result = await client.execute(snapshot)
 * console.log(result.scalar('sum'))  // 7
 * ```
 */

import type { ClientOptions, EvalResult, ExecuteOptions, GraphSnapshot } from './types.ts'
import { ApiError } from './types.ts'
import { ResultAccessor } from './result.ts'
import { applyParams } from './graphBuilder.ts'

// ── ChainSolveClient ──────────────────────────────────────────────────────────

/**
 * REST API client for the ChainSolve computation engine.
 *
 * Thread-safe.  A single instance can be reused across multiple `execute()`
 * calls.
 */
export class ChainSolveClient {
  private readonly _baseUrl: string
  private readonly _accessToken: string | undefined
  private readonly _fetch: typeof globalThis.fetch

  constructor(options: ClientOptions) {
    this._baseUrl = options.baseUrl.replace(/\/$/, '')
    this._accessToken = options.accessToken
    this._fetch = options.fetch ?? globalThis.fetch
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Execute a graph snapshot and return a typed result accessor.
   *
   * Applies any `params` overrides before sending the request.
   *
   * @throws `ApiError` on HTTP 4xx/5xx.
   * @throws `Error` on network failure or malformed response.
   */
  async execute(
    snapshot: GraphSnapshot,
    options: ExecuteOptions = {},
  ): Promise<ResultAccessor> {
    const patched = options.params
      ? applyParams(snapshot, options.params)
      : snapshot

    const body = JSON.stringify({ snapshot: patched })
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this._accessToken) {
      headers['Authorization'] = `Bearer ${this._accessToken}`
    }

    const controller = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if (options.timeoutMs !== undefined) {
      timeoutId = setTimeout(() => controller.abort(), options.timeoutMs)
    }

    let response: Response
    try {
      response = await this._fetch(`${this._baseUrl}/graph/execute`, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
      throw new ApiError(
        response.status,
        String(errorBody['code'] ?? 'API_ERROR'),
        String(errorBody['message'] ?? `HTTP ${response.status}`),
      )
    }

    const data = await response.json() as Record<string, unknown>
    const result = data['result'] as EvalResult
    return new ResultAccessor(result)
  }

  /**
   * Execute a graph from a JSON string.
   *
   * Convenience wrapper around `execute()` that accepts a raw JSON string
   * (e.g. from `GraphBuilder.toJSON()` or a saved `.chainsolve` file).
   */
  async executeJson(
    snapshotJson: string,
    options: ExecuteOptions = {},
  ): Promise<ResultAccessor> {
    const { parseSnapshot } = await import('./graphBuilder.ts')
    const snapshot = parseSnapshot(snapshotJson)
    return this.execute(snapshot, options)
  }

  /**
   * Validate a graph snapshot against the server catalog.
   *
   * Returns a list of diagnostic messages.  An empty array means the graph
   * is valid.
   */
  async validate(snapshot: GraphSnapshot): Promise<EvalResult['diagnostics']> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this._accessToken) {
      headers['Authorization'] = `Bearer ${this._accessToken}`
    }

    const response = await this._fetch(`${this._baseUrl}/graph/validate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ snapshot }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
      throw new ApiError(
        response.status,
        String(errorBody['code'] ?? 'API_ERROR'),
        String(errorBody['message'] ?? `HTTP ${response.status}`),
      )
    }

    const data = await response.json() as Record<string, unknown>
    return (data['diagnostics'] ?? []) as EvalResult['diagnostics']
  }
}
