/**
 * orgsService.test.ts — P124 organizations service unit tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createOrg,
  listMyOrgs,
  listOrgMembers,
  inviteOrgMember,
  updateMemberRole,
  removeOrgMember,
  renameOrg,
  deleteOrg,
  getOrgPolicy,
  updateOrgPolicy,
  getOrgSeatUsage,
} from './orgsService'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockOrder = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()

function makeQb(finalResult: { data: unknown; error: unknown }) {
  const qb: Record<string, unknown> = {
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    order: mockOrder,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  }
  mockSelect.mockReturnValue(qb)
  mockEq.mockReturnValue(qb)
  mockIn.mockReturnValue(qb)
  mockOrder.mockResolvedValue(finalResult)
  mockInsert.mockReturnValue(qb)
  mockUpdate.mockReturnValue(qb)
  mockDelete.mockResolvedValue(finalResult)
  mockSingle.mockResolvedValue(finalResult)
  mockMaybeSingle.mockResolvedValue(finalResult)
  return qb
}

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'uid-1' } } }),
    },
    from: vi.fn(),
  },
}))

let supabaseMock: { from: ReturnType<typeof vi.fn>; auth: unknown }

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('./supabase')
  supabaseMock = mod.supabase as unknown as typeof supabaseMock
  ;(supabaseMock.auth as { getUser: ReturnType<typeof vi.fn> }).getUser.mockResolvedValue({
    data: { user: { id: 'uid-1' } },
  })
})

// ── createOrg ─────────────────────────────────────────────────────────────────

describe('createOrg', () => {
  const MOCK_ORG = {
    id: 'org-1',
    name: 'ACME Corp',
    owner_id: 'uid-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  }

  it('throws when not authenticated', async () => {
    ;(supabaseMock.auth as { getUser: ReturnType<typeof vi.fn> }).getUser.mockResolvedValueOnce({
      data: { user: null },
    })
    await expect(createOrg('ACME')).rejects.toThrow('Sign in')
  })

  it('throws when name is empty', async () => {
    await expect(createOrg('   ')).rejects.toThrow('required')
  })

  it('throws when name exceeds 80 chars', async () => {
    await expect(createOrg('A'.repeat(81))).rejects.toThrow('80 characters')
  })

  it('inserts org and returns it', async () => {
    makeQb({ data: MOCK_ORG, error: null })
    // Second from() call is for org_members insert
    supabaseMock.from
      .mockReturnValueOnce({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      })
      .mockReturnValue({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) })

    const org = await createOrg('ACME Corp')
    expect(org.name).toBe('ACME Corp')
    expect(org.owner_id).toBe('uid-1')
  })

  it('throws on supabase error', async () => {
    makeQb({ data: null, error: { message: 'constraint violation' } })
    supabaseMock.from.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    })
    await expect(createOrg('ACME')).rejects.toMatchObject({ message: 'constraint violation' })
  })
})

// ── listMyOrgs ────────────────────────────────────────────────────────────────

describe('listMyOrgs', () => {
  it('returns [] when not authenticated', async () => {
    ;(supabaseMock.auth as { getUser: ReturnType<typeof vi.fn> }).getUser.mockResolvedValueOnce({
      data: { user: null },
    })
    expect(await listMyOrgs()).toEqual([])
  })

  it('returns [] when user has no memberships', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: [], error: null })
    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockEqFn }),
    })
    expect(await listMyOrgs()).toEqual([])
  })

  it('returns orgs for member', async () => {
    const MOCK_ORGS = [
      {
        id: 'org-1',
        name: 'ACME',
        owner_id: 'uid-1',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ]
    // First from(): org_members SELECT eq
    const mockEqFn = vi.fn().mockResolvedValue({ data: [{ org_id: 'org-1' }], error: null })
    // Second from(): organizations SELECT in order
    const mockOrderFn = vi.fn().mockResolvedValue({ data: MOCK_ORGS, error: null })
    const mockInFn = vi.fn().mockReturnValue({ order: mockOrderFn })
    supabaseMock.from
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: mockEqFn }) })
      .mockReturnValue({ select: vi.fn().mockReturnValue({ in: mockInFn }) })

    const orgs = await listMyOrgs()
    expect(orgs).toHaveLength(1)
    expect(orgs[0].name).toBe('ACME')
  })

  it('throws on supabase error', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockEqFn }),
    })
    await expect(listMyOrgs()).rejects.toMatchObject({ message: 'db error' })
  })
})

// ── listOrgMembers ────────────────────────────────────────────────────────────

describe('listOrgMembers', () => {
  it('returns members list', async () => {
    const MEMBERS = [
      { id: 'm1', org_id: 'org-1', user_id: 'uid-1', role: 'owner', invited_by: null },
    ]
    const mockOrderFn = vi.fn().mockResolvedValue({ data: MEMBERS, error: null })
    const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn })
    supabaseMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEqFn }) })

    const members = await listOrgMembers('org-1')
    expect(members).toHaveLength(1)
    expect(members[0].role).toBe('owner')
  })

  it('throws on supabase error', async () => {
    const mockOrderFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'rls denied' } })
    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: mockOrderFn }) }),
    })
    await expect(listOrgMembers('org-1')).rejects.toMatchObject({ message: 'rls denied' })
  })
})

// ── inviteOrgMember ───────────────────────────────────────────────────────────

describe('inviteOrgMember', () => {
  it('throws when not authenticated', async () => {
    ;(supabaseMock.auth as { getUser: ReturnType<typeof vi.fn> }).getUser.mockResolvedValueOnce({
      data: { user: null },
    })
    await expect(inviteOrgMember('org-1', 'uid-2')).rejects.toThrow('Sign in')
  })

  it('inserts member row and returns it', async () => {
    const MEMBER = {
      id: 'm2',
      org_id: 'org-1',
      user_id: 'uid-2',
      role: 'member',
      invited_by: 'uid-1',
    }
    // D10-3: first two from() calls are for getOrgSeatUsage
    const mockMaybeSingleFn = vi.fn().mockResolvedValue({ data: { max_seats: 10 }, error: null })
    const mockSeatEq1 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleFn })
    const mockSeatSelect1 = vi.fn().mockReturnValue({ eq: mockSeatEq1 })
    const mockSeatEq2 = vi.fn().mockResolvedValue({ count: 1, error: null })
    const mockSeatSelect2 = vi.fn().mockReturnValue({ eq: mockSeatEq2 })

    const mockSingleFn = vi.fn().mockResolvedValue({ data: MEMBER, error: null })
    supabaseMock.from
      .mockReturnValueOnce({ select: mockSeatSelect1 }) // org lookup
      .mockReturnValueOnce({ select: mockSeatSelect2 }) // member count
      .mockReturnValueOnce({
        insert: vi
          .fn()
          .mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingleFn }) }),
      })

    const member = await inviteOrgMember('org-1', 'uid-2')
    expect(member.user_id).toBe('uid-2')
    expect(member.role).toBe('member')
  })
})

// ── updateMemberRole ──────────────────────────────────────────────────────────

describe('updateMemberRole', () => {
  it('calls update with role and eq on id', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })
    supabaseMock.from.mockReturnValue({ update: mockUpdateFn })

    await updateMemberRole('m1', 'admin')
    expect(mockUpdateFn).toHaveBeenCalledWith({ role: 'admin' })
    expect(mockEqFn).toHaveBeenCalledWith('id', 'm1')
  })

  it('throws on supabase error', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'rls' } })
    supabaseMock.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockEqFn }) })
    await expect(updateMemberRole('m1', 'admin')).rejects.toMatchObject({ message: 'rls' })
  })
})

// ── removeOrgMember ───────────────────────────────────────────────────────────

describe('removeOrgMember', () => {
  it('calls delete with eq on id', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEqFn }) })

    await removeOrgMember('m1')
    expect(mockEqFn).toHaveBeenCalledWith('id', 'm1')
  })

  it('throws on supabase error', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'not allowed' } })
    supabaseMock.from.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEqFn }) })
    await expect(removeOrgMember('m1')).rejects.toMatchObject({ message: 'not allowed' })
  })
})

// ── renameOrg ─────────────────────────────────────────────────────────────────

describe('renameOrg', () => {
  it('throws when name is empty', async () => {
    await expect(renameOrg('org-1', '   ')).rejects.toThrow('required')
  })

  it('throws when name exceeds 80 chars', async () => {
    await expect(renameOrg('org-1', 'A'.repeat(81))).rejects.toThrow('80 characters')
  })

  it('calls update with name and updated_at', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })
    supabaseMock.from.mockReturnValue({ update: mockUpdateFn })

    await renameOrg('org-1', 'New Name')
    expect(mockUpdateFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }))
    expect(mockEqFn).toHaveBeenCalledWith('id', 'org-1')
  })
})

// ── deleteOrg ─────────────────────────────────────────────────────────────────

describe('deleteOrg', () => {
  it('calls delete with eq on id', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEqFn }) })

    await deleteOrg('org-1')
    expect(mockEqFn).toHaveBeenCalledWith('id', 'org-1')
  })

  it('throws on supabase error', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'not owner' } })
    supabaseMock.from.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEqFn }) })
    await expect(deleteOrg('org-1')).rejects.toMatchObject({ message: 'not owner' })
  })
})

// ── getOrgPolicy (D10-2) ─────────────────────────────────────────────────────

describe('getOrgPolicy', () => {
  it('returns policy flags for org', async () => {
    const policy = {
      policy_explore_enabled: true,
      policy_installs_allowed: false,
      policy_comments_allowed: true,
    }
    makeQb({ data: policy, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await getOrgPolicy('org-1')
    expect(result).toEqual(policy)
    expect(supabaseMock.from).toHaveBeenCalledWith('organizations')
  })

  it('throws when org not found', async () => {
    makeQb({ data: null, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    await expect(getOrgPolicy('missing')).rejects.toThrow('not found')
  })

  it('throws on supabase error', async () => {
    makeQb({ data: null, error: { message: 'RLS denied' } })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    await expect(getOrgPolicy('org-1')).rejects.toMatchObject({ message: 'RLS denied' })
  })
})

// ── updateOrgPolicy (D10-2) ──────────────────────────────────────────────────

describe('updateOrgPolicy', () => {
  it('calls update with policy flags', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })
    supabaseMock.from.mockReturnValue({ update: mockUpdateFn })

    await updateOrgPolicy('org-1', { policy_explore_enabled: false })
    expect(supabaseMock.from).toHaveBeenCalledWith('organizations')
    expect(mockUpdateFn).toHaveBeenCalledWith({ policy_explore_enabled: false })
    expect(mockEqFn).toHaveBeenCalledWith('id', 'org-1')
  })

  it('throws on supabase error', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'not owner' } })
    supabaseMock.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockEqFn }) })

    await expect(
      updateOrgPolicy('org-1', { policy_comments_allowed: false }),
    ).rejects.toMatchObject({ message: 'not owner' })
  })
})

// ── getOrgSeatUsage (D10-3) ──────────────────────────────────────────────────

describe('getOrgSeatUsage', () => {
  it('returns used count and max seats', async () => {
    // First call: organizations select max_seats
    const mockMaybeSingleFn = vi.fn().mockResolvedValue({ data: { max_seats: 10 }, error: null })
    const mockEqFn1 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleFn })
    const mockSelectFn1 = vi.fn().mockReturnValue({ eq: mockEqFn1 })

    // Second call: org_members count
    const mockEqFn2 = vi.fn().mockResolvedValue({ count: 4, error: null })
    const mockSelectFn2 = vi.fn().mockReturnValue({ eq: mockEqFn2 })

    supabaseMock.from
      .mockReturnValueOnce({ select: mockSelectFn1 })
      .mockReturnValueOnce({ select: mockSelectFn2 })

    const usage = await getOrgSeatUsage('org-1')
    expect(usage).toEqual({ used: 4, max: 10 })
  })

  it('returns max=null for unlimited orgs', async () => {
    const mockMaybeSingleFn = vi.fn().mockResolvedValue({ data: { max_seats: null }, error: null })
    const mockEqFn1 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleFn })
    const mockSelectFn1 = vi.fn().mockReturnValue({ eq: mockEqFn1 })

    const mockEqFn2 = vi.fn().mockResolvedValue({ count: 50, error: null })
    const mockSelectFn2 = vi.fn().mockReturnValue({ eq: mockEqFn2 })

    supabaseMock.from
      .mockReturnValueOnce({ select: mockSelectFn1 })
      .mockReturnValueOnce({ select: mockSelectFn2 })

    const usage = await getOrgSeatUsage('org-1')
    expect(usage).toEqual({ used: 50, max: null })
  })

  it('throws when org not found', async () => {
    const mockMaybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEqFn1 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleFn })
    supabaseMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEqFn1 }) })

    await expect(getOrgSeatUsage('missing')).rejects.toThrow('not found')
  })
})

// ── inviteOrgMember seat limit (D10-3) ───────────────────────────────────────

describe('inviteOrgMember (D10-3 seat limit)', () => {
  it('throws when seat limit reached', async () => {
    // getOrgSeatUsage: org lookup then member count
    const mockMaybeSingleFn = vi.fn().mockResolvedValue({ data: { max_seats: 2 }, error: null })
    const mockEqFn1 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleFn })
    const mockSelectFn1 = vi.fn().mockReturnValue({ eq: mockEqFn1 })

    const mockEqFn2 = vi.fn().mockResolvedValue({ count: 2, error: null })
    const mockSelectFn2 = vi.fn().mockReturnValue({ eq: mockEqFn2 })

    supabaseMock.from
      .mockReturnValueOnce({ select: mockSelectFn1 })
      .mockReturnValueOnce({ select: mockSelectFn2 })

    await expect(inviteOrgMember('org-1', 'uid-2')).rejects.toThrow('Seat limit')
  })

  it('allows invite when max_seats is null (unlimited)', async () => {
    // getOrgSeatUsage: org lookup then member count
    const mockMaybeSingleFn = vi.fn().mockResolvedValue({ data: { max_seats: null }, error: null })
    const mockEqFn1 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleFn })
    const mockSelectFn1 = vi.fn().mockReturnValue({ eq: mockEqFn1 })

    const mockEqFn2 = vi.fn().mockResolvedValue({ count: 100, error: null })
    const mockSelectFn2 = vi.fn().mockReturnValue({ eq: mockEqFn2 })

    // inviteOrgMember insert
    const MEMBER = { id: 'm2', org_id: 'org-1', user_id: 'uid-2', role: 'member' }
    const mockSingleFn = vi.fn().mockResolvedValue({ data: MEMBER, error: null })
    const mockInsertResult = {
      select: vi.fn().mockReturnValue({ single: mockSingleFn }),
    }

    supabaseMock.from
      .mockReturnValueOnce({ select: mockSelectFn1 }) // org lookup
      .mockReturnValueOnce({ select: mockSelectFn2 }) // member count
      .mockReturnValueOnce({ insert: vi.fn().mockReturnValue(mockInsertResult) }) // insert

    const member = await inviteOrgMember('org-1', 'uid-2')
    expect(member.user_id).toBe('uid-2')
  })
})
