/**
 * hashes.ts — Hash helpers for .chainsolvejson export.
 *
 * Re-exports existing sha256Hex and stableStringify from the pdf helpers,
 * plus adds sha256BytesHex for hashing raw byte arrays.
 */

export { sha256Hex } from '../pdf/sha256'
export { stableStringify } from '../pdf/stableStringify'

/** SHA-256 hex digest for raw bytes (CSP-safe, uses Web Crypto API). */
export async function sha256BytesHex(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
