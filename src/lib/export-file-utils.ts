/**
 * export-file-utils.ts — Shared helpers for all export modules.
 *
 * Single canonical implementations of:
 *   - downloadBlob      — triggers a browser download from a Blob
 *   - safeName          — sanitises a project name for use in filenames
 *   - formatTimestampForFilename — compact ISO-8601 slice safe for filenames
 *
 * Imported by src/lib/pdf/, src/lib/xlsx/, and src/lib/chainsolvejson/.
 * Do not duplicate these helpers in individual export modules.
 */

/** Trigger a browser download for the given Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Sanitise a project name for use in export filenames.
 * Replaces any character that is not alphanumeric, underscore, or hyphen
 * with an underscore, and truncates to 80 characters.
 */
export function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)
}

/**
 * Convert an ISO-8601 timestamp to a compact string safe for filenames.
 * Example: "2026-02-27T13:04:00.000Z" → "2026022713040"
 */
export function formatTimestampForFilename(iso: string): string {
  return iso.replace(/[-:T]/g, '').slice(0, 13)
}
