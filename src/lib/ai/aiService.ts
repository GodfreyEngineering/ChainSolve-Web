/**
 * aiService.ts — client-side service to call POST /api/ai.
 *
 * Never calls OpenAI directly — all AI traffic is proxied through
 * the Cloudflare Pages Function.
 */

import { getSession } from '../auth'
import type { AiApiRequest, AiApiResponse, AiApiError, AiMode, AiScope, AiTask } from './types'

export interface SendAiOptions {
  mode: AiMode
  task?: AiTask
  scope?: AiScope
  userMessage: string
  projectId: string
  canvasId: string
  selectedNodeIds: string[]
  locale?: string
  diagnostics?: { level: string; code: string; message: string; nodeIds?: string[] }[]
  /** 6.02: Computed values per node — nodeId → scalar number or error string. */
  computedValues?: Record<string, number | string>
}

/**
 * Send an AI request to POST /api/ai.
 * Returns the parsed response or throws with a user-facing message.
 */
export async function sendAiRequest(opts: SendAiOptions): Promise<AiApiResponse> {
  const session = await getSession()
  const token = session?.access_token
  if (!token) {
    throw new Error('Not authenticated')
  }

  const body: AiApiRequest = {
    mode: opts.mode,
    scope: opts.scope ?? 'active_canvas',
    task: opts.task ?? 'chat',
    userMessage: opts.userMessage,
    projectId: opts.projectId,
    canvasId: opts.canvasId,
    selectedNodeIds: opts.selectedNodeIds,
    clientContext: {
      locale: opts.locale,
      diagnostics: opts.diagnostics,
      computedValues: opts.computedValues,
    },
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as AiApiResponse | AiApiError

  if (!json.ok) {
    const err = json as AiApiError
    throw new Error(err.error ?? 'AI request failed')
  }

  return json as AiApiResponse
}

// ── 6.05: Streaming variant ──────────────────────────────────────────────

/** SSE event types from the streaming AI endpoint. */
export type AiStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; response: AiApiResponse }
  | { type: 'error'; error: string }

/**
 * Send a streaming AI request. Returns an async iterable of SSE events.
 * Text deltas arrive as `{type:'delta', text:'...'}` and the final structured
 * response arrives as `{type:'done', response:{...}}`.
 */
export async function* sendAiRequestStreaming(opts: SendAiOptions): AsyncGenerator<AiStreamEvent> {
  const session = await getSession()
  const token = session?.access_token
  if (!token) {
    yield { type: 'error', error: 'Not authenticated' }
    return
  }

  const body: AiApiRequest = {
    mode: opts.mode,
    scope: opts.scope ?? 'active_canvas',
    task: opts.task ?? 'chat',
    userMessage: opts.userMessage,
    projectId: opts.projectId,
    canvasId: opts.canvasId,
    selectedNodeIds: opts.selectedNodeIds,
    stream: true,
    clientContext: {
      locale: opts.locale,
      diagnostics: opts.diagnostics,
      computedValues: opts.computedValues,
    },
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errMsg = 'AI request failed'
    try {
      const errJson = (await res.json()) as AiApiError
      errMsg = errJson.error ?? errMsg
    } catch {
      // ignore parse failure
    }
    yield { type: 'error', error: errMsg }
    return
  }

  // If the response is not SSE (e.g. backend doesn't support streaming yet),
  // fall back to parsing the full JSON response.
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    const json = (await res.json()) as AiApiResponse | AiApiError
    if (!json.ok) {
      yield { type: 'error', error: (json as AiApiError).error ?? 'AI request failed' }
      return
    }
    yield { type: 'done', response: json as AiApiResponse }
    return
  }

  // Parse SSE stream
  const reader = res.body?.getReader()
  if (!reader) {
    yield { type: 'error', error: 'No response body' }
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try {
            const event = JSON.parse(data) as AiStreamEvent
            yield event
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
