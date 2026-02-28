/**
 * marketplaceService.ts — Marketplace data layer (P101–P109)
 *
 * All Supabase calls for marketplace_items and marketplace_purchases
 * live here. UI components MUST NOT import supabase directly.
 */

import { supabase } from './supabase'
import { importProject, type ProjectJSON } from './projects'

// ── Types ──────────────────────────────────────────────────────────────────────

export type MarketplaceCategory = 'template' | 'block_pack' | 'theme'

export interface MarketplaceItem {
  id: string
  author_id: string
  name: string
  description: string | null
  category: string
  version: string
  thumbnail_url: string | null
  downloads_count: number
  is_published: boolean
  /** For category='template': a ProjectJSON snapshot forked on install. */
  payload: unknown | null
  /** P110: review gate — 'pending' | 'approved' | 'rejected' */
  review_status: 'pending' | 'approved' | 'rejected'
  /** P112: price in smallest currency unit (GBP pence). 0 = free. */
  price_cents: number
  created_at: string
  updated_at: string
}

export interface MarketplacePurchase {
  id: string
  user_id: string
  item_id: string
  installed_at: string
}

/** Fields required / allowed when creating or updating an author item. */
export interface AuthorItemInput {
  name: string
  description?: string | null
  category: MarketplaceCategory
  version: string
  thumbnail_url?: string | null
}

// ── Semver validation (P107) ────────────────────────────────────────────────────

const SEMVER_RE = /^\d+\.\d+\.\d+$/

/**
 * Validate a marketplace item version string.
 * Must be strict semver: MAJOR.MINOR.PATCH (all non-negative integers).
 */
export function validateMarketplaceVersion(v: string): { ok: boolean; error?: string } {
  if (!SEMVER_RE.test(v.trim()))
    return { ok: false, error: 'Version must be X.Y.Z format (e.g. 1.0.0)' }
  return { ok: true }
}

// ── Queries ────────────────────────────────────────────────────────────────────

/**
 * List all published marketplace items, optionally filtered by category
 * and/or a name search query. Ordered by downloads descending (most popular first).
 */
export async function listPublishedItems(
  category?: string,
  query?: string,
): Promise<MarketplaceItem[]> {
  let q = supabase
    .from('marketplace_items')
    .select('*')
    .eq('is_published', true)
    .order('downloads_count', { ascending: false })

  if (category && category !== 'all') q = q.eq('category', category)
  if (query && query.trim()) q = q.ilike('name', `%${query.trim()}%`)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as MarketplaceItem[]
}

/**
 * Fetch a single published item by ID. Returns null if not found or not published.
 */
export async function getItem(itemId: string): Promise<MarketplaceItem | null> {
  const { data, error } = await supabase
    .from('marketplace_items')
    .select('*')
    .eq('id', itemId)
    .eq('is_published', true)
    .maybeSingle()

  if (error) throw error
  return data as MarketplaceItem | null
}

/**
 * Record an install (upsert — idempotent: does nothing if already installed).
 * Requires an authenticated session.
 */
export async function recordInstall(itemId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to install marketplace items')

  const { error } = await supabase
    .from('marketplace_purchases')
    .upsert(
      { user_id: user.id, item_id: itemId },
      { onConflict: 'user_id,item_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

/**
 * Fork a project_template item into the user's project list.
 *
 * 1. Fetches the item (including its payload).
 * 2. Calls importProject() to create a new project from the template snapshot.
 * 3. Records the install in marketplace_purchases.
 * 4. Returns the new project ID so the caller can navigate to /canvas/:id.
 *
 * Throws if the user is unauthenticated, the item is not found, the category
 * is not 'template', or the payload is missing.
 */
export async function forkTemplate(itemId: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to install marketplace items')

  const { data: item, error: fetchErr } = await supabase
    .from('marketplace_items')
    .select('id,name,category,payload')
    .eq('id', itemId)
    .eq('is_published', true)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!item) throw new Error('Marketplace item not found')
  if (item.category !== 'template') throw new Error('Item is not a project template')
  if (!item.payload) throw new Error('Template has no project data attached')

  const proj = await importProject(item.payload as ProjectJSON, item.name)
  await recordInstall(itemId)
  return proj.id
}

/**
 * Return all items the current user has installed. Returns [] if unauthenticated.
 */
export async function getUserInstalls(): Promise<MarketplacePurchase[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return []

  const { data, error } = await supabase
    .from('marketplace_purchases')
    .select('*')
    .order('installed_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as MarketplacePurchase[]
}

// ── Author verification (P109) ────────────────────────────────────────────────

/**
 * Check whether the current user has the verified_author flag on their profile.
 * Returns false when unauthenticated or when the flag is not set.
 */
export async function isVerifiedAuthor(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('verified_author')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)

  return (data as { verified_author: boolean } | null)?.verified_author ?? false
}

// ── Author CRUD (P108) ─────────────────────────────────────────────────────────

/**
 * List all items authored by the currently authenticated user (published + drafts).
 * Returns [] if unauthenticated.
 */
export async function listAuthorItems(): Promise<MarketplaceItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('marketplace_items')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as MarketplaceItem[]
}

/**
 * Create a new marketplace item owned by the current user.
 * Version must pass validateMarketplaceVersion before calling.
 */
export async function createAuthorItem(input: AuthorItemInput): Promise<MarketplaceItem> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to create marketplace items')

  const { data, error } = await supabase
    .from('marketplace_items')
    .insert({
      author_id: user.id,
      name: input.name.trim(),
      description: input.description ?? null,
      category: input.category,
      version: input.version.trim(),
      thumbnail_url: input.thumbnail_url ?? null,
      is_published: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as MarketplaceItem
}

/**
 * Toggle the published state of an item the current user authored.
 */
export async function togglePublishItem(itemId: string, published: boolean): Promise<void> {
  const { error } = await supabase
    .from('marketplace_items')
    .update({ is_published: published })
    .eq('id', itemId)

  if (error) throw error
}
