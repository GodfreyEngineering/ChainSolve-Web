/**
 * captureCanvasImage.ts — Robust viewport capture with fallback ladder.
 *
 * Uses html-to-image's toBlob (lazy-loaded) to produce raw PNG bytes
 * suitable for pdf-lib's embedPng. Avoids base64 data URLs to halve
 * peak memory usage on large canvases.
 *
 * Fallback ladder:
 *   1. pixelRatio = 2 (if under MAX_CAPTURE_PIXELS)
 *   2. pixelRatio = 1
 *   3. pixelRatio = 1 with downscale (if element is huge)
 *   4. Skip — return null with error
 */

import { loadPdfLib } from '../pdf-loader'

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum total pixels in the output canvas. Chrome crashes above ~16M. */
export const MAX_CAPTURE_PIXELS = 16_777_216 // 4096 × 4096

// ── Types ────────────────────────────────────────────────────────────────────

export interface CaptureOptions {
  /** The DOM element to capture (typically .react-flow__viewport). */
  element: HTMLElement
  /** Desired pixel ratio (default 2). */
  pixelRatio?: number
  /** Background colour (CSS value). */
  backgroundColor?: string
  /** AbortSignal for cancellation. */
  signal?: AbortSignal
}

export interface CaptureResult {
  /** Raw PNG bytes, or null if all fallback rungs failed. */
  bytes: Uint8Array | null
  /** Which fallback rung was used (for diagnostics). */
  rung: 'pr2' | 'pr1' | 'pr1-downscale' | 'skipped'
  /** Error message if capture failed. */
  error?: string
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Compute the effective pixelRatio that keeps total output pixels under the cap.
 *
 * Pure function — safe to unit-test without DOM.
 */
export function computeSafePixelRatio(
  elementWidth: number,
  elementHeight: number,
  desiredRatio: number,
  maxPixels: number = MAX_CAPTURE_PIXELS,
): number {
  if (elementWidth <= 0 || elementHeight <= 0) return desiredRatio
  const outputPixels = elementWidth * desiredRatio * (elementHeight * desiredRatio)
  if (outputPixels <= maxPixels) return desiredRatio
  // Scale down: sqrt(maxPixels / (w * h))
  return Math.sqrt(maxPixels / (elementWidth * elementHeight))
}

// ── Main capture function ────────────────────────────────────────────────────

/**
 * Attempt to capture the viewport element as a PNG Uint8Array,
 * using the fallback ladder: PR=2 → PR=1 → PR=1-downscale → skip.
 */
export async function captureCanvasImage(opts: CaptureOptions): Promise<CaptureResult> {
  const { element, pixelRatio = 2, backgroundColor, signal } = opts

  if (signal?.aborted) {
    return { bytes: null, rung: 'skipped', error: 'Aborted' }
  }

  const { toBlob } = await loadPdfLib()
  const w = element.offsetWidth
  const h = element.offsetHeight

  if (w <= 0 || h <= 0) {
    return { bytes: null, rung: 'skipped', error: 'Element has zero dimensions' }
  }

  // Build ordered list of attempts
  const attempts: { ratio: number; rung: CaptureResult['rung'] }[] = []

  const safePr2 = computeSafePixelRatio(w, h, pixelRatio)
  if (safePr2 >= 2) {
    attempts.push({ ratio: 2, rung: 'pr2' })
  }

  const safePr1 = computeSafePixelRatio(w, h, 1)
  if (safePr1 >= 1) {
    attempts.push({ ratio: 1, rung: 'pr1' })
  } else {
    attempts.push({ ratio: safePr1, rung: 'pr1-downscale' })
  }

  for (const attempt of attempts) {
    if (signal?.aborted) {
      return { bytes: null, rung: 'skipped', error: 'Aborted' }
    }

    try {
      const blob = await toBlob(element, {
        pixelRatio: attempt.ratio,
        backgroundColor,
      })

      if (!blob) {
        continue // toBlob returned null — try next rung
      }

      const buffer = await blob.arrayBuffer()
      return { bytes: new Uint8Array(buffer), rung: attempt.rung }
    } catch {
      // This rung failed — try the next one
      continue
    }
  }

  return { bytes: null, rung: 'skipped', error: 'All capture attempts failed' }
}
