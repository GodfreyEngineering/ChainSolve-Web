import { describe, it, expect, beforeEach } from 'vitest'
import { getPinnedProjects, togglePinnedProject, unpinProject } from './pinnedProjects'

describe('pinnedProjects', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty set when no pinned projects', () => {
    expect(getPinnedProjects().size).toBe(0)
  })

  it('togglePinnedProject adds a project', () => {
    const set = togglePinnedProject('proj-1')
    expect(set.has('proj-1')).toBe(true)
    expect(getPinnedProjects().has('proj-1')).toBe(true)
  })

  it('togglePinnedProject removes a pinned project', () => {
    togglePinnedProject('proj-1')
    const set = togglePinnedProject('proj-1')
    expect(set.has('proj-1')).toBe(false)
    expect(getPinnedProjects().has('proj-1')).toBe(false)
  })

  it('tracks multiple pinned projects', () => {
    togglePinnedProject('a')
    togglePinnedProject('b')
    togglePinnedProject('c')
    const pinned = getPinnedProjects()
    expect(pinned.size).toBe(3)
    expect(pinned.has('a')).toBe(true)
    expect(pinned.has('b')).toBe(true)
    expect(pinned.has('c')).toBe(true)
  })

  it('unpinProject removes a specific project', () => {
    togglePinnedProject('a')
    togglePinnedProject('b')
    unpinProject('a')
    const pinned = getPinnedProjects()
    expect(pinned.size).toBe(1)
    expect(pinned.has('b')).toBe(true)
  })

  it('unpinProject is a no-op for non-pinned project', () => {
    togglePinnedProject('a')
    unpinProject('z')
    expect(getPinnedProjects().size).toBe(1)
  })

  it('persists to localStorage', () => {
    togglePinnedProject('x')
    const raw = localStorage.getItem('cs:pinnedProjects')
    expect(raw).toBeTruthy()
    const arr = JSON.parse(raw!) as string[]
    expect(arr).toContain('x')
  })
})
