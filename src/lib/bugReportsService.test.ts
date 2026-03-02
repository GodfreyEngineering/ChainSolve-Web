/**
 * bugReportsService.test.ts — Unit tests for bug report submission
 * and screenshot upload (H9-2).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockUpload, mockStorageFrom } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpload: vi.fn(),
  mockStorageFrom: vi.fn(),
}))

vi.mock('./supabase', () => {
  mockStorageFrom.mockReturnValue({ upload: mockUpload })
  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
      storage: {
        from: mockStorageFrom,
      },
    },
  }
})

vi.mock('../observability/redact', () => ({
  redactString: (s: string) => `[R]${s}`,
  redactObject: (o: Record<string, unknown>) => o,
}))

import { submitBugReport, uploadBugScreenshot } from './bugReportsService'

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockResolvedValue({ error: null })
  mockUpload.mockResolvedValue({ error: null })
  mockStorageFrom.mockReturnValue({ upload: mockUpload })
})

describe('submitBugReport', () => {
  it('inserts a redacted bug report without screenshot', async () => {
    await submitBugReport({
      userId: 'u1',
      title: 'Crash on save',
      description: 'App crashes when saving',
      metadata: { browser: 'Chrome' },
    })
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'u1',
      title: '[R]Crash on save',
      description: '[R]App crashes when saving',
      metadata: { browser: 'Chrome' },
    })
  })

  it('includes screenshot_path when provided', async () => {
    await submitBugReport({
      userId: 'u1',
      title: 'Bug',
      description: 'Desc',
      metadata: {},
      screenshotPath: 'u1/bug-reports/123_shot.png',
    })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshot_path: 'u1/bug-reports/123_shot.png',
      }),
    )
  })

  it('omits screenshot_path when null', async () => {
    await submitBugReport({
      userId: 'u1',
      title: 'Bug',
      description: 'Desc',
      metadata: {},
      screenshotPath: null,
    })
    const row = mockInsert.mock.calls[0][0]
    expect(row).not.toHaveProperty('screenshot_path')
  })

  it('throws on Supabase error', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'insert fail' } })
    await expect(
      submitBugReport({
        userId: 'u1',
        title: 'Bug',
        description: 'Desc',
        metadata: {},
      }),
    ).rejects.toEqual({ message: 'insert fail' })
  })
})

describe('uploadBugScreenshot', () => {
  it('uploads file to uploads bucket at expected path', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const file = new File(['data'], 'screen shot.png', { type: 'image/png' })
    const path = await uploadBugScreenshot('u1', file)
    expect(path).toBe('u1/bug-reports/1700000000000_screen_shot.png')
    expect(mockUpload).toHaveBeenCalledWith('u1/bug-reports/1700000000000_screen_shot.png', file, {
      contentType: 'image/png',
      upsert: false,
    })
    vi.restoreAllMocks()
  })

  it('throws on storage upload error', async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: 'storage full' } })
    const file = new File(['data'], 'shot.png', { type: 'image/png' })
    await expect(uploadBugScreenshot('u1', file)).rejects.toEqual({
      message: 'storage full',
    })
  })
})
