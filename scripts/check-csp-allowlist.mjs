#!/usr/bin/env node
/**
 * check-csp-allowlist.mjs
 *
 * Parses public/_headers and verifies that only pre-approved external origins
 * appear in the Content-Security-Policy.
 *
 * Any external origin NOT in APPROVED_ORIGINS causes a non-zero exit, failing CI.
 *
 * Purpose (P050): enforce that adding a new third-party script/resource requires
 * an explicit review — the developer must add the origin to APPROVED_ORIGINS with
 * a comment explaining the rationale.
 *
 * Approved origins MUST be updated here AND in docs/SECURITY.md §5 when a new
 * external resource is intentionally added.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Approved external origins ─────────────────────────────────────────────────
// Each entry is a string or regex pattern. To add a new external resource,
// add it here AND document the rationale in docs/SECURITY.md §5.
const APPROVED_ORIGINS = [
  // Google Fonts (stylesheet + font files)
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  // Supabase (REST API, Realtime WebSocket)
  'https://*.supabase.co',
  'wss://*.supabase.co',
  // Stripe (API + Checkout iframe)
  'https://api.stripe.com',
  'https://js.stripe.com',
  // Cloudflare Turnstile CAPTCHA (E2-2: script + widget iframe)
  'https://challenges.cloudflare.com',
]

// ── Keywords that are not external origins ────────────────────────────────────
const CSP_KEYWORDS = new Set([
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'wasm-unsafe-eval'",
  "'strict-dynamic'",
  'data:',
  'blob:',
  'https:',
  'http:',
])

// ── Parse logic ───────────────────────────────────────────────────────────────

const headersPath = resolve('public/_headers')
const raw = readFileSync(headersPath, 'utf8')

// Extract the enforced CSP line (not Report-Only)
const cspLine = raw
  .split('\n')
  .map((l) => l.trim())
  .find((l) => l.startsWith('Content-Security-Policy:') && !l.startsWith('Content-Security-Policy-Report-Only:'))

if (!cspLine) {
  console.error('ERROR: Content-Security-Policy header not found in public/_headers')
  process.exit(1)
}

const cspValue = cspLine.slice('Content-Security-Policy:'.length).trim()
const directives = cspValue.split(';').map((d) => d.trim()).filter(Boolean)

const externalOrigins = []

for (const directive of directives) {
  const parts = directive.split(/\s+/)
  // Skip report-uri / report-to directives entirely (their values are not origins)
  if (parts[0] === 'report-uri' || parts[0] === 'report-to') continue
  // parts[0] is the directive name (e.g. script-src), rest are values
  for (const val of parts.slice(1)) {
    // Skip CSP keywords and self-relative paths
    if (CSP_KEYWORDS.has(val)) continue
    if (val.startsWith('/')) continue
    if (val.startsWith("'") && val.endsWith("'")) continue
    // Remaining values should be origins
    externalOrigins.push({ directive: parts[0], origin: val })
  }
}

// ── Allowlist check ───────────────────────────────────────────────────────────

let failed = false

for (const { directive, origin } of externalOrigins) {
  const approved = APPROVED_ORIGINS.some((allowed) => {
    // Exact match or wildcard prefix match
    if (allowed === origin) return true
    if (allowed.startsWith('https://*.') && origin.startsWith('https://')) {
      const suffix = allowed.slice('https://*.'.length)
      return origin === `https://${suffix}` || origin.endsWith(`.${suffix}`)
    }
    if (allowed.startsWith('wss://*.') && origin.startsWith('wss://')) {
      const suffix = allowed.slice('wss://*.'.length)
      return origin === `wss://${suffix}` || origin.endsWith(`.${suffix}`)
    }
    return false
  })

  if (!approved) {
    console.error(
      `CSP ALLOWLIST VIOLATION: Unapproved external origin in ${directive}: "${origin}"`,
    )
    console.error(
      '  → Add the origin to APPROVED_ORIGINS in scripts/check-csp-allowlist.mjs',
    )
    console.error(
      '  → Document the rationale in docs/SECURITY.md §5 (Third-Party Analytics and CSP)',
    )
    failed = true
  }
}

if (failed) {
  process.exit(1)
}

const seen = externalOrigins.map((e) => `${e.directive}: ${e.origin}`)
if (seen.length > 0) {
  console.log('CSP allowlist check passed. Approved external origins:')
  for (const s of seen) console.log(`  ${s}`)
} else {
  console.log('CSP allowlist check passed. No external origins in CSP.')
}
