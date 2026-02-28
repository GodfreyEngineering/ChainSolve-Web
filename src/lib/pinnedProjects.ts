/**
 * pinnedProjects — localStorage-based pinned projects set.
 *
 * Stores project IDs the user has pinned. Follows the same pattern as
 * blockLibraryUtils favourites (cs:favs).
 */

const STORAGE_KEY = 'cs:pinnedProjects'

export function getPinnedProjects(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function togglePinnedProject(projectId: string): Set<string> {
  const set = getPinnedProjects()
  if (set.has(projectId)) {
    set.delete(projectId)
  } else {
    set.add(projectId)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // Storage full or unavailable — ignore
  }
  return set
}

export function unpinProject(projectId: string): Set<string> {
  const set = getPinnedProjects()
  set.delete(projectId)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // ignore
  }
  return set
}
