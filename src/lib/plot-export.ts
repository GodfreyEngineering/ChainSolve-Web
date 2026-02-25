/**
 * plot-export.ts — Export functions for plot visualizations.
 *
 * SVG:  view.toSVG()              → Blob → download
 * PNG:  view.toCanvas(scaleFactor) → canvas.toBlob() → download
 * CSV:  extract data from Value   → CSV string → download
 * Tab:  view.toSVG()              → Blob URL → window.open()
 */

import type { Value } from '../engine/value'
import { isVector, isTable } from '../engine/value'

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

export async function exportSVG(
  view: { toSVG: () => Promise<string> },
  filename: string,
): Promise<void> {
  const svg = await view.toSVG()
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  downloadBlob(blob, filename)
}

export async function exportPNG(
  view: { toCanvas: (opts: { scaleFactor: number }) => Promise<HTMLCanvasElement> },
  filename: string,
  scaleFactor = 2,
): Promise<void> {
  const canvas = await view.toCanvas({ scaleFactor })
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename)
      resolve()
    }, 'image/png')
  })
}

export function exportCSV(value: Value | undefined, filename: string): void {
  if (!value) return

  let csv = ''
  if (isVector(value)) {
    csv = 'index,value\n' + value.value.map((v, i) => `${i},${v}`).join('\n')
  } else if (isTable(value)) {
    csv = (value.columns as string[]).join(',') + '\n'
    csv += (value.rows as readonly (readonly number[])[]).map((row) => row.join(',')).join('\n')
  } else {
    return
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, filename)
}

export async function openSVGInNewTab(view: { toSVG: () => Promise<string> }): Promise<void> {
  const svg = await view.toSVG()
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
