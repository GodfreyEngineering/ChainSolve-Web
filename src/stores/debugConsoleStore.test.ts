/**
 * debugConsoleStore unit tests.
 *
 * Run with: npm run test:unit
 *
 * Tests verify:
 *   - Ring buffer respects MAX_ENTRIES (2000)
 *   - Adding entries while paused is a no-op
 *   - filterEntries respects minLevel, enabled scopes, and search text
 *   - exportText produces expected line format
 *   - exportJson produces valid JSON with ISO timestamps
 *   - Meta values are redacted through redactObject
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useDebugConsoleStore, filterEntries, exportText, exportJson } from './debugConsoleStore'
import type { LogEntry } from './debugConsoleStore'

// ── Helpers ────────────────────────────────────────────────────────────────────

function addN(n: number, prefix = 'msg') {
  const store = useDebugConsoleStore.getState()
  for (let i = 0; i < n; i++) {
    store.add('info', 'engine', `${prefix}-${i}`)
  }
}

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    ts: 1700000000000,
    level: 'info',
    scope: 'engine',
    msg: 'test message',
    ...overrides,
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset the store between tests
  useDebugConsoleStore.setState({
    entries: [],
    nextId: 1,
    paused: false,
    search: '',
    minLevel: 'trace',
    enabledScopes: new Set([
      'engine',
      'bindings',
      'variables',
      'persistence',
      'network',
      'perf',
      'ui',
    ]),
    autoScroll: true,
    visible: false,
  })
})

// ── Ring buffer ────────────────────────────────────────────────────────────────

describe('ring buffer', () => {
  it('adds entries and increments nextId', () => {
    const store = useDebugConsoleStore.getState()
    store.add('info', 'engine', 'hello')
    store.add('warn', 'ui', 'world')
    const state = useDebugConsoleStore.getState()
    expect(state.entries).toHaveLength(2)
    expect(state.entries[0].msg).toBe('hello')
    expect(state.entries[1].msg).toBe('world')
    expect(state.nextId).toBe(3)
  })

  it('trims entries when exceeding 2000', () => {
    addN(2005)
    const state = useDebugConsoleStore.getState()
    expect(state.entries.length).toBeLessThanOrEqual(2000)
    // The first entry should be msg-5 (the first 5 were trimmed)
    expect(state.entries[0].msg).toBe('msg-5')
  })

  it('does not add entries when paused', () => {
    useDebugConsoleStore.getState().setPaused(true)
    useDebugConsoleStore.getState().add('error', 'engine', 'should not appear')
    expect(useDebugConsoleStore.getState().entries).toHaveLength(0)
  })

  it('clear empties the buffer', () => {
    addN(10)
    expect(useDebugConsoleStore.getState().entries.length).toBe(10)
    useDebugConsoleStore.getState().clear()
    expect(useDebugConsoleStore.getState().entries).toHaveLength(0)
  })
})

// ── Redaction ──────────────────────────────────────────────────────────────────

describe('redaction', () => {
  it('redacts secret keys in meta', () => {
    useDebugConsoleStore.getState().add('info', 'engine', 'test', {
      nodeId: 'n1',
      token: 'secret-value',
    })
    const entry = useDebugConsoleStore.getState().entries[0]
    expect(entry.meta?.['nodeId']).toBe('n1')
    expect(entry.meta?.['token']).toBe('[REDACTED]')
  })

  it('redacts emails in meta string values', () => {
    useDebugConsoleStore.getState().add('info', 'engine', 'test', {
      description: 'Error for user@test.com',
    })
    const entry = useDebugConsoleStore.getState().entries[0]
    expect(entry.meta?.['description']).toBe('Error for [EMAIL]')
  })
})

// ── filterEntries ──────────────────────────────────────────────────────────────

describe('filterEntries', () => {
  const allScopes = new Set([
    'engine',
    'bindings',
    'variables',
    'persistence',
    'network',
    'perf',
    'ui',
  ] as const)

  it('filters by minLevel (error only)', () => {
    const entries = [
      makeEntry({ level: 'error', msg: 'err' }),
      makeEntry({ id: 2, level: 'warn', msg: 'wrn' }),
      makeEntry({ id: 3, level: 'info', msg: 'inf' }),
    ]
    const result = filterEntries(entries, 'error', allScopes, '')
    expect(result).toHaveLength(1)
    expect(result[0].msg).toBe('err')
  })

  it('filters by minLevel (warn includes error+warn)', () => {
    const entries = [
      makeEntry({ level: 'error' }),
      makeEntry({ id: 2, level: 'warn' }),
      makeEntry({ id: 3, level: 'info' }),
      makeEntry({ id: 4, level: 'debug' }),
    ]
    const result = filterEntries(entries, 'warn', allScopes, '')
    expect(result).toHaveLength(2)
  })

  it('filters by minLevel (trace includes all)', () => {
    const entries = [
      makeEntry({ level: 'error' }),
      makeEntry({ id: 2, level: 'warn' }),
      makeEntry({ id: 3, level: 'info' }),
      makeEntry({ id: 4, level: 'debug' }),
      makeEntry({ id: 5, level: 'trace' }),
    ]
    const result = filterEntries(entries, 'trace', allScopes, '')
    expect(result).toHaveLength(5)
  })

  it('filters by enabled scopes', () => {
    const entries = [
      makeEntry({ scope: 'engine', msg: 'eng' }),
      makeEntry({ id: 2, scope: 'ui', msg: 'ui' }),
      makeEntry({ id: 3, scope: 'persistence', msg: 'pers' }),
    ]
    const result = filterEntries(entries, 'trace', new Set(['engine', 'persistence'] as const), '')
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.msg)).toEqual(['eng', 'pers'])
  })

  it('filters by search text (case-insensitive)', () => {
    const entries = [
      makeEntry({ msg: 'Worker ready' }),
      makeEntry({ id: 2, msg: 'Eval complete' }),
      makeEntry({ id: 3, msg: 'Worker error' }),
    ]
    const result = filterEntries(entries, 'trace', allScopes, 'worker')
    expect(result).toHaveLength(2)
  })

  it('matches search against scope name', () => {
    const entries = [
      makeEntry({ scope: 'engine', msg: 'hello' }),
      makeEntry({ id: 2, scope: 'ui', msg: 'hello' }),
    ]
    const result = filterEntries(entries, 'trace', allScopes, 'engine')
    expect(result).toHaveLength(1)
    expect(result[0].scope).toBe('engine')
  })

  it('returns empty for no matches', () => {
    const entries = [makeEntry({ msg: 'abc' })]
    const result = filterEntries(entries, 'trace', allScopes, 'xyz')
    expect(result).toHaveLength(0)
  })
})

// ── exportText ────────────────────────────────────────────────────────────────

describe('exportText', () => {
  it('formats entries as timestamped lines', () => {
    const entries = [
      makeEntry({ ts: 1700000000000, level: 'info', scope: 'engine', msg: 'Worker ready' }),
      makeEntry({ id: 2, ts: 1700000001000, level: 'error', scope: 'ui', msg: 'Render crash' }),
    ]
    const text = exportText(entries)
    const lines = text.split('\n')
    expect(lines).toHaveLength(2)
    // Check format: HH:MM:SS.mmm [LEVEL] [scope] message
    expect(lines[0]).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3} \[INFO \] \[engine\] Worker ready$/)
    expect(lines[1]).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3} \[ERROR\] \[ui\] Render crash$/)
  })

  it('includes meta as JSON suffix', () => {
    const entries = [makeEntry({ msg: 'test', meta: { nodeId: 'n1' } })]
    const text = exportText(entries)
    expect(text).toContain('{"nodeId":"n1"}')
  })
})

// ── exportJson ────────────────────────────────────────────────────────────────

describe('exportJson', () => {
  it('produces valid JSON with ISO timestamps', () => {
    const entries = [
      makeEntry({ ts: 1700000000000, level: 'warn', scope: 'persistence', msg: 'Conflict' }),
    ]
    const json = exportJson(entries)
    const parsed = JSON.parse(json) as Array<{
      ts: string
      level: string
      scope: string
      msg: string
    }>
    expect(parsed).toHaveLength(1)
    expect(parsed[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(parsed[0].level).toBe('warn')
    expect(parsed[0].scope).toBe('persistence')
    expect(parsed[0].msg).toBe('Conflict')
  })

  it('includes meta when present', () => {
    const entries = [makeEntry({ meta: { count: 42 } })]
    const parsed = JSON.parse(exportJson(entries)) as Array<{ meta: { count: number } }>
    expect(parsed[0].meta.count).toBe(42)
  })

  it('handles empty entries array', () => {
    expect(exportJson([])).toBe('[]')
  })
})

// ── Export redaction regression ───────────────────────────────────────────────

describe('export redaction regression — exportText', () => {
  it('does not emit token values in text export', () => {
    useDebugConsoleStore.getState().add('info', 'network', 'auth event', {
      token: 'super-secret-token',
      nodeId: 'n1',
    })
    const entries = useDebugConsoleStore.getState().entries
    const text = exportText(entries)
    expect(text).not.toContain('super-secret-token')
    expect(text).toContain('[REDACTED]')
    expect(text).toContain('n1')
  })

  it('does not emit email addresses in text export', () => {
    useDebugConsoleStore.getState().add('info', 'engine', 'user event', {
      description: 'login for user@example.com',
    })
    const entries = useDebugConsoleStore.getState().entries
    const text = exportText(entries)
    expect(text).not.toContain('user@example.com')
    expect(text).toContain('[EMAIL]')
  })

  it('does not emit JWT tokens in text export', () => {
    useDebugConsoleStore.getState().add('debug', 'network', 'request', {
      authorization: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
    })
    const entries = useDebugConsoleStore.getState().entries
    const text = exportText(entries)
    expect(text).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(text).toContain('[REDACTED]')
  })

  it('does not emit supabase keys in text export', () => {
    useDebugConsoleStore.getState().add('debug', 'network', 'init', {
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supabase-payload.sig',
    })
    const entries = useDebugConsoleStore.getState().entries
    const text = exportText(entries)
    expect(text).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supabase-payload.sig')
    expect(text).toContain('[REDACTED]')
  })
})

describe('export redaction regression — exportJson', () => {
  it('does not emit token values in JSON export', () => {
    useDebugConsoleStore.getState().add('info', 'network', 'auth event', {
      token: 'super-secret-token',
      nodeId: 'n1',
    })
    const entries = useDebugConsoleStore.getState().entries
    const json = exportJson(entries)
    expect(json).not.toContain('super-secret-token')
    expect(json).toContain('[REDACTED]')
    expect(json).toContain('n1')
  })

  it('does not emit email addresses in JSON export', () => {
    useDebugConsoleStore.getState().add('info', 'engine', 'user event', {
      description: 'login for user@example.com',
    })
    const entries = useDebugConsoleStore.getState().entries
    const json = exportJson(entries)
    expect(json).not.toContain('user@example.com')
    expect(json).toContain('[EMAIL]')
  })

  it('preserves safe metadata in JSON export', () => {
    useDebugConsoleStore.getState().add('info', 'engine', 'perf', {
      nodeId: 'n42',
      durationMs: 123,
      label: 'solver-run',
    })
    const entries = useDebugConsoleStore.getState().entries
    const parsed = JSON.parse(exportJson(entries)) as Array<{
      meta: { nodeId: string; durationMs: number; label: string }
    }>
    expect(parsed[0].meta.nodeId).toBe('n42')
    expect(parsed[0].meta.durationMs).toBe(123)
    expect(parsed[0].meta.label).toBe('solver-run')
  })
})
