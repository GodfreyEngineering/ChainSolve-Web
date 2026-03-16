/**
 * fluid-flow.ts — Reynolds Number & Flow Classification template.
 *
 * Computes the Reynolds number:
 *   Re = rho * v * D / mu
 *
 * and classifies the flow as laminar (Re < 2300) or turbulent.
 *
 * Inputs: density rho, velocity v, diameter D, dynamic viscosity mu.
 * Default values: rho = 1000 kg/m3 (water), v = 1.5 m/s,
 *   D = 0.05 m (50 mm pipe), mu = 0.001 Pa*s (water at 20C)
 *   -> Re = 75000 (turbulent)
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildFluidFlow(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'ff-rho',
      type: 'csSource',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Density \u03C1 (kg/m\u00B3)', value: 1000 },
    },
    {
      id: 'ff-v',
      type: 'csSource',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'Velocity v (m/s)', value: 1.5 },
    },
    {
      id: 'ff-d',
      type: 'csSource',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'Diameter D (m)', value: 0.05 },
    },
    {
      id: 'ff-mu',
      type: 'csSource',
      position: { x: 0, y: 360 },
      data: { blockType: 'number', label: 'Viscosity \u03BC (Pa\u00B7s)', value: 0.001 },
    },

    // ── Operation ─────────────────────────────────────────────────────
    {
      id: 'ff-re',
      type: 'csOperation',
      position: { x: 280, y: 120 },
      data: { blockType: 'eng.fluids.reynolds', label: 'Re = \u03C1vD/\u03BC' },
    },

    // ── Flow classification (Re < 2300 = laminar) ─────────────────────
    {
      id: 'ff-threshold',
      type: 'csSource',
      position: { x: 280, y: 300 },
      data: { blockType: 'number', label: 'Laminar Threshold', value: 2300 },
    },
    {
      id: 'ff-cmp',
      type: 'csOperation',
      position: { x: 500, y: 240 },
      data: { blockType: 'less', label: 'Re < 2300 ?' },
    },

    // ── Outputs ───────────────────────────────────────────────────────
    {
      id: 'ff-re-disp',
      type: 'csDisplay',
      position: { x: 500, y: 120 },
      data: { blockType: 'display', label: 'Reynolds Number Re' },
    },
    {
      id: 'ff-regime-disp',
      type: 'csDisplay',
      position: { x: 720, y: 240 },
      data: { blockType: 'display', label: 'Laminar? (1=yes, 0=no)' },
    },
  ]

  const edges = [
    // Reynolds number wiring
    {
      id: 'ff-e1',
      source: 'ff-rho',
      sourceHandle: 'out',
      target: 'ff-re',
      targetHandle: 'rho',
    },
    { id: 'ff-e2', source: 'ff-v', sourceHandle: 'out', target: 'ff-re', targetHandle: 'v' },
    { id: 'ff-e3', source: 'ff-d', sourceHandle: 'out', target: 'ff-re', targetHandle: 'D' },
    {
      id: 'ff-e4',
      source: 'ff-mu',
      sourceHandle: 'out',
      target: 'ff-re',
      targetHandle: 'mu',
    },
    // Re display
    {
      id: 'ff-e5',
      source: 'ff-re',
      sourceHandle: 'out',
      target: 'ff-re-disp',
      targetHandle: 'value',
    },
    // Flow classification
    { id: 'ff-e6', source: 'ff-re', sourceHandle: 'out', target: 'ff-cmp', targetHandle: 'a' },
    {
      id: 'ff-e7',
      source: 'ff-threshold',
      sourceHandle: 'out',
      target: 'ff-cmp',
      targetHandle: 'b',
    },
    {
      id: 'ff-e8',
      source: 'ff-cmp',
      sourceHandle: 'out',
      target: 'ff-regime-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
