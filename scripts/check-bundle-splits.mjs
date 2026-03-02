#!/usr/bin/env node
/**
 * scripts/check-bundle-splits.mjs — Bundle lazy-split audit for CI.
 *
 * Run after `npm run build`:
 *   node scripts/check-bundle-splits.mjs
 *
 * Reads the Vite manifest (dist/.vite/manifest.json) and verifies that
 * components intentionally code-split via React.lazy() have NOT been
 * accidentally hoisted into the initial-load closure.
 *
 * A component appears in the initial closure if it is reachable through
 * the chain of static (non-dynamic) imports from the entry point.
 *
 * Rules:
 *   - MUST_BE_LAZY entries that land in the initial closure → FAIL
 *   - MUST_BE_LAZY entries not found in manifest → WARN (may be dead-code
 *     eliminated or file renamed; update the list when this happens)
 *
 * Exits 1 if any lazy component ended up in the initial bundle.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MANIFEST_PATH = join(ROOT, 'dist', '.vite', 'manifest.json')

// ── Files that MUST stay in separate lazy chunks ──────────────────────────
//
// Add a source path (relative to project root) for each component loaded via
// React.lazy(). The check fails if any of these end up in the initial bundle.
//
// Keep this list in sync with all lazy() calls in src/.

const MUST_BE_LAZY = [
  // App-level lazy pages / heavy panels
  'src/pages/DiagnosticsPage.tsx',

  // Modals loaded on-demand (AppHeader)
  'src/components/app/KeyboardShortcutsModal.tsx',
  'src/components/app/FirstRunModal.tsx',
  'src/components/app/AboutModal.tsx',
  'src/components/BugReportModal.tsx',
  'src/components/app/ConfirmDialog.tsx',
  'src/components/app/OpenProjectDialog.tsx',
  'src/components/app/SaveAsDialog.tsx',
  'src/components/app/CommandPalette.tsx',
  'src/components/app/ImportProjectDialog.tsx',

  // Heavy canvas panels
  'src/components/canvas/DebugConsolePanel.tsx',
  'src/components/canvas/GraphHealthPanel.tsx',
  'src/components/canvas/FindBlockDialog.tsx',
  'src/components/canvas/ValuePopover.tsx',
  'src/components/canvas/PlotExpandModal.tsx',

  // Settings
  'src/components/SettingsModal.tsx',

  // Perf HUD
  'src/components/PerfHud.tsx',

  // P149 / P150: Canvas dialogs (always lazy)
  'src/components/canvas/LlmGraphBuilderDialog.tsx',
  'src/components/canvas/TemplateManagerDialog.tsx',
]

// ── Load manifest ─────────────────────────────────────────────────────────

if (!existsSync(MANIFEST_PATH)) {
  console.error('\nBundle splits check: dist/.vite/manifest.json not found.\nRun `npm run build` first.\n')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))

// ── Compute initial closure (static imports only) ─────────────────────────

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry)
if (!entryKey) {
  console.error('No entry point found in manifest')
  process.exit(1)
}

const initialFiles = new Set()
const visited = new Set()

function walkStatic(key) {
  if (visited.has(key)) return
  visited.add(key)
  const chunk = manifest[key]
  if (!chunk) return
  if (chunk.file) initialFiles.add(chunk.file)
  for (const imp of chunk.imports ?? []) {
    walkStatic(imp)
  }
}

// Walk entry and its direct dynamic imports (the app bundle).
walkStatic(entryKey)
for (const dynKey of manifest[entryKey].dynamicImports ?? []) {
  walkStatic(dynKey)
}

// ── Collect all dynamic (lazy) chunk files ───────────────────────────────

const dynamicFiles = new Set()
for (const [, chunk] of Object.entries(manifest)) {
  if (chunk.isDynamicEntry && chunk.file) {
    dynamicFiles.add(chunk.file)
  }
}

// ── Audit MUST_BE_LAZY entries ────────────────────────────────────────────

const failures = []
const warnings = []

for (const srcPath of MUST_BE_LAZY) {
  const entry = manifest[srcPath]
  if (!entry) {
    // Not in manifest: file may have been tree-shaken or renamed.
    warnings.push(`  WARN  ${srcPath}  — not found in manifest (may be renamed or tree-shaken)`)
    continue
  }

  const outFile = entry.file
  if (initialFiles.has(outFile)) {
    failures.push(`  FAIL  ${srcPath}  →  ${outFile}  (in initial closure!)`)
  }
}

// ── Print report ──────────────────────────────────────────────────────────

console.log('')
console.log('Bundle splits audit')
console.log(`Entry: ${entryKey}`)
console.log(`Initial closure: ${initialFiles.size} file(s)`)
console.log(`Dynamic chunks:  ${dynamicFiles.size} file(s)`)
console.log(`Lazy guards:     ${MUST_BE_LAZY.length} checked`)
console.log('')

if (warnings.length > 0) {
  for (const w of warnings) console.warn(w)
  console.log('')
}

if (failures.length === 0) {
  console.log('All lazy components remain in separate chunks. PASS')
  console.log('')
} else {
  for (const f of failures) console.error(f)
  console.error(`\nBundle splits audit FAILED — ${failures.length} lazy component(s) found in initial bundle.\n`)
  process.exit(1)
}
