import { describe, it, expect } from 'vitest'
import { computeSaveStatusLabel } from './saveStatusLabel'

// Minimal stub: maps the keys used by computeSaveStatusLabel to their EN templates
const I18N_STUBS: Record<string, string> = {
  'canvas.saving': 'Saving…',
  'canvas.saved': 'Saved',
  'canvas.conflict': 'Conflict',
  'canvas.error': 'Error',
  'canvas.offlineQueued': 'Queued — offline',
  'canvas.unsaved': 'Unsaved',
  'canvas.lastSaved': 'Last saved: {{time}} · {{target}}',
}

function t(key: string, opts?: Record<string, string>): string {
  const template = I18N_STUBS[key] ?? key
  if (!opts) return template
  return Object.entries(opts).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), template)
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const SAVED_AT = new Date('2025-06-01T10:30:00Z')
const PROJECT_ID = 'p-1'
const PROJECT_NAME = 'My Project'

describe('computeSaveStatusLabel — no project', () => {
  it('returns null when projectId is undefined', () => {
    expect(computeSaveStatusLabel('idle', null, false, undefined, '', fmtTime, t)).toBeNull()
  })
})

describe('computeSaveStatusLabel — idle', () => {
  it('returns null when idle and not dirty', () => {
    expect(
      computeSaveStatusLabel('idle', null, false, PROJECT_ID, PROJECT_NAME, fmtTime, t),
    ).toBeNull()
  })

  it('returns unsaved badge when idle and dirty', () => {
    const label = computeSaveStatusLabel('idle', null, true, PROJECT_ID, PROJECT_NAME, fmtTime, t)
    expect(label).not.toBeNull()
    expect(label!.text).toBe('Unsaved')
    expect(label!.clickable).toBeUndefined()
  })
})

describe('computeSaveStatusLabel — saving', () => {
  it('returns saving badge', () => {
    const label = computeSaveStatusLabel(
      'saving',
      null,
      false,
      PROJECT_ID,
      PROJECT_NAME,
      fmtTime,
      t,
    )
    expect(label!.text).toBe('Saving…')
    expect(label!.color).toBe('rgba(244,244,243,0.45)')
    expect(label!.clickable).toBeUndefined()
  })
})

describe('computeSaveStatusLabel — saved', () => {
  it('includes time in badge text', () => {
    const label = computeSaveStatusLabel(
      'saved',
      SAVED_AT,
      false,
      PROJECT_ID,
      PROJECT_NAME,
      fmtTime,
      t,
    )
    expect(label!.text).toContain('Saved')
    expect(label!.text).toContain(fmtTime(SAVED_AT))
    expect(label!.color).toBe('#22c55e')
  })

  it('includes timestamp and project name in tooltip', () => {
    const label = computeSaveStatusLabel(
      'saved',
      SAVED_AT,
      false,
      PROJECT_ID,
      PROJECT_NAME,
      fmtTime,
      t,
    )
    expect(label!.tooltip).toContain(fmtTime(SAVED_AT))
    expect(label!.tooltip).toContain(PROJECT_NAME)
  })

  it('has no tooltip when lastSavedAt is null', () => {
    const label = computeSaveStatusLabel('saved', null, false, PROJECT_ID, PROJECT_NAME, fmtTime, t)
    expect(label!.tooltip).toBeUndefined()
  })
})

describe('computeSaveStatusLabel — conflict', () => {
  it('returns amber conflict badge', () => {
    const label = computeSaveStatusLabel(
      'conflict',
      null,
      false,
      PROJECT_ID,
      PROJECT_NAME,
      fmtTime,
      t,
    )
    expect(label!.text).toContain('Conflict')
    expect(label!.color).toBe('#f59e0b')
    expect(label!.clickable).toBeUndefined()
  })
})

describe('computeSaveStatusLabel — error', () => {
  it('returns red clickable error badge', () => {
    const label = computeSaveStatusLabel('error', null, false, PROJECT_ID, PROJECT_NAME, fmtTime, t)
    expect(label!.text).toContain('Error')
    expect(label!.color).toBe('#ef4444')
    expect(label!.clickable).toBe(true)
  })
})

describe('computeSaveStatusLabel — offline-queued', () => {
  it('returns amber clickable offline-queued badge', () => {
    const label = computeSaveStatusLabel(
      'offline-queued',
      null,
      false,
      PROJECT_ID,
      PROJECT_NAME,
      fmtTime,
      t,
    )
    expect(label!.text).toContain('Queued')
    expect(label!.color).toBe('#f59e0b')
    expect(label!.clickable).toBe(true)
  })
})
