/**
 * Shared Playwright helpers and fixtures for ChainSolve e2e tests.
 *
 * Key exports
 * ───────────
 * waitForEngineOrFatal   – waits for engine-ready OR engine-fatal; throws on fatal
 * waitForCanvasOrFatal   – waits for canvas-computed OR engine-fatal; throws on fatal
 * test                   – custom test object with a worker-scoped `enginePage`
 *                          fixture (WASM compiled once per worker, reused across
 *                          tests in the same file)
 * expect                 – re-exported from @playwright/test
 */

import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

// ── Deterministic wait helpers ────────────────────────────────────────────────

/**
 * Read the error message embedded in data-fatal-message on engine-fatal.
 * Returns a fallback string so callers always get something useful.
 */
async function readFatalMessage(page: Page): Promise<string> {
  return (
    (await page
      .locator('[data-testid="engine-fatal"]')
      .getAttribute('data-fatal-message')) ?? '(no message attribute)'
  )
}

/**
 * Wait for the WASM engine to either succeed (engine-ready) or fail
 * (engine-fatal).  On failure the test is aborted immediately with the error
 * message from the DOM — much faster and clearer than a 60-second timeout.
 *
 * @param page         Playwright Page
 * @param consoleErrors Optional array of collected console error strings to
 *                      include in the failure message for easier debugging.
 */
export async function waitForEngineOrFatal(
  page: Page,
  consoleErrors?: string[],
): Promise<void> {
  // Wait for whichever sentinel appears first.  Both are mutually exclusive
  // (React renders one or the other, never both).
  await page
    .locator('[data-testid="engine-ready"], [data-testid="engine-fatal"]')
    .first()
    .waitFor({ state: 'attached', timeout: 60_000 })

  const fatal = page.locator('[data-testid="engine-fatal"]')
  if (await fatal.isVisible()) {
    const msg = await readFatalMessage(page)
    const extra =
      consoleErrors?.length ? `\nConsole errors:\n${consoleErrors.join('\n')}` : ''
    throw new Error(`[engine-fatal] ${msg}${extra}`)
  }
}

/**
 * Wait for the canvas evaluation cycle to complete (canvas-computed) or for
 * the engine to fail (engine-fatal).  canvas-computed renders once
 * useGraphEngine has processed the first loadSnapshot round-trip.
 */
export async function waitForCanvasOrFatal(
  page: Page,
  consoleErrors?: string[],
): Promise<void> {
  await page
    .locator('[data-testid="canvas-computed"], [data-testid="engine-fatal"]')
    .first()
    .waitFor({ state: 'attached', timeout: 60_000 })

  const fatal = page.locator('[data-testid="engine-fatal"]')
  if (await fatal.isVisible()) {
    const msg = await readFatalMessage(page)
    const extra =
      consoleErrors?.length ? `\nConsole errors:\n${consoleErrors.join('\n')}` : ''
    throw new Error(`[engine-fatal] ${msg}${extra}`)
  }
}

// ── Worker-scoped shared page fixture ─────────────────────────────────────────
//
// All tests in the same Playwright worker share ONE BrowserContext and ONE Page.
// WASM is compiled by Chromium's V8 once when the page first loads at '/'; every
// subsequent test reuses the already-running engine without recompilation.
//
// Isolation contract:
//   • Tests that call engine.evaluateGraph()  → stateless; safe at any point.
//   • Tests that call engine.loadSnapshot()   → resets engine state explicitly;
//     subsequent tests start from whatever state the last loadSnapshot left.
//     Each such test is self-contained (it calls loadSnapshot itself).
//   • Tests that navigate away from '/'        → must use the default `page`
//     fixture, not enginePage, to avoid corrupting shared state.

type WorkerFixtures = {
  /**
   * A Page pre-loaded at '/' with the WASM engine already initialised.
   * Worker-scoped: created once per Playwright worker, shared across all
   * tests in the same worker (usually all tests in one spec file).
   */
  enginePage: Page
}

export const test = base.extend<Record<never, never>, WorkerFixtures>({
  enginePage: [
    async ({ browser }, use) => {
      const context = await browser.newContext()
      const page = await context.newPage()

      // Navigate once and wait for WASM init.  60 s budget for cold CI runners
      // where the first V8 WASM compilation is expensive.
      await page.goto('/')
      await waitForEngineOrFatal(page)

      await use(page)
      // Context (and the page inside it) is closed after the last test in
      // this worker completes.
      await context.close()
    },
    { scope: 'worker' },
  ],
})

export { expect } from '@playwright/test'
