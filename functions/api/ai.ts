/**
 * POST /api/ai
 *
 * ChainSolve AI Copilot server-side proxy (AI-1 / AI-2 / AI-3).
 *
 * 1. Verify Supabase JWT -> get user identity.
 * 2. Check plan entitlements (Pro/Enterprise only).
 * 3. Enterprise policy enforcement (ai_enabled, ai_allowed_modes, per-seat quotas).
 * 4. Enforce monthly token quota.
 * 5. Build task-specific system prompt (chat/fix_graph/explain_node/generate_*).
 * 6. Call OpenAI Responses API (store: false) with JSON output.
 * 7. Validate response JSON; repair once if invalid.
 * 8. Log request metadata (no content) to ai_request_log.
 * 9. Update ai_usage_monthly counters.
 * 10. Return structured response with tokensRemaining.
 *
 * Env vars: OPEN_AI_API_KEY, AI_MODEL (optional, default gpt-4.1),
 *           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { jsonError } from './stripe/_lib'

// ── Types ───────────────────────────────────────────────────────────────────

type Env = {
  OPEN_AI_API_KEY: string
  AI_MODEL?: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

type AiTask = 'chat' | 'fix_graph' | 'explain_node' | 'generate_template' | 'generate_theme'

interface AiRequestBody {
  mode: 'plan' | 'edit' | 'bypass'
  scope: 'active_canvas' | 'selection'
  task?: AiTask
  userMessage: string
  projectId: string
  canvasId: string
  selectedNodeIds: string[]
  clientContext?: {
    locale?: string
    theme?: string
    decimalPlaces?: number
    diagnostics?: { level: string; code: string; message: string; nodeIds?: string[] }[]
  }
}

type Plan = 'free' | 'trialing' | 'pro' | 'enterprise' | 'past_due' | 'canceled'

// ── Constants ───────────────────────────────────────────────────────────────

const PRO_MONTHLY_TOKEN_LIMIT = 200_000
const ENTERPRISE_DEFAULT_TOKEN_LIMIT = 1_000_000
const MAX_PROMPT_LENGTH = 4000
const VALID_TASKS: AiTask[] = [
  'chat',
  'fix_graph',
  'explain_node',
  'generate_template',
  'generate_theme',
]

// ── Compact block catalog for system prompt ─────────────────────────────────

const BLOCK_CATALOG_DIGEST = `Available blockTypes (use ONLY these):
INPUT: number, slider, variableSource, constant, material
CONSTANTS: pi, euler, tau, phi
MATH: add(a,b), subtract(a,b), multiply(a,b), divide(a,b), negate(a), abs(a), sqrt(a), power(base,exp), floor(a), ceil(a), round(a), mod(a,b), clamp(val,min,max)
TRIG: sin(a), cos(a), tan(a), asin(a), acos(a), atan(a), atan2(y,x), degToRad(deg), radToDeg(rad)
LOGIC: greater(a,b), less(a,b), equal(a,b), ifthenelse(cond,then,else), max(a,b), min(a,b)
OUTPUT: display(value), probe(value)
ENG.MECHANICS: eng.mechanics.hooke(F,k), eng.mechanics.power_work_time(W,t), eng.mechanics.kinetic_energy(m,v), eng.mechanics.potential_energy(m,g,h), eng.mechanics.momentum(m,v)
ENG.FLUIDS: eng.fluids.reynolds(rho,v,D,mu), eng.fluids.bernoulli_pressure(rho,v,h), eng.fluids.flow_rate(A,v)
ENG.SECTIONS: eng.sections.bending_stress(M,y,I), eng.sections.area_annulus(d_inner,d_outer)
FIN.TVM: fin.tvm.compound_fv(PV,r,n,t), fin.tvm.rule_of_72(r)
STATS: stats.desc.mean(c,x1..x6), stats.desc.stddev(c,x1..x6), stats.rel.linreg_slope(c,x1..x6,y1..y6)

Port naming: binary ops use a,b. All blocks output via "out" handle.
Edge sourceHandle is always "out". targetHandle is the port id (e.g. "a", "b", "value").
Node IDs: use "ai_node_1", "ai_node_2", etc. Edge IDs: use "ai_edge_1", etc.`

// ── System prompts per task ─────────────────────────────────────────────────

function buildSystemPrompt(mode: string, task: AiTask): string {
  const base = `You are ChainSolve Copilot, an AI assistant that helps users build node-graph calculation chains.

${BLOCK_CATALOG_DIGEST}

RULES:
- Return ONLY valid JSON matching the required schema. No markdown, no code fences.
- Do NOT hallucinate blockType values. Only use block types from the catalog above.
- All node IDs must be unique strings prefixed with "ai_node_".
- All edge IDs must be unique strings prefixed with "ai_edge_".
- Edge sourceHandle is ALWAYS "out". Edge targetHandle is the input port id.
- For "number" nodes, set data.value to the numeric value.
- Position nodes in a readable left-to-right layout (x increases by ~200 per column).
- Keep explanations concise. Focus on the graph structure.
- Assess risk honestly: low for simple additions, medium for >10 ops or variable changes, high for removals.`

  if (task === 'fix_graph') {
    return `${base}

TASK: FIX GRAPH
You are given diagnostics about issues in the user's graph. Propose patch ops that fix them.
Common fixes: add missing connections, remove duplicate edges, fix fan-in violations, set default values for unconnected inputs.
For cycles: explain why the cycle exists and suggest which edge to remove, but mark as high risk.
Do NOT delete nodes unless explicitly asked. Prefer fixing connections and bindings.
Mode: ${mode}

Required JSON response:
{
  "mode": "${mode}",
  "message": "what was fixed and why",
  "assumptions": ["any assumptions"],
  "risk": { "level": "low"|"medium"|"high", "reasons": ["..."] },
  "patch": { "ops": [...] }
}`
  }

  if (task === 'explain_node') {
    return `${base}

TASK: EXPLAIN NODE
Explain the selected node(s): what the block does, current inputs/bindings, upstream dependencies, and any diagnostics.
This is READ-ONLY. Do NOT propose any patch ops. Return empty ops array.

Required JSON response:
{
  "mode": "plan",
  "message": "concise explanation of the node and its role in the chain",
  "assumptions": [],
  "risk": { "level": "low", "reasons": [] },
  "patch": { "ops": [] },
  "explanation": {
    "block": { "type": "blockType", "whatItDoes": "description", "inputs": ["port names"], "outputs": ["out"] },
    "bindings": [{ "portId": "a", "source": "edge|literal|default", "value": 10 }],
    "upstream": [{ "nodeId": "n1", "label": "Force", "blockType": "number" }],
    "diagnostics": [{ "level": "warn", "code": "orphan", "message": "..." }]
  }
}`
  }

  if (task === 'generate_template') {
    return `${base}

TASK: GENERATE TEMPLATE
Based on the user's selection, generate a reusable template artifact with metadata.
The template should be a self-contained subgraph (nodes + edges) with normalized positions.

Required JSON response:
{
  "mode": "plan",
  "message": "description of the template",
  "assumptions": [],
  "risk": { "level": "low", "reasons": [] },
  "patch": { "ops": [] },
  "template": {
    "name": "Template Name",
    "description": "What this template does",
    "tags": ["engineering", "mechanics"]
  }
}`
  }

  if (task === 'generate_theme') {
    return `${base}

TASK: GENERATE THEME
Based on the user's description, generate CSS variable values for a ChainSolve theme.
Available CSS variables: --bg-primary, --bg-secondary, --bg-tertiary, --text-primary, --text-secondary, --accent, --accent-hover, --accent-active, --node-bg, --node-border, --node-header, --node-header-text, --node-text, --node-port, --edge-default, --edge-selected, --edge-animated, --handle-bg, --handle-border.
Values must be valid CSS color values (hex, rgb, hsl).

Required JSON response:
{
  "mode": "plan",
  "message": "description of the theme",
  "assumptions": [],
  "risk": { "level": "low", "reasons": [] },
  "patch": { "ops": [] },
  "theme": {
    "name": "Theme Name",
    "baseMode": "dark"|"light",
    "variables": { "--bg-primary": "#1a1a2e", "--accent": "#e94560", ... }
  }
}`
  }

  // Default: chat task
  return `${base}
- Current mode: ${mode}
  - plan: describe steps only, patch.ops should be empty.
  - edit: propose ops for user review.
  - bypass: propose ops for auto-apply (user still confirms high-risk).

Required JSON response schema:
{
  "mode": "${mode}",
  "message": "human explanation of what this does",
  "assumptions": ["any assumptions made"],
  "risk": { "level": "low"|"medium"|"high", "reasons": ["..."] },
  "patch": {
    "ops": [
      { "op": "addNode", "node": { "id": "ai_node_1", "blockType": "number", "label": "Force", "position": { "x": 100, "y": 100 }, "data": { "blockType": "number", "label": "Force", "value": 10 } } },
      { "op": "addEdge", "edge": { "id": "ai_edge_1", "source": "ai_node_1", "sourceHandle": "out", "target": "ai_node_2", "targetHandle": "a" } },
      { "op": "updateNodeData", "nodeId": "existing_id", "data": { "value": 42 } },
      { "op": "removeNode", "nodeId": "existing_id" },
      { "op": "removeEdge", "edgeId": "existing_id" }
    ]
  }
}`
}

// ── Validation ──────────────────────────────────────────────────────────────

interface AiResponse {
  mode: string
  message: string
  assumptions: string[]
  risk: { level: string; reasons: string[] }
  patch: { ops: unknown[] }
  explanation?: Record<string, unknown>
  template?: Record<string, unknown>
  theme?: Record<string, unknown>
}

function validateAiResponse(raw: unknown): AiResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  if (typeof obj.message !== 'string') return null
  if (!Array.isArray(obj.assumptions)) obj.assumptions = []
  if (!obj.risk || typeof obj.risk !== 'object') {
    obj.risk = { level: 'low', reasons: [] }
  }
  const risk = obj.risk as Record<string, unknown>
  if (!['low', 'medium', 'high'].includes(risk.level as string)) {
    risk.level = 'low'
  }
  if (!Array.isArray(risk.reasons)) risk.reasons = []

  if (!obj.patch || typeof obj.patch !== 'object') {
    obj.patch = { ops: [] }
  }
  const patch = obj.patch as Record<string, unknown>
  if (!Array.isArray(patch.ops)) patch.ops = []

  return obj as unknown as AiResponse
}

// ── OpenAI call ─────────────────────────────────────────────────────────────

interface OpenAiUsage {
  input_tokens: number
  output_tokens: number
}

interface OpenAiResponse {
  id: string
  output: Array<{ type: string; content: Array<{ type: string; text: string }> }>
  usage: OpenAiUsage
}

async function callOpenAi(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<{ parsed: AiResponse; usage: OpenAiUsage; responseId: string }> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      text: { format: { type: 'json_object' } },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`OpenAI API error ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const data = (await res.json()) as OpenAiResponse
  const outputText = data.output?.[0]?.content?.[0]?.text ?? '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(outputText)
  } catch {
    parsed = null
  }

  let validated = validateAiResponse(parsed)

  // One repair round if invalid
  if (!validated) {
    const repairRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
          { role: 'assistant', content: outputText },
          {
            role: 'user',
            content:
              'Your previous response was not valid JSON matching the schema. Please return ONLY the corrected JSON with no extra text.',
          },
        ],
        text: { format: { type: 'json_object' } },
      }),
    })

    if (repairRes.ok) {
      const repairData = (await repairRes.json()) as OpenAiResponse
      const repairText = repairData.output?.[0]?.content?.[0]?.text ?? '{}'
      try {
        const repairParsed = JSON.parse(repairText)
        validated = validateAiResponse(repairParsed)
      } catch {
        // Still invalid after repair
      }
      // Add repair usage
      data.usage.input_tokens += repairData.usage?.input_tokens ?? 0
      data.usage.output_tokens += repairData.usage?.output_tokens ?? 0
    }

    if (!validated) {
      throw new Error('AI returned invalid JSON even after repair')
    }
  }

  return { parsed: validated, usage: data.usage, responseId: data.id }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const reqId = crypto.randomUUID().slice(0, 8)

  try {
    const { OPEN_AI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env
    const model = context.env.AI_MODEL ?? 'gpt-4.1'

    if (!OPEN_AI_API_KEY) {
      console.error(`[ai ${reqId}] Missing OPEN_AI_API_KEY`)
      return jsonError('AI service not configured', 503)
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[ai ${reqId}] Missing Supabase config`)
      return jsonError('Server configuration error', 500)
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body: AiRequestBody
    try {
      body = (await context.request.json()) as AiRequestBody
    } catch {
      return jsonError('Invalid JSON body', 400)
    }

    if (!body.mode || !['plan', 'edit', 'bypass'].includes(body.mode)) {
      return jsonError('Invalid mode', 400)
    }
    if (!body.userMessage || typeof body.userMessage !== 'string') {
      return jsonError('Missing userMessage', 400)
    }
    if (body.userMessage.length > MAX_PROMPT_LENGTH) {
      return jsonError(`Message too long (max ${MAX_PROMPT_LENGTH} chars)`, 400)
    }
    if (!body.projectId || !body.canvasId) {
      return jsonError('Missing projectId or canvasId', 400)
    }

    const task: AiTask = VALID_TASKS.includes(body.task as AiTask) ? (body.task as AiTask) : 'chat'

    // ── Auth ──────────────────────────────────────────────────────────────
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return jsonError('Missing Authorization Bearer token', 401)

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return jsonError('Authentication failed', 401)
    }
    const userId = userData.user.id

    // ── Plan check ────────────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id,plan,is_developer,is_admin')
      .eq('id', userId)
      .maybeSingle()

    // E2-6: Developer/admin accounts bypass plan restrictions
    const isDev = !!(profile as Record<string, unknown> | null)?.is_developer
    const isAdm = !!(profile as Record<string, unknown> | null)?.is_admin
    const plan: Plan = isDev || isAdm ? 'enterprise' : ((profile?.plan as Plan) ?? 'free')

    if (plan === 'free' || plan === 'past_due' || plan === 'canceled') {
      return jsonError('AI Copilot requires a Pro or Enterprise subscription', 402)
    }

    // ── Resolve org for enterprise ────────────────────────────────────────
    let orgId: string | null = null
    let enterpriseBypassAllowed = false
    let tokenLimit = PRO_MONTHLY_TOKEN_LIMIT
    let aiEnabled = true
    let allowedModes: string[] = ['plan', 'edit', 'bypass']

    if (plan === 'enterprise') {
      const { data: membership } = await supabaseAdmin
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (membership?.org_id) {
        orgId = membership.org_id

        const { data: policy } = await supabaseAdmin
          .from('ai_org_policies')
          .select('allow_bypass,monthly_token_limit_per_seat,ai_enabled,ai_allowed_modes')
          .eq('org_id', orgId)
          .maybeSingle()

        if (policy) {
          enterpriseBypassAllowed = policy.allow_bypass ?? false
          tokenLimit = policy.monthly_token_limit_per_seat ?? ENTERPRISE_DEFAULT_TOKEN_LIMIT
          aiEnabled = policy.ai_enabled ?? true
          allowedModes = Array.isArray(policy.ai_allowed_modes)
            ? policy.ai_allowed_modes
            : ['plan', 'edit', 'bypass']
        } else {
          tokenLimit = ENTERPRISE_DEFAULT_TOKEN_LIMIT
        }
      }
    }

    // Enterprise org disabled AI entirely
    if (!aiEnabled) {
      return Response.json(
        { ok: false, error: 'AI Copilot is disabled by your organization', code: 'AI_DISABLED' },
        { status: 403 },
      )
    }

    // Mode not allowed by org policy
    if (!allowedModes.includes(body.mode)) {
      // Downgrade to the most permissive allowed mode
      if (allowedModes.includes('edit')) body.mode = 'edit'
      else if (allowedModes.includes('plan')) body.mode = 'plan'
      else {
        return Response.json(
          { ok: false, error: 'No AI modes allowed by your organization', code: 'MODE_BLOCKED' },
          { status: 403 },
        )
      }
    }

    // Bypass mode requires enterprise policy
    if (body.mode === 'bypass' && plan !== 'enterprise') {
      body.mode = 'edit'
    }
    if (body.mode === 'bypass' && !enterpriseBypassAllowed) {
      body.mode = 'edit'
    }

    // Explain task forces plan mode (read-only)
    if (task === 'explain_node') {
      body.mode = 'plan'
    }

    // ── Quota check ───────────────────────────────────────────────────────
    const now = new Date()
    const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`

    const { data: usage } = await supabaseAdmin
      .from('ai_usage_monthly')
      .select('id,tokens_in,tokens_out')
      .eq('owner_id', userId)
      .eq('period_start', periodStart)
      .maybeSingle()

    const currentTokens = (usage?.tokens_in ?? 0) + (usage?.tokens_out ?? 0)
    if (currentTokens >= tokenLimit) {
      return Response.json(
        {
          ok: false,
          error: 'Monthly AI token quota exceeded',
          code: 'QUOTA_EXCEEDED',
          tokensRemaining: 0,
        },
        { status: 402 },
      )
    }

    // ── Fetch canvas context ──────────────────────────────────────────────
    let contextSummary = ''
    try {
      const { data: canvas } = await supabaseAdmin
        .from('canvases')
        .select('storage_path')
        .eq('id', body.canvasId)
        .eq('owner_id', userId)
        .maybeSingle()

      if (canvas?.storage_path) {
        const { data: fileData } = await supabaseAdmin.storage
          .from('projects')
          .download(canvas.storage_path)

        if (fileData) {
          const text = await fileData.text()
          const canvasJson = JSON.parse(text) as {
            nodes?: Array<{ id: string; data?: Record<string, unknown> }>
            edges?: Array<{ id: string; source: string; target: string; targetHandle?: string }>
          }

          const nodes = canvasJson.nodes ?? []
          const edges = canvasJson.edges ?? []

          // If selection scope, filter to selected + 1 hop neighbors
          let relevantNodes = nodes
          let relevantEdges = edges
          if (
            body.scope === 'selection' &&
            Array.isArray(body.selectedNodeIds) &&
            body.selectedNodeIds.length > 0
          ) {
            const selectedSet = new Set(body.selectedNodeIds)
            for (const e of edges) {
              if (selectedSet.has(e.source)) selectedSet.add(e.target)
              if (selectedSet.has(e.target)) selectedSet.add(e.source)
            }
            relevantNodes = nodes.filter((n) => selectedSet.has(n.id))
            relevantEdges = edges.filter(
              (e) => selectedSet.has(e.source) && selectedSet.has(e.target),
            )
          }

          // Build compact summary
          const nodeSummaries = relevantNodes
            .slice(0, 50)
            .map((n) => {
              const d = n.data as Record<string, unknown> | undefined
              return `${n.id}: ${d?.blockType ?? '?'}${d?.label ? ` "${d.label}"` : ''}${d?.value !== undefined ? ` val=${d.value}` : ''}`
            })
            .join('\n')

          const edgeSummaries = relevantEdges
            .slice(0, 50)
            .map((e) => `${e.source} -> ${e.target}:${e.targetHandle ?? 'value'}`)
            .join('\n')

          contextSummary = `\nCurrent canvas (${nodes.length} nodes, ${edges.length} edges):\nNODES:\n${nodeSummaries}\nEDGES:\n${edgeSummaries}`

          if (relevantNodes.length < nodes.length) {
            contextSummary += `\n(Showing ${relevantNodes.length} of ${nodes.length} nodes)`
          }
        }
      }
    } catch {
      contextSummary = '\n(Canvas context unavailable)'
    }

    // Append diagnostics to context if provided
    if (body.clientContext?.diagnostics?.length) {
      const diagSummary = body.clientContext.diagnostics
        .slice(0, 20)
        .map(
          (d) =>
            `[${d.level}] ${d.code}: ${d.message}${d.nodeIds?.length ? ` (nodes: ${d.nodeIds.join(',')})` : ''}`,
        )
        .join('\n')
      contextSummary += `\n\nDIAGNOSTICS:\n${diagSummary}`
    }

    // ── Call OpenAI ───────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(body.mode, task)
    const userPrompt = `${body.userMessage}${contextSummary}`

    const {
      parsed,
      usage: aiUsage,
      responseId,
    } = await callOpenAi(OPEN_AI_API_KEY, model, systemPrompt, userPrompt)

    const tokensIn = aiUsage.input_tokens ?? 0
    const tokensOut = aiUsage.output_tokens ?? 0
    const tokensRemaining = Math.max(0, tokenLimit - currentTokens - tokensIn - tokensOut)

    // ── Update quota ──────────────────────────────────────────────────────
    if (usage?.id) {
      await supabaseAdmin
        .from('ai_usage_monthly')
        .update({
          tokens_in: (usage.tokens_in ?? 0) + tokensIn,
          tokens_out: (usage.tokens_out ?? 0) + tokensOut,
          requests: ((usage as Record<string, unknown>).requests as number) + 1,
          last_request_at: now.toISOString(),
        })
        .eq('id', usage.id)
    } else {
      await supabaseAdmin.from('ai_usage_monthly').insert({
        owner_id: userId,
        org_id: orgId,
        period_start: periodStart,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        requests: 1,
        last_request_at: now.toISOString(),
      })
    }

    // ── Log request metadata (NO content) ─────────────────────────────────
    const opsCount = Array.isArray(parsed.patch?.ops) ? parsed.patch.ops.length : 0
    await supabaseAdmin.from('ai_request_log').insert({
      owner_id: userId,
      org_id: orgId,
      mode: body.mode,
      task,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      ops_count: opsCount,
      risk_level: parsed.risk?.level ?? 'low',
      response_id: responseId,
    })

    // ── Return response ───────────────────────────────────────────────────
    const response: Record<string, unknown> = {
      ok: true,
      task,
      message: parsed.message,
      assumptions: parsed.assumptions ?? [],
      risk: parsed.risk ?? { level: 'low', reasons: [] },
      patchOps: parsed.patch?.ops ?? [],
      usage: { tokensIn, tokensOut },
      tokensRemaining,
    }

    // Include extra fields for specific tasks
    if (parsed.explanation) response.explanation = parsed.explanation
    if (parsed.template) response.template = parsed.template
    if (parsed.theme) response.theme = parsed.theme

    return Response.json(response)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error(`[ai ${reqId}]`, err)
    return jsonError(msg, 500)
  }
}
