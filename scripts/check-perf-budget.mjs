#!/usr/bin/env node
/**
 * scripts/check-perf-budget.mjs — Structural performance budget for CI.
 *
 * Run after `npm run build`:
 *   node scripts/check-perf-budget.mjs
 *
 * Checks STRUCTURAL properties of the bundle that would indicate a
 * performance regression but are not caught by check-bundle-size.mjs:
 *
 *   1. Minimum lazy chunk count
 *      Ensures React.lazy() code-splitting is still effective.
 *      A sharp drop signals a bundler misconfiguration that pulled lazy
 *      pages/modals into the initial bundle.
 *
 *   2. Maximum initial JS file count
 *      Guards against accidental synchronous import creep.  The initial
 *      closure should remain small (entry + 1–2 vendor splits).
 *
 *   3. WASM gzip efficiency ratio
 *      wasm-opt produces highly compressible WASM.  A ratio above 0.70
 *      (compressed/raw > 70%) indicates the optimiser did not run.
 *
 * These checks complement check-bundle-size.mjs (raw + gzip byte budgets)
 * and check-bundle-splits.mjs (named lazy component allowlist).
 *
 * Exits 1 if any budget is violated.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = join(ROOT, 'dist')
const ASSETS = join(DIST, 'assets')
const MANIFEST_PATH = join(DIST, '.vite', 'manifest.json')

// ── Budgets ───────────────────────────────────────────────────────────────────

const BUDGETS = {
  /**
   * Minimum number of dynamic (lazy) chunks.
   * ChainSolve has 15+ lazy-loaded components; dropping below 10 means
   * code-splitting has broken for a large number of them.
   */
  minLazyChunks: 10,

  /**
   * Maximum number of JS files in the initial load closure.
   * Typical split: entry + 1–2 vendor chunks = 3–4 files.
   * Allowing up to 6 leaves room for future intentional additions.
   */
  maxInitialJsFiles: 6,

  /**
   * WASM gzip / raw ratio upper bound.
   * wasm-opt -Oz produces ~50–65% gzip ratio on typical Rust WASM.
   * Above 0.70 (70%) indicates the optimiser was skipped.
   */
  maxWasmGzipRatio: 0.70,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gzipSize(filePath) {
  const buf = readFileSync(filePath)
  return gzipSync(buf, { level: 9 }).length
}

function fmtKB(n) {
  return `${(n / 1024).toFixed(0)} KB`
}

function fmtRatio(r) {
  return `${(r * 100).toFixed(1)}%`
}

// ── Pre-flight ────────────────────────────────────────────────────────────────

if (!existsSync(MANIFEST_PATH)) {
  console.error('\nPerf budget check: dist/.vite/manifest.json not found.\nRun `npm run build` first.\n')
  process.exit(1)
}

if (!existsSync(ASSETS)) {
  console.error('\nPerf budget check: dist/assets/ not found.\nRun `npm run build` first.\n')
  process.exit(1)
}

// ── Load manifest ─────────────────────────────────────────────────────────────

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))

// ── Compute initial closure ───────────────────────────────────────────────────

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
  if (chunk.file && chunk.file.endsWith('.js')) initialFiles.add(chunk.file)
  for (const imp of chunk.imports ?? []) walkStatic(imp)
}

walkStatic(entryKey)
for (const dynKey of manifest[entryKey].dynamicImports ?? []) {
  walkStatic(dynKey)
}

// ── Count dynamic (lazy) chunks ───────────────────────────────────────────────

let lazyChunkCount = 0
for (const [, chunk] of Object.entries(manifest)) {
  if (chunk.isDynamicEntry && chunk.file && chunk.file.endsWith('.js')) lazyChunkCount++
}

// ── Check WASM gzip ratio ─────────────────────────────────────────────────────

const wasmFiles = readdirSync(ASSETS)
  .filter((f) => f.endsWith('.wasm'))
  .map((f) => {
    const p = join(ASSETS, f)
    const raw = statSync(p).size
    const gz = gzipSize(p)
    return { name: f, raw, gz, ratio: gz / raw }
  })

// ── Results ───────────────────────────────────────────────────────────────────

const failures = []
const rows = []

// 1. Lazy chunk count
{
  const ok = lazyChunkCount >= BUDGETS.minLazyChunks
  if (!ok) failures.push(`Lazy chunks: ${lazyChunkCount} < minimum ${BUDGETS.minLazyChunks}`)
  rows.push({
    label: 'Lazy chunks (dynamic entries)',
    value: String(lazyChunkCount),
    budget: `≥ ${BUDGETS.minLazyChunks}`,
    ok,
  })
}

// 2. Initial JS file count
{
  const count = initialFiles.size
  const ok = count <= BUDGETS.maxInitialJsFiles
  if (!ok) failures.push(`Initial JS files: ${count} > maximum ${BUDGETS.maxInitialJsFiles}`)
  rows.push({
    label: 'Initial JS files in closure',
    value: String(count),
    budget: `≤ ${BUDGETS.maxInitialJsFiles}`,
    ok,
  })
}

// 3. WASM gzip ratio (per file)
for (const wasm of wasmFiles) {
  const ok = wasm.ratio <= BUDGETS.maxWasmGzipRatio
  if (!ok) {
    failures.push(
      `WASM ${wasm.name}: gzip ratio ${fmtRatio(wasm.ratio)} > max ${fmtRatio(BUDGETS.maxWasmGzipRatio)} (wasm-opt may not have run)`,
    )
  }
  rows.push({
    label: `WASM gzip ratio: ${wasm.name}`,
    value: `${fmtRatio(wasm.ratio)} (${fmtKB(wasm.raw)} raw → ${fmtKB(wasm.gz)} gz)`,
    budget: `≤ ${fmtRatio(BUDGETS.maxWasmGzipRatio)}`,
    ok,
  })
}

if (wasmFiles.length === 0) {
  rows.push({ label: 'WASM gzip ratio', value: 'no .wasm files found', budget: '—', ok: true })
}

// ── Print report ──────────────────────────────────────────────────────────────

const COL_LABEL = 44
const COL_VAL = 36
const COL_BUDGET = 14
const HR = '─'.repeat(COL_LABEL + COL_VAL + COL_BUDGET + 12)

const pad = (s, n) => String(s).padEnd(n)

console.log('\nPerformance budget check (structural)')
console.log(HR)
console.log(`${pad('Check', COL_LABEL)}  ${pad('Value', COL_VAL)}  ${pad('Budget', COL_BUDGET)}  Status`)
console.log(HR)
for (const r of rows) {
  console.log(`${pad(r.label, COL_LABEL)}  ${pad(r.value, COL_VAL)}  ${pad(r.budget, COL_BUDGET)}  ${r.ok ? 'PASS' : '*** FAIL ***'}`)
}
console.log(HR)
console.log('')

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`)
  console.error(`\nPerformance budget check FAILED — ${failures.length} violation(s).\n`)
  process.exit(1)
} else {
  console.log('Performance budget check PASSED.\n')
}
