#!/usr/bin/env node
/**
 * scripts/optimize-wasm.mjs — Post-process WASM with wasm-opt -Oz.
 *
 * Run after `wasm-pack build` and/or after `vite build`:
 *   node scripts/optimize-wasm.mjs
 *
 * Optimizes ALL engine_wasm_bg*.wasm files found in:
 *   - crates/engine-wasm/pkg/       (wasm-pack output)
 *   - dist/assets/                  (Vite build output)
 *
 * Safety: writes to a temp file first, replaces original only on success.
 * Requires `binaryen` (devDependency) which provides wasm-opt.
 */

import { execFileSync } from 'child_process'
import { statSync, existsSync, readdirSync, renameSync, unlinkSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Resolve wasm-opt ─────────────────────────────────────────────

const BIN = join(ROOT, 'node_modules', '.bin', 'wasm-opt')

if (!existsSync(BIN)) {
  console.warn('wasm-opt not found in node_modules/.bin — skipping optimization.')
  console.warn('Install binaryen: npm install --save-dev binaryen')
  process.exit(0)
}

// Print version for diagnostics
try {
  const ver = execFileSync(BIN, ['--version'], { encoding: 'utf-8' }).trim()
  console.log(`wasm-opt: ${ver}`)
} catch {
  console.log('wasm-opt: (version unknown)')
}

// ── Find all engine WASM files ───────────────────────────────────

const SEARCH_DIRS = [
  join(ROOT, 'crates', 'engine-wasm', 'pkg'),
  join(ROOT, 'dist', 'assets'),
]

const wasmFiles = []
for (const dir of SEARCH_DIRS) {
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir)) {
    if (f.startsWith('engine_wasm_bg') && f.endsWith('.wasm')) {
      wasmFiles.push(join(dir, f))
    }
  }
}

if (wasmFiles.length === 0) {
  console.error('No engine_wasm_bg*.wasm files found.')
  console.error('Run wasm-pack build or vite build first.')
  process.exit(1)
}

// ── Feature flags + optimization flags ───────────────────────────
// Rust/wasm-bindgen output uses bulk-memory (memory.fill, memory.copy)
// and nontrapping-float-to-int (trunc_sat). These must be enabled
// explicitly or wasm-opt's validator rejects the module.

const FEATURE_FLAGS = [
  '--enable-bulk-memory',
  '--enable-nontrapping-float-to-int',
  '--enable-bulk-memory-opt',
]

const OPT_FLAGS = [
  '-Oz',
  '--strip-debug',
  '--strip-producers',
  '--vacuum',
  '--dce',
]

console.log(`Feature flags: ${FEATURE_FLAGS.join(' ')}`)
console.log(`Opt flags: ${OPT_FLAGS.join(' ')}`)
console.log('')

// ── Optimize each file ───────────────────────────────────────────

let allOk = true

for (const wasmPath of wasmFiles) {
  const before = statSync(wasmPath).size
  const label = wasmPath.replace(ROOT + '/', '')
  const tmpPath = wasmPath + '.opt.wasm'

  console.log(`Optimizing ${label}`)
  console.log(`  before: ${(before / 1024).toFixed(0)} KB`)

  // Write to temp file — never corrupt the original on failure
  try {
    execFileSync(BIN, [...FEATURE_FLAGS, ...OPT_FLAGS, wasmPath, '-o', tmpPath], {
      stdio: 'inherit',
    })
  } catch (err) {
    console.error(`  ::error::wasm-opt failed on ${label}: ${err.message}`)
    // Clean up temp file if it was partially written
    try {
      unlinkSync(tmpPath)
    } catch {
      // ignore
    }
    allOk = false
    continue
  }

  // Validate: run wasm-opt on the output to /dev/null — triggers the
  // built-in validator without modifying anything.
  try {
    execFileSync(BIN, [...FEATURE_FLAGS, tmpPath, '-o', '/dev/null'], {
      stdio: 'inherit',
    })
  } catch (err) {
    console.error(`  ::error::Validation failed for optimized ${label}: ${err.message}`)
    try {
      unlinkSync(tmpPath)
    } catch {
      // ignore
    }
    allOk = false
    continue
  }

  // Atomic replace: rename temp over original
  renameSync(tmpPath, wasmPath)

  const after = statSync(wasmPath).size
  const saved = before - after
  const pct = before > 0 ? ((saved / before) * 100).toFixed(1) : '0.0'

  console.log(`  after:  ${(after / 1024).toFixed(0)} KB`)
  console.log(`  saved:  ${(saved / 1024).toFixed(0)} KB (${pct}%)`)
}

console.log('')

if (!allOk) {
  console.error('::error::One or more WASM files failed optimization.')
  process.exit(1)
}

console.log(`All ${wasmFiles.length} file(s) optimized successfully.`)
