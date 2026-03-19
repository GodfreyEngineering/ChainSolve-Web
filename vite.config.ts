import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { wasmHotReload } from './vite-plugin-wasm-reload'

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

function getPkgVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Injects the current git SHA into dist/sw.js as the CACHE_VERSION.
 * This ensures sw.js content changes on every deployment, which causes the
 * browser to detect the new SW and install it — invalidating stale caches.
 * Without this, sw.js would be byte-identical across builds and the browser
 * would never detect a new SW, leaving users with the original cached chunks.
 */
function swCacheVersionPlugin() {
  return {
    name: 'sw-cache-version',
    apply: 'build' as const,
    closeBundle() {
      const sha = getGitSha()
      const swPath = resolve(__dirname, 'dist/sw.js')
      try {
        const content = readFileSync(swPath, 'utf-8')
        writeFileSync(swPath, content.replace('__BUILD_HASH__', sha))
      } catch {
        // sw.js not present (e.g. wasm-only partial builds) — safe to skip.
      }
    },
  }
}

// DEV-04: Upload source maps to Sentry during production builds when
// SENTRY_AUTH_TOKEN and VITE_SENTRY_DSN are set. Safe to omit in local dev.
const sentryPlugin =
  process.env.SENTRY_AUTH_TOKEN && process.env.VITE_SENTRY_DSN
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT ?? 'chainsolve-web',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      })
    : null

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasmHotReload(), swCacheVersionPlugin(), ...(sentryPlugin ? [sentryPlugin] : [])],
  define: {
    __CS_VERSION__: JSON.stringify(getPkgVersion()),
    __CS_SHA__: JSON.stringify(getGitSha()),
    __CS_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __CS_ENV__: JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  resolve: {
    alias: {
      '@engine-wasm': resolve(__dirname, 'crates/engine-wasm/pkg'),
    },
  },
  build: {
    manifest: true,
    // The main chunk contains core SPA infrastructure (React, router,
    // engine bridge). The block registry and all domain block files are
    // loaded as a lazy chunk (dynamic import in main.tsx) to stay under the
    // initial JS budget. 1500 KB guards against accidental hoisting.
    // UI-PERF-05: block registry lazy-loaded post engine-init.
    chunkSizeWarningLimit: 1500,
    // TEMPORARY: Disable minification so React #185 error shows real component names.
    // Remove after diagnosing the infinite loop.
    sourcemap: true,
    minify: false,
  },
  worker: {
    format: 'es',
  },
})
