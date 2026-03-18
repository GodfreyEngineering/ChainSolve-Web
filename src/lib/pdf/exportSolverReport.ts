/**
 * exportSolverReport.ts — Solver verification report PDF (11.13).
 *
 * Generates a regulatory-grade PDF documenting the numerical solver used,
 * convergence behaviour, error estimates, and reference comparisons.
 * Suitable for submission to quality/safety management systems.
 *
 * Uses the same pdf-lib infrastructure as exportAuditPdf.ts.
 *
 * Public API:
 *   exportSolverReport(model, options?) → Promise<void>   (downloads PDF)
 *   buildSolverReport(...)             → SolverReportModel (pure, testable)
 */

import { loadPdfLib } from '../pdf-loader'
import { downloadBlob, safeName, formatTimestampForFilename } from '../export-file-utils'
import type { PDFFont, PDFPage } from '../pdf-loader'
import type { EngineDiagnostic } from '../../engine/wasm-types'

// ── Data model ────────────────────────────────────────────────────────────────

export type SolverName =
  | 'RK4'        // Fixed-step Runge-Kutta 4th order
  | 'RK45'       // Dormand-Prince adaptive (default ODE solver)
  | 'RK23'       // Bogacki-Shampine adaptive
  | 'BDF'        // Backwards differentiation formula (stiff)
  | 'Radau'      // Radau IIA 5th order (stiff/DAE)
  | 'LSODA'      // Automatic stiffness detection
  | 'Euler'      // Forward Euler (educational)
  | 'Symplectic' // Störmer-Verlet (Hamiltonian)
  | 'Simplex'    // Nelder-Mead optimisation
  | 'GradDesc'   // Gradient descent
  | 'LBFGS'      // Limited-memory BFGS
  | 'NSGA2'      // Non-dominated sorting GA II
  | string       // Custom / unknown

export interface ConvergencePoint {
  /** Integration time or iteration index. */
  x: number
  /** Global error estimate or loss at this point. */
  error: number
  /** Step size used (ODE solvers). */
  stepSize?: number
}

export interface ReferenceComparison {
  /** Short name of the reference (e.g. "DETEST A1", "Rosenbrock exact"). */
  name: string
  /** Reference value / solution. */
  referenceValue: number
  /** Computed value. */
  computedValue: number
  /** Absolute error |computed - reference|. */
  absoluteError: number
  /** Relative error (%), or null if reference is zero. */
  relativeErrorPct: number | null
  /** Whether the comparison passes the stated tolerance. */
  passed: boolean
  /** Tolerance used. */
  tolerance: number
}

export interface SolverVerificationModel {
  /** Project / canvas name. */
  projectName: string
  /** When the computation was run (ISO-8601). */
  timestamp: string
  /** Solver algorithm used. */
  solverName: SolverName
  /** Version of the engine. */
  engineVersion: string
  /** Key solver parameters (e.g. rtol, atol, maxStep). */
  solverParams: Record<string, number | string | boolean>
  /** Convergence history points (may be empty if not available). */
  convergence: ConvergencePoint[]
  /** Final global error estimate (from the solver's error control). */
  finalErrorEstimate: number | null
  /** Number of solver steps taken. */
  stepCount: number | null
  /** Number of function evaluations. */
  functionEvaluations: number | null
  /** Wall-clock time for the solve (ms). */
  elapsedMs: number
  /** Reference comparisons for validation. */
  referenceComparisons: ReferenceComparison[]
  /** Engine diagnostics (warnings, info). */
  diagnostics: EngineDiagnostic[]
  /** Free-text notes for the report (e.g. model description). */
  notes: string
  /** Algorithm description for the report. */
  algorithmDescription: string
  /** Regulatory context (e.g. "ISO 26262", "DO-178C"). */
  regulatoryContext?: string
  /** Name of the engineer who ran the verification. */
  preparedBy?: string
  /** Organisation name. */
  organisation?: string
}

export interface SolverReportOptions {
  filename?: string
}

// ── Algorithm descriptions ────────────────────────────────────────────────────

