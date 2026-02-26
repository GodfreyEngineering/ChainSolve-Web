/**
 * boot.ts — True bootloader. No static imports.
 *
 * Loaded directly by index.html. Catches import-time errors
 * (circular dependency TDZ, missing modules, etc.) that would
 * otherwise produce a blank white screen.
 *
 * Once the dynamic import('./main') succeeds, React's ErrorBoundary
 * takes over for runtime errors.
 */

function showBootError(message: string) {
  const root = document.getElementById('root')
  if (!root) return

  // Escape a string for safe use inside an HTML attribute value (double-quoted).
  // Capped at 2 000 chars — enough for any diagnostic message.
  const attrSafe = (s: string) =>
    s
      .slice(0, 2000)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  root.innerHTML = [
    // Boot ladder rung "boot-fatal": machine-readable sentinel for e2e helpers.
    // data-fatal-message carries the error text so tests can fail immediately
    // with the real cause instead of waiting for a 15-second timeout.
    '<div data-testid="boot-fatal" data-fatal-message="' +
      attrSafe(message) +
      '" style="display:none"></div>',
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;',
    'padding:2rem;font-family:system-ui,sans-serif;background:#1a1a1a;color:#f87171;text-align:center">',
    '<div style="max-width:480px">',
    '<h2 style="margin:0 0 0.75rem">Something went wrong during startup</h2>',
    '<p style="opacity:0.7;font-size:0.9rem;word-break:break-word">',
    message.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    '</p>',
    '<p style="opacity:0.4;font-size:0.75rem;margin-top:1rem">',
    'Check browser DevTools (F12 \u2192 Console) for details.</p>',
    '<button onclick="location.reload()" style="margin-top:1.5rem;padding:0.5rem 1.25rem;',
    'border-radius:8px;border:none;background:#646cff;color:#fff;font-weight:600;cursor:pointer">',
    'Reload page</button>',
    '</div></div>',
  ].join('')
}

window.addEventListener('error', (e) => showBootError(e.message))
window.addEventListener('unhandledrejection', (e) =>
  showBootError((e as PromiseRejectionEvent).reason?.message ?? String(e)),
)

// Boot ladder rung 2: JS module has executed and global error-handlers are
// installed.  The sentinel appears even if the dynamic import below fails,
// letting e2e helpers distinguish "JS never ran" from "main.tsx import error".
{
  const el = document.createElement('div')
  el.setAttribute('data-testid', 'boot-js')
  el.style.display = 'none'
  document.body.appendChild(el)
}

import('./main').catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : 'Failed to load application'
  // Log to console so the full error (including stack) appears in CI logs and
  // in browser DevTools even before Playwright can read the DOM sentinel.
  console.error('[boot] Failed to load application:', err)
  showBootError(msg)
})
