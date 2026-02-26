import { defineConfig, devices } from '@playwright/test'

// Chromium launch flags shared by all projects.
const chromiumArgs = [
  // --disable-dev-shm-usage: /dev/shm is only 64 MB in most containers/codespaces;
  // Chromium's renderer writes shared memory there, causing page crashes when the
  // WASM binary is compiled repeatedly. Redirecting to /tmp eliminates the crash.
  '--disable-dev-shm-usage',
]

export default defineConfig({
  testDir: 'e2e',

  // 90 s per test: the two-stage boot-ladder wait (15 s react-mounted + 55 s
  // engine-ready) totals 70 s in the worst case.  90 s leaves 20 s headroom for
  // the diagnostic dump and other test body work before the hard deadline fires.
  timeout: 90_000,

  // In CI run sequentially; locally Playwright picks an appropriate default.
  workers: process.env.CI ? 1 : undefined,

  // Retries catch transient infrastructure hiccups without hiding real bugs.
  retries: process.env.CI ? 2 : 0,

  // Assertion deadline: engine API calls resolve in < 1 ms once WASM is loaded;
  // 15 s is ample even on slow machines.
  expect: {
    timeout: 15_000,
  },

  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    // 60 s for the preview server to start after a fresh build in CI.
    timeout: 60_000,
  },

  projects: [
    // ── smoke ──────────────────────────────────────────────────────────────
    // Minimal CI suite: static asset checks + engine boot + canvas eval.
    // Only smoke.spec.ts runs.  One WASM compilation for the engine-ready test;
    // all other tests are instant (HTTP, meta-tag, title).
    // Target: < 90 s stable on repeated runs.
    {
      name: 'smoke',
      testMatch: '**/smoke.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: chromiumArgs },
      },
    },

    // ── full ───────────────────────────────────────────────────────────────
    // Complete suite: all spec files including wasm-engine.spec.ts.
    // wasm-engine.spec.ts uses the worker-scoped `enginePage` fixture so
    // WASM is compiled once per worker, not once per test (~16 API tests share
    // one V8 compilation).
    // Run via: npm run test:e2e:full   (nightly workflow or manual dispatch)
    {
      name: 'full',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: chromiumArgs },
      },
    },
  ],
})
