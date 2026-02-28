/** Shared constants and helpers for BlockLibrary (split out for react-refresh). */

export const DRAG_TYPE = 'application/chainsolve-block'

const RECENT_KEY = 'cs:recent'

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
