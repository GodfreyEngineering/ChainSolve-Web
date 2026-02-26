/**
 * variablesService.ts — Domain service for project-level variables (W12.2).
 *
 * Reads and writes the `variables` JSONB column on the `projects` table.
 */

import type { VariablesMap } from './variables'
import { supabase } from './supabase'

/** Load variables for a project. Returns empty map if column is null. */
export async function loadVariables(projectId: string): Promise<VariablesMap> {
  const { data, error } = await supabase
    .from('projects')
    .select('variables')
    .eq('id', projectId)
    .single()

  if (error) throw new Error(`Failed to load variables: ${error.message}`)
  return ((data as { variables: VariablesMap } | null)?.variables ?? {}) as VariablesMap
}

/** Save variables for a project (full overwrite of the JSONB column). */
export async function saveVariables(
  projectId: string,
  variables: VariablesMap,
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ variables })
    .eq('id', projectId)

  if (error) throw new Error(`Failed to save variables: ${error.message}`)
}
