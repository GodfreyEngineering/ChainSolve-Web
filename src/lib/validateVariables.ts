/**
 * validateVariables.ts — Runtime shape validator for VariablesMap.
 *
 * Validates the JSONB `variables` column loaded from the DB and any
 * variables map produced by the import pipeline, enforcing:
 *
 *   - Top-level is a plain object (not an array, not null)
 *   - Each entry is a valid ProjectVariable:
 *       id: non-empty string matching the map key
 *       name: non-empty string, ≤ MAX_NAME_LENGTH, unique (case-insensitive)
 *       value: finite number (no NaN, no ±Infinity)
 *       description?: string, ≤ MAX_DESCRIPTION_LENGTH
 */

import type { VariablesMap } from './variables'

export const MAX_VARIABLE_NAME_LENGTH = 64
export const MAX_VARIABLE_DESCRIPTION_LENGTH = 256

export interface VariablesValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Validate a `VariablesMap` value (typically parsed from JSONB).
 *
 * Does not throw; returns `{ ok, errors }` so callers can decide how to
 * handle invalid data (log + reset, or surface to the user).
 */
export function validateVariablesMap(vars: unknown): VariablesValidationResult {
  const errors: string[] = []

  if (vars === null || typeof vars !== 'object' || Array.isArray(vars)) {
    return { ok: false, errors: ['variables must be a plain object'] }
  }

  const map = vars as Record<string, unknown>
  // Track seen names (lowercase) → key for uniqueness check
  const seenNames = new Map<string, string>()

  for (const [key, entry] of Object.entries(map)) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`variable "${key}": entry must be an object`)
      continue
    }

    const v = entry as Record<string, unknown>

    // id: non-empty string matching the map key
    if (typeof v.id !== 'string' || v.id.length === 0) {
      errors.push(`variable "${key}": id must be a non-empty string`)
    } else if (v.id !== key) {
      errors.push(`variable "${key}": id "${v.id}" does not match map key`)
    }

    // name: non-empty string within length limit, unique case-insensitively
    if (typeof v.name !== 'string' || v.name.length === 0) {
      errors.push(`variable "${key}": name must be a non-empty string`)
    } else if (v.name.length > MAX_VARIABLE_NAME_LENGTH) {
      errors.push(`variable "${key}": name exceeds ${MAX_VARIABLE_NAME_LENGTH} characters`)
    } else {
      const lower = v.name.toLowerCase()
      const existing = seenNames.get(lower)
      if (existing !== undefined && existing !== key) {
        errors.push(`variable "${key}": name "${v.name}" conflicts with variable "${existing}"`)
      } else {
        seenNames.set(lower, key)
      }
    }

    // value: finite number
    if (typeof v.value !== 'number') {
      errors.push(`variable "${key}": value must be a number`)
    } else if (!Number.isFinite(v.value)) {
      errors.push(`variable "${key}": value must be finite (no NaN or Infinity)`)
    }

    // description: optional string within length limit
    if (v.description !== undefined) {
      if (typeof v.description !== 'string') {
        errors.push(`variable "${key}": description must be a string`)
      } else if (v.description.length > MAX_VARIABLE_DESCRIPTION_LENGTH) {
        errors.push(
          `variable "${key}": description exceeds ${MAX_VARIABLE_DESCRIPTION_LENGTH} characters`,
        )
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Validate a single variable name for real-time UI feedback.
 *
 * Returns `{ ok: true }` for valid names, or `{ ok: false, error }` if invalid.
 * Identical rules to the name checks inside `validateVariablesMap`.
 */
export function validateVariableName(name: unknown): { ok: boolean; error?: string } {
  if (typeof name !== 'string' || name.length === 0) {
    return { ok: false, error: 'variable name must be a non-empty string' }
  }
  if (name.length > MAX_VARIABLE_NAME_LENGTH) {
    return {
      ok: false,
      error: `variable name must not exceed ${MAX_VARIABLE_NAME_LENGTH} characters`,
    }
  }
  return { ok: true }
}

/**
 * Return `vars` cast to `VariablesMap` if valid, or an empty map on error.
 * Logs a warning to console when falling back so developers notice.
 */
export function safeParseVariablesMap(vars: unknown): VariablesMap {
  const result = validateVariablesMap(vars)
  if (result.ok) return vars as VariablesMap
  console.warn('[variables] Invalid variables map — using empty map.', result.errors)
  return {}
}
