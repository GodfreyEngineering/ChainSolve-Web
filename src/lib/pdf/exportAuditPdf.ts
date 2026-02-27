/**
 * exportAuditPdf.ts — Renders an audit-ready PDF from an AuditModel.
 *
 * Uses pdf-lib (lazy-loaded) to create A4 pages with standard fonts.
 * No eval, no inline scripts — fully CSP-safe.
 */

import type { PDFFont, PDFPage } from '../pdf-loader'
import { loadPdfLib } from '../pdf-loader'
import type { AuditModel } from './auditModel'

// ── Constants ────────────────────────────────────────────────────────────────

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const MARGIN = 50
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN
const LINE_HEIGHT = 14
const SECTION_GAP = 20
const FOOTER_Y = 30

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Truncate text to fit within maxWidth using the given font/size. */
function truncateText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let truncated = text
  while (truncated.length > 0 && font.widthOfTextAtSize(truncated + '...', size) > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '...'
}

// ── Page manager ─────────────────────────────────────────────────────────────

interface PageManager {
  page: PDFPage
  y: number
  ensureSpace(needed: number): void
  drawText(text: string, opts: { font: PDFFont; size: number; indent?: number }): void
  drawSectionTitle(text: string, font: PDFFont): void
  drawKeyValue(key: string, value: string, fontRegular: PDFFont, fontBold: PDFFont): void
}

