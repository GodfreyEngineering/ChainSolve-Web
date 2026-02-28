/** Shared constants and helpers for BlockLibrary (split out for react-refresh). */

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
