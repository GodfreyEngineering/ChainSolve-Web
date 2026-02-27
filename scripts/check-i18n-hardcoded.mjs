#!/usr/bin/env node
/**
 * check-i18n-hardcoded.mjs — Detect hard-coded multi-word strings in JSX
 * attributes that must be translated (placeholder, aria-label).
 *
 * Rules:
 *   - `placeholder="<value>"` where <value> contains a space (multi-word)
 *   - `aria-label="<value>"` where <value> contains a space (multi-word)
 *
 * Violations not in the ALLOWLIST cause a non-zero exit so verify-ci.sh fails.
 * The ALLOWLIST records known pre-existing violations; remove entries as you fix them.
 *
 * Usage: node scripts/check-i18n-hardcoded.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ── Known pre-existing violations ────────────────────────────────────────────
// Each entry is "relative/path/to/file.tsx|attribute value".
// Remove an entry once the component uses t() for that string.
const ALLOWLIST = new Set([
  // PlotInspector — does not yet import useTranslation
  'src/components/canvas/PlotInspector.tsx|X axis',
  'src/components/canvas/PlotInspector.tsx|Y axis',
  'src/components/canvas/PlotInspector.tsx|Chart title...',
  'src/components/canvas/PlotInspector.tsx|Subtitle...',
  // QuickAddPalette — does not yet import useTranslation
  'src/components/canvas/QuickAddPalette.tsx|Filter blocks…',
  // VariablesPanel — does not yet import useTranslation
  'src/components/canvas/VariablesPanel.tsx|Variable name',
  // ValueEditor — complex inline search, no matching key yet
  'src/components/canvas/editors/ValueEditor.tsx|Search constants & variables...',
  // GroupInspector — does not yet import useTranslation
  'src/components/canvas/GroupInspector.tsx|Add notes…',
])

// ── Scan ──────────────────────────────────────────────────────────────────────

/** Yield every .tsx file under dir recursively. */
function* walkTsx(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
      yield* walkTsx(full)
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      yield full
    }
  }
}

// Matches:  placeholder="some value"  or  aria-label="some value"
// Captures the attribute value (group 1).
const ATTR_RE = /\b(?:placeholder|aria-label)="([^"]+)"/g

let violations = 0

for (const absPath of walkTsx('src')) {
  const relPath = absPath.replace(/\\/g, '/').replace(/^.*?src\//, 'src/')
  const src = readFileSync(absPath, 'utf-8')

  let m
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(src)) !== null) {
    const value = m[1]
    // Only flag multi-word values (contain at least one space).
    if (!value.includes(' ')) continue

    const key = `${relPath}|${value}`
    if (!ALLOWLIST.has(key)) {
      const line = src.slice(0, m.index).split('\n').length
      console.error(`  FAIL  ${relPath}:${line}  literal attribute value: "${value}"`)
      violations++
    }
  }
}

if (violations > 0) {
  console.error(
    `\nFound ${violations} hard-coded multi-word attribute string(s).\n` +
      `Use t('your.key') instead, or add to ALLOWLIST in check-i18n-hardcoded.mjs\n` +
      `(with a TODO comment) if the component does not yet import useTranslation.\n`,
  )
  process.exit(1)
}

console.log(
  `i18n hardcoded-attribute check passed. ${ALLOWLIST.size} known exception(s) in allowlist.`,
)
