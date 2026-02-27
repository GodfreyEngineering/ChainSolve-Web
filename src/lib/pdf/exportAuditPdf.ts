/**
 * exportAuditPdf.ts — Renders an audit-ready PDF from an AuditModel.
 *
 * Supports both single-canvas (v1) and multi-canvas project-level (v2) export.
 * Uses pdf-lib (lazy-loaded) to create A4 pages with standard fonts.
 * No eval, no inline scripts — fully CSP-safe.
 */

import type { PDFFont, PDFPage } from '../pdf-loader'
import { loadPdfLib } from '../pdf-loader'
import type { AuditModel, ProjectAuditModel } from './auditModel'
import { downloadBlob, safeName, formatTimestampForFilename } from '../export-file-utils'

/** pdf-lib rgb return type — avoids re-exporting the enum-based Color union. */
type RGBColor = ReturnType<Awaited<ReturnType<typeof loadPdfLib>>['rgb']>

/** PDFDocument instance type — avoids InstanceType<> on private constructor. */
type PDFDocInstance = Awaited<
  ReturnType<Awaited<ReturnType<typeof loadPdfLib>>['PDFDocument']['create']>
>

// ── Constants ────────────────────────────────────────────────────────────────

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const MARGIN = 50
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN
const LINE_HEIGHT = 14
const SECTION_GAP = 20
const FOOTER_Y = 30

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  pageNumber: number
  ensureSpace(needed: number): void
  forceNewPage(): void
  drawText(text: string, opts: { font: PDFFont; size: number; indent?: number }): void
  drawSectionTitle(text: string, font: PDFFont): void
  drawKeyValue(key: string, value: string, fontRegular: PDFFont, fontBold: PDFFont): void
}

