/**
 * resolveBindings.ts — Converts inputBindings into manualValues (W12.2).
 *
 * This is the single point of binding resolution before the engine snapshot
 * is sent to Rust. The Rust engine continues to read manualValues as before.
 *
 * Future: when the engine gains native binding support, this file becomes
 * a pass-through and bindings are sent raw in the snapshot.
 */

import type { InputBinding } from '../blocks/types'
import type { VariablesMap } from '../lib/variables'

/** Map of constOpId → scalar value. Built from the engine's constantValues. */
export type ConstantsLookup = ReadonlyMap<string, number>

/**
 * Build a constants lookup from the engine's pre-computed constant values.
 * Input is the Record<opId, number> received from the WASM worker on startup.
 */
export function buildConstantsLookup(constantValues: Record<string, number>): ConstantsLookup {
  return new Map(Object.entries(constantValues))
}

/**
 * Resolve a single binding to a scalar value.
 * Returns NaN if the binding cannot be resolved (unknown const/var).
 */
export function resolveBinding(
  binding: InputBinding,
  constants: ConstantsLookup,
  variables: VariablesMap,
): number {
  switch (binding.kind) {
    case 'literal':
      return binding.value
    case 'const':
      return constants.get(binding.constOpId) ?? NaN
    case 'var':
      return variables[binding.varId]?.value ?? NaN
  }
}

/**
 * Resolve all inputBindings on a node into manualValues.
 * Merges with existing manualValues (inputBindings take precedence).
 */
export function resolveNodeBindings(
  inputBindings: Record<string, InputBinding> | undefined,
  existingManualValues: Record<string, number> | undefined,
  constants: ConstantsLookup,
  variables: VariablesMap,
): Record<string, number> {
  const result = { ...(existingManualValues ?? {}) }

  if (inputBindings) {
    for (const [portId, binding] of Object.entries(inputBindings)) {
      result[portId] = resolveBinding(binding, constants, variables)
    }
  }

  return result
}
