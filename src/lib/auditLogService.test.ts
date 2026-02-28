/**
 * auditLogService.test.ts — P126 + P128: audit log service unit tests.
 *
 * Covers:
 *  - appendAuditEvent: insert shape, metadata redaction (P128), best-effort swallowing
 *  - getAuditLog: query building, pagination cursor, error propagation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { appendAuditEvent, getAuditLog } from './auditLogService'

// ── Supabase mock ─────────────────────────────────────────────────────────────

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

let supabaseMock: { from: ReturnType<typeof vi.fn> }

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('./supabase')
  supabaseMock = mod.supabase as unknown as typeof supabaseMock
})

// ── appendAuditEvent ──────────────────────────────────────────────────────────

describe('appendAuditEvent', () => {
  it('inserts a well-shaped row', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsert })

    await appendAuditEvent({
      userId: 'uid-1',
      orgId: 'org-1',
      eventType: 'project.create',
      objectType: 'project',
      objectId: 'proj-1',
      metadata: { name: 'My project' },
    })

    expect(supabaseMock.from).toHaveBeenCalledWith('audit_log')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'uid-1',
        org_id: 'org-1',
        event_type: 'project.create',
        object_type: 'project',
        object_id: 'proj-1',
      }),
    )
  })

  it('uses null for omitted userId / orgId', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsert })

    await appendAuditEvent({
      eventType: 'auth.login',
      objectType: 'session',
      objectId: 'sess-1',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, org_id: null }),
    )
  })

  it('is best-effort: does not throw when supabase errors', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: { message: 'rls denied' } })
    supabaseMock.from.mockReturnValue({ insert: mockInsert })

    // Must not throw
    await expect(
      appendAuditEvent({
        eventType: 'org.create',
        objectType: 'org',
        objectId: 'org-2',
      }),
    ).resolves.toBeUndefined()
  })

  it('is best-effort: does not throw on network exception', async () => {
    supabaseMock.from.mockImplementation(() => {
      throw new Error('network error')
    })

    await expect(
      appendAuditEvent({
        eventType: 'canvas.delete',
        objectType: 'canvas',
        objectId: 'canvas-1',
      }),
    ).resolves.toBeUndefined()
  })

  // ── P128 redaction tests ──────────────────────────────────────────────────

  it('P128: redacts secret-keyed metadata fields before insert', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsert })

    await appendAuditEvent({
      eventType: 'auth.login',
      objectType: 'session',
      objectId: 'sess-1',
      metadata: {
        token: 'super-secret-jwt',
        password: 'hunter2',
        name: 'safe value',
      },
    })

    const insertedMetadata = (mockInsert.mock.calls[0][0] as { metadata: Record<string, unknown> })
      .metadata

    expect(insertedMetadata.token).toBe('[REDACTED]')
    expect(insertedMetadata.password).toBe('[REDACTED]')
    expect(insertedMetadata.name).toBe('safe value')
  })

  it('P128: redacts JWT token strings in metadata values', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsert })

    const fakeJwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

    await appendAuditEvent({
      eventType: 'project.create',
      objectType: 'project',
      objectId: 'proj-1',
      metadata: { description: `Created with token ${fakeJwt}` },
    })

    const insertedMetadata = (mockInsert.mock.calls[0][0] as { metadata: Record<string, unknown> })
      .metadata

    expect(String(insertedMetadata.description)).not.toContain(fakeJwt)
    expect(String(insertedMetadata.description)).toContain('[TOKEN]')
  })

  it('P128: redacts email addresses in metadata values', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsert })

    await appendAuditEvent({
      eventType: 'org.member.invite',
      objectType: 'org_member',
      objectId: 'mem-1',
      metadata: { invitedEmail: 'alice@example.com', note: 'no pii here' },
    })

    const insertedMetadata = (mockInsert.mock.calls[0][0] as { metadata: Record<string, unknown> })
      .metadata

    expect(String(insertedMetadata.invitedEmail)).not.toContain('alice@example.com')
    expect(String(insertedMetadata.invitedEmail)).toContain('[EMAIL]')
    expect(insertedMetadata.note).toBe('no pii here')
  })

  it('P128: passes empty metadata as-is without error', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsert })

    await appendAuditEvent({
      eventType: 'canvas.create',
      objectType: 'canvas',
      objectId: 'c-1',
    })

    const insertedMetadata = (mockInsert.mock.calls[0][0] as { metadata: Record<string, unknown> })
      .metadata

    expect(insertedMetadata).toEqual({})
  })
})

// ── getAuditLog ───────────────────────────────────────────────────────────────

describe('getAuditLog', () => {
  function makeQueryMock(rows: unknown[]) {
    const mockLimit = vi.fn().mockResolvedValue({ data: rows, error: null })
    const mockLt = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEqOrgId = vi.fn().mockReturnValue({ limit: mockLimit, lt: mockLt })
    const mockEqUserId = vi.fn().mockReturnValue({ eq: mockEqOrgId, limit: mockLimit, lt: mockLt })
    const mockOrder = vi.fn().mockReturnValue({
      limit: mockLimit,
      lt: mockLt,
      eq: mockEqUserId,
    })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    supabaseMock.from.mockReturnValue({ select: mockSelect })
    return { mockLimit, mockSelect, mockOrder }
  }

  it('returns entries and null nextCursor when no more pages', async () => {
    const ENTRIES = [
      { id: 'e1', event_type: 'project.create', created_at: '2025-01-02T00:00:00Z' },
      { id: 'e2', event_type: 'auth.login', created_at: '2025-01-01T00:00:00Z' },
    ]
    makeQueryMock(ENTRIES)

    const page = await getAuditLog({ limit: 10 })
    expect(page.entries).toHaveLength(2)
    expect(page.nextCursor).toBeNull()
  })

  it('returns nextCursor when there are more pages', async () => {
    // Request limit=2 but return 3 rows (limit+1) to signal more pages
    const ENTRIES = Array.from({ length: 3 }, (_, i) => ({
      id: `e${String(i)}`,
      event_type: 'auth.login',
      created_at: `2025-01-0${String(3 - i)}T00:00:00Z`,
    }))
    makeQueryMock(ENTRIES)

    const page = await getAuditLog({ limit: 2 })
    expect(page.entries).toHaveLength(2)
    expect(page.nextCursor).toBe('2025-01-02T00:00:00Z')
  })

  it('caps limit at 200', async () => {
    const { mockLimit } = makeQueryMock([])
    await getAuditLog({ limit: 9999 })
    // limit(201) is called (200 + 1 for next-page detection)
    expect(mockLimit).toHaveBeenCalledWith(201)
  })

  it('throws on supabase error', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: { message: 'rls' } })
    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ limit: mockLimit }),
      }),
    })
    await expect(getAuditLog()).rejects.toMatchObject({ message: 'rls' })
  })
})
