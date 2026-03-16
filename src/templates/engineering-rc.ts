/**
 * engineering-rc.ts — RC Circuit Time Constant template.
 *
 * Computes the RC circuit time constant:
 *   τ = R · C
 *
 * where:
 *   R = resistance (ohms)
 *   C = capacitance (farads)
 *
 * Default values: R = 1000 Ω, C = 0.001 F (1 mF)
 *   → τ = 1 s
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildEngineeringRc(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'rc-r',
      type: 'csSource',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Resistance R (Ω)', value: 1000 },
    },
    {
      id: 'rc-c',
      type: 'csSource',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'Capacitance C (F)', value: 0.001 },
    },

    // ── Operation ─────────────────────────────────────────────────────
    {
      id: 'rc-tau',
      type: 'csOperation',
      position: { x: 240, y: 60 },
      data: { blockType: 'multiply', label: 'τ = R·C' },
    },

    // ── Output ────────────────────────────────────────────────────────
    {
      id: 'rc-disp',
      type: 'csDisplay',
      position: { x: 440, y: 60 },
      data: { blockType: 'display', label: 'Time Constant τ (s)' },
    },
  ]

  const edges = [
    // τ = R * C
    { id: 'rc-e1', source: 'rc-r', sourceHandle: 'out', target: 'rc-tau', targetHandle: 'a' },
    { id: 'rc-e2', source: 'rc-c', sourceHandle: 'out', target: 'rc-tau', targetHandle: 'b' },
    // display
    {
      id: 'rc-e3',
      source: 'rc-tau',
      sourceHandle: 'out',
      target: 'rc-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
