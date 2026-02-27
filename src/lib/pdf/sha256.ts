/**
 * sha256.ts — CSP-safe SHA-256 hashing using the Web Crypto API.
 *
 * No eval, no external libraries — uses the browser's native
 * crypto.subtle.digest which is available in all modern browsers
 * and Web Workers.
 */

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
