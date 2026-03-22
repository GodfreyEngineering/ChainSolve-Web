/**
 * black-scholes.ts — Black-Scholes option pricing template.
 *
 * Demonstrates the finance options blocks (fin.options.*):
 *   1. Call price:  C = S·N(d₁) − K·e^(−rT)·N(d₂)
 *   2. Put price:   P = K·e^(−rT)·N(−d₂) − S·N(−d₁)
 *   3. Delta (Δ):   N(d₁) — rate of change w.r.t. spot
 *   4. Gamma (Γ):   φ(d₁)/(S·σ·√T) — delta convexity
 *   5. Vega (ν):    S·φ(d₁)·√T — volatility sensitivity
 *
 * Default values: S = 100, K = 105, T = 0.5 yr, r = 0.05, σ = 0.20
 *
 * Note: all five Black-Scholes blocks are Pro-tier blocks.
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildBlackScholes(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ──────────────────────────────────────────────
    {
      id: 'bs-title',
      type: 'csAnnotation',
      position: { x: -20, y: -90 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Black-Scholes Option Pricing\n\nAdjust S, K, T, r, and σ to see how call/put prices and Greeks update in real time.\nAll five calculations share the same five inputs.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 420,
      },
      style: { width: 420 },
    },

    // ── Input nodes ───────────────────────────────────────────────────
    {
      id: 'bs-S',
      type: 'csSource',
      position: { x: 0, y: 40 },
      data: { blockType: 'number', label: 'Stock price S ($)', value: 100 },
    },
    {
      id: 'bs-K',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: 'Strike price K ($)', value: 105 },
    },
    {
      id: 'bs-T',
      type: 'csSource',
      position: { x: 0, y: 280 },
      data: { blockType: 'number', label: 'Time to expiry T (years)', value: 0.5 },
    },
    {
      id: 'bs-r',
      type: 'csSource',
      position: { x: 0, y: 400 },
      data: { blockType: 'number', label: 'Risk-free rate r (decimal)', value: 0.05 },
    },
    {
      id: 'bs-sigma',
      type: 'csSource',
      position: { x: 0, y: 520 },
      data: { blockType: 'number', label: 'Volatility σ (decimal)', value: 0.2 },
    },

    // ── Inputs annotation ─────────────────────────────────────────────
    {
      id: 'bs-ann-inputs',
      type: 'csAnnotation',
      position: { x: -180, y: 60 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '① Market inputs\n\nSpot price, strike, time to expiry,\nrisk-free rate, and implied volatility.',
        annotationColor: '#60a5fa',
        annotationFontSize: 11,
        width: 160,
      },
      style: { width: 160 },
    },

    // ── Operations ────────────────────────────────────────────────────
    {
      id: 'bs-call',
      type: 'csOperation',
      position: { x: 320, y: 40 },
      data: { blockType: 'fin.options.bs_call', label: 'BS Call' },
    },
    {
      id: 'bs-put',
      type: 'csOperation',
      position: { x: 320, y: 160 },
      data: { blockType: 'fin.options.bs_put', label: 'BS Put' },
    },
    {
      id: 'bs-delta',
      type: 'csOperation',
      position: { x: 320, y: 280 },
      data: { blockType: 'fin.options.bs_delta', label: 'BS Delta' },
    },
    {
      id: 'bs-gamma',
      type: 'csOperation',
      position: { x: 320, y: 400 },
      data: { blockType: 'fin.options.bs_gamma', label: 'BS Gamma' },
    },
    {
      id: 'bs-vega',
      type: 'csOperation',
      position: { x: 320, y: 520 },
      data: { blockType: 'fin.options.bs_vega', label: 'BS Vega' },
    },

    // ── Operations annotation ─────────────────────────────────────────
    {
      id: 'bs-ann-ops',
      type: 'csAnnotation',
      position: { x: 280, y: -60 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '② Black-Scholes engine\n\nCall/put prices plus three key Greeks:\nDelta, Gamma, and Vega.',
        annotationColor: '#facc15',
        annotationFontSize: 11,
        width: 180,
      },
      style: { width: 180 },
    },

    // ── Outputs ───────────────────────────────────────────────────────
    {
      id: 'bs-call-disp',
      type: 'csDisplay',
      position: { x: 560, y: 40 },
      data: { blockType: 'display', label: 'Call Price ($)' },
    },
    {
      id: 'bs-put-disp',
      type: 'csDisplay',
      position: { x: 560, y: 160 },
      data: { blockType: 'display', label: 'Put Price ($)' },
    },
    {
      id: 'bs-delta-disp',
      type: 'csDisplay',
      position: { x: 560, y: 280 },
      data: { blockType: 'display', label: 'Delta (Δ)' },
    },
    {
      id: 'bs-gamma-disp',
      type: 'csDisplay',
      position: { x: 560, y: 400 },
      data: { blockType: 'display', label: 'Gamma (Γ)' },
    },
    {
      id: 'bs-vega-disp',
      type: 'csDisplay',
      position: { x: 560, y: 520 },
      data: { blockType: 'display', label: 'Vega (ν)' },
    },

    // ── Outputs annotation ────────────────────────────────────────────
    {
      id: 'bs-ann-outputs',
      type: 'csAnnotation',
      position: { x: 540, y: -60 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '③ Results\n\nOption prices and Greek sensitivities\nupdate as you change any input.',
        annotationColor: '#4ade80',
        annotationFontSize: 11,
        width: 160,
      },
      style: { width: 160 },
    },
  ]

  // Helper: wire one input source to one operation target handle
  const wire = (id: string, source: string, target: string, targetHandle: string) => ({
    id,
    source,
    sourceHandle: 'out',
    target,
    targetHandle,
  })

  const opIds = ['bs-call', 'bs-put', 'bs-delta', 'bs-gamma', 'bs-vega'] as const
  const inputMap: [string, string][] = [
    ['bs-S', 'S'],
    ['bs-K', 'K'],
    ['bs-T', 'T'],
    ['bs-r', 'r'],
    ['bs-sigma', 'sigma'],
  ]

  const edges = [
    // Wire each of the 5 inputs to each of the 5 operations (25 edges)
    ...opIds.flatMap((opId, oi) =>
      inputMap.map(([srcId, handle], ii) => wire(`bs-e${oi * 5 + ii + 1}`, srcId, opId, handle)),
    ),
    // Wire each operation to its display (5 edges)
    wire('bs-e26', 'bs-call', 'bs-call-disp', 'value'),
    wire('bs-e27', 'bs-put', 'bs-put-disp', 'value'),
    wire('bs-e28', 'bs-delta', 'bs-delta-disp', 'value'),
    wire('bs-e29', 'bs-gamma', 'bs-gamma-disp', 'value'),
    wire('bs-e30', 'bs-vega', 'bs-vega-disp', 'value'),
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
