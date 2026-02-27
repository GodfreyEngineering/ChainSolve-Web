/**
 * pdf-loader.ts — Lazy-loads pdf-lib and html-to-image.
 *
 * Follows the same cached-promise pattern as vega-loader.ts.
 * No static imports — both libraries are code-split out of the
 * initial bundle and only fetched when the user triggers PDF export.
 */

import type { PDFDocument, PDFFont, PDFPage, PDFImage, StandardFonts } from 'pdf-lib'

export interface PdfAPI {
  /** pdf-lib module */
  PDFDocument: typeof PDFDocument
  StandardFonts: typeof StandardFonts
  rgb: typeof import('pdf-lib').rgb
  /** html-to-image toPng function */
  toPng: (node: HTMLElement, options?: Record<string, unknown>) => Promise<string>
}

export type { PDFDocument, PDFFont, PDFPage, PDFImage }

let cached: Promise<PdfAPI> | null = null

export function loadPdfLib(): Promise<PdfAPI> {
  if (cached) return cached
  cached = (async () => {
    const [pdfLib, htmlToImage] = await Promise.all([import('pdf-lib'), import('html-to-image')])
    return {
      PDFDocument: pdfLib.PDFDocument,
      StandardFonts: pdfLib.StandardFonts,
      rgb: pdfLib.rgb,
      toPng: htmlToImage.toPng as PdfAPI['toPng'],
    }
  })()
  return cached
}