const ALGORITHM_DESCRIPTIONS: Partial<Record<SolverName, string>> = {
  RK4: 'Fixed-step Runge-Kutta 4th order (RK4). Classic explicit 4-stage method. ' +
    'Global error O(h⁴) where h is the step size. Suitable for non-stiff problems ' +
    'where a fixed step size is required (e.g. real-time simulation).',
  RK45: 'Dormand-Prince RK45 (DOPRI5) adaptive step-size control. Embedded pair of ' +
    '4th/5th order Runge-Kutta formulas. Error controlled via step doubling. ' +
    'Widely used reference solver; matches MATLAB ODE45.',
  RK23: 'Bogacki-Shampine RK23. Embedded 2nd/3rd order pair. Lower order than RK45 ' +
    'but requires fewer function evaluations per step — efficient for low-accuracy requirements.',
  BDF: 'Backwards Differentiation Formula (BDF). Variable-order, variable-step implicit ' +
    'multistep method. Orders 1-5. Optimised for stiff ODEs and DAEs where explicit ' +
    'methods require extremely small steps.',
  Radau: 'Radau IIA 5th order implicit Runge-Kutta. L-stable; ideal for stiff systems ' +
    'and fully implicit DAEs of index ≤ 3. Requires Newton iteration at each step.',
  Simplex: 'Nelder-Mead simplex optimisation. Derivative-free direct search. Convergence ' +
    'not guaranteed for non-convex problems; suitable for low-dimensional smooth objectives.',
  GradDesc: 'Gradient descent with configurable learning rate and optional momentum. ' +
    'First-order method; convergence rate depends on problem conditioning.',
  LBFGS: 'Limited-memory BFGS quasi-Newton method. Approximates the Hessian using ' +
    'the last m (default: 10) gradient/position pairs. Superlinear convergence near ' +
    'minima for smooth objectives.',
  NSGA2: 'Non-Dominated Sorting Genetic Algorithm II (NSGA-II). Elitist multi-objective ' +
    'evolutionary algorithm. Produces an approximation of the Pareto front.',
}

// ── Page layout constants ──────────────────────────────────────────────────────

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 50
const CONTENT_W = PAGE_WIDTH - 2 * MARGIN
const LH = 13
const FOOTER_Y = 28

// ── Internal page state ────────────────────────────────────────────────────────

interface PageState {
  page: PDFPage
  y: number
  pageNum: number
}

// ── PDF rendering helpers ──────────────────────────────────────────────────────

type RGBColor = [number, number, number]

function rgbF(r: number, g: number, b: number): [number, number, number] {
  return [r / 255, g / 255, b / 255]
}

const COL_ACCENT: RGBColor = rgbF(28, 171, 176)    // ChainSolve teal
const COL_TEXT: RGBColor = rgbF(40, 40, 40)
const COL_DIM: RGBColor = rgbF(120, 120, 120)
const COL_PASS: RGBColor = rgbF(46, 204, 113)
const COL_FAIL: RGBColor = rgbF(231, 76, 60)
const COL_HEADER_BG: RGBColor = rgbF(245, 248, 252)

// ── Main export function ───────────────────────────────────────────────────────

/**
 * Generate and download a solver verification report PDF.
 */
