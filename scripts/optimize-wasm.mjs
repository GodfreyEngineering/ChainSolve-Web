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

import { execFileSync, spawnSync } from 'child_process'
import { statSync, existsSync, readdirSync, renameSync, unlinkSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Resolve wasm-opt ─────────────────────────────────────────────

const isWindows = process.platform === 'win32'
// On Windows, the .cmd wrapper and cmd.exe /c break when paths contain spaces.
// Use the Node.js script in binaryen/bin directly via process.execPath.
const BIN_NODE_SCRIPT = join(ROOT, 'node_modules', 'binaryen', 'bin', 'wasm-opt')
const BIN_CMD = isWindows ? join(ROOT, 'node_modules', '.bin', 'wasm-opt.cmd') : null
const BIN = isWindows ? null : join(ROOT, 'node_modules', '.bin', 'wasm-opt')

function runWasmOpt(args) {
  if (isWindows && existsSync(BIN_NODE_SCRIPT)) {
    // Invoke the Node.js wrapper script directly — avoids cmd.exe quoting issues
    execFileSync(process.execPath, [BIN_NODE_SCRIPT, ...args], { stdio: 'inherit' })
  } else if (isWindows) {
    const result = spawnSync('cmd.exe', ['/c', BIN_CMD, ...args], { stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`wasm-opt exited with ${result.status}`)
  } else {
    execFileSync(BIN, args, { stdio: 'inherit' })
  }
}

const BIN_CHECK = isWindows ? BIN_NODE_SCRIPT : BIN
if (!existsSync(BIN_CHECK)) {
  console.warn('wasm-opt not found in node_modules/.bin — skipping optimization.')
  console.warn('Install binaryen: npm install --save-dev binaryen')
  process.exit(0)
}

// Print version for diagnostics
try {
  if (isWindows && existsSync(BIN_NODE_SCRIPT)) {
    const ver = execFileSync(process.execPath, [BIN_NODE_SCRIPT, '--version'], { encoding: 'utf-8' }).trim()
    console.log(`wasm-opt: ${ver}`)
  } else if (isWindows) {
    const r = spawnSync('cmd.exe', ['/c', BIN_CMD, '--version'], { encoding: 'utf-8' })
    console.log(`wasm-opt: ${(r.stdout || '').trim() || '(version unknown)'}`)
  } else {
    const ver = execFileSync(BIN, ['--version'], { encoding: 'utf-8' }).trim()
    console.log(`wasm-opt: ${ver}`)
  }
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
// ENG-09: Use -O3 (speed-optimised) instead of -Oz (size-optimised).
// Performance is the primary pillar; up to 800 KB raw / 250 KB gzip is
// acceptable (bundle budgets updated in CLAUDE.md accordingly).
//
// Rust/wasm-bindgen output uses bulk-memory (memory.fill, memory.copy),
// nontrapping-float-to-int (trunc_sat), mutable-globals, and SIMD128.
// These must be enabled or wasm-opt's validator rejects the module.

const FEATURE_FLAGS = [
  '--enable-bulk-memory',
  '--enable-nontrapping-float-to-int',
  '--enable-bulk-memory-opt',
  '--enable-mutable-globals',
  '--enable-simd',
]

const OPT_FLAGS = [
  '-O3',            // Speed-optimised (vs -Oz for size). ENG-09.
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
    runWasmOpt([...FEATURE_FLAGS, ...OPT_FLAGS, wasmPath, '-o', tmpPath])
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

  // wasm-opt validates both input and output modules during the
  // optimization step above. A separate validation pass is unnecessary
  // and produced "no passes specified" warnings.

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
