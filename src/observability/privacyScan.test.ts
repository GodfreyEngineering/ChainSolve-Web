/**
 * privacyScan.test.ts — E9-2: Privacy scanner enforcement.
 *
 * Verifies that all service-layer modules that write user-submitted content
 * to the database import and use the redaction API.
 *
 * This is a static-analysis-style test: it reads source files and checks for
 * the presence of redaction imports. It does NOT test runtime behaviour (that
 * is covered by auditLogRedaction.test.ts and redact.test.ts).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '..')

function readSrc(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8')
}

describe('privacy scanner: redaction imports', () => {
  it('bugReportsService imports redactString', () => {
    const src = readSrc('lib/bugReportsService.ts')
    expect(src).toContain('import { redactString')
    expect(src).toContain('redactString(')
  })

  it('marketplaceService imports redactString', () => {
    const src = readSrc('lib/marketplaceService.ts')
    expect(src).toContain('import { redactString')
    expect(src).toContain('redactString(')
  })

  it('profilesService imports redactString for avatar reports', () => {
    const src = readSrc('lib/profilesService.ts')
    expect(src).toContain('import { redactString')
    expect(src).toContain('redactString(')
  })

  it('auditLogService imports redactObject', () => {
    const src = readSrc('lib/auditLogService.ts')
    expect(src).toContain('redactObject')
  })

  it('observability client imports redactString and redactUrl', () => {
    const src = readSrc('observability/client.ts')
    expect(src).toContain('redactString')
    expect(src).toContain('redactUrl')
  })

  it('debugConsoleStore imports redactObject', () => {
    const src = readSrc('stores/debugConsoleStore.ts')
    expect(src).toContain('redactObject')
  })
})

describe('privacy scanner: no raw supabase inserts of user text without redaction', () => {
  it('reportComment uses redactString on flag_reason', () => {
    const src = readSrc('lib/marketplaceService.ts')
    // Ensure flag_reason is wrapped in redactString
    expect(src).toMatch(/flag_reason:\s*redactString/)
  })

  it('reportItem uses redactString on description', () => {
    const src = readSrc('lib/marketplaceService.ts')
    // Ensure the item report description is redacted
    expect(src).toMatch(/description:\s*redactString/)
  })

  it('reportAvatar uses redactString on reason', () => {
    const src = readSrc('lib/profilesService.ts')
    expect(src).toMatch(/reason:\s*redactString/)
  })

  it('submitBugReport uses redactString on title and description', () => {
    const src = readSrc('lib/bugReportsService.ts')
    expect(src).toMatch(/title:\s*redactString/)
    expect(src).toMatch(/description:\s*redactString/)
  })
})
