/**
 * marketplaceService.ts — Marketplace data layer (P101–P109)
 *
 * All Supabase calls for marketplace_items and marketplace_purchases
 * live here. UI components MUST NOT import supabase directly.
 */

import { supabase } from './supabase'
import { importProject, type ProjectJSON } from './projects'
import { addInstalledBlockPack, type BlockPackPayload } from './installedBlockPacksService'
import {
  sanitizeThemeVariables,
  installMarketplaceTheme,
  type MarketplaceThemePayload,
} from './marketplaceThemeService'
import { ENGINE_CONTRACT_VERSION } from './engineContractVersion'

// ── Types ──────────────────────────────────────────────────────────────────────

export type MarketplaceCategory = 'template' | 'block_pack' | 'theme' | 'group' | 'custom_block'

export interface MarketplaceItem {
  id: string
  author_id: string
  name: string
  description: string | null
  category: string
  version: string
  thumbnail_url: string | null
  downloads_count: number
  /** D9-2: denormalised like count. */
  likes_count: number
  /** D9-4: denormalised comment count. */
  comments_count: number
  /** D9-2: discoverable tags. */
  tags: string[]
  is_published: boolean
  /** For category='template': a ProjectJSON snapshot forked on install. */
  payload: unknown | null
  /** P110: review gate — 'pending' | 'approved' | 'rejected' */
  review_status: 'pending' | 'approved' | 'rejected'
  /** P112: price in smallest currency unit (GBP pence). 0 = free. */
  price_cents: number
  /** D10-1: org-scoped items. NULL = public. */
  org_id: string | null
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
  /** D9-2: optional tags for discoverability. */
  tags?: string[]
}

/**
 * Privacy-safe aggregated analytics for a single marketplace item.
 * No per-user identity is included — counts only.
 */
