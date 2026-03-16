/**
 * aiConversationStore — Zustand store for persistent ChainSolve AI conversations.
 *
 * Persists conversations to localStorage so they survive panel close/reopen
 * and page reloads. Each conversation has a unique ID, title, timestamp,
 * and full message history.
 */

import { create } from 'zustand'
import type { AiPatchOp, RiskAssessment } from '../lib/ai/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  patchOps?: AiPatchOp[]
  risk?: RiskAssessment
  assumptions?: string[]
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

interface AiConversationState {
  /** All saved conversations, newest first. */
  conversations: Conversation[]
  /** Currently active conversation ID (null = new conversation). */
  activeId: string | null

  // ── Actions ──────────────────────────────────────────────────────────────
  /** Start a new conversation (clears active, does not delete old). */
  newConversation: () => void
  /** Switch to an existing conversation by ID. */
  switchTo: (id: string) => void
  /** Add a message to the active conversation (creates one if needed). */
  addMessage: (msg: ChatMessage) => void
  /** Update the last message in the active conversation (for streaming finalize). */
  updateLastMessage: (msg: ChatMessage) => void
  /** Rename a conversation. */
  rename: (id: string, title: string) => void
  /** Delete a conversation. */
  remove: (id: string) => void
  /** Get the active conversation (or null). */
  getActive: () => Conversation | null
}

// ── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cs:aiConversations'
const ACTIVE_KEY = 'cs:aiActiveConv'
const MAX_CONVERSATIONS = 50

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Conversation[]
  } catch {
    // ignore
  }
  return []
}

function saveConversations(convs: Conversation[]) {
  try {
    // Only persist the most recent conversations to avoid localStorage bloat
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, MAX_CONVERSATIONS)))
  } catch {
    // ignore (private browsing, quota exceeded)
  }
}

function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // ignore
  }
}

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Derive a title from the first user message. */
function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first) return 'New conversation'
  const text = first.content.trim()
  return text.length > 60 ? text.slice(0, 57) + '...' : text
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useAiConversationStore = create<AiConversationState>((set, get) => ({
  conversations: loadConversations(),
  activeId: loadActiveId(),

  newConversation: () => {
    set({ activeId: null })
    saveActiveId(null)
  },

  switchTo: (id) => {
    set({ activeId: id })
    saveActiveId(id)
  },

  addMessage: (msg) => {
    const state = get()
    let convs = [...state.conversations]
    let activeId = state.activeId
    const now = Date.now()

    if (!activeId) {
      // Create new conversation
      const newConv: Conversation = {
        id: generateId(),
        title: msg.role === 'user' ? deriveTitle([msg]) : 'New conversation',
        messages: [msg],
        createdAt: now,
        updatedAt: now,
      }
      convs = [newConv, ...convs]
      activeId = newConv.id
    } else {
      // Append to existing
      const idx = convs.findIndex((c) => c.id === activeId)
      if (idx !== -1) {
        const conv = { ...convs[idx] }
        conv.messages = [...conv.messages, msg]
        conv.updatedAt = now
        // Update title from first user message if still default
        if (conv.title === 'New conversation') {
          conv.title = deriveTitle(conv.messages)
        }
        convs[idx] = conv
        // Move to front (most recent)
        convs = [conv, ...convs.filter((_, i) => i !== idx)]
      }
    }

    set({ conversations: convs, activeId })
    saveConversations(convs)
    saveActiveId(activeId)
  },

  updateLastMessage: (msg) => {
    const state = get()
    if (!state.activeId) return
    const convs = [...state.conversations]
    const idx = convs.findIndex((c) => c.id === state.activeId)
    if (idx === -1) return
    const conv = { ...convs[idx] }
    const msgs = [...conv.messages]
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      msgs[msgs.length - 1] = msg
    } else {
      msgs.push(msg)
    }
    conv.messages = msgs
    conv.updatedAt = Date.now()
    convs[idx] = conv
    set({ conversations: convs })
    saveConversations(convs)
  },

  rename: (id, title) => {
    const convs = get().conversations.map((c) => (c.id === id ? { ...c, title } : c))
    set({ conversations: convs })
    saveConversations(convs)
  },

  remove: (id) => {
    const state = get()
    const convs = state.conversations.filter((c) => c.id !== id)
    const activeId = state.activeId === id ? null : state.activeId
    set({ conversations: convs, activeId })
    saveConversations(convs)
    saveActiveId(activeId)
  },

  getActive: () => {
    const state = get()
    if (!state.activeId) return null
    return state.conversations.find((c) => c.id === state.activeId) ?? null
  },
}))
