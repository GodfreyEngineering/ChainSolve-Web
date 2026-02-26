/**
 * Shared Playwright helpers and fixtures for ChainSolve e2e tests.
 *
 * Boot ladder (in order of appearance):
 *   boot-html      → HTML parsed (set in index.html <meta>, no JS needed)
 *   boot-js        → JS module executed (set in boot.ts before dynamic import)
 *   react-mounted  → React Root rendered at least once (set in main.tsx)
 *   engine-ready   → WASM engine ready (set in main.tsx inside EngineContext.Provider)
 *   engine-fatal   → WASM engine failed (set in EngineFatalError component)
 *
 * Key exports
 * ───────────
 * waitForEngineOrFatal   – two-stage wait (react-mounted → engine-ready/fatal);
 *                          dumps structured diagnostics on timeout
 * waitForCanvasOrFatal   – two-stage wait (react-mounted → canvas-computed/fatal)
 * test                   – custom test object with a worker-scoped `enginePage`
 *                          fixture (WASM compiled once per worker, reused across
 *                          tests in the same file)
 * expect                 – re-exported from @playwright/test
 */

import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

// ── Diagnostic helpers ────────────────────────────────────────────────────────

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
 * Dump structured boot diagnostics to stderr when a sentinel times out.
 *
 * Reports:
 *  • page URL (catches wrong-server / wrong-port situations)
 *  • boot ladder state — which rungs are present in the DOM
 *  • WASM / worker resources from the browser's PerformanceResourceTiming API
 *    (URL path + fetch duration) — works without knowing the hashed filename
 *  • console errors passed by the caller
 */
async function dumpBootDiagnostics(
  page: Page,
  failedAt: string,
  consoleErrors?: string[],
): Promise<void> {
  const url = page.url()

  // Query the boot ladder from the live DOM.
  const ladder = await page
    .evaluate(() => ({
      bootHtml: !!document.querySelector('[data-testid="boot-html"]'),
      bootJs: !!document.querySelector('[data-testid="boot-js"]'),
      reactMounted: !!document.querySelector('[data-testid="react-mounted"]'),
      engineReady: !!document.querySelector('[data-testid="engine-ready"]'),
      engineFatal: !!document.querySelector('[data-testid="engine-fatal"]'),
      rootInnerHtml: (document.getElementById('root')?.innerHTML ?? '').slice(0, 300),
    }))
    .catch(() => ({ error: 'page.evaluate failed — renderer may have crashed' }))

  // Find WASM / worker resources via the browser's performance timeline.
  // This works without knowing the content-hashed asset filename.
  const networkResources = await page
    .evaluate(() =>
      (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter((e) => e.name.includes('.wasm') || e.name.includes('worker'))
        .map((e) => ({
          path: new URL(e.name).pathname,
          ms: Math.round(e.duration),
          // responseStatus is available in modern Chromium via the extended timing API
          status: (e as PerformanceResourceTiming & { responseStatus?: number }).responseStatus ?? '?',
        })),
    )
    .catch(() => [])

  const errors = (consoleErrors ?? []).slice(0, 10)

  console.error(
    [
      '',
      `[e2e boot-diagnostic] Hung waiting for: ${failedAt}`,
      `  Page URL      : ${url}`,
      `  Boot ladder   : ${JSON.stringify(ladder)}`,
      `  WASM/worker   : ${networkResources.length ? JSON.stringify(networkResources) : 'none found in PerformanceTiming'}`,
      `  Console errors: ${errors.length ? errors.join(' | ') : 'none'}`,
    ].join('\n'),
  )
}

// ── Deterministic wait helpers ────────────────────────────────────────────────

/**
 * Wait for the WASM engine to either succeed (engine-ready) or fail
 * (engine-fatal).
 *
 * Uses a two-stage boot-ladder approach:
 *   Stage 1 (15 s): wait for react-mounted — React has rendered.
 *     Failure here means boot.ts or main.tsx failed to execute.
 *   Stage 2 (55 s): wait for engine-ready OR engine-fatal.
 *     Failure here means WASM init hung (worker crash, init loop, etc.).
 *
 * On any timeout, structured diagnostics are printed to stderr before throwing.
 *
 * @param page          Playwright Page
 * @param consoleErrors Optional array of collected console error strings to
 *                      include in the failure message for easier debugging.
 */
export async function waitForEngineOrFatal(
  page: Page,
  consoleErrors?: string[],
): Promise<void> {
  // ── Stage 1: React must mount quickly ──────────────────────────────────────
  try {
    await page
      .locator('[data-testid="react-mounted"]')
      .waitFor({ state: 'attached', timeout: 15_000 })
  } catch {
    await dumpBootDiagnostics(page, 'react-mounted (15 s)', consoleErrors)
    throw new Error(
      '[engine] React never mounted — boot.ts or main.tsx import failed ' +
        '(check boot-js sentinel; if missing, JS never ran)',
    )
  }

  // ── Stage 2: WASM init (can be slow on cold CI runners) ───────────────────
  try {
    await page
      .locator('[data-testid="engine-ready"], [data-testid="engine-fatal"]')
      .first()
      .waitFor({ state: 'attached', timeout: 55_000 })
  } catch {
    await dumpBootDiagnostics(page, 'engine-ready / engine-fatal (55 s)', consoleErrors)
    throw new Error(
      '[engine] WASM engine never became ready or fatal — ' +
        'init hung or Web Worker failed to load',
    )
  }

  // ── Fatal check ────────────────────────────────────────────────────────────
  // Use count() instead of isVisible() — robust regardless of CSS visibility.
  if ((await page.locator('[data-testid="engine-fatal"]').count()) > 0) {
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
 *
 * Same two-stage approach as waitForEngineOrFatal.
 */
export async function waitForCanvasOrFatal(
  page: Page,
  consoleErrors?: string[],
): Promise<void> {
  // ── Stage 1: React must mount quickly ──────────────────────────────────────
  try {
    await page
      .locator('[data-testid="react-mounted"]')
      .waitFor({ state: 'attached', timeout: 15_000 })
  } catch {
    await dumpBootDiagnostics(page, 'react-mounted (15 s)', consoleErrors)
    throw new Error('[engine] React never mounted — canvas route failed to boot')
  }

  // ── Stage 2: canvas eval + WASM ────────────────────────────────────────────
  try {
    await page
      .locator('[data-testid="canvas-computed"], [data-testid="engine-fatal"]')
      .first()
      .waitFor({ state: 'attached', timeout: 55_000 })
  } catch {
    await dumpBootDiagnostics(page, 'canvas-computed / engine-fatal (55 s)', consoleErrors)
    throw new Error(
      '[engine] Canvas never computed — WASM init hung or canvas route ' +
        'failed to evaluate the starter graph',
    )
  }

  // ── Fatal check ────────────────────────────────────────────────────────────
  if ((await page.locator('[data-testid="engine-fatal"]').count()) > 0) {
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
