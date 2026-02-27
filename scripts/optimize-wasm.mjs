#!/usr/bin/env node
/**
 * scripts/optimize-wasm.mjs — Post-process WASM with wasm-opt -Oz.
 *
 * Run after `wasm-pack build`:
 *   node scripts/optimize-wasm.mjs
 *
 * Requires `binaryen` (devDependency) which provides wasm-opt.
 * Optimizes crates/engine-wasm/pkg/engine_wasm_bg.wasm in-place.
 */

import { execFileSync } from 'child_process'
import { statSync, existsSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const WASM = join(ROOT, 'crates/engine-wasm/pkg/engine_wasm_bg.wasm')

if (!existsSync(WASM)) {
  console.error(`WASM file not found: ${WASM}`)
  console.error('Run wasm-pack build first.')
  process.exit(1)
}

const before = statSync(WASM).size

// Resolve wasm-opt from node_modules/.bin (provided by binaryen)
const BIN = join(ROOT, 'node_modules', '.bin', 'wasm-opt')

if (!existsSync(BIN)) {
  console.warn('wasm-opt not found in node_modules/.bin — skipping optimization.')
  console.warn('Install binaryen: npm install --save-dev binaryen')
  process.exit(0)
}

console.log(`Optimizing ${WASM}`)
console.log(`  before: ${(before / 1024).toFixed(0)} KB`)

execFileSync(BIN, [WASM, '-Oz', '--strip-debug', '-o', WASM], {
  stdio: 'inherit',
})

const after = statSync(WASM).size
const saved = before - after
const pct = ((saved / before) * 100).toFixed(1)

console.log(`  after:  ${(after / 1024).toFixed(0)} KB`)
console.log(`  saved:  ${(saved / 1024).toFixed(0)} KB (${pct}%)`)
