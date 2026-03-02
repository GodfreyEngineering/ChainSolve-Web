/**
 * adminService.test.ts — E3-1: Unit tests for admin service functions.
 *
 * Tests resetLocalCaches (pure localStorage logic).
 * deleteAllUserProjects and adminDeleteProject require Supabase mocks
 * and are covered by integration testing.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { resetLocalCaches } from './adminService'

describe('resetLocalCaches', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clears all known cs: keys', () => {
    localStorage.setItem('cs:prefs', '{}')
    localStorage.setItem('cs:lang', 'en')
    localStorage.setItem('cs:onboarded', '1')
    localStorage.setItem('cs:onboarding-checklist', '{}')
    localStorage.setItem('cs:favs', '[]')
    localStorage.setItem('cs:recent', '[]')
    localStorage.setItem('cs:window-geometry', '{}')
    localStorage.setItem('cs_obs_session_v1', '{}')
    localStorage.setItem('cs_diag', '1')

    const cleared = resetLocalCaches()

    expect(cleared).toBe(9)
    expect(localStorage.getItem('cs:prefs')).toBeNull()
    expect(localStorage.getItem('cs:lang')).toBeNull()
    expect(localStorage.getItem('cs:onboarded')).toBeNull()
    expect(localStorage.getItem('cs:onboarding-checklist')).toBeNull()
    expect(localStorage.getItem('cs:favs')).toBeNull()
    expect(localStorage.getItem('cs:recent')).toBeNull()
    expect(localStorage.getItem('cs:window-geometry')).toBeNull()
    expect(localStorage.getItem('cs_obs_session_v1')).toBeNull()
    expect(localStorage.getItem('cs_diag')).toBeNull()
  })

  it('clears cs:debug.* keys', () => {
    localStorage.setItem('cs:debug.enabled', 'true')
    localStorage.setItem('cs:debug.scopes', '["engine"]')

    const cleared = resetLocalCaches()

    expect(cleared).toBe(2)
    expect(localStorage.getItem('cs:debug.enabled')).toBeNull()
    expect(localStorage.getItem('cs:debug.scopes')).toBeNull()
  })

  it('preserves non-ChainSolve keys', () => {
    localStorage.setItem('other-app-key', 'value')
    localStorage.setItem('cs:prefs', '{}')

    const cleared = resetLocalCaches()

    expect(cleared).toBe(1)
    expect(localStorage.getItem('other-app-key')).toBe('value')
  })

  it('returns 0 when nothing to clear', () => {
    const cleared = resetLocalCaches()
    expect(cleared).toBe(0)
  })
})
