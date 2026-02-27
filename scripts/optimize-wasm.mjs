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
 * Requires `binaryen` (devDependency) which provides wasm-opt.
 */

import { execFileSync } from 'child_process'
import { statSync, existsSync, readdirSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Resolve wasm-opt from node_modules/.bin (provided by binaryen)
const BIN = join(ROOT, 'node_modules', '.bin', 'wasm-opt')

if (!existsSync(BIN)) {
  console.warn('wasm-opt not found in node_modules/.bin — skipping optimization.')
  console.warn('Install binaryen: npm install --save-dev binaryen')
  process.exit(0)
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

// ── Optimize each file ───────────────────────────────────────────

const FLAGS = [
  '-Oz',
  '--strip-debug',
  '--strip-producers',
  '--vacuum',
  '--dce',
]

let allOk = true

for (const wasmPath of wasmFiles) {
  const before = statSync(wasmPath).size
  const label = wasmPath.replace(ROOT + '/', '')

  console.log(`Optimizing ${label}`)
  console.log(`  before: ${(before / 1024).toFixed(0)} KB`)

  try {
    execFileSync(BIN, [...FLAGS, wasmPath, '-o', wasmPath], {
      stdio: 'inherit',
    })
  } catch (err) {
    console.error(`  FAILED: ${err.message}`)
    allOk = false
    continue
  }

  const after = statSync(wasmPath).size
  const saved = before - after
  const pct = before > 0 ? ((saved / before) * 100).toFixed(1) : '0.0'

  console.log(`  after:  ${(after / 1024).toFixed(0)} KB`)
  console.log(`  saved:  ${(saved / 1024).toFixed(0)} KB (${pct}%)`)
}

if (!allOk) {
  process.exit(1)
}
