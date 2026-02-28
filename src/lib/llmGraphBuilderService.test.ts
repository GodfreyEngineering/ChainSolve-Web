/**
 * llmGraphBuilderService.test.ts — P149: LLM graph builder service tests.
 */

import { describe, it, expect } from 'vitest'
import { parseLlmPlan, buildGraphFromPrompt } from './llmGraphBuilderService'

// ── parseLlmPlan ──────────────────────────────────────────────────────────────

describe('parseLlmPlan', () => {
  it('parses a valid plan JSON', () => {
    const raw = JSON.stringify({
      summary: 'Adds two numbers',
      nodes: [
        { blockType: 'number', label: 'Input A', data: { value: 1 } },
        { blockType: 'number', label: 'Input B', data: { value: 2 } },
        { blockType: 'add', label: 'Sum' },
      ],
      edges: [
        { sourceIndex: 0, sourceHandle: 'out', targetIndex: 2, targetHandle: 'a' },
        { sourceIndex: 1, sourceHandle: 'out', targetIndex: 2, targetHandle: 'b' },
      ],
    })
    const plan = parseLlmPlan(raw)
    expect(plan).not.toBeNull()
    expect(plan?.summary).toBe('Adds two numbers')
    expect(plan?.nodes).toHaveLength(3)
    expect(plan?.edges).toHaveLength(2)
  })

  it('returns null for missing summary field', () => {
    const raw = JSON.stringify({ nodes: [], edges: [] })
    expect(parseLlmPlan(raw)).toBeNull()
  })

  it('returns null for missing nodes field', () => {
    const raw = JSON.stringify({ summary: 'test', edges: [] })
    expect(parseLlmPlan(raw)).toBeNull()
  })

  it('returns null for missing edges field', () => {
    const raw = JSON.stringify({ summary: 'test', nodes: [] })
    expect(parseLlmPlan(raw)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseLlmPlan('not json at all')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseLlmPlan('')).toBeNull()
  })

  it('returns null for non-array nodes', () => {
    const raw = JSON.stringify({ summary: 'test', nodes: {}, edges: [] })
    expect(parseLlmPlan(raw)).toBeNull()
  })

  it('parses an empty plan (no nodes or edges)', () => {
    const raw = JSON.stringify({ summary: 'Empty graph', nodes: [], edges: [] })
    const plan = parseLlmPlan(raw)
    expect(plan).not.toBeNull()
    expect(plan?.nodes).toHaveLength(0)
    expect(plan?.edges).toHaveLength(0)
  })
})

// ── buildGraphFromPrompt ──────────────────────────────────────────────────────

describe('buildGraphFromPrompt', () => {
  it('returns not_configured when VITE_LLM_API_KEY is absent', async () => {
    // In test environment, import.meta.env.VITE_LLM_API_KEY is undefined.
    const result = await buildGraphFromPrompt('Calculate the area of a circle')
    expect(result.status).toBe('not_configured')
  })

  it('returns not_configured for empty prompt when key absent', async () => {
    const result = await buildGraphFromPrompt('   ')
    // Without an API key, not_configured is returned before the empty-prompt guard.
    expect(result.status).toBe('not_configured')
  })
})
