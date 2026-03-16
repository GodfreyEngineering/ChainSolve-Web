/**
 * heat-transfer.ts — Conductive heat transfer template.
 *
 * Calculates heat flow through a flat wall via Fourier's law:
 *   Q = k·A·ΔT / L
 *
 * Also computes thermal resistance R = L/(k·A) and heat flux q = Q/A.
 *
 * Default: Concrete wall, 0.2m thick, 10m² area, 20°C temperature difference
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildHeatTransfer(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'ht-k',
      type: 'csSource',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Conductivity k (W/m·K)', value: 1.4 },
    },
    {
      id: 'ht-A',
      type: 'csSource',
      position: { x: 0, y: 80 },
      data: { blockType: 'number', label: 'Area A (m²)', value: 10 },
    },
    {
      id: 'ht-dT',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: 'ΔT (°C)', value: 20 },
    },
    {
      id: 'ht-L',
      type: 'csSource',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'Thickness L (m)', value: 0.2 },
    },
    // ── Q = k·A·ΔT / L ──────────────────────────────────────────────
    {
      id: 'ht-kA',
      type: 'csOperation',
      position: { x: 220, y: 30 },
      data: { blockType: 'multiply', label: 'k × A' },
    },
    {
      id: 'ht-kAdT',
      type: 'csOperation',
      position: { x: 400, y: 80 },
      data: { blockType: 'multiply', label: 'k·A·ΔT' },
    },
    {
      id: 'ht-Q',
      type: 'csOperation',
      position: { x: 580, y: 130 },
      data: { blockType: 'divide', label: 'Q = k·A·ΔT / L (W)' },
    },
    {
      id: 'ht-Q-disp',
      type: 'csDisplay',
      position: { x: 780, y: 130 },
      data: { blockType: 'display', label: 'Heat Flow Q (W)' },
    },
    // ── q = Q/A ──────────────────────────────────────────────────────
    {
      id: 'ht-flux',
      type: 'csOperation',
      position: { x: 780, y: 260 },
      data: { blockType: 'divide', label: 'q = Q/A (W/m²)' },
    },
    {
      id: 'ht-flux-disp',
      type: 'csDisplay',
      position: { x: 960, y: 260 },
      data: { blockType: 'display', label: 'Heat Flux q (W/m²)' },
    },
    // ── R = L/(k·A) ─────────────────────────────────────────────────
    {
      id: 'ht-R',
      type: 'csOperation',
      position: { x: 580, y: 380 },
      data: { blockType: 'divide', label: 'R = L/(k·A) (K/W)' },
    },
    {
      id: 'ht-R-disp',
      type: 'csDisplay',
      position: { x: 780, y: 380 },
      data: { blockType: 'display', label: 'Thermal Resistance (K/W)' },
    },
  ]

  const edges = [
    // k·A
    { id: 'ht-e1', source: 'ht-k', sourceHandle: 'out', target: 'ht-kA', targetHandle: 'a' },
    { id: 'ht-e2', source: 'ht-A', sourceHandle: 'out', target: 'ht-kA', targetHandle: 'b' },
    // k·A·ΔT
    { id: 'ht-e3', source: 'ht-kA', sourceHandle: 'out', target: 'ht-kAdT', targetHandle: 'a' },
    { id: 'ht-e4', source: 'ht-dT', sourceHandle: 'out', target: 'ht-kAdT', targetHandle: 'b' },
    // Q = k·A·ΔT / L
    { id: 'ht-e5', source: 'ht-kAdT', sourceHandle: 'out', target: 'ht-Q', targetHandle: 'a' },
    { id: 'ht-e6', source: 'ht-L', sourceHandle: 'out', target: 'ht-Q', targetHandle: 'b' },
    {
      id: 'ht-e7',
      source: 'ht-Q',
      sourceHandle: 'out',
      target: 'ht-Q-disp',
      targetHandle: 'value',
    },
    // q = Q/A
    { id: 'ht-e8', source: 'ht-Q', sourceHandle: 'out', target: 'ht-flux', targetHandle: 'a' },
    { id: 'ht-e9', source: 'ht-A', sourceHandle: 'out', target: 'ht-flux', targetHandle: 'b' },
    {
      id: 'ht-e10',
      source: 'ht-flux',
      sourceHandle: 'out',
      target: 'ht-flux-disp',
      targetHandle: 'value',
    },
    // R = L/(k·A)
    { id: 'ht-e11', source: 'ht-L', sourceHandle: 'out', target: 'ht-R', targetHandle: 'a' },
    { id: 'ht-e12', source: 'ht-kA', sourceHandle: 'out', target: 'ht-R', targetHandle: 'b' },
    {
      id: 'ht-e13',
      source: 'ht-R',
      sourceHandle: 'out',
      target: 'ht-R-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
