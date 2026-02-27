/**
 * storage.test.ts — Unit tests for upload size-limit guards.
 *
 * These tests verify that uploadCsv and uploadAssetBytes reject payloads
 * that exceed MAX_UPLOAD_BYTES before touching Supabase.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadCsv, uploadAssetBytes, MAX_UPLOAD_BYTES } from './storage'

// ── Supabase mock ─────────────────────────────────────────────────────────────

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ── uploadCsv size guard ──────────────────────────────────────────────────────

describe('uploadCsv size guard', () => {
  it('rejects a file that exceeds MAX_UPLOAD_BYTES', async () => {
    const oversized = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.csv', {
      type: 'text/csv',
    })
    await expect(uploadCsv('proj-1', oversized)).rejects.toThrow('File is too large')
  })

  it('includes human-readable size info in the error message', async () => {
    const oversized = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.csv', {
      type: 'text/csv',
    })
    await expect(uploadCsv('proj-1', oversized)).rejects.toThrow('50 MB')
  })

  it('accepts a file exactly at MAX_UPLOAD_BYTES', async () => {
    const { supabase } = await import('./supabase')
    const exactSize = new File([new Uint8Array(MAX_UPLOAD_BYTES)], 'exact.csv', {
      type: 'text/csv',
    })
    // Should not throw — supabase mock returns success
    await expect(uploadCsv('proj-1', exactSize)).resolves.toMatchObject({
      storage_key: expect.any(String),
    })
    expect(supabase.storage.from).toHaveBeenCalledWith('uploads')
  })
})

// ── uploadAssetBytes size guard ───────────────────────────────────────────────

describe('uploadAssetBytes size guard', () => {
  it('rejects bytes that exceed MAX_UPLOAD_BYTES', async () => {
    const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1)
    await expect(
      uploadAssetBytes('proj-1', 'asset.png', 'image/png', oversized, null, 'image'),
    ).rejects.toThrow('Asset is too large')
  })

  it('includes human-readable size info in the error message', async () => {
    const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1)
    await expect(
      uploadAssetBytes('proj-1', 'asset.png', 'image/png', oversized, null, 'image'),
    ).rejects.toThrow('50 MB')
  })

  it('accepts bytes exactly at MAX_UPLOAD_BYTES', async () => {
    const { supabase } = await import('./supabase')
    const exactSize = new Uint8Array(MAX_UPLOAD_BYTES)
    await expect(
      uploadAssetBytes('proj-1', 'asset.png', 'image/png', exactSize, null, 'image'),
    ).resolves.toMatchObject({ storage_key: expect.any(String) })
    expect(supabase.storage.from).toHaveBeenCalledWith('uploads')
  })
})
