/**
 * power-flow.ts — AC Power Flow tutorial template (12.7).
 *
 * Computes apparent, active (real) and reactive power for an AC circuit:
 *   S = V × I   (apparent power, VA)
 *   P = S × cos(φ)  (active / real power, W)
 *   Q = S × sin(φ)  (reactive power, VAR)
 *   pf = P / S      (power factor, 0–1)
 *
 * Default: V = 230 Vrms, I = 10 A, φ = 30°
 * Expected: S = 2300 VA, P ≈ 1991.6 W, Q ≈ 1150 VAR, pf ≈ 0.866
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildPowerFlow(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    {
      id: 'pf-title',
      type: 'csAnnotation',
      position: { x: -20, y: -100 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'AC Power Flow Analysis\n\n' +
          'Single-phase apparent, active, and reactive power for a load with phase angle φ.\n' +
          'S (VA) = V × I   |   P (W) = S·cos(φ)   |   Q (VAR) = S·sin(φ)   |   pf = P/S',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 620,
      },
      style: { width: 620 },
    },

    // Inputs
    {
      id: 'pf-V',
      type: 'csSource',
      position: { x: 0, y: 20 },
      data: { blockType: 'number', label: 'Voltage V (Vrms)', value: 230 },
    },
    {
      id: 'pf-I',
      type: 'csSource',
      position: { x: 0, y: 90 },
      data: { blockType: 'number', label: 'Current I (A)', value: 10 },
    },
    {
      id: 'pf-phi',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: 'Phase angle φ (°)', value: 30 },
    },

    // Apparent power S = V × I
    {
      id: 'pf-S',
      type: 'csOperation',
      position: { x: 240, y: 50 },
      data: { blockType: 'multiply', label: 'S = V·I (VA)' },
    },
    {
      id: 'pf-S-d',
      type: 'csDisplay',
      position: { x: 440, y: 50 },
      data: { blockType: 'display', label: 'Apparent power S (VA)' },
    },

    // Convert φ to radians: φ_rad = φ × (π/180)
    {
      id: 'pf-pi180',
      type: 'csSource',
      position: { x: 0, y: 260 },
      data: { blockType: 'number', label: 'π/180', value: 0.017453292519943295 },
    },
    {
      id: 'pf-phi-r',
      type: 'csOperation',
      position: { x: 240, y: 230 },
      data: { blockType: 'multiply', label: 'φ·π/180 (rad)' },
    },

    // cos(φ) and sin(φ)
    {
      id: 'pf-cos',
      type: 'csOperation',
      position: { x: 440, y: 200 },
      data: { blockType: 'cos', label: 'cos(φ)' },
    },
    {
      id: 'pf-sin',
      type: 'csOperation',
      position: { x: 440, y: 290 },
      data: { blockType: 'sin', label: 'sin(φ)' },
    },

    // P = S × cos(φ)
    {
      id: 'pf-P',
      type: 'csOperation',
      position: { x: 620, y: 120 },
      data: { blockType: 'multiply', label: 'P = S·cos(φ) (W)' },
    },
    {
      id: 'pf-P-d',
      type: 'csDisplay',
      position: { x: 820, y: 120 },
      data: { blockType: 'display', label: 'Active power P (W)' },
    },

    // Q = S × sin(φ)
    {
      id: 'pf-Q',
      type: 'csOperation',
      position: { x: 620, y: 250 },
      data: { blockType: 'multiply', label: 'Q = S·sin(φ) (VAR)' },
    },
    {
      id: 'pf-Q-d',
      type: 'csDisplay',
      position: { x: 820, y: 250 },
      data: { blockType: 'display', label: 'Reactive power Q (VAR)' },
    },

    // Power factor pf = P / S
    {
      id: 'pf-pf',
      type: 'csOperation',
      position: { x: 620, y: 370 },
      data: { blockType: 'divide', label: 'pf = P/S' },
    },
    {
      id: 'pf-pf-d',
      type: 'csDisplay',
      position: { x: 820, y: 370 },
      data: { blockType: 'display', label: 'Power factor (0–1)' },
    },

    {
      id: 'pf-ann2',
      type: 'csAnnotation',
      position: { x: 0, y: 460 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Interpretation:\n' +
          '  pf = 1.0 → purely resistive load, all power is useful work\n' +
          '  pf = 0.0 → purely reactive load, no useful work done\n' +
          '  pf < 0.95 → utility companies charge penalty in industrial tariffs\n' +
          '  Reactive compensation (capacitor banks) raises pf toward 1.',
        annotationColor: '#06b6d4',
        annotationFontSize: 11,
        width: 620,
      },
      style: { width: 620 },
    },
  ]

  const edges = [
    // S = V × I
    {
      id: 'pf-e-S-V',
      source: 'pf-V',
      sourceHandle: 'out',
      target: 'pf-S',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'pf-e-S-I',
      source: 'pf-I',
      sourceHandle: 'out',
      target: 'pf-S',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'pf-e-S-d',
      source: 'pf-S',
      sourceHandle: 'out',
      target: 'pf-S-d',
      targetHandle: 'value',
      animated: true,
    },
    // φ → radians
    {
      id: 'pf-e-phir-phi',
      source: 'pf-phi',
      sourceHandle: 'out',
      target: 'pf-phi-r',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'pf-e-phir-conv',
      source: 'pf-pi180',
      sourceHandle: 'out',
      target: 'pf-phi-r',
      targetHandle: 'b',
      animated: true,
    },
    // cos/sin of φ_rad
    {
      id: 'pf-e-cos',
      source: 'pf-phi-r',
      sourceHandle: 'out',
      target: 'pf-cos',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'pf-e-sin',
      source: 'pf-phi-r',
      sourceHandle: 'out',
      target: 'pf-sin',
      targetHandle: 'a',
      animated: true,
    },
    // P = S × cos(φ)
    {
      id: 'pf-e-P-S',
      source: 'pf-S',
      sourceHandle: 'out',
      target: 'pf-P',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'pf-e-P-c',
      source: 'pf-cos',
      sourceHandle: 'out',
      target: 'pf-P',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'pf-e-P-d',
      source: 'pf-P',
      sourceHandle: 'out',
      target: 'pf-P-d',
      targetHandle: 'value',
      animated: true,
    },
    // Q = S × sin(φ)
    {
      id: 'pf-e-Q-S',
      source: 'pf-S',
      sourceHandle: 'out',
      target: 'pf-Q',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'pf-e-Q-s',
      source: 'pf-sin',
      sourceHandle: 'out',
      target: 'pf-Q',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'pf-e-Q-d',
      source: 'pf-Q',
      sourceHandle: 'out',
      target: 'pf-Q-d',
      targetHandle: 'value',
      animated: true,
    },
    // pf = P / S
    {
      id: 'pf-e-pf-P',
      source: 'pf-P',
      sourceHandle: 'out',
      target: 'pf-pf',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'pf-e-pf-S',
      source: 'pf-S',
      sourceHandle: 'out',
      target: 'pf-pf',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'pf-e-pf-d',
      source: 'pf-pf',
      sourceHandle: 'out',
      target: 'pf-pf-d',
      targetHandle: 'value',
      animated: true,
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
