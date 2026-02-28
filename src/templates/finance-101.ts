/**
 * finance-101.ts — Finance 101 sample template.
 *
 * Demonstrates two TVM calculations sharing common inputs:
 *   1. Compound FV: FV = PV(1 + r/n)^(n·t)
 *   2. Simple Interest: SI = P·r·t
 *
 * Default values: PV = 1 000, r = 0.05 (5%), n = 12 (monthly), t = 1 year
 *   → Compound FV ≈ 1 051.16,  Simple interest = 50
 *
 * Note: compound_fv and simple_interest are Pro-tier blocks.
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildFinance101(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Shared inputs ─────────────────────────────────────────────────
    {
      id: 'f101-pv',
      type: 'number',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Principal PV', value: 1000 },
    },
    {
      id: 'f101-r',
      type: 'number',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'Rate r (decimal)', value: 0.05 },
    },
    {
      id: 'f101-t',
      type: 'number',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'Time t (years)', value: 1 },
    },
    // ── Compound FV extra input ────────────────────────────────────────
    {
      id: 'f101-n',
      type: 'number',
      position: { x: 0, y: 360 },
      data: { blockType: 'number', label: 'Periods/yr n', value: 12 },
    },
    // ── Operations ────────────────────────────────────────────────────
    {
      id: 'f101-fv',
      type: 'fin.tvm.compound_fv',
      position: { x: 280, y: 180 },
      data: { blockType: 'fin.tvm.compound_fv', label: 'Compound FV' },
    },
    {
      id: 'f101-si',
      type: 'fin.tvm.simple_interest',
      position: { x: 280, y: 360 },
      data: { blockType: 'fin.tvm.simple_interest', label: 'Simple Int.' },
    },
    // ── Outputs ───────────────────────────────────────────────────────
    {
      id: 'f101-fv-disp',
      type: 'display',
      position: { x: 500, y: 180 },
      data: { blockType: 'display', label: 'Future Value ($)' },
    },
    {
      id: 'f101-si-disp',
      type: 'display',
      position: { x: 500, y: 360 },
      data: { blockType: 'display', label: 'Simple Interest ($)' },
    },
  ]

  const edges = [
    // Compound FV wiring
    {
      id: 'f101-e1',
      source: 'f101-pv',
      sourceHandle: 'out',
      target: 'f101-fv',
      targetHandle: 'PV',
    },
    { id: 'f101-e2', source: 'f101-r', sourceHandle: 'out', target: 'f101-fv', targetHandle: 'r' },
    { id: 'f101-e3', source: 'f101-n', sourceHandle: 'out', target: 'f101-fv', targetHandle: 'n' },
    { id: 'f101-e4', source: 'f101-t', sourceHandle: 'out', target: 'f101-fv', targetHandle: 't' },
    {
      id: 'f101-e5',
      source: 'f101-fv',
      sourceHandle: 'out',
      target: 'f101-fv-disp',
      targetHandle: 'value',
    },
    // Simple interest wiring (PV, r, t shared from above)
    { id: 'f101-e6', source: 'f101-pv', sourceHandle: 'out', target: 'f101-si', targetHandle: 'P' },
    { id: 'f101-e7', source: 'f101-r', sourceHandle: 'out', target: 'f101-si', targetHandle: 'r' },
    { id: 'f101-e8', source: 'f101-t', sourceHandle: 'out', target: 'f101-si', targetHandle: 't' },
    {
      id: 'f101-e9',
      source: 'f101-si',
      sourceHandle: 'out',
      target: 'f101-si-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
