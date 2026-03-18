/**
 * spring-mass-damper.ts — Interactive spring-mass-damper tutorial template.
 *
 * 9.10: 5-minute tutorial demonstrating the input→compute→visualise workflow.
 *
 * System: mass m on a spring k with damper c, excited by a unit step input.
 *
 * Calculations:
 *   ωn = √(k/m)              — natural frequency
 *   ζ  = c / (2√(km))        — damping ratio
 *   %OS = exp(-πζ/√(1-ζ²))  — percent overshoot
 *   y(t) = step 2nd order    — time-domain response at t
 *
 * Default values: k = 100 N/m, m = 1 kg, c = 2 N·s/m, t = 2 s
 *   → ωn ≈ 10 rad/s, ζ ≈ 0.1, %OS ≈ 72.9%, y(2) ≈ 0.998
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildSpringMassDamper(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ────────────────────────────────────────────────
    {
      id: 'smd-title',
      type: 'csAnnotation',
      position: { x: -20, y: -90 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Spring-Mass-Damper System\n\nAdjust k, m, c and t to see how the system response changes.\nNatural frequency ωn, damping ratio ζ, overshoot and step response update in real time.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 420,
      },
      style: { width: 420 },
    },

    // ── Input nodes ──────────────────────────────────────────────────────
    {
      id: 'smd-k',
      type: 'csSource',
      position: { x: 0, y: 40 },
      data: { blockType: 'number', label: 'Spring stiffness k (N/m)', value: 100 },
    },
    {
      id: 'smd-m',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: 'Mass m (kg)', value: 1 },
    },
    {
      id: 'smd-c',
      type: 'csSource',
      position: { x: 0, y: 280 },
      data: { blockType: 'number', label: 'Damping coeff c (N·s/m)', value: 2 },
    },
    {
      id: 'smd-t',
      type: 'csSource',
      position: { x: 0, y: 400 },
      data: { blockType: 'number', label: 'Time t (s)', value: 2 },
    },

    // ── Step 1 annotation: inputs ────────────────────────────────────────
    {
      id: 'smd-ann1',
      type: 'csAnnotation',
      position: { x: -180, y: 60 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '① Set inputs\n\nChange k, m, c, t to explore\ndifferent system configurations.',
        annotationColor: '#60a5fa',
        annotationFontSize: 11,
        width: 160,
      },
      style: { width: 160 },
    },

    // ── Operations ───────────────────────────────────────────────────────
    {
      id: 'smd-wn',
      type: 'csOperation',
      position: { x: 280, y: 80 },
      data: { blockType: 'ctrl.natural_freq', label: 'ωn = √(k/m)' },
    },
    {
      id: 'smd-zeta',
      type: 'csOperation',
      position: { x: 280, y: 220 },
      data: { blockType: 'ctrl.damping_ratio', label: 'ζ = c/(2√km)' },
    },
    {
      id: 'smd-os',
      type: 'csOperation',
      position: { x: 280, y: 360 },
      data: { blockType: 'ctrl.overshoot_2nd', label: '% Overshoot' },
    },
    {
      id: 'smd-step',
      type: 'csOperation',
      position: { x: 280, y: 460 },
      data: { blockType: 'ctrl.step_2nd_order', label: 'Step Response y(t)' },
    },

    // ── Step 2 annotation: operations ───────────────────────────────────
    {
      id: 'smd-ann2',
      type: 'csAnnotation',
      position: { x: 280, y: -40 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '② Computation\n\nThe engine evaluates each block\nautomatically — no code needed.',
        annotationColor: '#4ade80',
        annotationFontSize: 11,
        width: 160,
      },
      style: { width: 160 },
    },

    // ── Outputs ──────────────────────────────────────────────────────────
    {
      id: 'smd-wn-disp',
      type: 'csDisplay',
      position: { x: 530, y: 80 },
      data: { blockType: 'display', label: 'Natural Freq ωn (rad/s)' },
    },
    {
      id: 'smd-zeta-disp',
      type: 'csDisplay',
      position: { x: 530, y: 220 },
      data: { blockType: 'display', label: 'Damping Ratio ζ' },
    },
    {
      id: 'smd-os-disp',
      type: 'csDisplay',
      position: { x: 530, y: 360 },
      data: { blockType: 'display', label: '% Overshoot' },
    },
    {
      id: 'smd-step-disp',
      type: 'csDisplay',
      position: { x: 530, y: 460 },
      data: { blockType: 'display', label: 'Step Response y(t)' },
    },

    // K = 1 for unit step input
    {
      id: 'smd-K',
      type: 'csSource',
      position: { x: 0, y: 480 },
      data: { blockType: 'number', label: 'Step gain K', value: 1 },
    },

    // ── Step 3 annotation: outputs ───────────────────────────────────────
    {
      id: 'smd-ann3',
      type: 'csAnnotation',
      position: { x: 530, y: -40 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '③ Results\n\nDisplay blocks show live results.\nDouble-click any block to inspect.',
        annotationColor: '#a78bfa',
        annotationFontSize: 11,
        width: 160,
      },
      style: { width: 160 },
    },

    // ── Interpretation annotation ────────────────────────────────────────
    {
      id: 'smd-ann4',
      type: 'csAnnotation',
      position: { x: 0, y: 530 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Try it:\n• Increase c → ζ rises, overshoot falls\n• At ζ = 1 (critically damped): c = 2√(km) ≈ 20 N·s/m\n• Increase k → ωn rises (stiffer system responds faster)',
        annotationColor: '#fb923c',
        annotationFontSize: 11,
        width: 700,
      },
      style: { width: 700 },
    },
  ]

  const edges = [
    // ωn = √(k/m)
    { id: 'smd-e1', source: 'smd-k', sourceHandle: 'out', target: 'smd-wn', targetHandle: 'k' },
    { id: 'smd-e2', source: 'smd-m', sourceHandle: 'out', target: 'smd-wn', targetHandle: 'm' },
    {
      id: 'smd-e3',
      source: 'smd-wn',
      sourceHandle: 'out',
      target: 'smd-wn-disp',
      targetHandle: 'value',
    },

    // ζ = c/(2√km)
    { id: 'smd-e4', source: 'smd-c', sourceHandle: 'out', target: 'smd-zeta', targetHandle: 'c' },
    { id: 'smd-e5', source: 'smd-k', sourceHandle: 'out', target: 'smd-zeta', targetHandle: 'k' },
    { id: 'smd-e6', source: 'smd-m', sourceHandle: 'out', target: 'smd-zeta', targetHandle: 'm' },
    {
      id: 'smd-e7',
      source: 'smd-zeta',
      sourceHandle: 'out',
      target: 'smd-zeta-disp',
      targetHandle: 'value',
    },

    // %OS (from ζ)
    {
      id: 'smd-e8',
      source: 'smd-zeta',
      sourceHandle: 'out',
      target: 'smd-os',
      targetHandle: 'zeta',
    },
    {
      id: 'smd-e9',
      source: 'smd-os',
      sourceHandle: 'out',
      target: 'smd-os-disp',
      targetHandle: 'value',
    },

    // Step 2nd order (K=1, wn from block, zeta from block, t from input)
    { id: 'smd-e10', source: 'smd-K', sourceHandle: 'out', target: 'smd-step', targetHandle: 'K' },
    {
      id: 'smd-e11',
      source: 'smd-wn',
      sourceHandle: 'out',
      target: 'smd-step',
      targetHandle: 'wn',
    },
    {
      id: 'smd-e12',
      source: 'smd-zeta',
      sourceHandle: 'out',
      target: 'smd-step',
      targetHandle: 'zeta',
    },
    { id: 'smd-e13', source: 'smd-t', sourceHandle: 'out', target: 'smd-step', targetHandle: 't' },
    {
      id: 'smd-e14',
      source: 'smd-step',
      sourceHandle: 'out',
      target: 'smd-step-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
