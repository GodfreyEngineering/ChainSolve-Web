import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from './projectStore'

// Reset the store before each test to prevent state leakage
beforeEach(() => {
  useProjectStore.getState().reset()
})

// ── beginLoad ────────────────────────────────────────────────────────────────

describe('beginLoad', () => {
  it('sets project identity and resets lifecycle state', () => {
    const s = useProjectStore.getState()
    s.beginLoad('p-1', 'My Project', '2024-01-01T00:00:00Z', 1, '2023-01-01T00:00:00Z')
    const after = useProjectStore.getState()
    expect(after.projectId).toBe('p-1')
    expect(after.projectName).toBe('My Project')
    expect(after.dbUpdatedAt).toBe('2024-01-01T00:00:00Z')
    expect(after.formatVersion).toBe(1)
    expect(after.saveStatus).toBe('idle')
    expect(after.isDirty).toBe(false)
    expect(after.lastSavedAt).toBeNull()
    expect(after.errorMessage).toBeNull()
  })
})

// ── markDirty ────────────────────────────────────────────────────────────────

describe('markDirty', () => {
  it('sets isDirty to true', () => {
    useProjectStore.getState().markDirty()
    expect(useProjectStore.getState().isDirty).toBe(true)
  })

  it('clears error status when dirty', () => {
    useProjectStore.getState().failSave('network error')
    useProjectStore.getState().markDirty()
    expect(useProjectStore.getState().saveStatus).toBe('idle')
  })

  it('clears offline-queued status when dirty', () => {
    useProjectStore.getState().queueOffline()
    useProjectStore.getState().markDirty()
    expect(useProjectStore.getState().saveStatus).toBe('idle')
  })

  it('preserves saving status while dirty', () => {
    useProjectStore.getState().beginSave()
    useProjectStore.getState().markDirty()
    expect(useProjectStore.getState().saveStatus).toBe('saving')
  })
})

// ── beginSave / completeSave ──────────────────────────────────────────────────

describe('save lifecycle', () => {
  it('beginSave transitions to saving', () => {
    useProjectStore.getState().beginSave()
    expect(useProjectStore.getState().saveStatus).toBe('saving')
  })

  it('completeSave transitions to saved and updates dbUpdatedAt', () => {
    useProjectStore.getState().beginSave()
    useProjectStore.getState().completeSave('2025-01-01T12:00:00Z')
    const s = useProjectStore.getState()
    expect(s.saveStatus).toBe('saved')
    expect(s.dbUpdatedAt).toBe('2025-01-01T12:00:00Z')
    expect(s.isDirty).toBe(false)
  })

  it('completeSave sets lastSavedAt to a recent Date', () => {
    const before = Date.now()
    useProjectStore.getState().completeSave('ts')
    const lastSavedAt = useProjectStore.getState().lastSavedAt
    expect(lastSavedAt).not.toBeNull()
    expect(lastSavedAt!.getTime()).toBeGreaterThanOrEqual(before)
  })
})

// ── failSave ──────────────────────────────────────────────────────────────────

describe('failSave', () => {
  it('transitions to error with message', () => {
    useProjectStore.getState().failSave('timeout')
    const s = useProjectStore.getState()
    expect(s.saveStatus).toBe('error')
    expect(s.errorMessage).toBe('timeout')
  })
})

// ── queueOffline ─────────────────────────────────────────────────────────────

describe('queueOffline', () => {
  it('transitions to offline-queued', () => {
    useProjectStore.getState().queueOffline()
    expect(useProjectStore.getState().saveStatus).toBe('offline-queued')
  })

  it('clears errorMessage', () => {
    useProjectStore.getState().failSave('err')
    useProjectStore.getState().queueOffline()
    expect(useProjectStore.getState().errorMessage).toBeNull()
  })
})

// ── detectConflict / dismissConflict ─────────────────────────────────────────

describe('detectConflict', () => {
  it('transitions saveStatus to conflict', () => {
    useProjectStore.getState().beginSave()
    useProjectStore.getState().detectConflict()
    expect(useProjectStore.getState().saveStatus).toBe('conflict')
  })
})

describe('dismissConflict', () => {
  it('transitions saveStatus back to idle', () => {
    useProjectStore.getState().detectConflict()
    useProjectStore.getState().dismissConflict()
    expect(useProjectStore.getState().saveStatus).toBe('idle')
  })

  it('marks the project as dirty after dismissal', () => {
    useProjectStore.getState().detectConflict()
    useProjectStore.getState().dismissConflict()
    expect(useProjectStore.getState().isDirty).toBe(true)
  })
})

// ── Full conflict scenario ────────────────────────────────────────────────────

describe('conflict scenario', () => {
  it('full cycle: load → save → conflict → dismiss → dirty', () => {
    const s = useProjectStore.getState()
    s.beginLoad('p-1', 'Project', 'ts-0', 1, 'ts-c')

    // User edits
    s.markDirty()
    expect(useProjectStore.getState().isDirty).toBe(true)

    // Autosave attempt
    useProjectStore.getState().beginSave()
    expect(useProjectStore.getState().saveStatus).toBe('saving')

    // Conflict detected — another session saved first
    useProjectStore.getState().detectConflict()
    expect(useProjectStore.getState().saveStatus).toBe('conflict')

    // User dismisses (chooses to deal with it later)
    useProjectStore.getState().dismissConflict()
    expect(useProjectStore.getState().saveStatus).toBe('idle')
    expect(useProjectStore.getState().isDirty).toBe(true)
  })

  it('full cycle: load → save → conflict → overwrite (completeSave)', () => {
    const s = useProjectStore.getState()
    s.beginLoad('p-1', 'Project', 'ts-0', 1, 'ts-c')

    useProjectStore.getState().beginSave()
    useProjectStore.getState().detectConflict()

    // User clicks "Keep mine" — we force-save with server timestamp
    useProjectStore.getState().beginSave()
    useProjectStore.getState().completeSave('ts-server')

    const after = useProjectStore.getState()
    expect(after.saveStatus).toBe('saved')
    expect(after.dbUpdatedAt).toBe('ts-server')
    expect(after.isDirty).toBe(false)
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('restores initial state', () => {
    const s = useProjectStore.getState()
    s.beginLoad('p-1', 'Project', 'ts', 1, 'ts')
    s.markDirty()
    s.reset()
    const after = useProjectStore.getState()
    expect(after.projectId).toBeNull()
    expect(after.projectName).toBe('Untitled')
    expect(after.saveStatus).toBe('idle')
    expect(after.isDirty).toBe(false)
    expect(after.lastSavedAt).toBeNull()
  })
})
