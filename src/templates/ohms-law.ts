/**
 * ohms-law.ts — Ohm's Law & Electrical Power template.
 *
 * Demonstrates three classic electrical calculations:
 *   1. Ohm's Law: V = IR
 *   2. Power (VI): P = IV
 *   3. Power (I²R): P = I²R
 *
 * Inputs: V (voltage), I (current), R (resistance).
 * Default values: V = 12 V, I = 2 A, R = 6 Ω
 *   → V = IR = 12 V, P(VI) = 24 W, P(I²R) = 24 W
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildOhmsLaw(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'ohm-v',
      type: 'csSource',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Voltage V (V)', value: 12 },
    },
    {
      id: 'ohm-i',
      type: 'csSource',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'Current I (A)', value: 2 },
    },
    {
      id: 'ohm-r',
      type: 'csSource',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'Resistance R (\u03A9)', value: 6 },
    },

    // ── Operations ────────────────────────────────────────────────────
    {
      id: 'ohm-vir',
      type: 'csOperation',
      position: { x: 240, y: 0 },
      data: { blockType: 'eng.elec.ohms_V', label: 'V = IR' },
    },
    {
      id: 'ohm-pvi',
      type: 'csOperation',
      position: { x: 240, y: 120 },
      data: { blockType: 'eng.elec.power_VI', label: 'P = IV' },
    },
    {
      id: 'ohm-pi2r',
      type: 'csOperation',
      position: { x: 240, y: 240 },
      data: { blockType: 'eng.elec.power_I2R', label: 'P = I\u00B2R' },
    },

    // ── Outputs ───────────────────────────────────────────────────────
    {
      id: 'ohm-vir-disp',
      type: 'csDisplay',
      position: { x: 480, y: 0 },
      data: { blockType: 'display', label: 'Voltage V (V)' },
    },
    {
      id: 'ohm-pvi-disp',
      type: 'csDisplay',
      position: { x: 480, y: 120 },
      data: { blockType: 'display', label: 'Power P (W) [VI]' },
    },
    {
      id: 'ohm-pi2r-disp',
      type: 'csDisplay',
      position: { x: 480, y: 240 },
      data: { blockType: 'display', label: 'Power P (W) [I\u00B2R]' },
    },
  ]

  const edges = [
    // V = IR wiring
    {
      id: 'ohm-e1',
      source: 'ohm-i',
      sourceHandle: 'out',
      target: 'ohm-vir',
      targetHandle: 'I',
    },
    {
      id: 'ohm-e2',
      source: 'ohm-r',
      sourceHandle: 'out',
      target: 'ohm-vir',
      targetHandle: 'R',
    },
    {
      id: 'ohm-e3',
      source: 'ohm-vir',
      sourceHandle: 'out',
      target: 'ohm-vir-disp',
      targetHandle: 'value',
    },
    // P = IV wiring
    {
      id: 'ohm-e4',
      source: 'ohm-v',
      sourceHandle: 'out',
      target: 'ohm-pvi',
      targetHandle: 'V',
    },
    {
      id: 'ohm-e5',
      source: 'ohm-i',
      sourceHandle: 'out',
      target: 'ohm-pvi',
      targetHandle: 'I',
    },
    {
      id: 'ohm-e6',
      source: 'ohm-pvi',
      sourceHandle: 'out',
      target: 'ohm-pvi-disp',
      targetHandle: 'value',
    },
    // P = I²R wiring
    {
      id: 'ohm-e7',
      source: 'ohm-i',
      sourceHandle: 'out',
      target: 'ohm-pi2r',
      targetHandle: 'I',
    },
    {
      id: 'ohm-e8',
      source: 'ohm-r',
      sourceHandle: 'out',
      target: 'ohm-pi2r',
      targetHandle: 'R',
    },
    {
      id: 'ohm-e9',
      source: 'ohm-pi2r',
      sourceHandle: 'out',
      target: 'ohm-pi2r-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
