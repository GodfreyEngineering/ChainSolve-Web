import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // In CI run sequentially to eliminate parallel-context interference.
  // Locally, Playwright picks an appropriate default (usually half CPU cores).
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  // Give assertions a longer deadline in CI where the WASM worker init can be
  // slower due to cold caches and limited /dev/shm.
  expect: {
    timeout: process.env.CI ? 15_000 : 5_000,
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
    // 60 s gives the preview server plenty of time to start in CI after build.
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // --disable-dev-shm-usage: Chromium's renderer writes shared memory to
        // /dev/shm; that partition is only 64 MB in most containers/codespaces,
        // causing renderer crashes when the WASM binary is compiled repeatedly.
        // Redirecting to /tmp eliminates the crash entirely.
        launchOptions: {
          args: ['--disable-dev-shm-usage'],
        },
      },
    },
  ],
})
