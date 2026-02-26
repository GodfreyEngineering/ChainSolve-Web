/**
 * migrateBindings.ts — Lazy migration from manualValues to inputBindings (W12.2).
 *
 * Called on first edit of a port in the new ValueEditor UI, not on load.
 * This means existing saved graphs are never rewritten — zero-cost migration.
 */

import type { InputBinding } from '../blocks/types'

/**
 * Convert legacy manualValues into inputBindings (all as literal kind).
 * Returns undefined if there are no manualValues to convert.
 */
export function migrateManualValues(
  manualValues: Record<string, number> | undefined,
): Record<string, InputBinding> | undefined {
  if (!manualValues) return undefined

  const entries = Object.entries(manualValues)
  if (entries.length === 0) return undefined

  const bindings: Record<string, InputBinding> = {}
  for (const [portId, value] of entries) {
    bindings[portId] = { kind: 'literal', value }
  }
  return bindings
}

/**
 * Ensure a node has inputBindings for a given port.
 * If the node only has manualValues, lazily migrates just that port.
 * Returns the existing or newly-created binding.
 */
export function ensureBinding(
  inputBindings: Record<string, InputBinding> | undefined,
  manualValues: Record<string, number> | undefined,
  portId: string,
): InputBinding {
  // Already has a binding — return it.
  if (inputBindings?.[portId]) return inputBindings[portId]

  // Fall back to legacy manualValues.
  const legacyValue = manualValues?.[portId]
  if (legacyValue !== undefined) {
    return { kind: 'literal', value: legacyValue }
  }

  // No value at all — default to 0.
  return { kind: 'literal', value: 0 }
}
