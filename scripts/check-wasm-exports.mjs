#!/usr/bin/env node
/**
 * Guard script: verify that the built @engine-wasm package exports every
 * function required by src/engine/worker.ts.
 *
 * Run after wasm-pack build, before tsc.
 * Exit 0 on success, 1 if any export is missing.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const REQUIRED_EXPORTS = [
  'evaluate',
  'load_snapshot',
  'load_snapshot_with_options',
  'apply_patch',
  'apply_patch_with_options',
  'set_input',
  'register_dataset',
  'release_dataset',
  'get_catalog',
  'get_constant_values',
  'get_engine_version',
  'get_engine_contract_version',
  'dataset_count',
  'dataset_total_bytes',
]

const dtsPath = resolve(root, 'crates/engine-wasm/pkg/engine_wasm.d.ts')
const jsPath = resolve(root, 'crates/engine-wasm/pkg/engine_wasm.js')

let failed = false

function check(filePath, label) {
  let content
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    console.error(`FAIL: ${label} not found at ${filePath}`)
    console.error('      Run "npm run wasm:build" first.')
    process.exit(1)
  }

  for (const name of REQUIRED_EXPORTS) {
    // Match "export function <name>" in both .js and .d.ts
    const pattern = new RegExp(`export function ${name}\\b`)
    if (!pattern.test(content)) {
      console.error(`FAIL: ${label} is missing export "${name}"`)
      failed = true
    }
  }
}

console.log('--- check-wasm-exports ---')
check(dtsPath, '.d.ts')
check(jsPath, '.js')

if (failed) {
  console.error(
    '\nWASM export check failed. Regenerate with "npm run wasm:build"',
    '\nor update crates/engine-wasm/pkg/ manually.',
  )
  process.exit(1)
}

console.log(
  `OK: all ${REQUIRED_EXPORTS.length} required exports present in .d.ts and .js`,
)
