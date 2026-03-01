/**
 * blockedUsers.ts — D16-3: Client-side user blocking via localStorage.
 *
 * Blocked users' items and comments are hidden from the current user's view.
 * This is a lightweight client-side mechanism; no server round-trip required.
 */

const STORAGE_KEY = 'cs:blockedUsers'

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((v): v is string => typeof v === 'string'))
  } catch {
    return new Set()
  }
}

function writeSet(s: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]))
}

/** Returns the set of blocked user IDs. */
export function getBlockedUsers(): Set<string> {
  return readSet()
}

/** Returns true if the given user ID is blocked. */
export function isUserBlocked(userId: string): boolean {
  return readSet().has(userId)
}

/** Block a user. Returns the updated set. */
export function blockUser(userId: string): Set<string> {
  const s = readSet()
  s.add(userId)
  writeSet(s)
  return s
}

/** Unblock a user. Returns the updated set. */
export function unblockUser(userId: string): Set<string> {
  const s = readSet()
  s.delete(userId)
  writeSet(s)
  return s
}
