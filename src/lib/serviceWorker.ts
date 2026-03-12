/**
 * serviceWorker.ts — Service worker registration and lifecycle management.
 *
 * Registers `public/sw.js` on supported browsers.
 * Exposes helpers for checking for updates and prompting the user to reload.
 */

/** True when the browser supports service workers and we are on HTTPS (or localhost). */
export function isServiceWorkerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost')
  )
}

/**
 * Register the service worker. Safe to call multiple times — the browser
 * deduplicates registrations automatically.
 *
 * @param onUpdateReady  Called when a new SW version is waiting to activate.
 *                       The callback receives a function that, when called,
 *                       tells the waiting SW to activate immediately.
 */
export async function registerServiceWorker(
  onUpdateReady?: (activate: () => void) => void,
): Promise<void> {
  if (!isServiceWorkerSupported()) return

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    // Check for an update every time the page gains focus.
    const checkUpdate = () => registration.update().catch(() => {})
    window.addEventListener('focus', checkUpdate, { passive: true })

    // Track when a new SW enters the 'waiting' state.
    const handleWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && onUpdateReady) {
        onUpdateReady(() => {
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
          window.location.reload()
        })
      }
    }

    // Already waiting (page was loaded while a new SW was pending).
    if (registration.waiting) handleWaiting(registration)

    // New SW just entered waiting state.
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            handleWaiting(registration)
          }
        })
      }
    })
  } catch {
    // SW registration failure is non-fatal.
  }
}

// ── PWA install prompt ────────────────────────────────────────────────────────

/** The BeforeInstallPromptEvent captured from the browser. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _installPrompt: any = null

/**
 * Listen for the `beforeinstallprompt` event and store it so the app can
 * show a custom "Add to Home Screen" button at the right moment.
 *
 * Call this once at app startup.
 */
export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // Suppress the browser's default install mini-bar
    _installPrompt = e
  })
}

/**
 * Trigger the browser's PWA install prompt (if captured).
 * @returns true if the prompt was shown, false if unavailable.
 */
export async function promptInstall(): Promise<boolean> {
  if (!_installPrompt) return false
  _installPrompt.prompt()
  const { outcome } = await _installPrompt.userChoice
  _installPrompt = null
  return outcome === 'accepted'
}

/** True when a PWA install prompt is available. */
export function canInstall(): boolean {
  return _installPrompt !== null
}
