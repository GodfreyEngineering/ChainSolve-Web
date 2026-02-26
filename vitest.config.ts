import { defineConfig } from 'vitest/config'

// Unit test config — pure TypeScript modules only.
// Does NOT build WASM or start Vite.  Runs in jsdom environment so
// Web APIs (localStorage, crypto.subtle, fetch) are available.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.e2e.ts', 'e2e/**'],
  },
})
