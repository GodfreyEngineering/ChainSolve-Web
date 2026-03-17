/**
 * datasetHash.ts — SHA-256 content hashing for imported datasets (4.22).
 *
 * Computes a deterministic SHA-256 hex digest of a dataset's content.
 * The hash is derived from the column names and numeric values only —
 * it is independent of label, node ID, or other metadata.
 *
 * This enables reproducibility: two graphs that reference the same data
 * produce identical hashes, letting users verify data integrity.
 *
 * Uses the Web Crypto API (available in all modern browsers and Node ≥ 15).
 */

export interface HashableDataset {
  columns: string[]
  rows: readonly (readonly number[])[] | number[][]
}

/**
 * Compute a SHA-256 hex digest of a dataset.
 *
 * The payload is a UTF-8 encoding of a deterministic JSON string:
 *   { "columns": [...], "rows": [[...], ...] }
 *
 * Returns a lowercase 64-character hex string.
 */
export async function computeDatasetHash(dataset: HashableDataset): Promise<string> {
  // Build a deterministic payload: sorted columns with matching row data
  const payload = JSON.stringify({ columns: dataset.columns, rows: dataset.rows })
  const bytes = new TextEncoder().encode(payload)
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Format a SHA-256 hash for compact display: "abc123…xyz789" (first 8 + last 8 chars).
 */
export function formatHashShort(hash: string): string {
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`
}
