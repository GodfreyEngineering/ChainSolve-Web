/**
 * csp.test.ts — CSP compliance structural tests (G0-3).
 *
 * Verifies that no inline event handlers exist in source files,
 * and that the CSP headers are consistent between public/ and dist/.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Inline event handler scan ─────────────────────────────────────────────────

describe('CSP: no inline event handlers', () => {
  // Inline handlers like onclick="..." violate CSP script-src when 'unsafe-inline'
  // is absent. They must use addEventListener instead.
  const INLINE_HANDLER_RE = /\b(?:onclick|onerror|onload|onsubmit|onchange|onfocus|onblur)\s*=/i

  it('boot.ts has no inline event handlers', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'boot.ts'), 'utf-8')
    const match = INLINE_HANDLER_RE.exec(src)
    expect(match, `Found inline handler in boot.ts: "${match?.[0]}"`).toBeNull()
  })

  it('index.html has no inline event handlers', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8')
    const match = INLINE_HANDLER_RE.exec(src)
    expect(match, `Found inline handler in index.html: "${match?.[0]}"`).toBeNull()
  })
})

// ── CSP header consistency ────────────────────────────────────────────────────

describe('CSP: _headers consistency', () => {
  const publicHeaders = fs.readFileSync(
    path.resolve(__dirname, '..', 'public', '_headers'),
    'utf-8',
  )

  it('public/_headers contains Content-Security-Policy', () => {
    expect(publicHeaders).toContain('Content-Security-Policy:')
  })

  it('CSP directives do not allowlist Cloudflare beacon', () => {
    // Check only the CSP directive lines (non-comment lines containing CSP header)
    const cspLines = publicHeaders
      .split('\n')
      .filter((l) => l.includes('Content-Security-Policy') && !l.trim().startsWith('#'))
    expect(cspLines.length).toBeGreaterThan(0)
    for (const line of cspLines) {
      expect(line).not.toContain('cloudflareinsights.com')
    }
  })

  it('CSP does not include unsafe-eval', () => {
    // 'wasm-unsafe-eval' is allowed; 'unsafe-eval' is not
    const lines = publicHeaders.split('\n')
    for (const line of lines) {
      if (line.includes('Content-Security-Policy') && !line.trim().startsWith('#')) {
        expect(line).not.toMatch(/(?<!'wasm-)unsafe-eval/)
      }
    }
  })

  it('CSP report-uri points to /api/report/csp', () => {
    expect(publicHeaders).toContain('report-uri /api/report/csp')
  })

  it('no redundant Content-Security-Policy-Report-Only identical to enforced (V2-004)', () => {
    // A Report-Only header identical to the enforced CSP doubles violation reports
    // with no benefit. Report-Only should only exist when testing a DIFFERENT
    // (stricter) policy before promoting it to enforced.
    const lines = publicHeaders.split('\n')
    const enforcedLine = lines.find(
      (l) =>
        l.includes('Content-Security-Policy:') &&
        !l.includes('Report-Only') &&
        !l.trim().startsWith('#'),
    )
    const reportOnlyLine = lines.find(
      (l) => l.includes('Content-Security-Policy-Report-Only:') && !l.trim().startsWith('#'),
    )
    if (enforcedLine && reportOnlyLine) {
      // Extract directives (everything after the header name)
      const enforcedDirectives = enforcedLine.split('Content-Security-Policy:')[1]?.trim()
      const reportOnlyDirectives = reportOnlyLine
        .split('Content-Security-Policy-Report-Only:')[1]
        ?.trim()
      expect(
        enforcedDirectives,
        'Report-Only CSP is identical to enforced CSP — remove it to avoid duplicate reports',
      ).not.toBe(reportOnlyDirectives)
    }
    // If no Report-Only exists, that's the expected state (V2-004 removed it)
  })
})
