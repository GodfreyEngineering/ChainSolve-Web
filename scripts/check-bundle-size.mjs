#!/usr/bin/env node
/**
 * scripts/check-bundle-size.mjs — Bundle size check for CI and local dev.
 *
 * Run after `npm run build`:
 *   node scripts/check-bundle-size.mjs
 *
 * Reads the Vite manifest (dist/.vite/manifest.json) to compute the
 * **initial-load closure** — the entry JS plus all transitive static imports
 * and the entry's direct dynamic imports (the app bundle, not lazy chunks).
 *
 * Reports raw and gzip sizes.  Budgets:
 *   initial JS (gzip)   350 KB   — what the CDN actually serves
 *   *.wasm (raw)         600 KB   — before Brotli/gzip on the wire
 *
 * Total JS is reported for visibility but does NOT fail the build, since
 * lazy chunks (dialogs, panels) only load on demand.
 *
 * Exits 1 if any hard budget is exceeded.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, basename, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = join(ROOT, 'dist')
const ASSETS = join(DIST, 'assets')
const MANIFEST_PATH = join(DIST, '.vite', 'manifest.json')

// ── Budget constants ──────────────────────────────────────────────

const KB = 1024
const BUDGETS = {
  initialGzip: 350 * KB, // initial-load JS closure (gzip)
  wasmRaw: 650 * KB, // per-WASM file (raw) — headroom for toolchain variance
  wasmGzip: 200 * KB, // per-WASM file (gzip) — what the CDN actually serves
}

// ── Helpers ───────────────────────────────────────────────────────

function gzipSize(filePath) {
  const buf = readFileSync(filePath)
  return gzipSync(buf, { level: 9 }).length
}

function fmtKB(n) {
  return `${(n / KB).toFixed(0)} KB`
}

// ── Locate dist ──────────────────────────────────────────────────

if (!existsSync(ASSETS)) {
  console.error('\nBundle size check: dist/assets/ not found.\nRun `npm run build` first.\n')
  process.exit(1)
}

// ── Compute initial closure from manifest ────────────────────────

let initialFiles = [] // asset filenames in initial closure
let hasManifest = false

if (existsSync(MANIFEST_PATH)) {
  hasManifest = true
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))

  // Find entry point
  const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry)
  if (!entryKey) {
    console.error('No entry point found in manifest')
    process.exit(1)
  }

  // Walk: collect a chunk and all its transitive static imports
  const visited = new Set()
  function walkStatic(key) {
    if (visited.has(key)) return
    visited.add(key)
    const chunk = manifest[key]
    if (!chunk) return
    if (chunk.file && chunk.file.endsWith('.js')) {
      initialFiles.push(chunk.file)
    }
    for (const imp of chunk.imports ?? []) {
      walkStatic(imp)
    }
  }

  // Start with the entry itself
  walkStatic(entryKey)

  // Also include the entry's direct dynamic imports — these are the app
  // bundle(s), not lazy chunks.  Lazy chunks are dynamic imports of the
  // app bundle, one level deeper.
  for (const dynKey of manifest[entryKey].dynamicImports ?? []) {
    walkStatic(dynKey)
  }
}

// Fallback: if no manifest, use main-*.js as the initial closure
if (!hasManifest || initialFiles.length === 0) {
  const files = readdirSync(ASSETS).filter((f) => f.startsWith('main-') && f.endsWith('.js'))
  initialFiles = files.map((f) => `assets/${f}`)
}

// ── Collect all asset files ──────────────────────────────────────

const allAssets = readdirSync(ASSETS).map((f) => ({
  name: f,
  path: join(ASSETS, f),
  size: statSync(join(ASSETS, f)).size,
}))

const jsFiles = allAssets.filter((f) => f.name.endsWith('.js'))
const wasmFiles = allAssets.filter((f) => f.name.endsWith('.wasm'))

// ── Compute sizes ────────────────────────────────────────────────

// Initial closure
const initialPaths = initialFiles.map((f) => join(DIST, f))
const initialRaw = initialPaths.reduce((s, p) => s + statSync(p).size, 0)
const initialGzip = initialPaths.reduce((s, p) => s + gzipSize(p), 0)

// Total JS
const totalRaw = jsFiles.reduce((s, f) => s + f.size, 0)
const totalGzip = jsFiles.reduce((s, f) => s + gzipSize(f.path), 0)

// ── Check budgets ────────────────────────────────────────────────

let failed = false

/** @type {Array<{label: string, raw: number, gz: number, budget?: number, budgetType?: string, ok: boolean, warn?: boolean}>} */
const rows = []

