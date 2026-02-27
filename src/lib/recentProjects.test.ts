import { describe, it, expect, beforeEach } from 'vitest'
import { getRecentProjects, addRecentProject, removeRecentProject } from './recentProjects'

const KEY = 'chainsolve.recentProjects'

describe('getRecentProjects', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty array when localStorage is empty', () => {
    expect(getRecentProjects()).toEqual([])
  })

  it('returns stored projects', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', name: 'Alpha' }]))
    expect(getRecentProjects()).toEqual([{ id: 'p1', name: 'Alpha' }])
  })

  it('returns empty array when stored value is corrupt JSON', () => {
    localStorage.setItem(KEY, 'not-json{{{')
    expect(getRecentProjects()).toEqual([])
  })
})

describe('addRecentProject', () => {
  beforeEach(() => localStorage.clear())

  it('adds a new project to the front of the list', () => {
    addRecentProject('p1', 'Alpha')
    expect(getRecentProjects()).toEqual([{ id: 'p1', name: 'Alpha' }])
  })

  it('prepends to existing entries', () => {
    addRecentProject('p1', 'Alpha')
    addRecentProject('p2', 'Beta')
    expect(getRecentProjects()[0]).toEqual({ id: 'p2', name: 'Beta' })
    expect(getRecentProjects()[1]).toEqual({ id: 'p1', name: 'Alpha' })
  })

  it('moves an existing project to the front (deduplication)', () => {
    addRecentProject('p1', 'Alpha')
    addRecentProject('p2', 'Beta')
    addRecentProject('p1', 'Alpha (renamed)')
    const list = getRecentProjects()
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual({ id: 'p1', name: 'Alpha (renamed)' })
    expect(list[1]).toEqual({ id: 'p2', name: 'Beta' })
  })

  it('trims list to at most 10 entries', () => {
    for (let i = 0; i < 12; i++) {
      addRecentProject(`p${i}`, `Project ${i}`)
    }
    expect(getRecentProjects()).toHaveLength(10)
  })
})

describe('removeRecentProject', () => {
  beforeEach(() => localStorage.clear())

  it('removes the matching entry', () => {
    addRecentProject('p1', 'Alpha')
    addRecentProject('p2', 'Beta')
    removeRecentProject('p1')
    const list = getRecentProjects()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('p2')
  })

  it('is a no-op when id is not in the list', () => {
    addRecentProject('p1', 'Alpha')
    removeRecentProject('p-missing')
    expect(getRecentProjects()).toHaveLength(1)
  })

  it('handles empty list gracefully', () => {
    expect(() => removeRecentProject('p1')).not.toThrow()
    expect(getRecentProjects()).toEqual([])
  })
})
