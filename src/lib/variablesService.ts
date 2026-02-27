/**
 * variablesService.ts — Domain service for project-level variables (W12.2).
 *
 * Reads and writes the `variables` JSONB column on the `projects` table.
 */

import type { VariablesMap } from './variables'
import { safeParseVariablesMap } from './validateVariables'
import { supabase } from './supabase'
import { dlog } from '../observability/debugLog'

/** Load variables for a project. Returns empty map if column is null. */
export async function loadVariables(projectId: string): Promise<VariablesMap> {
  dlog.debug('variables', 'Loading variables', { projectId })
  const { data, error } = await supabase
    .from('projects')
    .select('variables')
    .eq('id', projectId)
    .single()

  if (error) {
    dlog.error('variables', 'Load failed', { projectId, error: error.message })
    throw new Error(`Failed to load variables: ${error.message}`)
  }
  const raw = (data as { variables: unknown } | null)?.variables ?? {}
  const result = safeParseVariablesMap(raw)
  dlog.info('variables', 'Variables loaded', { projectId, count: Object.keys(result).length })
  return result
}

/** Save variables for a project (full overwrite of the JSONB column). */
export async function saveVariables(projectId: string, variables: VariablesMap): Promise<void> {
  dlog.debug('variables', 'Saving variables', { projectId, count: Object.keys(variables).length })
  const { error } = await supabase.from('projects').update({ variables }).eq('id', projectId)

  if (error) {
    dlog.error('variables', 'Save failed', { projectId, error: error.message })
    throw new Error(`Failed to save variables: ${error.message}`)
  }
  dlog.info('variables', 'Variables saved', { projectId })
}