function createPageManager(
  doc: { addPage: (size: [number, number]) => PDFPage },
  footerFont: PDFFont,
  projectName: string,
  buildSha?: string,
): PageManager {
  let pageNumber = 0

  function addFooter(p: PDFPage) {
    pageNumber++
    const shaLabel = buildSha ? ` (${buildSha.slice(0, 8)})` : ''
    p.drawText(`${projectName} — Audit Report${shaLabel} — Page ${pageNumber}`, {
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
    get pageNumber() {
      return pageNumber
    },

    ensureSpace(needed: number) {
      if (y - needed < FOOTER_Y + 20) {
        page = newPage()
        y = A4_HEIGHT - MARGIN
      }
    },

    forceNewPage() {
      page = newPage()
      y = A4_HEIGHT - MARGIN
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

// ── Shared section renderers ─────────────────────────────────────────────────

interface Fonts {
  regular: PDFFont
  bold: PDFFont
  mono: PDFFont
}

function renderDiagnosticsTable(
  pm: PageManager,
  diagnostics: { nodeId: string; level: string; code: string; message: string }[],
  fonts: Fonts,
  rgb: (r: number, g: number, b: number) => RGBColor,
): void {
  if (diagnostics.length === 0) return

  pm.drawSectionTitle('Diagnostics', fonts.bold)

  // Header
  pm.ensureSpace(LINE_HEIGHT)
  const headerY = pm.y
  pm.page.drawText('Node ID', { x: MARGIN, y: headerY, size: 8, font: fonts.bold })
  pm.page.drawText('Level', { x: MARGIN + 80, y: headerY, size: 8, font: fonts.bold })
  pm.page.drawText('Code', { x: MARGIN + 130, y: headerY, size: 8, font: fonts.bold })
  pm.page.drawText('Message', { x: MARGIN + 210, y: headerY, size: 8, font: fonts.bold })
  pm.y -= LINE_HEIGHT

  for (const d of diagnostics) {
    pm.ensureSpace(LINE_HEIGHT)
    const rowY = pm.y
    const col =
      d.level === 'error'
        ? rgb(0.8, 0.1, 0.1)
        : d.level === 'warning'
          ? rgb(0.7, 0.5, 0)
          : rgb(0.3, 0.3, 0.3)
    pm.page.drawText(truncateText(d.nodeId, fonts.mono, 7, 70), {
      x: MARGIN,
      y: rowY,
      size: 7,
      font: fonts.mono,
    })
    pm.page.drawText(d.level, {
      x: MARGIN + 80,
      y: rowY,
      size: 7,
      font: fonts.bold,
      color: col,
    })
    pm.page.drawText(truncateText(d.code, fonts.mono, 7, 70), {
      x: MARGIN + 130,
      y: rowY,
      size: 7,
      font: fonts.mono,
    })
    pm.page.drawText(truncateText(d.message, fonts.regular, 7, CONTENT_WIDTH - 210), {
      x: MARGIN + 210,
      y: rowY,
      size: 7,
      font: fonts.regular,
    })
    pm.y -= LINE_HEIGHT
  }
}

function renderNodeValuesTable(
  pm: PageManager,
  nodeValues: { nodeId: string; label: string; blockType: string; compact: string; full: string }[],
  fonts: Fonts,
): void {
  pm.drawSectionTitle('Node Values', fonts.bold)

  // Header
  pm.ensureSpace(LINE_HEIGHT)
  const nvHeaderY = pm.y
  pm.page.drawText('Node ID', { x: MARGIN, y: nvHeaderY, size: 8, font: fonts.bold })
  pm.page.drawText('Label', { x: MARGIN + 70, y: nvHeaderY, size: 8, font: fonts.bold })
  pm.page.drawText('Block Type', { x: MARGIN + 170, y: nvHeaderY, size: 8, font: fonts.bold })
  pm.page.drawText('Value (compact)', { x: MARGIN + 260, y: nvHeaderY, size: 8, font: fonts.bold })
  pm.page.drawText('Value (full)', { x: MARGIN + 370, y: nvHeaderY, size: 8, font: fonts.bold })
  pm.y -= LINE_HEIGHT

  for (const row of nodeValues) {
    pm.ensureSpace(LINE_HEIGHT)
    const rowY = pm.y
    pm.page.drawText(truncateText(row.nodeId, fonts.mono, 7, 60), {
      x: MARGIN,
      y: rowY,
      size: 7,
      font: fonts.mono,
    })
    pm.page.drawText(truncateText(row.label, fonts.regular, 7, 90), {
      x: MARGIN + 70,
      y: rowY,
      size: 7,
      font: fonts.regular,
    })
    pm.page.drawText(truncateText(row.blockType, fonts.mono, 7, 80), {
      x: MARGIN + 170,
      y: rowY,
      size: 7,
      font: fonts.mono,
    })
    pm.page.drawText(truncateText(row.compact, fonts.regular, 7, 100), {
      x: MARGIN + 260,
      y: rowY,
      size: 7,
      font: fonts.regular,
    })
    pm.page.drawText(truncateText(row.full, fonts.mono, 6, CONTENT_WIDTH - 370), {
      x: MARGIN + 370,
      y: rowY,
      size: 6,
      font: fonts.mono,
    })
    pm.y -= LINE_HEIGHT
  }
}

async function renderGraphImage(
  pm: PageManager,
  pdfDoc: PDFDocInstance,
  graphImageBytes: Uint8Array | null,
  fonts: Fonts,
  imageError?: string,
): Promise<void> {
  if (graphImageBytes) {
    try {
      const pngImage = await pdfDoc.embedPng(graphImageBytes)

      // Fit image to a new A4 page with margins
      const imgDims = pngImage.scaleToFit(CONTENT_WIDTH, A4_HEIGHT - 2 * MARGIN - 30)

      // Force new page for graph image
      pm.ensureSpace(A4_HEIGHT)
      pm.drawSectionTitle('Graph Snapshot', fonts.bold)

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
      pm.drawSectionTitle('Graph Snapshot', fonts.bold)
      pm.drawText('Graph image unavailable (embed failed).', { font: fonts.regular, size: 10 })
    }
  } else {
    pm.ensureSpace(A4_HEIGHT)
    pm.drawSectionTitle('Graph Snapshot', fonts.bold)
    const reason = imageError
      ? `Graph image unavailable: ${imageError}`
      : 'Graph image unavailable.'
    pm.drawText(reason, { font: fonts.regular, size: 10 })
  }
}

// ── Single-canvas export (v1, preserved) ─────────────────────────────────────

export async function exportAuditPdf(
  model: AuditModel,
  graphImageBytes: Uint8Array | null,
): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()

  const doc = PDFDocument.create()
  const [fontRegular, fontBold, fontMono] = await Promise.all([
    doc.then((d) => d.embedFont(StandardFonts.Helvetica)),
    doc.then((d) => d.embedFont(StandardFonts.HelveticaBold)),
    doc.then((d) => d.embedFont(StandardFonts.Courier)),
  ])

  const pdfDoc = await doc
  const pm = createPageManager(pdfDoc, fontRegular, model.meta.projectName, model.meta.buildSha)
  const fonts: Fonts = { regular: fontRegular, bold: fontBold, mono: fontMono }

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

  renderDiagnosticsTable(pm, model.diagnostics, fonts, rgb)

  // ── Node Value Table ───────────────────────────────────────────────────────

  renderNodeValuesTable(pm, model.nodeValues, fonts)

  // ── Graph Image Page ───────────────────────────────────────────────────────

  await renderGraphImage(pm, pdfDoc, graphImageBytes, fonts)

  // ── Save & Download ────────────────────────────────────────────────────────

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

  const ts = formatTimestampForFilename(model.meta.exportTimestamp)
  const name = safeName(model.meta.projectName || 'chainsolve')
  const filename = `${name}_${ts}_audit.pdf`

  downloadBlob(blob, filename)
}

// ── Project-level export (v2, multi-canvas with TOC) ─────────────────────────

export async function exportProjectAuditPdf(model: ProjectAuditModel): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()

  const doc = PDFDocument.create()
  const [fontRegular, fontBold, fontMono] = await Promise.all([
    doc.then((d) => d.embedFont(StandardFonts.Helvetica)),
    doc.then((d) => d.embedFont(StandardFonts.HelveticaBold)),
    doc.then((d) => d.embedFont(StandardFonts.Courier)),
  ])

  const pdfDoc = await doc
  const pm = createPageManager(pdfDoc, fontRegular, model.meta.projectName, model.meta.buildSha)
  const fonts: Fonts = { regular: fontRegular, bold: fontBold, mono: fontMono }

  // ── Cover Page ─────────────────────────────────────────────────────────────

  pm.drawText('ChainSolve Audit Report', { font: fontBold, size: 18 })
  pm.y -= 8
  pm.drawText(model.meta.projectName, { font: fontRegular, size: 14 })
  pm.y -= 4
  pm.drawText('All Sheets', { font: fontRegular, size: 11 })
  pm.y -= SECTION_GAP

  pm.drawKeyValue('Project ID', model.meta.projectId ?? '(scratch)', fontRegular, fontBold)
  pm.drawKeyValue('Export timestamp', model.meta.exportTimestamp, fontRegular, fontBold)
  pm.drawKeyValue('Build version', model.meta.buildVersion, fontRegular, fontBold)
  pm.drawKeyValue('Build SHA', model.meta.buildSha, fontRegular, fontBold)
  pm.drawKeyValue('Build time', model.meta.buildTime, fontRegular, fontBold)
  pm.drawKeyValue('Build env', model.meta.buildEnv, fontRegular, fontBold)
  pm.drawKeyValue('Engine version', model.meta.engineVersion, fontRegular, fontBold)
  pm.drawKeyValue('Contract version', String(model.meta.contractVersion), fontRegular, fontBold)
  pm.drawKeyValue('Total canvases', String(model.meta.totalCanvases), fontRegular, fontBold)
  pm.drawKeyValue('Total nodes', String(model.meta.nodeCount), fontRegular, fontBold)
  pm.drawKeyValue('Total edges', String(model.meta.edgeCount), fontRegular, fontBold)
  if (model.exportOptions) {
    pm.drawKeyValue(
      'Images',
      model.exportOptions.includeImages ? 'Included' : 'Skipped (values-only)',
      fontRegular,
      fontBold,
    )
  }

  // ── Project Hash ───────────────────────────────────────────────────────────

  pm.drawSectionTitle('Project Hash (SHA-256)', fontBold)
  pm.drawText(model.projectHash, { font: fontMono, size: 8 })

  // ── TOC placeholder pages ──────────────────────────────────────────────────
  // We reserve TOC pages now, then fill them after we know final page numbers.

  pm.forceNewPage()
  const tocPageIndices: number[] = [pdfDoc.getPageCount() - 1]

  // Reserve enough TOC space (one line per canvas = ~14pt; estimate capacity)
  const tocLinesPerPage = Math.floor((A4_HEIGHT - 2 * MARGIN - 60) / LINE_HEIGHT)
  const extraTocPages = Math.max(0, Math.ceil(model.canvases.length / tocLinesPerPage) - 1)
  for (let i = 0; i < extraTocPages; i++) {
    pm.forceNewPage()
    tocPageIndices.push(pdfDoc.getPageCount() - 1)
  }

  // ── Per-canvas sections ────────────────────────────────────────────────────

  const canvasPageNumbers: { canvasName: string; startPage: number }[] = []

  for (const canvas of model.canvases) {
    pm.forceNewPage()
    const startPage = pm.pageNumber
    canvasPageNumbers.push({ canvasName: canvas.canvasName, startPage })

    // Canvas header
    pm.drawText(`Sheet: ${canvas.canvasName}`, { font: fontBold, size: 16 })
    pm.y -= 8
    pm.drawKeyValue('Canvas ID', canvas.canvasId, fontRegular, fontBold)
    pm.drawKeyValue('Nodes', String(canvas.nodeCount), fontRegular, fontBold)
    pm.drawKeyValue('Edges', String(canvas.edgeCount), fontRegular, fontBold)

    // Canvas snapshot hash
    pm.drawSectionTitle('Snapshot Hash (SHA-256)', fontBold)
    pm.drawText(canvas.snapshotHash, { font: fontMono, size: 8 })

    // Graph health
    pm.drawSectionTitle('Graph Health Summary', fontBold)
    for (const line of canvas.healthSummary.split('\n')) {
      pm.drawText(line, { font: fontRegular, size: 9 })
    }

    // Evaluation summary
    pm.drawSectionTitle('Engine Evaluation Summary', fontBold)
    pm.drawKeyValue('Elapsed', `${canvas.evalElapsedMs.toFixed(2)} ms`, fontRegular, fontBold)
    pm.drawKeyValue('Partial', canvas.evalPartial ? 'Yes' : 'No', fontRegular, fontBold)
    pm.drawKeyValue(
      'Diagnostics',
      `${canvas.diagnosticCounts.error} errors, ${canvas.diagnosticCounts.warning} warnings, ${canvas.diagnosticCounts.info} info`,
      fontRegular,
      fontBold,
    )

    // Diagnostics table
    renderDiagnosticsTable(pm, canvas.diagnostics, fonts, rgb)

    // Node values table
    renderNodeValuesTable(pm, canvas.nodeValues, fonts)

    // Graph image
    await renderGraphImage(pm, pdfDoc, canvas.graphImageBytes, fonts, canvas.imageError)
  }

  // ── Fill TOC pages ─────────────────────────────────────────────────────────
  // Draw TOC text onto the reserved pages now that we know all page numbers.

  let tocLineIndex = 0

  for (let pi = 0; pi < tocPageIndices.length; pi++) {
    const tocPage = pdfDoc.getPage(tocPageIndices[pi])
    let tocY = A4_HEIGHT - MARGIN

    // Title only on first TOC page
    if (pi === 0) {
      tocPage.drawText('Table of Contents', { x: MARGIN, y: tocY, size: 14, font: fontBold })
      tocY -= 24

      // Underline
      tocPage.drawLine({
        start: { x: MARGIN, y: tocY },
        end: { x: MARGIN + CONTENT_WIDTH, y: tocY },
        thickness: 0.5,
      })
      tocY -= 16
    }

    while (tocLineIndex < canvasPageNumbers.length && tocY > FOOTER_Y + 20) {
      const entry = canvasPageNumbers[tocLineIndex]
      const label = `${tocLineIndex + 1}. ${entry.canvasName}`
      const pageLabel = `Page ${entry.startPage}`

      tocPage.drawText(truncateText(label, fontRegular, 10, CONTENT_WIDTH - 80), {
        x: MARGIN,
        y: tocY,
        size: 10,
        font: fontRegular,
      })
      tocPage.drawText(pageLabel, {
        x: MARGIN + CONTENT_WIDTH - fontMono.widthOfTextAtSize(pageLabel, 9),
        y: tocY,
        size: 9,
        font: fontMono,
      })

      // Dot leaders
      const labelWidth = fontRegular.widthOfTextAtSize(
        truncateText(label, fontRegular, 10, CONTENT_WIDTH - 80),
        10,
      )
      const pageWidth = fontMono.widthOfTextAtSize(pageLabel, 9)
      const dotsStart = MARGIN + labelWidth + 8
      const dotsEnd = MARGIN + CONTENT_WIDTH - pageWidth - 8
      if (dotsEnd > dotsStart) {
        const dotChar = '.'
        const dotWidth = fontRegular.widthOfTextAtSize(dotChar, 8)
        const dotCount = Math.floor((dotsEnd - dotsStart) / (dotWidth + 1))
        if (dotCount > 0) {
          const dots = dotChar.repeat(dotCount)
          tocPage.drawText(dots, {
            x: dotsStart,
            y: tocY,
            size: 8,
            font: fontRegular,
            color: rgb(0.6, 0.6, 0.6),
          })
        }
      }

      tocY -= LINE_HEIGHT + 2
      tocLineIndex++
    }
  }

  // ── Reorder pages: cover, TOC, then sections (already in order) ────────────
  // Pages are already in the correct order since we added cover → TOC → sections

  // ── Save & Download ────────────────────────────────────────────────────────

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

  const ts = formatTimestampForFilename(model.meta.exportTimestamp)
  const name = safeName(model.meta.projectName || 'chainsolve')
  const filename = `${name}_${ts}_project_audit.pdf`

  downloadBlob(blob, filename)
}
