import { defineConfig } from 'vitest/config'

// Unit test config — pure TypeScript modules only.
// Does NOT build WASM or start Vite.  Runs in jsdom environment so
// Web APIs (localStorage, crypto.subtle, fetch) are available.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.e2e.ts', 'e2e/**'],
    // Coverage: `npm run test:coverage` (not run in verify-ci to keep CI fast).
    // Thresholds enforce a floor for src/lib and src/engine — the areas with
    // the most unit-testable pure logic.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/engine/**'],
      // worker.ts executes inside a Web Worker context and cannot be loaded by
      // jsdom; exclude it from the collection set.
      exclude: ['src/engine/worker.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
      reporter: ['text', 'lcov'],
      // Lines/statements floor is set below 50 % because large I/O modules
      // (PDF, Excel, WASM hook, service-layer) have 0 line coverage in jsdom
      // — they require integration-level mocking.  Functions and branches are
      // much higher because those modules exist but their bodies aren't traced.
      // These floors prevent regressions in the well-tested pure-logic files.
      thresholds: {
        lines: 44,
        functions: 78,
        branches: 72,
        statements: 44,
      },
    },
  },
})
