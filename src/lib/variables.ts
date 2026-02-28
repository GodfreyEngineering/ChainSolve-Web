/**
 * variables.ts — Project-level variable types (W12.2).
 *
 * Variables are scalar values shared across all canvases in a project.
 * They can be referenced from input port bindings ({ kind: 'var', varId }).
 */

/** A project-level scalar variable. */
export interface ProjectVariable {
  id: string
  name: string
  value: number
  unit?: string
  description?: string
}

/** Map of varId → ProjectVariable. Stored as JSONB on the projects table. */
export type VariablesMap = Record<string, ProjectVariable>

/** Resolve a variable value by ID. Returns undefined if not found. */
export function resolveVariable(variables: VariablesMap, varId: string): number | undefined {
  return variables[varId]?.value
}