export async function exportSolverReport(
  model: SolverVerificationModel,
  options: SolverReportOptions = {},
): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()

  const doc = await PDFDocument.create()
  doc.setTitle(`Solver Verification Report — ${model.projectName}`)
  doc.setAuthor(model.preparedBy ?? 'ChainSolve')
  doc.setSubject('Numerical Solver Verification')
  doc.setCreator('ChainSolve')
  doc.setCreationDate(new Date(model.timestamp))
  if (model.regulatoryContext) doc.setKeywords([model.regulatoryContext])

  const fontNormal = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await doc.embedFont(StandardFonts.Courier)

  function newPage(): PageState {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    return { page, y: PAGE_HEIGHT - MARGIN, pageNum: doc.getPageCount() }
  }

  function ensureSpace(state: PageState, needed: number): PageState {
    if (state.y - needed < FOOTER_Y + 20) return newPage()
    return state
  }

  function drawText(
    state: PageState,
    text: string,
    opts: {
      size?: number
      font?: PDFFont
      color?: RGBColor
      x?: number
      indent?: number
      maxWidth?: number
    } = {},
  ): PageState {
    const size = opts.size ?? 10
    const font = opts.font ?? fontNormal
    const color = opts.color ?? COL_TEXT
    const x = opts.x ?? MARGIN + (opts.indent ?? 0)
    const maxWidth = opts.maxWidth ?? CONTENT_W - (opts.indent ?? 0)

    // Simple word-wrap
    const words = text.split(' ')
    let line = ''
    let s = state

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        s.page.drawText(line, { x, y: s.y, size, font, color: rgb(...color) })
        s = ensureSpace({ ...s, y: s.y - LH }, LH)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) {
      s.page.drawText(line, { x, y: s.y, size, font, color: rgb(...color) })
      s = { ...s, y: s.y - LH }
    }
    return s
  }

  function drawSectionHeader(state: PageState, title: string): PageState {
    let s = ensureSpace(state, LH * 3)
    s = { ...s, y: s.y - 6 }
    // Accent bar
    s.page.drawRectangle({
      x: MARGIN, y: s.y - 2, width: CONTENT_W, height: LH + 6,
      color: rgb(...COL_HEADER_BG),
    })
    s.page.drawLine({
      start: { x: MARGIN, y: s.y - 2 },
      end: { x: MARGIN + 4, y: s.y - 2 },
      thickness: LH + 6,
      color: rgb(...COL_ACCENT),
    })
    s = drawText(s, title, { font: fontBold, size: 11, color: COL_TEXT, x: MARGIN + 10 })
    s = { ...s, y: s.y - 4 }
    return s
  }

  function drawKV(
    state: PageState, key: string, value: string, mono = false,
  ): PageState {
    let s = ensureSpace(state, LH)
    const kw = fontBold.widthOfTextAtSize(`${key}: `, 9)
    s.page.drawText(`${key}: `, { x: MARGIN + 8, y: s.y, size: 9, font: fontBold, color: rgb(...COL_DIM) })
    s.page.drawText(value, {
      x: MARGIN + 8 + kw, y: s.y, size: 9,
      font: mono ? fontMono : fontNormal,
      color: rgb(...COL_TEXT),
    })
    return { ...s, y: s.y - LH }
  }

  function drawFooter(state: PageState): void {
    state.page.drawText(
      `ChainSolve Solver Verification Report — Page ${state.pageNum}`,
      { x: MARGIN, y: FOOTER_Y, size: 8, font: fontNormal, color: rgb(...COL_DIM) },
    )
    state.page.drawText(
      model.timestamp.slice(0, 10),
      { x: PAGE_WIDTH - MARGIN - 60, y: FOOTER_Y, size: 8, font: fontNormal, color: rgb(...COL_DIM) },
    )
  }

  // ── Cover / header ─────────────────────────────────────────────────────────
  let state = newPage()

  // Title block
  state.page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 100, width: PAGE_WIDTH, height: 100,
    color: rgb(...COL_ACCENT),
  })
  state.page.drawText('Solver Verification Report', {
    x: MARGIN, y: PAGE_HEIGHT - 50,
    size: 22, font: fontBold, color: rgb(1, 1, 1),
  })
  state.page.drawText(model.projectName, {
    x: MARGIN, y: PAGE_HEIGHT - 72,
    size: 13, font: fontNormal, color: rgb(0.9, 0.98, 1),
  })
  state = { ...state, y: PAGE_HEIGHT - 115 }

  // Meta
  state = drawKV(state, 'Prepared by', model.preparedBy ?? 'N/A')
  state = drawKV(state, 'Organisation', model.organisation ?? 'N/A')
  state = drawKV(state, 'Date', model.timestamp.slice(0, 10))
  state = drawKV(state, 'Engine version', model.engineVersion)
  if (model.regulatoryContext) {
    state = drawKV(state, 'Regulatory context', model.regulatoryContext)
  }

  // ── Algorithm description ───────────────────────────────────────────────────
  state = drawSectionHeader(state, `1. Algorithm: ${model.solverName}`)
  const algDesc = model.algorithmDescription ||
    ALGORITHM_DESCRIPTIONS[model.solverName as SolverName] ||
    `${model.solverName} — no description available.`
  state = drawText(state, algDesc, { indent: 8, size: 9 })
  state = { ...state, y: state.y - 4 }

  // ── Solver parameters ───────────────────────────────────────────────────────
  state = drawSectionHeader(state, '2. Solver Parameters')
  for (const [k, v] of Object.entries(model.solverParams)) {
    state = drawKV(state, k, String(v), typeof v === 'number')
  }
  if (model.stepCount != null) state = drawKV(state, 'Steps taken', String(model.stepCount))
  if (model.functionEvaluations != null) {
    state = drawKV(state, 'Function evaluations', String(model.functionEvaluations))
  }
  state = drawKV(state, 'Elapsed (ms)', model.elapsedMs.toFixed(2))
  if (model.finalErrorEstimate != null) {
    state = drawKV(state, 'Final error estimate', model.finalErrorEstimate.toExponential(4))
  }

  // ── Convergence history ─────────────────────────────────────────────────────
  if (model.convergence.length > 0) {
    state = drawSectionHeader(state, '3. Convergence History (sampled)')
    // Table header
    state = ensureSpace(state, LH)
    state.page.drawText('Step / t', { x: MARGIN + 8, y: state.y, size: 9, font: fontBold, color: rgb(...COL_DIM) })
    state.page.drawText('Error estimate', { x: MARGIN + 130, y: state.y, size: 9, font: fontBold, color: rgb(...COL_DIM) })
    state.page.drawText('Step size', { x: MARGIN + 280, y: state.y, size: 9, font: fontBold, color: rgb(...COL_DIM) })
    state = { ...state, y: state.y - LH }

    // Sample up to 40 points
    const pts = model.convergence
    const step = Math.max(1, Math.floor(pts.length / 40))
    for (let i = 0; i < pts.length; i += step) {
      const pt = pts[i]
      state = ensureSpace(state, LH)
      state.page.drawText(pt.x.toExponential(3), { x: MARGIN + 8, y: state.y, size: 8, font: fontMono, color: rgb(...COL_TEXT) })
      state.page.drawText(pt.error.toExponential(4), { x: MARGIN + 130, y: state.y, size: 8, font: fontMono, color: rgb(...COL_TEXT) })
      if (pt.stepSize != null) {
        state.page.drawText(pt.stepSize.toExponential(3), { x: MARGIN + 280, y: state.y, size: 8, font: fontMono, color: rgb(...COL_TEXT) })
      }
      state = { ...state, y: state.y - LH }
    }
  }

  // ── Reference comparisons ───────────────────────────────────────────────────
  if (model.referenceComparisons.length > 0) {
    state = drawSectionHeader(state, '4. Reference Comparisons')

    // Column headers
    const cols = { name: MARGIN + 8, ref: MARGIN + 160, comp: MARGIN + 270, err: MARGIN + 360, pass: MARGIN + 450 }
    state = ensureSpace(state, LH)
    state.page.drawText('Reference', { x: cols.name, y: state.y, size: 8, font: fontBold, color: rgb(...COL_DIM) })
    state.page.drawText('Expected', { x: cols.ref, y: state.y, size: 8, font: fontBold, color: rgb(...COL_DIM) })
    state.page.drawText('Computed', { x: cols.comp, y: state.y, size: 8, font: fontBold, color: rgb(...COL_DIM) })
    state.page.drawText('|Error|', { x: cols.err, y: state.y, size: 8, font: fontBold, color: rgb(...COL_DIM) })
    state.page.drawText('Pass', { x: cols.pass, y: state.y, size: 8, font: fontBold, color: rgb(...COL_DIM) })
    state = { ...state, y: state.y - LH }
    // Divider
    state.page.drawLine({
      start: { x: MARGIN, y: state.y + LH - 2 },
      end: { x: PAGE_WIDTH - MARGIN, y: state.y + LH - 2 },
      thickness: 0.5, color: rgb(...COL_DIM),
    })

    let allPassed = true
    for (const rc of model.referenceComparisons) {
      state = ensureSpace(state, LH)
      if (!rc.passed) allPassed = false
      const passColor = rc.passed ? COL_PASS : COL_FAIL
      const passText = rc.passed ? 'PASS' : 'FAIL'
      state.page.drawText(rc.name.slice(0, 22), { x: cols.name, y: state.y, size: 8, font: fontNormal, color: rgb(...COL_TEXT) })
      state.page.drawText(rc.referenceValue.toExponential(5), { x: cols.ref, y: state.y, size: 8, font: fontMono, color: rgb(...COL_TEXT) })
      state.page.drawText(rc.computedValue.toExponential(5), { x: cols.comp, y: state.y, size: 8, font: fontMono, color: rgb(...COL_TEXT) })
      state.page.drawText(rc.absoluteError.toExponential(3), { x: cols.err, y: state.y, size: 8, font: fontMono, color: rgb(...COL_TEXT) })
      state.page.drawText(passText, { x: cols.pass, y: state.y, size: 8, font: fontBold, color: rgb(...passColor) })
      state = { ...state, y: state.y - LH }
    }

    state = { ...state, y: state.y - 4 }
    const summaryColor = allPassed ? COL_PASS : COL_FAIL
    const summaryText = allPassed
      ? `✓ All ${model.referenceComparisons.length} reference comparisons passed.`
      : `✗ ${model.referenceComparisons.filter((r) => !r.passed).length} of ${model.referenceComparisons.length} comparisons failed.`
    state = drawText(state, summaryText, { font: fontBold, size: 10, color: summaryColor, indent: 8 })
  }

  // ── Diagnostics ─────────────────────────────────────────────────────────────
  if (model.diagnostics.length > 0) {
    state = drawSectionHeader(state, '5. Diagnostics')
    for (const diag of model.diagnostics) {
      const color = diag.level === 'error' ? COL_FAIL : diag.level === 'warning' ? [200, 120, 0] as RGBColor : COL_DIM
      const prefix = diag.level === 'error' ? '[ERROR]' : diag.level === 'warning' ? '[WARN]' : '[INFO]'
      state = drawText(state, `${prefix} ${diag.code}: ${diag.message}`, {
        size: 9, color, indent: 8,
      })
    }
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (model.notes) {
    state = drawSectionHeader(state, '6. Notes')
    state = drawText(state, model.notes, { size: 9, indent: 8 })
  }

  // Draw footer on all pages
  for (let i = 0; i < doc.getPageCount(); i++) {
    const pg = doc.getPage(i)
    pg.drawText(
      `ChainSolve Solver Verification Report — Page ${i + 1} of ${doc.getPageCount()}`,
      { x: MARGIN, y: FOOTER_Y, size: 8, font: fontNormal, color: rgb(...COL_DIM) },
    )
    pg.drawText(
      model.timestamp.slice(0, 10),
      { x: PAGE_WIDTH - MARGIN - 60, y: FOOTER_Y, size: 8, font: fontNormal, color: rgb(...COL_DIM) },
    )
  }
  void drawFooter

  // ── Serialise and download ─────────────────────────────────────────────────
  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const ts = formatTimestampForFilename(model.timestamp)
  const filename = options.filename ?? `solver-verification-${safeName(model.projectName)}-${ts}.pdf`
  downloadBlob(blob, filename)
}

