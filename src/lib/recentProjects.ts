/**
 * recentProjects — localStorage MRU list of recently opened projects.
 *
 * Stores up to 10 entries as { id, name }. Updated on project load.
 * Used by the File → Recent Projects submenu in AppHeader.
 */

const STORAGE_KEY = 'chainsolve.recentProjects'
const MAX_RECENT = 10

export interface RecentProject {
  id: string
  name: string
}

export function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentProject[]
  } catch {
    return []
  }
}

export function addRecentProject(id: string, name: string): void {
  const list = getRecentProjects().filter((p) => p.id !== id)
  list.unshift({ id, name })
  if (list.length > MAX_RECENT) list.length = MAX_RECENT
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function removeRecentProject(id: string): void {
  const list = getRecentProjects().filter((p) => p.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}
