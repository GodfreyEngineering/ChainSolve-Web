/**
 * AI Copilot shared types — used by the client UI and the API route.
 *
 * These types define the stable patch format, risk levels, and API
 * request/response shapes for the ChainSolve AI Copilot (AI-1 / AI-2 / AI-3).
 */

// ── Modes ───────────────────────────────────────────────────────────────────

export type AiMode = 'plan' | 'edit' | 'bypass'

export type AiScope = 'active_canvas' | 'selection'

// ── Workflow tasks (AI-3) ──────────────────────────────────────────────────

export type AiTask = 'chat' | 'fix_graph' | 'explain_node' | 'generate_template' | 'generate_theme'

// ── Patch operations ────────────────────────────────────────────────────────

export type AiPatchOp =
  | { op: 'addNode'; node: AiNodeSpec }
  | { op: 'addEdge'; edge: AiEdgeSpec }
  | { op: 'updateNodeData'; nodeId: string; data: Record<string, unknown> }
  | { op: 'removeEdge'; edgeId: string }
  | { op: 'removeNode'; nodeId: string }
  | { op: 'setInputBinding'; nodeId: string; portId: string; binding: AiInputBinding }
  | { op: 'createVariable'; variable: AiVariableSpec }
  | { op: 'updateVariable'; varId: string; patch: Partial<AiVariableSpec> }

export interface AiNodeSpec {
  id: string
  blockType: string
  label?: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}

export interface AiEdgeSpec {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}

export type AiInputBinding =
  | { kind: 'literal'; value: number }
  | { kind: 'const'; constOpId: string }
  | { kind: 'var'; varId: string }

export interface AiVariableSpec {
  id: string
  name: string
  value: number
  unit?: string
  description?: string
}

// ── Risk scoring ────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskAssessment {
  level: RiskLevel
  reasons: string[]
}

// ── AI response format (from OpenAI, validated by zod) ──────────────────────

export interface AiResponsePayload {
  mode: AiMode
  message: string
  assumptions: string[]
  risk: { level: RiskLevel; reasons: string[] }
  patch: {
    ops: AiPatchOp[]
  }
}

// ── API request / response ──────────────────────────────────────────────────

export interface AiApiRequest {
  mode: AiMode
  scope: AiScope
  task: AiTask
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

export interface AiApiResponse {
  ok: true
  task: AiTask
  message: string
  assumptions: string[]
  risk: RiskAssessment
  patchOps: AiPatchOp[]
  explanation?: AiExplanation
  usage: { tokensIn: number; tokensOut: number }
  tokensRemaining?: number
}

/** Returned by explain_node task — read-only analysis. */
export interface AiExplanation {
  block?: { type: string; whatItDoes: string; inputs: string[]; outputs: string[] }
  bindings?: { portId: string; source: string; value?: unknown }[]
  upstream?: { nodeId: string; label: string; blockType: string }[]
  diagnostics?: { level: string; code: string; message: string }[]
}

export interface AiApiError {
  ok: false
  error: string
  code?: string
}
