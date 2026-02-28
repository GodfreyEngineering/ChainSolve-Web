/**
 * blockLibraryUtils.test.ts
 *
 * Tests for P068: Favourites + recently-used helpers exported from
 * blockLibraryUtils (getFavourites, toggleFavourite).
 * The recently-used half (getRecentlyUsed / trackBlockUsed) is
 * tested in quickAddPalette.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getFavourites, toggleFavourite } from './blockLibraryUtils'

describe('getFavourites', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty Set when nothing is stored', () => {
    expect(getFavourites().size).toBe(0)
  })

  it('returns a Set containing stored favourites', () => {
    localStorage.setItem('cs:favs', JSON.stringify(['number', 'display']))
    const favs = getFavourites()
    expect(favs.has('number')).toBe(true)
    expect(favs.has('display')).toBe(true)
    expect(favs.size).toBe(2)
  })

  it('survives malformed localStorage gracefully', () => {
    localStorage.setItem('cs:favs', 'not-valid-json')
    expect(() => getFavourites()).not.toThrow()
    expect(getFavourites().size).toBe(0)
  })
})

describe('toggleFavourite', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adds a block to favourites when it is not already there', () => {
    const result = toggleFavourite('number')
    expect(result.has('number')).toBe(true)
  })

  it('removes a block from favourites when it is already there', () => {
    toggleFavourite('number')
    const result = toggleFavourite('number')
    expect(result.has('number')).toBe(false)
  })

  it('persists the new state to localStorage', () => {
    toggleFavourite('display')
    // Fresh call should see the persisted value
    expect(getFavourites().has('display')).toBe(true)
  })

  it('returns the updated set without stale entries', () => {
    toggleFavourite('number')
    toggleFavourite('display')
    toggleFavourite('number') // remove number
    const favs = getFavourites()
    expect(favs.has('number')).toBe(false)
    expect(favs.has('display')).toBe(true)
  })

  it('allows multiple distinct blocks to be favourited', () => {
    toggleFavourite('a')
    toggleFavourite('b')
    toggleFavourite('c')
    const favs = getFavourites()
    expect(favs.size).toBe(3)
  })
})
