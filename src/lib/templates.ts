/**
 * templates.ts — CRUD for group templates stored in Supabase.
 *
 * Templates are Pro-only. Each template stores a name, color, and a payload
 * containing the subgraph snapshot (nodes + edges) with original positions
 * normalized to origin.
 */

import { supabase } from './supabase'
import type { TemplatePayload } from './groups'

export interface Template {
  id: string
  name: string
  color: string
  payload: TemplatePayload
  created_at: string
  updated_at: string
}

/** Fetch the current user's templates, most recently updated first. */
export async function listTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('group_templates')
    .select('id, name, color, payload, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`listTemplates: ${error.message}`)
  return (data ?? []) as Template[]
}

/** Save a new template. Returns the created template. */
export async function saveTemplate(
  name: string,
  color: string,
  payload: TemplatePayload,
): Promise<Template> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('group_templates')
    .insert({ owner_id: user.id, name, color, payload })
    .select('id, name, color, payload, created_at, updated_at')
    .single()

  if (error) throw new Error(`saveTemplate: ${error.message}`)
  return data as Template
}

/** Delete a template by ID. */
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('group_templates').delete().eq('id', id)
  if (error) throw new Error(`deleteTemplate: ${error.message}`)
}

/** Rename a template. */
export async function renameTemplate(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('group_templates').update({ name }).eq('id', id)
  if (error) throw new Error(`renameTemplate: ${error.message}`)
}
