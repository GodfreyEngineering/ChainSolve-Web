import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
