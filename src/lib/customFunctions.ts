/**
 * customFunctions.ts — Types, validation, and localStorage CRUD for custom
 * function blocks (H5-1, Pro only).
 *
 * Custom functions let users define reusable operations with named inputs
 * and a formula expression. The formula is evaluated in the Rust engine
 * via the `math_expr` block type.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface CustomFunctionInput {
  id: string
  label: string
}

export type CustomFunctionTag =
  | 'math'
  | 'physics'
  | 'engineering'
  | 'finance'
  | 'statistics'
  | 'other'

export const CUSTOM_FUNCTION_TAGS: readonly CustomFunctionTag[] = [
  'math',
  'physics',
  'engineering',
  'finance',
  'statistics',
  'other',
]

export const CUSTOM_FUNCTION_TAG_LABELS: Record<CustomFunctionTag, string> = {
  math: 'Math',
  physics: 'Physics',
  engineering: 'Engineering',
  finance: 'Finance',
  statistics: 'Statistics',
  other: 'Other',
}

export interface CustomFunction {
  id: string
  name: string
  description?: string
  tag: CustomFunctionTag
  inputs: CustomFunctionInput[]
  formula: string
  /** Optional default unit for the output. */
  unit?: string
}

// ── Limits ───────────────────────────────────────────────────────────────────

export const MAX_FUNCTION_NAME_LENGTH = 64
export const MAX_FUNCTION_DESC_LENGTH = 200
export const MAX_FUNCTION_FORMULA_LENGTH = 500
export const MAX_FUNCTION_INPUTS = 8
export const MIN_FUNCTION_INPUTS = 1

// ── Validation ───────────────────────────────────────────────────────────────

export function validateFunctionName(name: string): { ok: boolean; error?: string } {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { ok: false, error: 'Name is required' }
  if (trimmed.length > MAX_FUNCTION_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_FUNCTION_NAME_LENGTH} characters or fewer` }
  }
  return { ok: true }
}

export function validateFunctionDescription(desc: string): { ok: boolean; error?: string } {
  if (desc.length > MAX_FUNCTION_DESC_LENGTH) {
    return {
      ok: false,
      error: `Description must be ${MAX_FUNCTION_DESC_LENGTH} characters or fewer`,
    }
  }
  return { ok: true }
}

export function validateFunctionFormula(formula: string): { ok: boolean; error?: string } {
  const trimmed = formula.trim()
  if (trimmed.length === 0) return { ok: false, error: 'Formula is required' }
  if (trimmed.length > MAX_FUNCTION_FORMULA_LENGTH) {
    return {
      ok: false,
      error: `Formula must be ${MAX_FUNCTION_FORMULA_LENGTH} characters or fewer`,
    }
  }
  // Basic syntax validation: check balanced parentheses
  let depth = 0
  for (const ch of trimmed) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth < 0) return { ok: false, error: 'Unbalanced parentheses' }
  }
  if (depth !== 0) return { ok: false, error: 'Unbalanced parentheses' }
  return { ok: true }
}

export function validateFunctionInputs(inputs: CustomFunctionInput[]): {
  ok: boolean
  error?: string
} {
  if (inputs.length < MIN_FUNCTION_INPUTS) {
    return { ok: false, error: `At least ${MIN_FUNCTION_INPUTS} input is required` }
  }
  if (inputs.length > MAX_FUNCTION_INPUTS) {
    return { ok: false, error: `Maximum ${MAX_FUNCTION_INPUTS} inputs allowed` }
  }
  const ids = new Set<string>()
  for (const input of inputs) {
    const id = input.id.trim()
    if (id.length === 0) return { ok: false, error: 'Input ID is required' }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
      return { ok: false, error: `Input ID "${id}" must start with a letter or underscore` }
    }
    if (ids.has(id)) return { ok: false, error: `Duplicate input ID: ${id}` }
    ids.add(id)
    if (input.label.trim().length === 0) {
      return { ok: false, error: 'Input label is required' }
    }
  }
  return { ok: true }
}

// ── ID generation ────────────────────────────────────────────────────────────

export function generateFunctionId(): string {
  return `cfb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── localStorage CRUD ────────────────────────────────────────────────────────

const LS_KEY = 'cs:custom-functions'

export function loadCustomFunctions(): CustomFunction[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidCustomFunction)
  } catch {
    return []
  }
}

export function saveCustomFunctions(fns: CustomFunction[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(fns))
  } catch {
    // Silently fail in private browsing or quota exceeded
  }
}

function isValidCustomFunction(obj: unknown): obj is CustomFunction {
  if (typeof obj !== 'object' || obj === null) return false
  const fn = obj as Record<string, unknown>
  return (
    typeof fn.id === 'string' &&
    typeof fn.name === 'string' &&
    typeof fn.formula === 'string' &&
    Array.isArray(fn.inputs)
  )
}