// ── Builder helper ────────────────────────────────────────────────────────────

/**
 * Build a `SolverVerificationModel` from raw engine data.
 * Pure function; can be unit-tested without pdf-lib.
 */
export function buildSolverReport(opts: {
  projectName: string
  solverName: SolverName
  engineVersion: string
  solverParams: Record<string, number | string | boolean>
  convergence: ConvergencePoint[]
  finalErrorEstimate: number | null
  stepCount: number | null
  functionEvaluations: number | null
  elapsedMs: number
  referenceComparisons?: ReferenceComparison[]
  diagnostics?: EngineDiagnostic[]
  notes?: string
  algorithmDescription?: string
  regulatoryContext?: string
  preparedBy?: string
  organisation?: string
}): SolverVerificationModel {
  return {
    projectName: opts.projectName,
    timestamp: new Date().toISOString(),
    solverName: opts.solverName,
    engineVersion: opts.engineVersion,
    solverParams: opts.solverParams,
    convergence: opts.convergence,
    finalErrorEstimate: opts.finalErrorEstimate,
    stepCount: opts.stepCount,
    functionEvaluations: opts.functionEvaluations,
    elapsedMs: opts.elapsedMs,
    referenceComparisons: opts.referenceComparisons ?? [],
    diagnostics: opts.diagnostics ?? [],
    notes: opts.notes ?? '',
    algorithmDescription: opts.algorithmDescription ?? '',
    regulatoryContext: opts.regulatoryContext,
    preparedBy: opts.preparedBy,
    organisation: opts.organisation,
  }
}
