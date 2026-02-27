#!/usr/bin/env node
/**
 * check-i18n-keys.mjs — Detect t('key') calls that reference missing i18n keys.
 *
 * Scans all .ts / .tsx source files for static t('...') usages and verifies that
 * each referenced key exists in src/i18n/locales/en.json (the source-of-truth locale).
 *
 * Dynamic keys (t(someVariable), t(`template${x}`)) are skipped — only static
 * string literals are checked.
 *
 * Usage: node scripts/check-i18n-keys.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ── Load and flatten en.json ──────────────────────────────────────────────────

function flattenKeys(obj, prefix = '') {
  const keys = new Set()
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const sub of flattenKeys(v, full)) keys.add(sub)
    } else {
      keys.add(full)
    }
  }
  return keys
}

const enJson = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf-8'))
const knownKeys = flattenKeys(enJson)

// ── Walk source files ─────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])
const SKIP_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']

function* walkSrc(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walkSrc(full)
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !SKIP_SUFFIXES.some((s) => entry.endsWith(s))
    ) {
      yield full
    }
  }
}

// Matches t('key') or t("key") — static string literal only.
// Captures the key in group 1.
// Also matches t('key', {...}) — the interpolation object is ignored.
const T_CALL_RE = /\bt\(\s*['"]([^'"]+)['"]/g

let missing = 0

for (const absPath of walkSrc('src')) {
  const relPath = absPath.replace(/\\/g, '/').replace(/^.*?src\//, 'src/')
  const src = readFileSync(absPath, 'utf-8')

  let m
  T_CALL_RE.lastIndex = 0
  while ((m = T_CALL_RE.exec(src)) !== null) {
    const key = m[1]

    // Skip keys that contain template expressions or look like identifiers
    if (key.includes('${') || key.includes(' ')) continue

    if (!knownKeys.has(key)) {
      const line = src.slice(0, m.index).split('\n').length
      console.error(`  MISSING  ${relPath}:${line}  t('${key}')`)
      missing++
    }
  }
}

if (missing > 0) {
  console.error(
    `\nFound ${missing} t() call(s) referencing keys absent from en.json.\n` +
      `Add the missing key(s) to src/i18n/locales/*.json (all 5 locales).\n`,
  )
  process.exit(1)
}

console.log(`i18n key check passed. ${knownKeys.size} keys in en.json; all t() calls resolve.`)
