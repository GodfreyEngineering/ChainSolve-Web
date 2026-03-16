/**
 * structural-beam.ts — Simply supported beam template.
 *
 * Calculates maximum bending stress and deflection for a simply
 * supported beam with a central point load:
 *   σ_max = (P·L) / (4·Z)
 *   δ_max = (P·L³) / (48·E·I)
 *
 * Default: Steel I-beam, 3m span, 10kN point load
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildStructuralBeam(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'sb-P',
      type: 'csSource',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Point Load P (N)', value: 10000 },
    },
    {
      id: 'sb-L',
      type: 'csSource',
      position: { x: 0, y: 80 },
      data: { blockType: 'number', label: 'Span L (m)', value: 3 },
    },
    {
      id: 'sb-E',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: "Young's Modulus E (Pa)", value: 200e9 },
    },
    {
      id: 'sb-I',
      type: 'csSource',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'Moment of Inertia I (m⁴)', value: 8.356e-5 },
    },
    {
      id: 'sb-Z',
      type: 'csSource',
      position: { x: 0, y: 320 },
      data: { blockType: 'number', label: 'Section Modulus Z (m³)', value: 6.28e-4 },
    },
    // ── Bending moment M = PL/4 ──────────────────────────────────────
    {
      id: 'sb-PL',
      type: 'csOperation',
      position: { x: 250, y: 30 },
      data: { blockType: 'multiply', label: 'P × L' },
    },
    {
      id: 'sb-four',
      type: 'csSource',
      position: { x: 250, y: 120 },
      data: { blockType: 'number', label: '4', value: 4 },
    },
    {
      id: 'sb-M',
      type: 'csOperation',
      position: { x: 420, y: 30 },
      data: { blockType: 'divide', label: 'M = PL/4 (N·m)' },
    },
    // ── Stress σ = M/Z ───────────────────────────────────────────────
    {
      id: 'sb-stress',
      type: 'csOperation',
      position: { x: 600, y: 30 },
      data: { blockType: 'divide', label: 'σ = M/Z (Pa)' },
    },
    {
      id: 'sb-stress-disp',
      type: 'csDisplay',
      position: { x: 800, y: 30 },
      data: { blockType: 'display', label: 'Max Bending Stress (Pa)' },
    },
    // ── Deflection δ = PL³/(48EI) ────────────────────────────────────
    {
      id: 'sb-L3',
      type: 'csOperation',
      position: { x: 250, y: 280 },
      data: { blockType: 'power', label: 'L³' },
    },
    {
      id: 'sb-three',
      type: 'csSource',
      position: { x: 120, y: 340 },
      data: { blockType: 'number', label: '3', value: 3 },
    },
    {
      id: 'sb-PL3',
      type: 'csOperation',
      position: { x: 420, y: 260 },
      data: { blockType: 'multiply', label: 'P × L³' },
    },
    {
      id: 'sb-48',
      type: 'csSource',
      position: { x: 420, y: 360 },
      data: { blockType: 'number', label: '48', value: 48 },
    },
    {
      id: 'sb-EI',
      type: 'csOperation',
      position: { x: 420, y: 430 },
      data: { blockType: 'multiply', label: 'E × I' },
    },
    {
      id: 'sb-48EI',
      type: 'csOperation',
      position: { x: 600, y: 380 },
      data: { blockType: 'multiply', label: '48 × E × I' },
    },
    {
      id: 'sb-defl',
      type: 'csOperation',
      position: { x: 750, y: 280 },
      data: { blockType: 'divide', label: 'δ = PL³/(48EI)' },
    },
    {
      id: 'sb-defl-disp',
      type: 'csDisplay',
      position: { x: 930, y: 280 },
      data: { blockType: 'display', label: 'Max Deflection (m)' },
    },
  ]

  const edges = [
    // M = PL/4
    { id: 'sb-e1', source: 'sb-P', sourceHandle: 'out', target: 'sb-PL', targetHandle: 'a' },
    { id: 'sb-e2', source: 'sb-L', sourceHandle: 'out', target: 'sb-PL', targetHandle: 'b' },
    { id: 'sb-e3', source: 'sb-PL', sourceHandle: 'out', target: 'sb-M', targetHandle: 'a' },
    { id: 'sb-e4', source: 'sb-four', sourceHandle: 'out', target: 'sb-M', targetHandle: 'b' },
    // σ = M/Z
    { id: 'sb-e5', source: 'sb-M', sourceHandle: 'out', target: 'sb-stress', targetHandle: 'a' },
    { id: 'sb-e6', source: 'sb-Z', sourceHandle: 'out', target: 'sb-stress', targetHandle: 'b' },
    {
      id: 'sb-e7',
      source: 'sb-stress',
      sourceHandle: 'out',
      target: 'sb-stress-disp',
      targetHandle: 'value',
    },
    // L³
    { id: 'sb-e8', source: 'sb-L', sourceHandle: 'out', target: 'sb-L3', targetHandle: 'a' },
    { id: 'sb-e9', source: 'sb-three', sourceHandle: 'out', target: 'sb-L3', targetHandle: 'b' },
    // PL³
    { id: 'sb-e10', source: 'sb-P', sourceHandle: 'out', target: 'sb-PL3', targetHandle: 'a' },
    { id: 'sb-e11', source: 'sb-L3', sourceHandle: 'out', target: 'sb-PL3', targetHandle: 'b' },
    // EI
    { id: 'sb-e12', source: 'sb-E', sourceHandle: 'out', target: 'sb-EI', targetHandle: 'a' },
    { id: 'sb-e13', source: 'sb-I', sourceHandle: 'out', target: 'sb-EI', targetHandle: 'b' },
    // 48EI
    { id: 'sb-e14', source: 'sb-48', sourceHandle: 'out', target: 'sb-48EI', targetHandle: 'a' },
    { id: 'sb-e15', source: 'sb-EI', sourceHandle: 'out', target: 'sb-48EI', targetHandle: 'b' },
    // δ
    { id: 'sb-e16', source: 'sb-PL3', sourceHandle: 'out', target: 'sb-defl', targetHandle: 'a' },
    { id: 'sb-e17', source: 'sb-48EI', sourceHandle: 'out', target: 'sb-defl', targetHandle: 'b' },
    {
      id: 'sb-e18',
      source: 'sb-defl',
      sourceHandle: 'out',
      target: 'sb-defl-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
