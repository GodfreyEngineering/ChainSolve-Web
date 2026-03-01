/**
 * aiService.ts — client-side service to call POST /api/ai.
 *
 * Never calls OpenAI directly — all AI traffic is proxied through
 * the Cloudflare Pages Function.
 */

import { getSession } from '../auth'
import type { AiApiRequest, AiApiResponse, AiApiError, AiMode, AiScope, AiTask } from './types'

export interface SendCopilotOptions {
  mode: AiMode
  scope: AiScope
  task?: AiTask
  userMessage: string
  projectId: string
  canvasId: string
  selectedNodeIds: string[]
  locale?: string
  diagnostics?: { level: string; code: string; message: string; nodeIds?: string[] }[]
}

/**
 * Send a copilot request to POST /api/ai.
 * Returns the parsed response or throws with a user-facing message.
 */
export async function sendCopilotRequest(opts: SendCopilotOptions): Promise<AiApiResponse> {
  const session = await getSession()
  const token = session?.access_token
  if (!token) {
    throw new Error('Not authenticated')
  }

  const body: AiApiRequest = {
    mode: opts.mode,
    scope: opts.scope,
    task: opts.task ?? 'chat',
    userMessage: opts.userMessage,
    projectId: opts.projectId,
    canvasId: opts.canvasId,
    selectedNodeIds: opts.selectedNodeIds,
    clientContext: {
      locale: opts.locale,
      diagnostics: opts.diagnostics,
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
