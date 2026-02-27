/**
 * stores/debugConsoleStore.ts — Ring-buffer log store for the Debug Console.
 *
 * Stores log entries in a bounded ring buffer. Preferences (level, scopes,
 * visibility) persist to localStorage; the log buffer itself does NOT persist.
 */

import { create } from 'zustand'
import { redactObject } from '../observability/redact'

// ── Types ──────────────────────────────────────────────────────────────────────

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace'
export type LogScope =
  | 'engine'
  | 'bindings'
  | 'variables'
  | 'persistence'
  | 'network'
  | 'perf'
  | 'ui'

export interface LogEntry {
  id: number
  ts: number
  level: LogLevel
  scope: LogScope
  msg: string
  meta?: Record<string, unknown>
}

export const LOG_LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace']
export const LOG_SCOPES: readonly LogScope[] = [
  'engine',
  'bindings',
  'variables',
  'persistence',
  'network',
  'perf',
  'ui',
]

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
}

// ── localStorage persistence ───────────────────────────────────────────────────

const LS_PREFIX = 'chainsolve.debugConsole'

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(`${LS_PREFIX}.${key}`)
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {
    /* private browsing */
  }
  return fallback
}

function saveBool(key: string, v: boolean) {
  try {
    localStorage.setItem(`${LS_PREFIX}.${key}`, String(v))
  } catch {
    /* private browsing */
  }
}

function loadString<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(`${LS_PREFIX}.${key}`) as T | null
    if (v && allowed.includes(v)) return v
  } catch {
    /* private browsing */
  }
  return fallback
}

function saveString(key: string, v: string) {
  try {
    localStorage.setItem(`${LS_PREFIX}.${key}`, v)
  } catch {
    /* private browsing */
  }
}

function loadScopes(): Set<LogScope> {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}.scopes`)
    if (raw) {
      const arr = JSON.parse(raw) as string[]
      return new Set(arr.filter((s): s is LogScope => LOG_SCOPES.includes(s as LogScope)))
    }
  } catch {
    /* ignore */
  }
  return new Set(LOG_SCOPES)
}

function saveScopes(scopes: Set<LogScope>) {
  try {
    localStorage.setItem(`${LS_PREFIX}.scopes`, JSON.stringify([...scopes]))
  } catch {
    /* private browsing */
  }
}

// ── Store ──────────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 2000

interface DebugConsoleState {
  // Buffer
  entries: LogEntry[]
  nextId: number

  // Preferences (persisted)
  visible: boolean
  minLevel: LogLevel
  enabledScopes: Set<LogScope>
  autoScroll: boolean
  paused: boolean
  search: string

  // Actions
  add: (level: LogLevel, scope: LogScope, msg: string, meta?: Record<string, unknown>) => void
  clear: () => void
  setVisible: (v: boolean) => void
  toggleVisible: () => void
  setMinLevel: (level: LogLevel) => void
  toggleScope: (scope: LogScope) => void
  setAutoScroll: (v: boolean) => void
  setPaused: (v: boolean) => void
  setSearch: (q: string) => void
}

export const useDebugConsoleStore = create<DebugConsoleState>((set, get) => ({
  entries: [],
  nextId: 1,

  visible: loadBool('visible', false),
  minLevel: loadString('minLevel', 'warn', LOG_LEVELS),
  enabledScopes: loadScopes(),
  autoScroll: loadBool('autoScroll', true),
  paused: false,
  search: '',

  add: (level, scope, msg, meta) => {
    if (get().paused) return
    const redactedMeta = meta ? (redactObject(meta) as Record<string, unknown>) : undefined
    set((s) => {
      const entry: LogEntry = {
        id: s.nextId,
        ts: Date.now(),
        level,
        scope,
        msg,
        meta: redactedMeta,
      }
      const next = [...s.entries, entry]
      // Ring buffer: trim from the front
      if (next.length > MAX_ENTRIES) next.splice(0, next.length - MAX_ENTRIES)
      return { entries: next, nextId: s.nextId + 1 }
    })
  },

  clear: () => set({ entries: [] }),

  setVisible: (v) => {
    saveBool('visible', v)
    set({ visible: v })
  },

  toggleVisible: () => {
    const next = !get().visible
    saveBool('visible', next)
    set({ visible: next })
  },

  setMinLevel: (level) => {
    saveString('minLevel', level)
    set({ minLevel: level })
  },

  toggleScope: (scope) => {
    const scopes = new Set(get().enabledScopes)
    if (scopes.has(scope)) scopes.delete(scope)
    else scopes.add(scope)
    saveScopes(scopes)
    set({ enabledScopes: scopes })
  },

  setAutoScroll: (v) => {
    saveBool('autoScroll', v)
    set({ autoScroll: v })
  },

  setPaused: (v) => set({ paused: v }),

  setSearch: (q) => set({ search: q }),
}))

// ── Selectors ──────────────────────────────────────────────────────────────────

/** Filter entries by current preferences. Pure function for testability. */
export function filterEntries(
  entries: readonly LogEntry[],
  minLevel: LogLevel,
  enabledScopes: ReadonlySet<LogScope>,
  search: string,
): LogEntry[] {
  const minRank = LEVEL_RANK[minLevel]
  const q = search.toLowerCase()
  return entries.filter((e) => {
    if (LEVEL_RANK[e.level] > minRank) return false
    if (!enabledScopes.has(e.scope)) return false
    if (q && !e.msg.toLowerCase().includes(q) && !e.scope.includes(q)) return false
    return true
  })
}

// ── Export helpers ──────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  const d = new Date(ts)
  return d.toISOString().slice(11, 23) // HH:MM:SS.mmm
}

export function exportText(entries: readonly LogEntry[]): string {
  return entries
    .map((e) => {
      const time = formatTs(e.ts)
      const meta = e.meta ? ` ${JSON.stringify(e.meta)}` : ''
      return `${time} [${e.level.toUpperCase().padEnd(5)}] [${e.scope}] ${e.msg}${meta}`
    })
    .join('\n')
}

export function exportJson(entries: readonly LogEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      ts: new Date(e.ts).toISOString(),
      level: e.level,
      scope: e.scope,
      msg: e.msg,
      meta: e.meta,
    })),
    null,
    2,
  )
}
