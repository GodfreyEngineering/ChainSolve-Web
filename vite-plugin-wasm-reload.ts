/**
 * vite-plugin-wasm-reload.ts — DEV-02: WASM hot reload for development.
 *
 * Watches crates/**\/*.rs and crates/**\/Cargo.toml for changes.
 * On change: debounces 300 ms, runs `npm run wasm:build:dev`, then
 * triggers a full-page reload (WASM modules cannot be hot-patched).
 *
 * Injects a small client-side script that shows a toast overlay:
 *   - "Rebuilding WASM..." (teal) during the build
 *   - Fades out on success
 *   - "WASM build failed — check terminal" (red) on error
 *
 * Only active during `vite dev` (apply: 'serve').
 */

import type { Plugin } from 'vite'
import { spawn } from 'node:child_process'

// ── Client-side toast script (injected into index.html during dev only) ──────

const CLIENT_SCRIPT = `
<script type="module" data-vite-wasm-reload>
if (import.meta.hot) {
  let _toast = null
  function _show(msg, color) {
    if (!_toast) {
      _toast = document.createElement('div')
      _toast.style.cssText = [
        'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
        'color:#fff', 'padding:10px 22px', 'border-radius:8px',
        'font:600 13px/1.4 ui-monospace,monospace', 'z-index:99999',
        'box-shadow:0 4px 16px rgba(0,0,0,.4)', 'transition:opacity .3s',
        'pointer-events:none',
      ].join(';')
      document.body.appendChild(_toast)
    }
    _toast.style.background = color
    _toast.style.opacity = '1'
    _toast.textContent = msg
  }
  function _hide() { if (_toast) _toast.style.opacity = '0' }
  import.meta.hot.on('wasm:build-start', () => _show('⚙  Rebuilding WASM\u2026', '#1CABB0'))
  import.meta.hot.on('wasm:build-done',  () => { _show('✓  WASM rebuilt', '#059669'); setTimeout(_hide, 1800) })
  import.meta.hot.on('wasm:build-error', () => _show('✗  WASM build failed \u2014 check terminal', '#dc2626'))
}
</script>`.trim()

// ── Plugin ────────────────────────────────────────────────────────────────────

export function wasmHotReload(): Plugin {
  let building = false
  let pendingRebuild = false
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  return {
    name: 'vite-plugin-wasm-hot-reload',
    apply: 'serve',

    configureServer(server) {
      // Add the crates directory to Vite's file watcher.
      // Vite's watcher is a chokidar instance; adding a directory watches it
      // recursively by default (chokidar depth: Infinity).
      server.watcher.add('crates')

      function scheduleRebuild(trigger: string) {
        if (debounceTimer !== null) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          if (building) {
            pendingRebuild = true
            return
          }
          runRebuild(trigger)
        }, 300)
      }

      function runRebuild(trigger: string) {
        building = true
        pendingRebuild = false

        console.log(`\x1b[36m[wasm-reload]\x1b[0m Rust file changed: ${trigger}`)
        console.log(`\x1b[36m[wasm-reload]\x1b[0m Running wasm:build:dev…`)

        server.hot.send('wasm:build-start', { trigger })

        const proc = spawn('npm', ['run', 'wasm:build:dev'], {
          cwd: server.config.root,
          shell: true,
          stdio: ['ignore', 'inherit', 'inherit'],
        })

        proc.on('close', (code) => {
          building = false
          if (code === 0) {
            console.log(`\x1b[32m[wasm-reload]\x1b[0m WASM rebuild succeeded — reloading.`)
            server.hot.send('wasm:build-done', {})
            // Full page reload: WASM module cannot be updated via HMR.
            server.hot.send({ type: 'full-reload' })
          } else {
            console.error(
              `\x1b[31m[wasm-reload]\x1b[0m WASM rebuild failed (exit ${code ?? '?'}).`,
            )
            server.hot.send('wasm:build-error', { code })
          }
          if (pendingRebuild) runRebuild('queued')
        })
      }

      server.watcher.on('change', (filePath: string) => {
        const normalised = filePath.replace(/\\/g, '/')
        if (
          normalised.includes('/crates/') &&
          (normalised.endsWith('.rs') || normalised.endsWith('.toml'))
        ) {
          scheduleRebuild(filePath)
        }
      })
    },

    transformIndexHtml: {
      order: 'pre',
      handler(_html, ctx) {
        // Only inject during dev server (ctx.server is set in serve mode).
        if (!ctx.server) return
        return [{ tag: 'script', attrs: { type: 'module', 'data-vite-wasm-reload': '' }, children: CLIENT_SCRIPT.replace(/<script[^>]*>|<\/script>/g, '').trim() }]
      },
    },
  }
}
