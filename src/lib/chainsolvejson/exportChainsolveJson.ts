/**
 * exportChainsolveJson.ts — Download function for .chainsolvejson project export.
 *
 * Builds the ChainsolveJsonV1 model, validates it, serializes with stable
 * key ordering, and triggers a browser download. No heavy dependencies
 * (uses only Web Crypto API and existing helpers).
 *
 * 5.11: Also exposes exportGitFriendlyProject() which produces .chainsolve files
 * with one-node-per-line formatting for clean git diffs.
 */

import { buildChainsolveJsonExport, validateNoSecrets, type BuildChainsolveJsonArgs } from './model'
import { stableStringify } from './hashes'
import { downloadBlob, safeName, formatTimestampForFilename } from '../export-file-utils'

// ── 5.11: Git-friendly serialiser ───────────────────────────────────────────

/**
 * Stable-key JSON serialiser where every element of an array-of-objects is
 * compacted to a single line (no internal newlines). All other values follow
 * normal 2-space indented pretty-printing. This makes each node/edge a
 * one-liner, producing minimal, readable git diffs.
 */
function gitFriendlyStringify(value: unknown): string {
  return serializeNode(value, 0)
}

/** Recursively stringify. Arrays whose elements are plain objects collapse to one element per line. */
function serializeNode(value: unknown, depth: number): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  const INDENT = 2
  const pad = ' '.repeat((depth + 1) * INDENT)
  const closePad = ' '.repeat(depth * INDENT)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'

    // If every element is a plain (non-array) object → compact each to one line
    const allObjects = value.every(
      (item) => item !== null && typeof item === 'object' && !Array.isArray(item),
    )
    if (allObjects) {
      const lines = value.map((item) => pad + stableStringify(item))
      return `[\n${lines.join(',\n')}\n${closePad}]`
    }

    // Mixed/scalar arrays: recurse normally
    const lines = value.map((item) => pad + serializeNode(item, depth + 1))
    return `[\n${lines.join(',\n')}\n${closePad}]`
  }

  // Plain object: sort keys, recurse into values
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => {
      const v = (value as Record<string, unknown>)[k]
      return `${pad}${JSON.stringify(k)}: ${serializeNode(v, depth + 1)}`
    })

  if (entries.length === 0) return '{}'
  return `{\n${entries.join(',\n')}\n${closePad}}`
}

// ── Standard .chainsolvejson export ─────────────────────────────────────────

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

// ── 5.11: Git-friendly .chainsolve export ───────────────────────────────────

/**
 * Export the project in git-friendly format: deterministic key ordering,
 * each node/edge on a single line, .chainsolve extension.
 *
 * This makes `git diff` output human-readable — each changed node appears as
 * a single modified line instead of a multi-line chunk.
 */
export async function exportGitFriendlyProject(args: BuildChainsolveJsonArgs): Promise<void> {
  const model = await buildChainsolveJsonExport(args)

  const text = gitFriendlyStringify(model)

  // Validate no secrets leaked
  const secretCheck = validateNoSecrets(text)
  if (!secretCheck.ok) {
    throw new Error(`Export blocked: forbidden fields detected: ${secretCheck.found.join(', ')}`)
  }

  const blob = new Blob([text], { type: 'application/json' })
  const name = safeName(args.projectName || 'chainsolve')
  const ts = formatTimestampForFilename(args.exportedAt)
  const filename = `${name}_${ts}.chainsolve`

  downloadBlob(blob, filename)
}
