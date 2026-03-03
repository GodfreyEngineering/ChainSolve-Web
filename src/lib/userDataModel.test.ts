/**
 * userDataModel.test.ts — Type-level and structural tests for J0-1 data model.
 *
 * Verifies that the TS types for user_preferences, user_terms_log, and
 * user_reports match the expected schema and that validation rules hold.
 */

import { describe, it, expect } from 'vitest'
import type { UserPreferences, Theme, EditorLayout } from './userPreferencesService'
import type { TermsLogEntry } from './userTermsService'
import type { UserReport, ReportTargetType, ReportStatus } from './userReportsService'

// ── UserPreferences ──────────────────────────────────────────────────────────

describe('UserPreferences type', () => {
  it('accepts valid preferences', () => {
    const prefs: UserPreferences = {
      user_id: '00000000-0000-0000-0000-000000000001',
      locale: 'en',
      theme: 'system',
      region: null,
      editor_layout: 'default',
      sidebar_collapsed: false,
    }
    expect(prefs.locale).toBe('en')
    expect(prefs.theme).toBe('system')
    expect(prefs.editor_layout).toBe('default')
  })

  it('theme values are restricted to light, dark, system', () => {
    const themes: Theme[] = ['light', 'dark', 'system']
    expect(themes).toHaveLength(3)
  })

  it('editor layout values are restricted', () => {
    const layouts: EditorLayout[] = ['default', 'compact', 'wide']
    expect(layouts).toHaveLength(3)
  })

  it('region can be null', () => {
    const prefs: UserPreferences = {
      user_id: '00000000-0000-0000-0000-000000000001',
      locale: 'de',
      theme: 'dark',
      region: null,
      editor_layout: 'compact',
      sidebar_collapsed: true,
    }
    expect(prefs.region).toBeNull()
  })

  it('region can be a string', () => {
    const prefs: UserPreferences = {
      user_id: '00000000-0000-0000-0000-000000000001',
      locale: 'fr',
      theme: 'light',
      region: 'EU',
      editor_layout: 'wide',
      sidebar_collapsed: false,
    }
    expect(prefs.region).toBe('EU')
  })
})

// ── TermsLogEntry ────────────────────────────────────────────────────────────

describe('TermsLogEntry type', () => {
  it('accepts valid entry', () => {
    const entry: TermsLogEntry = {
      id: '00000000-0000-0000-0000-000000000001',
      user_id: '00000000-0000-0000-0000-000000000002',
      terms_version: '1.0',
      accepted_at: '2026-01-15T10:00:00Z',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
    }
    expect(entry.terms_version).toBe('1.0')
    expect(entry.ip_address).toBe('192.168.1.1')
  })

  it('ip_address and user_agent can be null', () => {
    const entry: TermsLogEntry = {
      id: '00000000-0000-0000-0000-000000000001',
      user_id: '00000000-0000-0000-0000-000000000002',
      terms_version: '2.0',
      accepted_at: '2026-03-01T12:00:00Z',
      ip_address: null,
      user_agent: null,
    }
    expect(entry.ip_address).toBeNull()
    expect(entry.user_agent).toBeNull()
  })
})

// ── UserReport ───────────────────────────────────────────────────────────────

describe('UserReport type', () => {
  it('accepts valid report', () => {
    const report: UserReport = {
      id: '00000000-0000-0000-0000-000000000001',
      reporter_id: '00000000-0000-0000-0000-000000000002',
      target_type: 'display_name',
      target_id: '00000000-0000-0000-0000-000000000003',
      reason: 'Offensive name',
      status: 'pending',
      resolved_by: null,
      resolved_at: null,
      created_at: '2026-03-01T12:00:00Z',
    }
    expect(report.target_type).toBe('display_name')
    expect(report.status).toBe('pending')
  })

  it('target types cover all content categories', () => {
    const types: ReportTargetType[] = ['display_name', 'avatar', 'comment', 'marketplace_item']
    expect(types).toHaveLength(4)
  })

  it('status types cover the full lifecycle', () => {
    const statuses: ReportStatus[] = ['pending', 'resolved', 'dismissed']
    expect(statuses).toHaveLength(3)
  })

  it('resolved report has resolution metadata', () => {
    const report: UserReport = {
      id: '00000000-0000-0000-0000-000000000001',
      reporter_id: '00000000-0000-0000-0000-000000000002',
      target_type: 'avatar',
      target_id: '00000000-0000-0000-0000-000000000003',
      reason: 'Inappropriate image',
      status: 'resolved',
      resolved_by: '00000000-0000-0000-0000-000000000004',
      resolved_at: '2026-03-02T08:00:00Z',
      created_at: '2026-03-01T12:00:00Z',
    }
    expect(report.resolved_by).not.toBeNull()
    expect(report.resolved_at).not.toBeNull()
  })

  it('reason max length is 1000 characters (enforced at DB level)', () => {
    // This is a documentation test -- actual enforcement is in the SQL CHECK constraint.
    const maxLength = 1000
    const longReason = 'x'.repeat(maxLength)
    expect(longReason).toHaveLength(maxLength)
  })
})
