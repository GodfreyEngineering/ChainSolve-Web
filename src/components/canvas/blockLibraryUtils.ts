/** Shared constants and helpers for BlockLibrary (split out for react-refresh). */

import type { BlockDef } from '../../blocks/types'

export const DRAG_TYPE = 'application/chainsolve-block'

const RECENT_KEY = 'cs:recent'
const FAV_KEY = 'cs:favs'

/** Maximum number of recently-used block types stored. */
export const MAX_RECENT_BLOCKS = 8

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** Returns an ordered list of the most-recently used block types (newest first). */
export function getRecentlyUsed(): string[] {
  return getRecent()
}

export function trackBlockUsed(blockType: string): void {
  const prev = getRecent().filter((t) => t !== blockType)
  localStorage.setItem(RECENT_KEY, JSON.stringify([blockType, ...prev].slice(0, MAX_RECENT_BLOCKS)))
}

// ── Favourites ────────────────────────────────────────────────────────────────

/** Returns the current set of favourite block types from localStorage. */
export function getFavourites(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/**
 * Toggle the favourite state for a block type.
 * Persists to localStorage and returns the updated set.
 */
export function toggleFavourite(type: string): Set<string> {
  const favs = getFavourites()
  if (favs.has(type)) favs.delete(type)
  else favs.add(type)
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]))
  return favs
}

// ── E5-5: Ranked search scoring ──────────────────────────────────────────────

/**
 * Score a block against a search query. Lower score = better match.
 * Returns null if the block does not match at all.
 *
 * Scoring tiers:
 *   1  — exact label match
 *   2  — exact type match
 *   5  — label starts with query
 *  10  — label contains query
 *  12  — type (opId) contains query
 *  15  — synonym match
 *  20  — tag match
 *  25  — input port label match
 */
export function scoreMatch(def: BlockDef, q: string): number | null {
  const lq = q.toLowerCase()
  let best: number | null = null

  const tryScore = (s: number) => {
    if (best === null || s < best) best = s
  }

  // Exact matches
  if (def.label.toLowerCase() === lq) tryScore(1)
  else if (def.type.toLowerCase() === lq) tryScore(2)

  // Label prefix / substring
  if (def.label.toLowerCase().startsWith(lq)) tryScore(5)
  else if (def.label.toLowerCase().includes(lq)) tryScore(10)

  // Type (opId) substring — covers type keywords (split on . and _) as well
  if (def.type.toLowerCase().includes(lq)) tryScore(12)

  // Synonyms
  if (def.synonyms?.some((s) => s.toLowerCase().includes(lq))) tryScore(15)

  // Tags
  if (def.tags?.some((t) => t.toLowerCase().includes(lq))) tryScore(20)

  // Input port labels
  if (def.inputs.some((p) => p.label.toLowerCase().includes(lq))) tryScore(25)

  return best
}
