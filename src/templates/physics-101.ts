/**
 * physics-101.ts — Physics 101 sample template.
 *
 * Demonstrates two classic mechanics calculations:
 *   1. Newton's second law: F = ma
 *   2. Kinetic energy:      KE = ½mv²
 *
 * The mass node (p101-m) is shared between both calculations.
 * Default values: m = 10 kg, a = 2 m/s², v = 5 m/s
 *   → F = 20 N,  KE = 125 J
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildPhysics101(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'p101-m',
      type: 'number',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Mass m (kg)', value: 10 },
    },
    {
      id: 'p101-a',
      type: 'number',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'Accel a (m/s²)', value: 2 },
    },
    {
      id: 'p101-v',
      type: 'number',
      position: { x: 0, y: 300 },
      data: { blockType: 'number', label: 'Velocity v (m/s)', value: 5 },
    },
    // ── Operations ────────────────────────────────────────────────────
    {
      id: 'p101-force',
      type: 'eng.mechanics.force_ma',
      position: { x: 220, y: 60 },
      data: { blockType: 'eng.mechanics.force_ma', label: 'F = ma' },
    },
    {
      id: 'p101-ke',
      type: 'eng.mechanics.kinetic_energy',
      position: { x: 220, y: 240 },
      data: { blockType: 'eng.mechanics.kinetic_energy', label: 'KE = ½mv²' },
    },
    // ── Outputs ───────────────────────────────────────────────────────
    {
      id: 'p101-force-disp',
      type: 'display',
      position: { x: 440, y: 60 },
      data: { blockType: 'display', label: 'Force F (N)' },
    },
    {
      id: 'p101-ke-disp',
      type: 'display',
      position: { x: 440, y: 240 },
      data: { blockType: 'display', label: 'Kinetic Energy (J)' },
    },
  ]

  const edges = [
    // F = ma wiring
    {
      id: 'p101-e1',
      source: 'p101-m',
      sourceHandle: 'out',
      target: 'p101-force',
      targetHandle: 'm',
    },
    {
      id: 'p101-e2',
      source: 'p101-a',
      sourceHandle: 'out',
      target: 'p101-force',
      targetHandle: 'a',
    },
    {
      id: 'p101-e3',
      source: 'p101-force',
      sourceHandle: 'out',
      target: 'p101-force-disp',
      targetHandle: 'value',
    },
    // KE = ½mv² wiring (m shared from above)
    { id: 'p101-e4', source: 'p101-m', sourceHandle: 'out', target: 'p101-ke', targetHandle: 'm' },
    { id: 'p101-e5', source: 'p101-v', sourceHandle: 'out', target: 'p101-ke', targetHandle: 'v' },
    {
      id: 'p101-e6',
      source: 'p101-ke',
      sourceHandle: 'out',
      target: 'p101-ke-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
