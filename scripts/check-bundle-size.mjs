#!/usr/bin/env node
/**
 * scripts/check-bundle-size.mjs — Bundle size check for CI and local dev.
 *
 * Run after `npm run build`:
 *   node scripts/check-bundle-size.mjs
 *
 * Budgets (uncompressed — Cloudflare serves Brotli at ~40–60% smaller):
 *   main-*.js       900 KB   (+13% headroom over current ~796 KB)
 *   total JS       1600 KB   (+4% headroom over current ~1537 KB)
 *   *.wasm          600 KB   (+22% headroom over current ~493 KB)
 *
 * Exits 1 if any budget is exceeded.
 */

import { readdirSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Locate dist/assets ────────────────────────────────────────────

function findDistDir() {
  const candidates = [join(ROOT, 'dist', 'assets'), join(ROOT, 'dist')]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

const distDir = findDistDir()
if (!distDir) {
  console.error(
    '\nBundle size check: dist/ not found.\nRun `npm run build` first.\n',
  )
  process.exit(1)
}

// ── Collect files ─────────────────────────────────────────────────

function listFiles(dir) {
  try {
    return readdirSync(dir)
      .map((f) => join(dir, f))
      .filter((f) => {
        try {
          return statSync(f).isFile()
        } catch {
          return false
        }
      })
  } catch {
    return []
  }
}

const allFiles = listFiles(distDir)
const jsFiles = allFiles.filter((f) => f.endsWith('.js'))
const wasmFiles = allFiles.filter((f) => f.endsWith('.wasm'))

// ── Budget constants ──────────────────────────────────────────────

const KB = 1024
const BUDGETS = {
  mainJs: 900 * KB,
  totalJs: 1600 * KB,
  wasm: 600 * KB,
}

// ── Check each budget ─────────────────────────────────────────────

let failed = false

/** @type {Array<{file: string, size: number, budget: number, ok: boolean}>} */
const rows = []

function addRow(file, size, budget) {
  const ok = size <= budget
  if (!ok) failed = true
  rows.push({ file, size, budget, ok })
}

// main-*.js
const mainJs = jsFiles.find((f) => basename(f).startsWith('main-'))
if (mainJs) {
  addRow(basename(mainJs), statSync(mainJs).size, BUDGETS.mainJs)
} else {
  // main chunk not found — might be chunked differently; treat as warning not failure
  rows.push({ file: 'main-*.js (not found)', size: 0, budget: BUDGETS.mainJs, ok: true })
}

// total JS
const totalJsSize = jsFiles.reduce((sum, f) => sum + statSync(f).size, 0)
addRow(`total JS (${jsFiles.length} files)`, totalJsSize, BUDGETS.totalJs)

// individual wasm files
for (const wasm of wasmFiles) {
  addRow(basename(wasm), statSync(wasm).size, BUDGETS.wasm)
}

if (wasmFiles.length === 0) {
  rows.push({ file: '*.wasm (none found)', size: 0, budget: BUDGETS.wasm, ok: true })
}

// ── Print table ───────────────────────────────────────────────────

const kbLabel = (n) => `${(n / KB).toFixed(0)} KB`
const COL_FILE = 46
const COL_SIZE = 12
const COL_BUDGET = 12
const LINE_WIDTH = COL_FILE + COL_SIZE + COL_BUDGET + 8

const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)
const hr = '─'.repeat(LINE_WIDTH)

console.log('')
console.log('Bundle size check')
console.log(`Scanning: ${distDir}`)
console.log(hr)
console.log(
  `${pad('File', COL_FILE)}  ${lpad('Size', COL_SIZE)}  ${lpad('Budget', COL_BUDGET)}  Status`,
)
console.log(hr)

for (const r of rows) {
  const status = r.ok ? 'PASS' : '*** FAIL ***'
  console.log(
    `${pad(r.file, COL_FILE)}  ${lpad(kbLabel(r.size), COL_SIZE)}  ${lpad(kbLabel(r.budget), COL_BUDGET)}  ${status}`,
  )
}

console.log(hr)
console.log('')

if (failed) {
  console.error(
    'Bundle size check FAILED — one or more files exceed their budget.\n',
  )
  process.exit(1)
} else {
  console.log('Bundle size check PASSED.\n')
}