function addRow(label, raw, gz, budget, budgetType) {
  const size = budgetType === 'gzip' ? gz : raw
  const ok = !budget || size <= budget
  if (!ok) failed = true
  rows.push({ label, raw, gz, budget, budgetType, ok })
}

function addWarn(label, raw, gz) {
  rows.push({ label, raw, gz, ok: true, warn: true })
}

// Initial closure
addRow(
  `initial JS (${initialFiles.length} files)`,
  initialRaw,
  initialGzip,
  BUDGETS.initialGzip,
  'gzip',
)

// Total JS (informational — does not fail)
addWarn(`total JS (${jsFiles.length} files)`, totalRaw, totalGzip)

// WASM — enforce both raw and gzip budgets
for (const wasm of wasmFiles) {
  const gz = gzipSize(wasm.path)
  addRow(wasm.name, wasm.size, gz, BUDGETS.wasmRaw, 'raw')
  addRow(`${wasm.name} (gz)`, wasm.size, gz, BUDGETS.wasmGzip, 'gzip')
}
if (wasmFiles.length === 0) {
  rows.push({ label: '*.wasm (none)', raw: 0, gz: 0, ok: true })
}

// ── Print table ──────────────────────────────────────────────────

const COL_LABEL = 40
const COL_RAW = 10
const COL_GZ = 10
const COL_BUDGET = 12
const LINE = COL_LABEL + COL_RAW + COL_GZ + COL_BUDGET + 18

const pad = (s, n) => String(s).padEnd(n)
const rpad = (s, n) => String(s).padStart(n)
const hr = '─'.repeat(LINE)

console.log('')
console.log('Bundle size check')
console.log(`Scanning: ${ASSETS}`)
if (hasManifest) console.log(`Manifest: ${initialFiles.length} initial chunks identified`)
console.log(hr)
console.log(
  `${pad('', COL_LABEL)}  ${rpad('Raw', COL_RAW)}  ${rpad('Gzip', COL_GZ)}  ${rpad('Budget', COL_BUDGET)}  Status`,
)
console.log(hr)

for (const r of rows) {
  const budgetStr = r.budget
    ? `${fmtKB(r.budget)} ${r.budgetType === 'gzip' ? '(gz)' : '(raw)'}`
    : '—'
  let status = 'PASS'
  if (!r.ok) status = '*** FAIL ***'
  else if (r.warn) status = '(info)'
  console.log(
    `${pad(r.label, COL_LABEL)}  ${rpad(fmtKB(r.raw), COL_RAW)}  ${rpad(fmtKB(r.gz), COL_GZ)}  ${rpad(budgetStr, COL_BUDGET)}  ${status}`,
  )
}

console.log(hr)

// List initial closure files for transparency
if (hasManifest && initialFiles.length > 0) {
  console.log('\nInitial closure files:')
  for (const f of initialFiles) {
    const p = join(DIST, f)
    console.log(`  ${basename(f)}  ${fmtKB(statSync(p).size)} raw  ${fmtKB(gzipSize(p))} gz`)
  }
}

console.log('')

if (failed) {
  console.error('Bundle size check FAILED — one or more files exceed their budget.\n')
  process.exit(1)
} else {
  console.log('Bundle size check PASSED.\n')
}
