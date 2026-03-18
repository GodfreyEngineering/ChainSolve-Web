/**
 * demonstrationsService.ts — Community Demonstrations
 *
 * Service layer for publishing, browsing, and searching ChainSolve community
 * demonstrations. A demonstration is a read-only published copy of a graph
 * snapshot with a title, description, and tags, linked to a Discourse forum thread.
 *
 * The `discourse-sso` Supabase Edge Function handles forum authentication
 * (DiscourseConnect protocol).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EngineSnapshotV1 } from '../engine/wasm-types'

export interface Demonstration {
  id: string
  user_id: string
  project_id: string | null
  title: string
  description: string
  tags: string[]
  snapshot_json: string
  discourse_topic_id: number | null
  discourse_topic_url: string | null
  view_count: number
  like_count: number
  published_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PublishDemonstrationInput {
  title: string
  description: string
  tags: string[]
  snapshot: EngineSnapshotV1
  projectId?: string
}

export type DemonstrationSortOrder = 'recent' | 'popular' | 'relevance'

export interface SearchDemonstrationsOptions {
  query?: string
  tags?: string[]
  limit?: number
  offset?: number
  sort?: DemonstrationSortOrder
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * Publish the current graph as a community demonstration.
 * Returns the newly created Demonstration row.
 */
export async function publishDemonstration(
  supabase: SupabaseClient,
  input: PublishDemonstrationInput,
): Promise<Demonstration> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('[DEMO_AUTH] User must be signed in to publish a demonstration')

  const row = {
    user_id: user.id,
    project_id: input.projectId ?? null,
    title: input.title.trim(),
    description: input.description.trim(),
    tags: input.tags.map((t) => t.toLowerCase().trim()).filter(Boolean),
    snapshot_json: JSON.stringify(input.snapshot),
  }

  const { data, error } = await supabase
    .from('demonstrations')
    .insert(row)
    .select()
    .single()

  if (error) {
    throw new Error(`[DEMO_INSERT] ${error.message}`)
  }
  return data as Demonstration
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Full-text search + tag filter over published demonstrations.
 * Uses the `search_demonstrations` RPC which returns rows ordered by
 * relevance → likes → recency.
 */
export async function searchDemonstrations(
  supabase: SupabaseClient,
  opts: SearchDemonstrationsOptions = {},
): Promise<Demonstration[]> {
  const { query = '', tags, limit = 20, offset = 0 } = opts

  const { data, error } = await supabase.rpc('search_demonstrations', {
    query,
    tag_filter: tags ?? null,
    limit_n: Math.min(limit, 100),
    offset_n: offset,
  })

  if (error) {
    throw new Error(`[DEMO_SEARCH] ${error.message}`)
  }
  return (data ?? []) as Demonstration[]
}

// ---------------------------------------------------------------------------
// Fetch single
// ---------------------------------------------------------------------------

export async function getDemonstration(
  supabase: SupabaseClient,
  id: string,
): Promise<Demonstration | null> {
  const { data, error } = await supabase
    .from('demonstrations')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error?.code === 'PGRST116') return null  // not found
  if (error) throw new Error(`[DEMO_FETCH] ${error.message}`)

  // Increment view count asynchronously (fire and forget)
  void supabase.rpc('increment_demonstration_view', { demo_id: id })

  return data as Demonstration
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateDemonstration(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<Demonstration, 'title' | 'description' | 'tags' | 'discourse_topic_id' | 'discourse_topic_url'>>,
): Promise<Demonstration> {
  const { data, error } = await supabase
    .from('demonstrations')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`[DEMO_UPDATE] ${error.message}`)
  return data as Demonstration
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export async function deleteDemonstration(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('demonstrations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`[DEMO_DELETE] ${error.message}`)
}

// ---------------------------------------------------------------------------
// List own demonstrations
// ---------------------------------------------------------------------------

export async function getMyDemonstrations(
  supabase: SupabaseClient,
): Promise<Demonstration[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('demonstrations')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })

  if (error) throw new Error(`[DEMO_MY_LIST] ${error.message}`)
  return (data ?? []) as Demonstration[]
}

// ---------------------------------------------------------------------------
// Discourse SSO — get forum login URL
// ---------------------------------------------------------------------------

/**
 * Returns the Discourse SSO URL to redirect the user to for forum login.
 * Calls the `discourse-sso` Supabase Edge Function.
 */
export async function getDiscourseLoginUrl(
  supabaseUrl: string,
  jwt: string,
  returnPath = '/latest',
): Promise<string> {
  const fnUrl = `${supabaseUrl}/functions/v1/discourse-sso?return=${encodeURIComponent(returnPath)}`
  const res = await fetch(fnUrl, {
    headers: { Authorization: `Bearer ${jwt}` },
  })
  if (!res.ok) {
    throw new Error(`[DISCOURSE_SSO_URL] HTTP ${res.status}: ${await res.text()}`)
  }
  const json = (await res.json()) as { url: string }
  return json.url
}
