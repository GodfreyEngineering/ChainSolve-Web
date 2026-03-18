/**
 * tauriFs.ts
 *
 * Native file system helpers for the Tauri desktop app.
 * Wraps tauri-plugin-fs and tauri-plugin-dialog for open/save dialogs.
 *
 * Falls back gracefully when not running in Tauri (returns null/false).
 */

import { isTauri } from './tauriEngine'

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

function getInvoke(): TauriInvoke {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (w.__TAURI_INTERNALS__?.invoke) return w.__TAURI_INTERNALS__.invoke as TauriInvoke
  if (w.__TAURI__?.invoke) return w.__TAURI__.invoke as TauriInvoke
  throw new Error('[TAURI_FS] invoke not available')
}

// ---------------------------------------------------------------------------
// Open project file dialog
// ---------------------------------------------------------------------------

/**
 * Opens a native file picker dialog for .chainsolvejson files.
 * Returns the file contents as a string, or null if the user cancelled.
 */
export async function openProjectFile(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const invoke = getInvoke()

    // Open dialog via tauri-plugin-dialog
    const filePath = await invoke('plugin:dialog|open', {
      multiple: false,
      directory: false,
      filters: [
        { name: 'ChainSolve Project', extensions: ['chainsolvejson', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      title: 'Open ChainSolve Project',
    })

    if (!filePath || filePath === null) return null

    // Read file via tauri-plugin-fs
    const contents = await invoke('plugin:fs|read_text_file', {
      path: filePath,
    })
    return contents as string
  } catch (e) {
    console.error('[TAURI_FS] openProjectFile failed:', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Save project file dialog
// ---------------------------------------------------------------------------

/**
 * Opens a native save dialog and writes the project JSON to disk.
 * Returns the path where the file was saved, or null if cancelled.
 */
export async function saveProjectFile(
  contents: string,
  defaultName = 'project.chainsolvejson',
): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const invoke = getInvoke()

    const savePath = await invoke('plugin:dialog|save', {
      defaultPath: defaultName,
      filters: [
        { name: 'ChainSolve Project', extensions: ['chainsolvejson', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      title: 'Save ChainSolve Project',
    })

    if (!savePath || savePath === null) return null

    await invoke('plugin:fs|write_text_file', {
      path: savePath,
      contents,
    })

    return savePath as string
  } catch (e) {
    console.error('[TAURI_FS] saveProjectFile failed:', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Export PDF / Excel helper
// ---------------------------------------------------------------------------

/**
 * Saves a Blob (e.g. PDF or Excel) to a user-selected path.
 * Returns the saved path, or null if cancelled.
 */
export async function saveExportFile(
  blob: Blob,
  defaultName: string,
  mimeLabel: string,
  extensions: string[],
): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const invoke = getInvoke()

    const savePath = await invoke('plugin:dialog|save', {
      defaultPath: defaultName,
      filters: [{ name: mimeLabel, extensions }, { name: 'All Files', extensions: ['*'] }],
      title: `Save ${mimeLabel}`,
    })

    if (!savePath) return null

    // Convert Blob to Uint8Array and write binary
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = Array.from(new Uint8Array(arrayBuffer))

    await invoke('plugin:fs|write_binary_file', {
      path: savePath,
      contents: bytes,
    })

    return savePath as string
  } catch (e) {
    console.error('[TAURI_FS] saveExportFile failed:', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Recent files (stored in AppData)
// ---------------------------------------------------------------------------

const RECENT_FILE = 'recent_projects.json'
const MAX_RECENT = 20

export async function addRecentFile(filePath: string): Promise<void> {
  if (!isTauri()) return
  try {
    const invoke = getInvoke()
    let paths: string[] = []
    try {
      const raw = await invoke('plugin:fs|read_text_file', {
        path: { path: RECENT_FILE, baseDir: 'AppData' },
      })
      paths = JSON.parse(raw as string)
    } catch {
      // File doesn't exist yet
    }
    paths = [filePath, ...paths.filter((p) => p !== filePath)].slice(0, MAX_RECENT)
    await invoke('plugin:fs|write_text_file', {
      path: { path: RECENT_FILE, baseDir: 'AppData' },
      contents: JSON.stringify(paths),
    })
  } catch {
    // Ignore errors for recent files — non-critical
  }
}

export async function getRecentFiles(): Promise<string[]> {
  if (!isTauri()) return []
  try {
    const invoke = getInvoke()
    const raw = await invoke('plugin:fs|read_text_file', {
      path: { path: RECENT_FILE, baseDir: 'AppData' },
    })
    return JSON.parse(raw as string) as string[]
  } catch {
    return []
  }
}
