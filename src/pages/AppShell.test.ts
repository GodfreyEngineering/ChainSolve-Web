/**
 * AppShell.test.ts — Structural regression tests for the AppShell page.
 *
 * V2-005: Ensures AppShell uses the canonical Profile type from
 * profilesService (which includes is_developer, is_admin, is_student),
 * preventing resolveEffectivePlan from silently ignoring developer flags.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appShellSrc = readFileSync(resolve(__dirname, 'AppShell.tsx'), 'utf-8')

describe('V2-005: AppShell Profile type correctness', () => {
  it('imports Profile from profilesService, not a local interface', () => {
    // The canonical Profile type includes is_developer, is_admin, is_student.
    // A local interface risks silently omitting these fields, causing
    // resolveEffectivePlan to return the wrong plan for developer accounts.
    expect(appShellSrc).toContain("from '../lib/profilesService'")
    expect(appShellSrc).not.toMatch(/^interface Profile\b/m)
  })

  it('Supabase query fetches is_developer, is_admin, is_student', () => {
    // Even with the correct type, the Supabase .select() must include
    // the developer flag columns for resolveEffectivePlan to work.
    expect(appShellSrc).toContain('is_developer')
    expect(appShellSrc).toContain('is_admin')
    expect(appShellSrc).toContain('is_student')
  })
})
