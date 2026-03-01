import { describe, it, expect, beforeEach } from 'vitest'
import { getBlockedUsers, isUserBlocked, blockUser, unblockUser } from './blockedUsers'

describe('blockedUsers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty set when no users blocked', () => {
    expect(getBlockedUsers().size).toBe(0)
  })

  it('blockUser adds a user', () => {
    const result = blockUser('user-1')
    expect(result.has('user-1')).toBe(true)
    expect(isUserBlocked('user-1')).toBe(true)
  })

  it('blockUser is idempotent', () => {
    blockUser('user-1')
    blockUser('user-1')
    expect(getBlockedUsers().size).toBe(1)
  })

  it('unblockUser removes a user', () => {
    blockUser('user-1')
    unblockUser('user-1')
    expect(isUserBlocked('user-1')).toBe(false)
    expect(getBlockedUsers().size).toBe(0)
  })

  it('unblockUser is safe for non-blocked user', () => {
    const result = unblockUser('user-999')
    expect(result.size).toBe(0)
  })

  it('persists across reads', () => {
    blockUser('a')
    blockUser('b')
    // Re-read from storage
    const s = getBlockedUsers()
    expect(s.has('a')).toBe(true)
    expect(s.has('b')).toBe(true)
    expect(s.size).toBe(2)
  })

  it('handles corrupt storage gracefully', () => {
    localStorage.setItem('cs:blockedUsers', 'not json')
    expect(getBlockedUsers().size).toBe(0)
  })

  it('handles non-array storage gracefully', () => {
    localStorage.setItem('cs:blockedUsers', '{"foo": "bar"}')
    expect(getBlockedUsers().size).toBe(0)
  })
})
