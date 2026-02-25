/** Shared constants and helpers for BlockLibrary (split out for react-refresh). */

export const DRAG_TYPE = 'application/chainsolve-block'

const RECENT_KEY = 'cs:recent'

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function trackBlockUsed(blockType: string): void {
  const prev = getRecent().filter((t) => t !== blockType)
  localStorage.setItem(RECENT_KEY, JSON.stringify([blockType, ...prev].slice(0, 8)))
}
