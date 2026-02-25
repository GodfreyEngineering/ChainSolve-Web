/**
 * downsample.ts — Largest-Triangle-Three-Buckets (LTTB) downsampling.
 *
 * Reduces a dataset to `threshold` points while preserving visual shape.
 * Pure function, no side effects. Original data is never mutated.
 */

export interface Point {
  x: number
  y: number
}

/**
 * Downsample a series of (x, y) points using the LTTB algorithm.
 * If the data has fewer points than `threshold`, returns it unchanged.
 */
export function lttbDownsample(data: readonly Point[], threshold: number): Point[] {
  if (data.length <= threshold || threshold < 3) return [...data]

  const sampled: Point[] = [data[0]] // Always keep first point
  const bucketSize = (data.length - 2) / (threshold - 2)

  let prevIndex = 0

  for (let i = 0; i < threshold - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length - 1)

    // Average point of next bucket (for triangle area calculation)
    const nextStart = Math.floor((i + 2) * bucketSize) + 1
    const nextEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, data.length - 1)
    let avgX = 0
    let avgY = 0
    const nextLen = Math.max(nextEnd - nextStart + 1, 1)
    for (let j = nextStart; j <= nextEnd && j < data.length; j++) {
      avgX += data[j].x
      avgY += data[j].y
    }
    avgX /= nextLen
    avgY /= nextLen

    // Find point in current bucket with largest triangle area
    const prev = data[prevIndex]
    let maxArea = -1
    let bestIndex = bucketStart

    for (let j = bucketStart; j < bucketEnd && j < data.length; j++) {
      const area = Math.abs(
        (prev.x - avgX) * (data[j].y - prev.y) - (prev.x - data[j].x) * (avgY - prev.y),
      )
      if (area > maxArea) {
        maxArea = area
        bestIndex = j
      }
    }

    sampled.push(data[bestIndex])
    prevIndex = bestIndex
  }

  sampled.push(data[data.length - 1]) // Always keep last point
  return sampled
}
