/**
 * wasmInit.test.ts — G0-5
 *
 * Structural tests verifying that wasm-bindgen init uses the
 * non-deprecated single-object parameter pattern, and that
 * the i18next config uses the non-deprecated initAsync option.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── wasm-bindgen init: single-object pattern ────────────────────────────────

describe('wasm-bindgen init call (worker.ts)', () => {
  const workerSrc = fs.readFileSync(path.resolve(__dirname, 'worker.ts'), 'utf-8')

  it('uses the single-object init pattern: initWasm({ module_or_path: ... })', () => {
    expect(workerSrc).toContain('initWasm({ module_or_path:')
  })

  it('does not pass a bare URL string to initWasm', () => {
    // The deprecated pattern is initWasm(wasmUrl) without wrapping in an object.
    // We need to check that initWasm is NOT called with a bare variable.
    // Match initWasm(wasmUrl) but not initWasm({ ... })
    const bareCallPattern = /initWasm\(\s*wasmUrl\s*\)/
    expect(bareCallPattern.test(workerSrc)).toBe(false)
  })
})

// ── wasm.d.ts: type signature uses object parameter ─────────────────────────

describe('wasm.d.ts init type signature', () => {
  const wasmDts = fs.readFileSync(path.resolve(__dirname, 'wasm.d.ts'), 'utf-8')

  it('init parameter type is an object with module_or_path key', () => {
    expect(wasmDts).toContain('module_or_path:')
  })

  it('does not use the deprecated bare-parameter signature', () => {
    // Old signature: init(input?: string | URL | ...)
    // New signature: init(input?: { module_or_path: string | URL | ... })
    // Check that the bare string|URL pattern is inside an object type
    const lines = wasmDts.split('\n')
    const initLine = lines.find((l) => l.includes('export default function init'))
    expect(initLine).toBeDefined()
    // The init line or the next line should have { module_or_path
    const initIdx = lines.indexOf(initLine!)
    const block = lines.slice(initIdx, initIdx + 3).join('\n')
    expect(block).toContain('module_or_path')
  })
})

// ── i18next config: uses non-deprecated initAsync ───────────────────────────

describe('i18next config (i18n/config.ts)', () => {
  const configSrc = fs.readFileSync(path.resolve(__dirname, '..', 'i18n', 'config.ts'), 'utf-8')

  it('uses initAsync (non-deprecated) instead of initImmediate', () => {
    expect(configSrc).toContain('initAsync:')
  })

  it('does not use deprecated initImmediate option', () => {
    expect(configSrc).not.toContain('initImmediate')
  })

  it('sets initAsync to false for synchronous init with pre-bundled resources', () => {
    expect(configSrc).toContain('initAsync: false')
  })
})
