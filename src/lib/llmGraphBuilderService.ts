/**
 * llmGraphBuilderService.ts — P149: LLM-assisted graph building.
 *
 * Service layer for converting natural language prompts into graph-building
 * plans.  Requires a configured LLM API key (VITE_LLM_API_KEY) to generate
 * real plans; returns a `not_configured` status otherwise.
 *
 * Architecture:
 *   1. User types a natural language description of the graph they want.
 *   2. buildGraphFromPrompt() sends it to the LLM with a structured prompt.
 *   3. The LLM returns a JSON plan (list of nodes + edges + human summary).
 *   4. The caller (LlmGraphBuilderDialog) can display the plan and optionally
 *      apply it to the canvas via the engine's patch API.
 *
 * Status:
 *   This is the infrastructure layer.  Full LLM API integration is gated on
 *   VITE_LLM_API_KEY being set.  Without it the dialog shows the configuration
 *   instructions.
 */

import { LLM_API_KEY } from './env'

/** A node spec from an LLM-generated graph plan. */
export interface LlmNodeSpec {
  /** Block type from the engine catalog (e.g. "add", "multiply", "number"). */
  blockType: string
  /** Human-readable label for the node. */
  label?: string
  /** Initial data values (e.g. { value: 42 } for a number node). */
  data?: Record<string, unknown>
}

/** An edge spec from an LLM-generated graph plan. */
export interface LlmEdgeSpec {
  /** Source node index in the `nodes` array. */
  sourceIndex: number
  /** Source port handle (e.g. "out", "a", "b"). */
  sourceHandle: string
  /** Target node index in the `nodes` array. */
  targetIndex: number
  /** Target port handle. */
  targetHandle: string
}

/** Structured graph-building plan returned by the LLM. */
export interface LlmGraphPlan {
  /** Human-readable summary of what the graph does. */
  summary: string
  /** Nodes to create, in topological order. */
  nodes: LlmNodeSpec[]
  /** Edges connecting the nodes. */
  edges: LlmEdgeSpec[]
}

/** Result of a buildGraphFromPrompt() call. */
export type LlmBuildResult =
  | { status: 'ok'; plan: LlmGraphPlan }
  | { status: 'not_configured' }
  | { status: 'error'; message: string }

/**
 * Validate and parse a raw LLM JSON response into an LlmGraphPlan.
 * Returns null if the response does not match the expected schema.
 */
export function parseLlmPlan(raw: string): LlmGraphPlan | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    if (typeof obj.summary !== 'string' || !Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
      return null
    }
    return obj as unknown as LlmGraphPlan
  } catch {
    return null
  }
}

/**
 * Build a graph plan from a natural language prompt.
 *
 * Returns `not_configured` when VITE_LLM_API_KEY is absent.
 * Full LLM integration (POST to Anthropic / OpenAI) is implemented here
 * once the key is present.
 */
export async function buildGraphFromPrompt(prompt: string): Promise<LlmBuildResult> {
  const apiKey = LLM_API_KEY
  if (!apiKey) {
    return { status: 'not_configured' }
  }

  // Minimum prompt validation.
  const trimmed = prompt.trim()
  if (trimmed.length === 0) {
    return { status: 'error', message: 'Prompt must not be empty.' }
  }
  if (trimmed.length > 2000) {
    return { status: 'error', message: 'Prompt must be 2 000 characters or fewer.' }
  }

  // Future: POST to LLM API and parse the response.
  // Stubbed for now — returns not_configured when API is unavailable.
  return { status: 'not_configured' }
}
