#!/usr/bin/env node
/**
 * scripts/doctor.mjs — Verify the dev environment is correctly configured.
 *
 * Run:  npm run doctor
 *
 * Checks:
 *   - Node.js version ≥ 20
 *   - npm present
 *   - cargo present + wasm toolchain installed
 *   - wasm-pack present
 *   - node_modules exists (npm ci run)
 *   - WASM build artifact present (crates/engine-wasm/pkg/engine_wasm_bg.wasm)
 *   - .env file present
 *   - .env has non-placeholder VITE_SUPABASE_URL
 *
 * Exits 0 if all checks pass (or all failures are warnings).
 * Exits 1 if any required check fails.
 */

import { existsSync, readFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'

const PASS = `${GREEN}[OK]${RESET}  `
const WARN = `${YELLOW}[WARN]${RESET}`
const FAIL = `${RED}[FAIL]${RESET}`

/** @type {Array<{label: string, status: 'ok'|'warn'|'fail', detail?: string}>} */
const results = []

function check(label, fn) {
  try {
    const result = fn()
    if (result === false) {
      results.push({ label, status: 'fail' })
    } else if (result === null) {
      results.push({ label, status: 'warn', detail: 'not found (optional)' })
    } else {
      results.push({ label, status: 'ok', detail: typeof result === 'string' ? result : undefined })
    }
  } catch (err) {
    results.push({ label, status: 'fail', detail: err.message })
  }
}

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function tryRun(cmd) {
  try {
    return run(cmd)
  } catch {
    return null
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────

check('Node.js ≥ 20', () => {
  const raw = run('node --version')
  const major = parseInt(raw.replace('v', '').split('.')[0], 10)
  if (major < 20) throw new Error(`v${major} found but ≥ 20 required`)
  return raw
})

check('npm', () => {
  const v = tryRun('npm --version')
  if (!v) throw new Error('npm not found')
  return v
})

check('cargo (Rust)', () => {
  const v = tryRun('cargo --version')
  if (!v) return null // optional warn
  return v
})

check('wasm-pack', () => {
  const v = tryRun('wasm-pack --version')
  if (!v) return null // optional warn
  return v
})

check('wasm32-unknown-unknown target', () => {
  const targets = tryRun('rustup target list --installed')
  if (!targets) return null // cargo not installed
  if (!targets.includes('wasm32-unknown-unknown')) {
    return null // warn: needs installation
  }
  return 'installed'
})

check('node_modules (npm ci)', () => {
  if (!existsSync(resolve(ROOT, 'node_modules'))) {
    throw new Error('node_modules missing — run: npm ci')
  }
  return 'present'
})

check('WASM build artifact', () => {
  const wasmPath = resolve(ROOT, 'crates', 'engine-wasm', 'pkg', 'engine_wasm_bg.wasm')
  if (!existsSync(wasmPath)) {
    throw new Error('WASM artifact missing — run: npm run wasm:build:dev')
  }
  return 'present'
})

check('.env file', () => {
  if (!existsSync(resolve(ROOT, '.env'))) {
    throw new Error('.env missing — run: cp .env.example .env and fill in credentials')
  }
  return 'present'
})

check('.env: VITE_SUPABASE_URL set', () => {
  const envPath = resolve(ROOT, '.env')
  if (!existsSync(envPath)) return null
  const contents = readFileSync(envPath, 'utf-8')
  const match = contents.match(/^VITE_SUPABASE_URL=(.+)$/m)
  if (!match || !match[1] || match[1].includes('YOUR_PROJECT_REF')) {
    throw new Error('VITE_SUPABASE_URL is still the placeholder — update .env')
  }
  // Mask the URL for safety
  const url = match[1].trim()
  return url.replace(/https:\/\/([^.]+)\.supabase\.co/, 'https://*****.supabase.co')
})

// ── Output ────────────────────────────────────────────────────────────────────

console.log('')
console.log(`${BOLD}ChainSolve Web — Doctor${RESET}`)
console.log('────────────────────────────────────────')
console.log('')

let failed = 0
let warned = 0

for (const r of results) {
  const icon = r.status === 'ok' ? PASS : r.status === 'warn' ? WARN : FAIL
  const detail = r.detail ? `  (${r.detail})` : ''
  console.log(`  ${icon}  ${r.label}${detail}`)
  if (r.status === 'fail') failed++
  if (r.status === 'warn') warned++
}

console.log('')
if (failed > 0) {
  console.log(`${RED}${BOLD}Doctor found ${failed} problem(s).${RESET} Fix the issues above, then re-run.`)
  console.log('')
  process.exit(1)
} else if (warned > 0) {
  console.log(`${YELLOW}${BOLD}All required checks passed${RESET} (${warned} optional item(s) missing).`)
  console.log('')
} else {
  console.log(`${GREEN}${BOLD}All checks passed.${RESET} You're ready to develop!`)
  console.log('')
}