function createPageManager(
  doc: { addPage: (size: [number, number]) => PDFPage },
  footerFont: PDFFont,
  projectName: string,
): PageManager {
  let pageNumber = 0

  function addFooter(p: PDFPage) {
    pageNumber++
    p.drawText(`${projectName} — Audit Report — Page ${pageNumber}`, {
      x: MARGIN,
      y: FOOTER_Y,
      size: 8,
      font: footerFont,
    })
  }

  function newPage(): PDFPage {
    const p = doc.addPage([A4_WIDTH, A4_HEIGHT])
    addFooter(p)
    return p
  }

  let page = newPage()
  let y = A4_HEIGHT - MARGIN

  const mgr: PageManager = {
    get page() {
      return page
    },
    get y() {
      return y
    },
    set y(val: number) {
      y = val
    },

    ensureSpace(needed: number) {
      if (y - needed < FOOTER_Y + 20) {
        page = newPage()
        y = A4_HEIGHT - MARGIN
      }
    },

    drawText(text: string, opts) {
      const indent = opts.indent ?? 0
      mgr.ensureSpace(opts.size + 4)
      page.drawText(text, {
        x: MARGIN + indent,
        y,
        size: opts.size,
        font: opts.font,
      })
      y -= opts.size + 4
    },

    drawSectionTitle(text: string, font: PDFFont) {
      y -= SECTION_GAP
      mgr.ensureSpace(16)
      page.drawText(text, { x: MARGIN, y, size: 12, font })
      y -= 16

      // Underline
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + CONTENT_WIDTH, y },
        thickness: 0.5,
      })
      y -= 8
    },

    drawKeyValue(key: string, value: string, fontRegular: PDFFont, fontBold: PDFFont) {
      mgr.ensureSpace(LINE_HEIGHT)
      page.drawText(`${key}:`, { x: MARGIN, y, size: 9, font: fontBold })
      page.drawText(value, { x: MARGIN + 140, y, size: 9, font: fontRegular })
      y -= LINE_HEIGHT
    },
  }

  return mgr
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function exportAuditPdf(
  model: AuditModel,
  graphImageDataUrl: string | null,
): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()

  const doc = PDFDocument.create()
  const [fontRegular, fontBold, fontMono] = await Promise.all([
    doc.then((d) => d.embedFont(StandardFonts.Helvetica)),
    doc.then((d) => d.embedFont(StandardFonts.HelveticaBold)),
    doc.then((d) => d.embedFont(StandardFonts.Courier)),
  ])

  const pdfDoc = await doc
  const pm = createPageManager(pdfDoc, fontRegular, model.meta.projectName)

  // ── Cover / Meta ───────────────────────────────────────────────────────────

  pm.drawText('ChainSolve Audit Report', { font: fontBold, size: 18 })
  pm.y -= 8
  pm.drawText(model.meta.projectName, { font: fontRegular, size: 14 })
  pm.y -= SECTION_GAP

  pm.drawKeyValue('Project ID', model.meta.projectId ?? '(scratch)', fontRegular, fontBold)
  pm.drawKeyValue('Export timestamp', model.meta.exportTimestamp, fontRegular, fontBold)
  pm.drawKeyValue('Build version', model.meta.buildVersion, fontRegular, fontBold)
  pm.drawKeyValue('Build SHA', model.meta.buildSha, fontRegular, fontBold)
  pm.drawKeyValue('Build time', model.meta.buildTime, fontRegular, fontBold)
  pm.drawKeyValue('Build env', model.meta.buildEnv, fontRegular, fontBold)
  pm.drawKeyValue('Engine version', model.meta.engineVersion, fontRegular, fontBold)
  pm.drawKeyValue('Contract version', String(model.meta.contractVersion), fontRegular, fontBold)
  pm.drawKeyValue('Nodes', String(model.meta.nodeCount), fontRegular, fontBold)
  pm.drawKeyValue('Edges', String(model.meta.edgeCount), fontRegular, fontBold)

  // ── Snapshot Hash ──────────────────────────────────────────────────────────

  pm.drawSectionTitle('Snapshot Hash (SHA-256)', fontBold)
  pm.drawText(model.snapshotHash, { font: fontMono, size: 8 })

  // ── Graph Health ───────────────────────────────────────────────────────────

  pm.drawSectionTitle('Graph Health Summary', fontBold)
  for (const line of model.healthSummary.split('\n')) {
    pm.drawText(line, { font: fontRegular, size: 9 })
  }

  // ── Evaluation Summary ─────────────────────────────────────────────────────

  pm.drawSectionTitle('Engine Evaluation Summary', fontBold)
  pm.drawKeyValue('Elapsed', `${model.evalElapsedMs.toFixed(2)} ms`, fontRegular, fontBold)
  pm.drawKeyValue('Partial', model.evalPartial ? 'Yes' : 'No', fontRegular, fontBold)
  pm.drawKeyValue(
    'Diagnostics',
    `${model.diagnosticCounts.error} errors, ${model.diagnosticCounts.warning} warnings, ${model.diagnosticCounts.info} info`,
    fontRegular,
    fontBold,
  )

  // ── Diagnostics Table ──────────────────────────────────────────────────────

  if (model.diagnostics.length > 0) {
    pm.drawSectionTitle('Diagnostics', fontBold)

    // Header
    pm.ensureSpace(LINE_HEIGHT)
    const headerY = pm.y
    pm.page.drawText('Node ID', { x: MARGIN, y: headerY, size: 8, font: fontBold })
    pm.page.drawText('Level', { x: MARGIN + 80, y: headerY, size: 8, font: fontBold })
    pm.page.drawText('Code', { x: MARGIN + 130, y: headerY, size: 8, font: fontBold })
    pm.page.drawText('Message', { x: MARGIN + 210, y: headerY, size: 8, font: fontBold })
    pm.y -= LINE_HEIGHT

    for (const d of model.diagnostics) {
      pm.ensureSpace(LINE_HEIGHT)
      const rowY = pm.y
      const col =
        d.level === 'error'
          ? rgb(0.8, 0.1, 0.1)
          : d.level === 'warning'
            ? rgb(0.7, 0.5, 0)
            : rgb(0.3, 0.3, 0.3)
      pm.page.drawText(truncateText(d.nodeId, fontMono, 7, 70), {
        x: MARGIN,
        y: rowY,
        size: 7,
        font: fontMono,
      })
      pm.page.drawText(d.level, {
        x: MARGIN + 80,
        y: rowY,
        size: 7,
        font: fontBold,
        color: col,
      })
      pm.page.drawText(truncateText(d.code, fontMono, 7, 70), {
        x: MARGIN + 130,
        y: rowY,
        size: 7,
        font: fontMono,
      })
      pm.page.drawText(truncateText(d.message, fontRegular, 7, CONTENT_WIDTH - 210), {
        x: MARGIN + 210,
        y: rowY,
        size: 7,
        font: fontRegular,
      })
      pm.y -= LINE_HEIGHT
    }
  }

  // ── Node Value Table ───────────────────────────────────────────────────────

  pm.drawSectionTitle('Node Values', fontBold)

  // Header
  pm.ensureSpace(LINE_HEIGHT)
  const nvHeaderY = pm.y
  pm.page.drawText('Node ID', { x: MARGIN, y: nvHeaderY, size: 8, font: fontBold })
  pm.page.drawText('Label', { x: MARGIN + 70, y: nvHeaderY, size: 8, font: fontBold })
  pm.page.drawText('Block Type', { x: MARGIN + 170, y: nvHeaderY, size: 8, font: fontBold })
  pm.page.drawText('Value (compact)', { x: MARGIN + 260, y: nvHeaderY, size: 8, font: fontBold })
  pm.page.drawText('Value (full)', { x: MARGIN + 370, y: nvHeaderY, size: 8, font: fontBold })
  pm.y -= LINE_HEIGHT

  for (const row of model.nodeValues) {
    pm.ensureSpace(LINE_HEIGHT)
    const rowY = pm.y
    pm.page.drawText(truncateText(row.nodeId, fontMono, 7, 60), {
      x: MARGIN,
      y: rowY,
      size: 7,
      font: fontMono,
    })
    pm.page.drawText(truncateText(row.label, fontRegular, 7, 90), {
      x: MARGIN + 70,
      y: rowY,
      size: 7,
      font: fontRegular,
    })
    pm.page.drawText(truncateText(row.blockType, fontMono, 7, 80), {
      x: MARGIN + 170,
      y: rowY,
      size: 7,
      font: fontMono,
    })
    pm.page.drawText(truncateText(row.compact, fontRegular, 7, 100), {
      x: MARGIN + 260,
      y: rowY,
      size: 7,
      font: fontRegular,
    })
    pm.page.drawText(truncateText(row.full, fontMono, 6, CONTENT_WIDTH - 370), {
      x: MARGIN + 370,
      y: rowY,
      size: 6,
      font: fontMono,
    })
    pm.y -= LINE_HEIGHT
  }

  // ── Graph Image Page ───────────────────────────────────────────────────────

  if (graphImageDataUrl) {
    try {
      const base64 = graphImageDataUrl.split(',')[1]
      const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const pngImage = await pdfDoc.embedPng(pngBytes)

      // Fit image to a new A4 page with margins
      const imgDims = pngImage.scaleToFit(CONTENT_WIDTH, A4_HEIGHT - 2 * MARGIN - 30)

      // Force new page for graph image
      pm.ensureSpace(A4_HEIGHT)
      pm.drawSectionTitle('Graph Snapshot', fontBold)

      const imgX = MARGIN + (CONTENT_WIDTH - imgDims.width) / 2
      pm.ensureSpace(imgDims.height + 10)
      pm.page.drawImage(pngImage, {
        x: imgX,
        y: pm.y - imgDims.height,
        width: imgDims.width,
        height: imgDims.height,
      })
      pm.y -= imgDims.height + 10
    } catch {
      pm.ensureSpace(A4_HEIGHT)
      pm.drawSectionTitle('Graph Snapshot', fontBold)
      pm.drawText('Graph image unavailable (capture failed).', { font: fontRegular, size: 10 })
    }
  } else {
    pm.ensureSpace(A4_HEIGHT)
    pm.drawSectionTitle('Graph Snapshot', fontBold)
    pm.drawText('Graph image unavailable.', { font: fontRegular, size: 10 })
  }

  // ── Save & Download ────────────────────────────────────────────────────────

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

  const ts = formatTimestampForFilename(model.meta.exportTimestamp)
  const name = safeName(model.meta.projectName || 'chainsolve')
  const filename = `${name}_${ts}_audit.pdf`

  downloadBlob(blob, filename)
}