export interface ItemAnalyticsSummary {
  /** Total events recorded for this item in marketplace_install_events. */
  total: number
  /** Events recorded in the last 30 calendar days. */
  last30Days: number
  /** Breakdown by event_type. */
  byType: {
    install: number
    fork: number
    purchase: number
  }
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

/** Sort options for Explore browse listing. */
export type ExploreSortKey = 'downloads' | 'likes' | 'newest'

/**
 * List all published marketplace items, optionally filtered by category,
 * name search query, and/or tag. Supports multiple sort orders.
 */
export async function listPublishedItems(
  category?: string,
  query?: string,
  sort: ExploreSortKey = 'downloads',
  tag?: string,
): Promise<MarketplaceItem[]> {
  const orderCol =
    sort === 'likes' ? 'likes_count' : sort === 'newest' ? 'created_at' : 'downloads_count'

  let q = supabase
    .from('marketplace_items')
    .select('*')
    .eq('is_published', true)
    .order(orderCol, { ascending: false })

  if (category && category !== 'all') q = q.eq('category', category)
  if (query && query.trim()) q = q.ilike('name', `%${query.trim()}%`)
  if (tag && tag.trim()) q = q.contains('tags', [tag.trim()])

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as MarketplaceItem[]
}

/**
 * D10-1: List org-scoped items ("Company Library").
 * Returns items where org_id matches, visible to org members via RLS.
 */
export async function listOrgExploreItems(orgId: string): Promise<MarketplaceItem[]> {
  const { data, error } = await supabase
    .from('marketplace_items')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

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
 * Append an entry to the marketplace_install_events audit log.
 * Best-effort: errors are swallowed so they never block the install flow.
 *
 * @param userId - Supabase user UUID of the installer.
 * @param itemId - Marketplace item UUID.
 * @param eventType - 'install' | 'fork' | 'purchase'
 */
export async function emitInstallEvent(
  userId: string,
  itemId: string,
  eventType: 'install' | 'fork' | 'purchase',
): Promise<void> {
  await supabase
    .from('marketplace_install_events')
    .insert({ user_id: userId, item_id: itemId, event_type: eventType })
}

/**
 * Return aggregated, privacy-safe analytics for a marketplace item.
 *
 * Callers must be the item author (enforced by the "mie_author_select" RLS
 * policy on marketplace_install_events).  Raw events are aggregated here so
 * no per-user identity is ever forwarded to the caller.
 */
export async function getItemAnalyticsSummary(itemId: string): Promise<ItemAnalyticsSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('marketplace_install_events')
    .select('event_type, created_at')
    .eq('item_id', itemId)

  if (error) throw new Error(error.message)

  const events = (data ?? []) as Array<{ event_type: string; created_at: string }>

  return {
    total: events.length,
    last30Days: events.filter((e) => e.created_at >= thirtyDaysAgo).length,
    byType: {
      install: events.filter((e) => e.event_type === 'install').length,
      fork: events.filter((e) => e.event_type === 'fork').length,
      purchase: events.filter((e) => e.event_type === 'purchase').length,
    },
  }
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

  // Best-effort audit event
  try {
    await emitInstallEvent(user.id, itemId, 'install')
  } catch {
    // Audit failures must not block the install.
  }
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

  // P118: contract version compatibility check
  const payloadMeta = item.payload as { minContractVersion?: number } | null
  if (
    typeof payloadMeta?.minContractVersion === 'number' &&
    payloadMeta.minContractVersion > ENGINE_CONTRACT_VERSION
  ) {
    throw new Error(
      `This template requires engine contract version ${payloadMeta.minContractVersion}, ` +
        `but this app supports up to v${ENGINE_CONTRACT_VERSION}. Please update ChainSolve.`,
    )
  }

  const proj = await importProject(item.payload as ProjectJSON, item.name)
  await recordInstall(itemId)
  // Override the generic 'install' event emitted by recordInstall with 'fork'
  try {
    await emitInstallEvent(user.id, itemId, 'fork')
  } catch {
    // Audit failures must not block the fork.
  }
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

// ── block_pack install (P116) ─────────────────────────────────────────────────

/**
 * Install a block_pack marketplace item.
 *
 * Fetches the item, validates the payload format, checks engine contract
 * compatibility (P118), persists the block definitions to localStorage via
 * installedBlockPacksService, and records the install in marketplace_purchases.
 *
 * Throws if unauthenticated, item not found, payload invalid, or incompatible.
 */
export async function installBlockPack(itemId: string): Promise<void> {
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
  if (item.category !== 'block_pack') throw new Error('Item is not a block pack')
  if (!item.payload) throw new Error('Block pack has no definitions attached')

  const payload = item.payload as BlockPackPayload
  if (!Array.isArray(payload.defs) || payload.defs.length === 0) {
    throw new Error('Block pack payload is missing or empty')
  }

  // P118: contract version compatibility check
  if (
    typeof payload.minContractVersion === 'number' &&
    payload.minContractVersion > ENGINE_CONTRACT_VERSION
  ) {
    throw new Error(
      `This block pack requires engine contract version ${payload.minContractVersion}, ` +
        `but this app supports up to v${ENGINE_CONTRACT_VERSION}. Please update ChainSolve.`,
    )
  }

  addInstalledBlockPack({ itemId, name: item.name as string, defs: payload.defs })
  await recordInstall(itemId)
}

// ── theme install (P117) ──────────────────────────────────────────────────────

/**
 * Install a theme marketplace item.
 *
 * Fetches the item, validates the payload, sanitises the CSS variable map,
 * applies the variables to :root via marketplaceThemeService, and records
 * the install in marketplace_purchases.
 *
 * Throws if unauthenticated, item not found, payload invalid.
 */
export async function installTheme(itemId: string): Promise<void> {
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
  if (item.category !== 'theme') throw new Error('Item is not a theme')
  if (!item.payload) throw new Error('Theme has no variables attached')

  const payload = item.payload as MarketplaceThemePayload
  if (!payload.variables || typeof payload.variables !== 'object') {
    throw new Error('Theme payload is missing variables')
  }

  const variables = sanitizeThemeVariables(payload.variables)
  if (Object.keys(variables).length === 0) {
    throw new Error('Theme has no valid CSS variable definitions')
  }

  installMarketplaceTheme(itemId, item.name as string, variables)
  await recordInstall(itemId)
}

// ── Author verification + publish gate (P109 / P113) ─────────────────────────

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

export interface PublishGate {
  /** User has verified_author = true on their profile. */
  verified: boolean
  /** User has stripe_onboarded = true on their profile (needed for paid items). */
  stripeOnboarded: boolean
}

/**
 * Fetch both verified_author and stripe_onboarded in a single profile query.
 * Returns all-false when unauthenticated.
 */
export async function getPublishGate(): Promise<PublishGate> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { verified: false, stripeOnboarded: false }

  const { data, error } = await supabase
    .from('profiles')
    .select('verified_author, stripe_onboarded')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const profile = data as { verified_author: boolean; stripe_onboarded: boolean } | null
  return {
    verified: profile?.verified_author ?? false,
    stripeOnboarded: profile?.stripe_onboarded ?? false,
  }
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
      tags: input.tags ?? [],
      is_published: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as MarketplaceItem
}

/**
 * Set the payload (JSONB) for an author's marketplace item.
 * Used when uploading theme variables, template snapshots, or block-pack defs.
 */
export async function updateItemPayload(itemId: string, payload: unknown): Promise<void> {
  const { error } = await supabase.from('marketplace_items').update({ payload }).eq('id', itemId)

  if (error) throw error
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

/**
 * P119: Set the review_status of any marketplace item.
 * Requires the caller to be a moderator (is_moderator = true on their profile).
 * Supabase RLS enforces this — a non-moderator UPDATE will be rejected.
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export async function setReviewStatus(itemId: string, status: ReviewStatus): Promise<void> {
  const { error } = await supabase
    .from('marketplace_items')
    .update({ review_status: status })
    .eq('id', itemId)

  if (error) throw error
}

// ── Likes (D9-2) ─────────────────────────────────────────────────────────────

/**
 * Return the set of item IDs the current user has liked.
 * Returns empty set when unauthenticated.
 */
export async function getUserLikes(): Promise<Set<string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return new Set()

  const { data, error } = await supabase.from('marketplace_likes').select('item_id')
  if (error) throw error
  return new Set((data ?? []).map((r: { item_id: string }) => r.item_id))
}

/**
 * Like an item. Idempotent — does nothing if already liked.
 * likes_count on the item is auto-incremented by a DB trigger.
 */
export async function likeItem(itemId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to like items')

  const { error } = await supabase
    .from('marketplace_likes')
    .upsert(
      { user_id: user.id, item_id: itemId },
      { onConflict: 'user_id,item_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

/**
 * Unlike an item. Idempotent — does nothing if not liked.
 */
export async function unlikeItem(itemId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to unlike items')

  const { error } = await supabase
    .from('marketplace_likes')
    .delete()
    .eq('user_id', user.id)
    .eq('item_id', itemId)
  if (error) throw error
}

// ── Comments (D9-4) ───────────────────────────────────────────────────────────

export interface MarketplaceComment {
  id: string
  item_id: string
  user_id: string
  content: string
  is_flagged: boolean
  created_at: string
}

/** Client-side rate limiting for comment posting. */
const COMMENT_RATE_KEY = 'cs:comment-rate'
const COMMENT_RATE_WINDOW_MS = 60_000 // 1 minute
const COMMENT_RATE_MAX = 5

export function checkCommentRateLimit(): boolean {
  try {
    const raw = localStorage.getItem(COMMENT_RATE_KEY)
    const timestamps: number[] = raw ? JSON.parse(raw) : []
    const now = Date.now()
    const recent = timestamps.filter((t) => now - t < COMMENT_RATE_WINDOW_MS)
    return recent.length < COMMENT_RATE_MAX
  } catch {
    return true
  }
}

function recordCommentTimestamp(): void {
  try {
    const raw = localStorage.getItem(COMMENT_RATE_KEY)
    const timestamps: number[] = raw ? JSON.parse(raw) : []
    const now = Date.now()
    const recent = timestamps.filter((t) => now - t < COMMENT_RATE_WINDOW_MS)
    recent.push(now)
    localStorage.setItem(COMMENT_RATE_KEY, JSON.stringify(recent))
  } catch {
    // localStorage unavailable — skip
  }
}

/**
 * Fetch all (non-flagged) comments for an item, ordered newest first.
 */
export async function getItemComments(itemId: string): Promise<MarketplaceComment[]> {
  const { data, error } = await supabase
    .from('marketplace_comments')
    .select('id,item_id,user_id,content,is_flagged,created_at')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as MarketplaceComment[]
}

/**
 * Post a comment on an item. Rate-limited client-side (5/min).
 */
export async function postComment(itemId: string, content: string): Promise<MarketplaceComment> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to comment')

  if (!checkCommentRateLimit()) {
    throw new Error('Too many comments — please wait a moment')
  }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 2000) {
    throw new Error('Comment must be between 1 and 2000 characters')
  }

  const { data, error } = await supabase
    .from('marketplace_comments')
    .insert({ item_id: itemId, user_id: user.id, content: trimmed })
    .select('id,item_id,user_id,content,is_flagged,created_at')
    .single()

  if (error) throw error
  recordCommentTimestamp()
  return data as MarketplaceComment
}

/**
 * Delete own comment, or any comment if moderator/author.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('marketplace_comments').delete().eq('id', commentId)
  if (error) throw error
}

/**
 * Report a comment by setting is_flagged + flag_reason.
 */
export async function reportComment(commentId: string, reason: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to report comments')

  const { error } = await supabase
    .from('marketplace_comments')
    .update({ is_flagged: true, flag_reason: reason.trim().slice(0, 500) })
    .eq('id', commentId)

  if (error) throw error
}
