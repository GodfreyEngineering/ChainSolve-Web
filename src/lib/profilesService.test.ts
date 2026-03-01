/**
 * profilesService.test.ts — Unit tests for profile display-name and avatar helpers.
 *
 * Supabase is mocked; we verify validation logic and that the correct
 * Supabase calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock (hoisted so vi.mock factory can reference them) ─────────────

const { mockUpload, mockCreateSignedUrl, mockUpdate, mockUpdateEq } = vi.hoisted(() => ({
  mockUpload: vi.fn().mockResolvedValue({ error: null }),
  mockCreateSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://storage.example.com/signed' },
    error: null,
  }),
  mockUpdate: vi.fn(),
  mockUpdateEq: vi.fn().mockReturnValue({ error: null }),
}))

vi.mock('./supabase', () => {
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-42' } },
        }),
      },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          createSignedUrl: mockCreateSignedUrl,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: mockUpdate,
      }),
    },
  }
})

import { updateDisplayName, uploadAvatar, getAvatarUrl } from './profilesService'

beforeEach(() => {
  vi.clearAllMocks()
  // Re-set defaults after clearAllMocks
  mockUpdateEq.mockReturnValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  mockUpload.mockResolvedValue({ error: null })
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.example.com/signed' },
    error: null,
  })
})

// ── updateDisplayName ─────────────────────────────────────────────────────────

describe('updateDisplayName', () => {
  it('trims whitespace before saving', async () => {
    await updateDisplayName('  Alice  ')
    expect(mockUpdate).toHaveBeenCalledWith({ full_name: 'Alice' })
  })

  it('saves null when the trimmed name is empty', async () => {
    await updateDisplayName('   ')
    expect(mockUpdate).toHaveBeenCalledWith({ full_name: null })
  })

  it('rejects names longer than 100 characters', async () => {
    const longName = 'x'.repeat(101)
    await expect(updateDisplayName(longName)).rejects.toThrow('100 characters')
  })

  it('accepts a name exactly 100 characters', async () => {
    const name = 'a'.repeat(100)
    await expect(updateDisplayName(name)).resolves.toBeUndefined()
  })
})

// ── uploadAvatar ──────────────────────────────────────────────────────────────

describe('uploadAvatar', () => {
  it('rejects non-image files', async () => {
    const textFile = new File(['hello'], 'readme.txt', { type: 'text/plain' })
    await expect(uploadAvatar(textFile)).rejects.toThrow('image')
  })

  it('rejects files larger than 2 MB', async () => {
    const oversized = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    })
    await expect(uploadAvatar(oversized)).rejects.toThrow('2 MB')
  })

  it('accepts a valid image file and returns a storage path', async () => {
    const img = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' })
    const path = await uploadAvatar(img)
    expect(path).toMatch(/^user-42\/avatar_\d+\.jpg$/)
  })

  it('uploads to the uploads bucket with upsert', async () => {
    const { supabase } = await import('./supabase')
    const img = new File([new Uint8Array(100)], 'photo.png', { type: 'image/png' })
    await uploadAvatar(img)
    expect(supabase.storage.from).toHaveBeenCalledWith('uploads')
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-42\/avatar_\d+\.png$/),
      img,
      expect.objectContaining({ upsert: true, contentType: 'image/png' }),
    )
  })
})

// ── getAvatarUrl ──────────────────────────────────────────────────────────────

describe('getAvatarUrl', () => {
  it('returns the signed URL on success', async () => {
    const url = await getAvatarUrl('user-42/avatar_123.jpg')
    expect(url).toBe('https://storage.example.com/signed')
  })

  it('returns null when createSignedUrl fails', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: new Error('fail') })
    const url = await getAvatarUrl('user-42/avatar_123.jpg')
    expect(url).toBeNull()
  })

  it('requests a 1-hour expiry', async () => {
    await getAvatarUrl('user-42/avatar_123.jpg')
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-42/avatar_123.jpg', 3600)
  })
})
