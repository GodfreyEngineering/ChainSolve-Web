/**
 * suppressResizeObserverError.test.ts — G0-4
 *
 * Tests for the ResizeObserver loop error suppressor and
 * the rAF-throttled makeResizeHandler pattern.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { isResizeObserverLoopError } from './suppressResizeObserverError'

// ── isResizeObserverLoopError ─────────────────────────────────────────────────

describe('isResizeObserverLoopError', () => {
  it('matches Chrome error message', () => {
    expect(isResizeObserverLoopError('ResizeObserver loop limit exceeded')).toBe(true)
  })

  it('matches Firefox/Safari error message', () => {
    expect(
      isResizeObserverLoopError('ResizeObserver loop completed with undelivered notifications.'),
    ).toBe(true)
  })

  it('matches partial substring', () => {
    expect(isResizeObserverLoopError('ResizeObserver loop')).toBe(true)
  })

  it('does not match unrelated errors', () => {
    expect(isResizeObserverLoopError('TypeError: cannot read property')).toBe(false)
    expect(isResizeObserverLoopError('Network error')).toBe(false)
    expect(isResizeObserverLoopError('')).toBe(false)
  })

  it('does not match partial "ResizeObserver" without "loop"', () => {
    expect(isResizeObserverLoopError('ResizeObserver is not defined')).toBe(false)
  })
})

// ── Structural: boot.ts filters ResizeObserver errors ─────────────────────────

describe('boot.ts ResizeObserver suppression', () => {
  const bootSrc = fs.readFileSync(path.resolve(__dirname, '..', 'boot.ts'), 'utf-8')

  it('boot.ts error handler checks for ResizeObserver loop', () => {
    // The window error handler must include the ResizeObserver filter
    expect(bootSrc).toContain("e.message.includes('ResizeObserver loop')")
  })
})

// ── Structural: main.tsx installs suppressor before observability ──────────────

describe('main.tsx suppressor installation order', () => {
  const mainSrc = fs.readFileSync(path.resolve(__dirname, '..', 'main.tsx'), 'utf-8')

  it('imports suppressResizeObserverError', () => {
    expect(mainSrc).toContain('installResizeObserverErrorSuppressor')
  })

  it('installs suppressor before initObservability', () => {
    const suppressIdx = mainSrc.indexOf('installResizeObserverErrorSuppressor()')
    const obsIdx = mainSrc.indexOf('initObservability()')
    expect(suppressIdx).toBeGreaterThan(-1)
    expect(obsIdx).toBeGreaterThan(-1)
    expect(suppressIdx).toBeLessThan(obsIdx)
  })
})

// ── Structural: observability client filters ResizeObserver ───────────────────

describe('observability client ResizeObserver filter', () => {
  const obsSrc = fs.readFileSync(
    path.resolve(__dirname, '..', 'observability', 'client.ts'),
    'utf-8',
  )

  it('captureWindowError filters ResizeObserver loop errors', () => {
    expect(obsSrc).toContain("e.message.includes('ResizeObserver loop')")
  })
})

// ── Structural: makeResizeHandler uses rAF throttle ───────────────────────────

describe('CanvasArea rAF-throttled resize handler', () => {
  const canvasSrc = fs.readFileSync(
    path.resolve(__dirname, '..', 'components', 'canvas', 'CanvasArea.tsx'),
    'utf-8',
  )

  it('makeResizeHandler uses requestAnimationFrame', () => {
    expect(canvasSrc).toContain('requestAnimationFrame')
  })

  it('makeResizeHandler cancels animation frame on mouseup', () => {
    expect(canvasSrc).toContain('cancelAnimationFrame(rafId)')
  })

  it('makeResizeHandler cancels animation frame before new frame request', () => {
    // The onMove handler should cancel before requesting a new frame
    // to ensure only one pending frame per drag
    const onMoveSection = canvasSrc.slice(
      canvasSrc.indexOf('const onMove = (me:'),
      canvasSrc.indexOf('const onUp = () =>'),
    )
    const cancelIdx = onMoveSection.indexOf('cancelAnimationFrame')
    const requestIdx = onMoveSection.indexOf('requestAnimationFrame')
    expect(cancelIdx).toBeGreaterThan(-1)
    expect(requestIdx).toBeGreaterThan(-1)
    expect(cancelIdx).toBeLessThan(requestIdx)
  })
})
