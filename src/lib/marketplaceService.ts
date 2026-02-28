/**
 * marketplaceService.ts — Marketplace data layer (P101–P106)
 *
 * All Supabase calls for marketplace_items and marketplace_purchases
 * live here. UI components MUST NOT import supabase directly.
 */

import { supabase } from './supabase'

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
  created_at: string
  updated_at: string
}

export interface MarketplacePurchase {
  id: string
  user_id: string
  item_id: string
  installed_at: string
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
