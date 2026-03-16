/**
 * investment-returns.ts — Compound & Simple Interest template.
 *
 * Side-by-side comparison of:
 *   1. Compound interest: FV = PV * (1 + r/n)^(n*t)
 *   2. Simple interest:   SI = P * r * t
 *
 * Shared inputs: PV / principal, rate, and time.
 * Default values: PV = 10000, r = 0.05 (5%), n = 12 (monthly), t = 10 years
 *   -> FV ~ 16470.09, SI = 5000
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildInvestmentReturns(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Shared Inputs ─────────────────────────────────────────────────
    {
      id: 'inv-pv',
      type: 'csSource',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Principal PV ($)', value: 10000 },
    },
    {
      id: 'inv-r',
      type: 'csSource',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'Annual Rate r (decimal)', value: 0.05 },
    },
    {
      id: 'inv-t',
      type: 'csSource',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'Time t (years)', value: 10 },
    },

    // ── Compound interest inputs ──────────────────────────────────────
    {
      id: 'inv-n',
      type: 'csSource',
      position: { x: 0, y: 360 },
      data: { blockType: 'number', label: 'Compounds/year n', value: 12 },
    },

    // ── Operations ────────────────────────────────────────────────────
    {
      id: 'inv-fv',
      type: 'csOperation',
      position: { x: 280, y: 60 },
      data: { blockType: 'fin.tvm.compound_fv', label: 'FV = PV(1+r/n)^(nt)' },
    },
    {
      id: 'inv-si',
      type: 'csOperation',
      position: { x: 280, y: 240 },
      data: { blockType: 'fin.tvm.simple_interest', label: 'SI = P\u00B7r\u00B7t' },
    },

    // ── Outputs ───────────────────────────────────────────────────────
    {
      id: 'inv-fv-disp',
      type: 'csDisplay',
      position: { x: 520, y: 60 },
      data: { blockType: 'display', label: 'Future Value ($)' },
    },
    {
      id: 'inv-si-disp',
      type: 'csDisplay',
      position: { x: 520, y: 240 },
      data: { blockType: 'display', label: 'Simple Interest ($)' },
    },
  ]

  const edges = [
    // Compound FV wiring (PV, r, n, t)
    {
      id: 'inv-e1',
      source: 'inv-pv',
      sourceHandle: 'out',
      target: 'inv-fv',
      targetHandle: 'PV',
    },
    { id: 'inv-e2', source: 'inv-r', sourceHandle: 'out', target: 'inv-fv', targetHandle: 'r' },
    { id: 'inv-e3', source: 'inv-n', sourceHandle: 'out', target: 'inv-fv', targetHandle: 'n' },
    { id: 'inv-e4', source: 'inv-t', sourceHandle: 'out', target: 'inv-fv', targetHandle: 't' },
    // FV display
    {
      id: 'inv-e5',
      source: 'inv-fv',
      sourceHandle: 'out',
      target: 'inv-fv-disp',
      targetHandle: 'value',
    },
    // Simple interest wiring (P, r, t)
    {
      id: 'inv-e6',
      source: 'inv-pv',
      sourceHandle: 'out',
      target: 'inv-si',
      targetHandle: 'P',
    },
    { id: 'inv-e7', source: 'inv-r', sourceHandle: 'out', target: 'inv-si', targetHandle: 'r' },
    { id: 'inv-e8', source: 'inv-t', sourceHandle: 'out', target: 'inv-si', targetHandle: 't' },
    // SI display
    {
      id: 'inv-e9',
      source: 'inv-si',
      sourceHandle: 'out',
      target: 'inv-si-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
