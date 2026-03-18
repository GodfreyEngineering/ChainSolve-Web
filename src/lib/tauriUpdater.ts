/**
 * tauriUpdater.ts
 *
 * Auto-update integration for the ChainSolve desktop app.
 * Uses tauri-plugin-updater to check for and install updates.
 *
 * Update server: https://releases.chainsolve.dev/{{target}}/{{arch}}/{{current_version}}
 * Update artifacts: signed .msi (Windows), .dmg (macOS), .AppImage (Linux)
 * Update format: Tauri v2 update JSON
 */

import { isTauri } from './tauriEngine'

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

function getInvoke(): TauriInvoke {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (w.__TAURI_INTERNALS__?.invoke) return w.__TAURI_INTERNALS__.invoke as TauriInvoke
  throw new Error('[TAURI_UPDATER] invoke not available')
}

export interface UpdateInfo {
  version: string
  currentVersion: string
  date?: string
  body?: string
}

export type UpdateStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'up_to_date' }
  | { status: 'downloading'; progress: number }
  | { status: 'ready_to_install'; info: UpdateInfo }
  | { status: 'error'; message: string }

// ---------------------------------------------------------------------------
// Check for update
// ---------------------------------------------------------------------------

/**
 * Checks for a new version from the update server.
 * Returns the update info if an update is available, or null if up to date.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null
  try {
    const invoke = getInvoke()
    const result = await invoke('plugin:updater|check')
    if (!result) return null
    return result as UpdateInfo
  } catch (e) {
    console.warn('[TAURI_UPDATER] checkForUpdate failed:', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Download and install update
// ---------------------------------------------------------------------------

/**
 * Downloads and installs the pending update.
 * Calls `onProgress` with a 0-100 progress value during download.
 * After installation, a restart is required.
 */
export async function downloadAndInstall(
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (!isTauri()) return
  const invoke = getInvoke()

  // Tauri v2 updater uses event-based progress via plugin:updater|download_and_install
  // We simulate progress callbacks using the response stream.
  await invoke('plugin:updater|download_and_install', {
    onChunkLength: (chunkLength: number, contentLength: number | null) => {
      if (onProgress && contentLength && contentLength > 0) {
        const pct = Math.round((chunkLength / contentLength) * 100)
        onProgress(Math.min(pct, 99))
      }
    },
    onDownloadFinished: () => onProgress?.(100),
  })
}

// ---------------------------------------------------------------------------
// Restart app (after update install)
// ---------------------------------------------------------------------------

export async function restartApp(): Promise<void> {
  if (!isTauri()) return
  try {
    await getInvoke()('plugin:process|restart')
  } catch {
    // Fallback: the update installer will restart on its own
  }
}

// ---------------------------------------------------------------------------
// Auto-update check on startup
// ---------------------------------------------------------------------------

let _startupCheckDone = false

/**
 * Runs a single startup update check (max once per app launch).
 * Calls `onUpdateAvailable` if a new version is found.
 * Silently no-ops on error (update check should never crash the app).
 */
export async function startupUpdateCheck(
  onUpdateAvailable: (info: UpdateInfo) => void,
): Promise<void> {
  if (!isTauri() || _startupCheckDone) return
  _startupCheckDone = true

  try {
    // Defer by 10 seconds so we don't delay app startup
    await new Promise<void>((resolve) => setTimeout(resolve, 10_000))
    const info = await checkForUpdate()
    if (info) onUpdateAvailable(info)
  } catch {
    // Silently ignore — update check is best-effort
  }
}
