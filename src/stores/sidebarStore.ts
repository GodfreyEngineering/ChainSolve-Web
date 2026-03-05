import { create } from 'zustand'

export type SidebarTab = 'projects' | 'explore' | 'recent'

interface SidebarState {
  open: boolean
  activeTab: SidebarTab
  /** When viewing an explore item detail, holds the item ID */
  exploreItemId: string | null

  toggle: () => void
  setOpen: (v: boolean) => void
  setActiveTab: (tab: SidebarTab) => void
  openExploreItem: (id: string) => void
  closeExploreItem: () => void
}

const STORAGE_KEY = 'cs:sidebar'

function readPersisted(): Pick<SidebarState, 'open' | 'activeTab'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        open: typeof parsed.open === 'boolean' ? parsed.open : true,
        activeTab: ['projects', 'explore', 'recent'].includes(parsed.activeTab)
          ? parsed.activeTab
          : 'projects',
      }
    }
  } catch {
    /* ignore */
  }
  return { open: true, activeTab: 'projects' }
}

function persist(state: Pick<SidebarState, 'open' | 'activeTab'>) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ open: state.open, activeTab: state.activeTab }),
    )
  } catch {
    /* ignore */
  }
}

export const useSidebarStore = create<SidebarState>()((set, get) => ({
  ...readPersisted(),
  exploreItemId: null,

  toggle: () => {
    const next = !get().open
    set({ open: next })
    persist({ open: next, activeTab: get().activeTab })
  },

  setOpen: (v) => {
    set({ open: v })
    persist({ open: v, activeTab: get().activeTab })
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab, exploreItemId: null })
    persist({ open: get().open, activeTab: tab })
  },

  openExploreItem: (id) => set({ exploreItemId: id, activeTab: 'explore' }),

  closeExploreItem: () => set({ exploreItemId: null }),
}))
