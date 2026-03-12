import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
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
  plugins: [react(), wasmHotReload(), ...(sentryPlugin ? [sentryPlugin] : [])],
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
    // The main chunk (~1.4 MB minified) contains core SPA infrastructure
    // (React, canvas editor, engine bridge, block registry). Route-level
    // lazy loading is in place; further splitting would fragment the hot
    // path. 1500 KB accommodates the main chunk without hiding regressions.
    chunkSizeWarningLimit: 1500,
  },
  worker: {
    format: 'es',
  },
})
