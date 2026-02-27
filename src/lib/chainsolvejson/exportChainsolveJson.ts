/**
 * exportChainsolveJson.ts — Download function for .chainsolvejson project export.
 *
 * Builds the ChainsolveJsonV1 model, validates it, serializes with stable
 * key ordering, and triggers a browser download. No heavy dependencies
 * (uses only Web Crypto API and existing helpers).
 */

import { buildChainsolveJsonExport, validateNoSecrets, type BuildChainsolveJsonArgs } from './model'
import { stableStringify } from './hashes'

// ── Helpers ─────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)
}

function formatTimestampForFilename(iso: string): string {
  return iso.replace(/[-:T]/g, '').slice(0, 13)
}

// ── Export function ─────────────────────────────────────────────────────────

export async function exportChainsolveJsonProject(args: BuildChainsolveJsonArgs): Promise<void> {
  // Build the export model
  const model = await buildChainsolveJsonExport(args)

  // Serialize with stable key ordering (deterministic)
  // Pretty-print for readability since it's a project archive
  const raw = stableStringify(model)
  // Parse and re-stringify with indentation for human-readable output
  const pretty = JSON.stringify(JSON.parse(raw), null, 2)

  // Validate no secrets leaked
  const secretCheck = validateNoSecrets(pretty)
  if (!secretCheck.ok) {
    throw new Error(`Export blocked: forbidden fields detected: ${secretCheck.found.join(', ')}`)
  }

  // Create blob and download
  const blob = new Blob([pretty], { type: 'application/json' })
  const name = safeName(args.projectName || 'chainsolve')
  const ts = formatTimestampForFilename(args.exportedAt)
  const filename = `${name}_${ts}.chainsolvejson`

  downloadBlob(blob, filename)
}
