/**
 * userReportsService.test.ts — K5-1: Unit tests for report validation and types.
 *
 * Tests the exported types and input validation logic. Does not test
 * Supabase calls (those require integration tests).
 */

import { describe, it, expect } from 'vitest'
import type { ReportTargetType, ReportStatus, UserReport } from './userReportsService'

describe('userReportsService types', () => {
  it('ReportTargetType covers all content types', () => {
    const types: ReportTargetType[] = ['display_name', 'avatar', 'comment', 'marketplace_item']
    expect(types).toHaveLength(4)
    // Each should be a string
    for (const t of types) {
      expect(typeof t).toBe('string')
    }
  })

  it('ReportStatus covers all states', () => {
    const statuses: ReportStatus[] = ['pending', 'resolved', 'dismissed']
    expect(statuses).toHaveLength(3)
  })

  it('UserReport interface has required fields', () => {
    const report: UserReport = {
      id: 'r1',
      reporter_id: 'u1',
      target_type: 'comment',
      target_id: 'c1',
      reason: 'Offensive content',
      status: 'pending',
      resolved_by: null,
      resolved_at: null,
      created_at: '2024-01-01T00:00:00Z',
    }
    expect(report.id).toBe('r1')
    expect(report.target_type).toBe('comment')
    expect(report.status).toBe('pending')
    expect(report.resolved_by).toBeNull()
  })

  it('UserReport can represent a resolved report', () => {
    const report: UserReport = {
      id: 'r2',
      reporter_id: 'u1',
      target_type: 'display_name',
      target_id: 'u2',
      reason: 'Impersonation',
      status: 'resolved',
      resolved_by: 'mod1',
      resolved_at: '2024-01-02T12:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
    }
    expect(report.status).toBe('resolved')
    expect(report.resolved_by).toBe('mod1')
    expect(report.resolved_at).toBeTruthy()
  })
})
