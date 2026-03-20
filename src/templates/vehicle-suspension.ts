/**
 * vehicle-suspension.ts — Vehicle Suspension K&C (Kinematics & Compliance) template.
 *
 * 9.11: Models a quarter-car suspension with spring, damper, and unsprung mass.
 *
 * Calculations:
 *   fn_s  = (1/(2π)) × √(ks / ms)   — sprung mass natural frequency
 *   fn_u  = (1/(2π)) × √(ku / mu)   — unsprung mass natural frequency
 *   ζ     = cs / (2√(ks × ms))      — damping ratio (sprung)
 *   %OS   = exp(-πζ/√(1-ζ²)) × 100 — percent overshoot
 *
 * Default: ks=25000 N/m, ms=350 kg, cs=3500 N·s/m, ku=200000 N/m, mu=45 kg
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildVehicleSuspension(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ────────────────────────────────────────────────
    {
      id: 'vs-title',
      type: 'csAnnotation',
      position: { x: -20, y: -90 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Vehicle Suspension K&C\n\nQuarter-car model: sprung mass ms on spring ks+damper cs, unsprung mass mu on tyre ku.\nAdjust parameters to tune ride comfort vs handling.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 500,
      },
      style: { width: 500 },
    },

    // ── Inputs: sprung side ──────────────────────────────────────────────
    {
      id: 'vs-ks',
      type: 'csSource',
      position: { x: 0, y: 40 },
      data: { blockType: 'number', label: 'Spring stiffness ks (N/m)', value: 25000 },
    },
    {
      id: 'vs-ms',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: 'Sprung mass ms (kg)', value: 350 },
    },
    {
      id: 'vs-cs',
      type: 'csSource',
      position: { x: 0, y: 280 },
      data: { blockType: 'number', label: 'Damper cs (N·s/m)', value: 3500 },
    },

    // ── Inputs: unsprung side ────────────────────────────────────────────
    {
      id: 'vs-ku',
      type: 'csSource',
      position: { x: 0, y: 420 },
      data: { blockType: 'number', label: 'Tyre stiffness ku (N/m)', value: 200000 },
    },
    {
      id: 'vs-mu',
      type: 'csSource',
      position: { x: 0, y: 540 },
      data: { blockType: 'number', label: 'Unsprung mass mu (kg)', value: 45 },
    },

    // ── Operations: sprung frequency ──────────────────────────────────────
    {
      id: 'vs-wn-s',
      type: 'csOperation',
      position: { x: 300, y: 80 },
      data: { blockType: 'ctrl.natural_freq', label: 'ωn_s = √(ks/ms)' },
    },
    {
      id: 'vs-fn-s',
      type: 'csOperation',
      position: { x: 300, y: 180 },
      data: { blockType: 'ctrl.natural_freq', label: 'fn_s (Hz)' },
    },

    // ── Operations: damping ──────────────────────────────────────────────
    {
      id: 'vs-zeta',
      type: 'csOperation',
      position: { x: 300, y: 300 },
      data: { blockType: 'ctrl.damping_ratio', label: 'ζ = cs/(2√(ks·ms))' },
    },
    {
      id: 'vs-os',
      type: 'csOperation',
      position: { x: 300, y: 400 },
      data: { blockType: 'ctrl.overshoot_2nd', label: '% Overshoot' },
    },

    // ── Operations: unsprung frequency ──────────────────────────────────
    {
      id: 'vs-wn-u',
      type: 'csOperation',
      position: { x: 300, y: 520 },
      data: { blockType: 'ctrl.natural_freq', label: 'ωn_u = √(ku/mu)' },
    },
    {
      id: 'vs-fn-u',
      type: 'csOperation',
      position: { x: 300, y: 620 },
      data: { blockType: 'ctrl.natural_freq', label: 'fn_u (Hz)' },
    },

    // ── Displays ─────────────────────────────────────────────────────────
    {
      id: 'vs-disp-fn-s',
      type: 'csDisplay',
      position: { x: 560, y: 180 },
      data: { blockType: 'display', label: 'Sprung freq fn_s (Hz)' },
    },
    {
      id: 'vs-disp-zeta',
      type: 'csDisplay',
      position: { x: 560, y: 300 },
      data: { blockType: 'display', label: 'Damping ratio ζ' },
    },
    {
      id: 'vs-disp-os',
      type: 'csDisplay',
      position: { x: 560, y: 400 },
      data: { blockType: 'display', label: '% Overshoot' },
    },
    {
      id: 'vs-disp-fn-u',
      type: 'csDisplay',
      position: { x: 560, y: 620 },
      data: { blockType: 'display', label: 'Unsprung freq fn_u (Hz)' },
    },

    // ── Guidance annotation ───────────────────────────────────────────────
    {
      id: 'vs-ann2',
      type: 'csAnnotation',
      position: { x: 0, y: 660 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'K&C targets:\n• fn_s ≈ 1–2 Hz (ride comfort), fn_u ≈ 10–15 Hz (wheel hop)\n• ζ ≈ 0.3–0.5 (balance comfort and handling)\n• Ratio fn_u/fn_s ≥ 5 → decoupled dynamics',
        annotationColor: '#fb923c',
        annotationFontSize: 11,
        width: 700,
      },
      style: { width: 700 },
    },
  ]

  const edges = [
    // sprung natural freq (rad/s)
    { id: 'vs-e1', source: 'vs-ks', sourceHandle: 'out', target: 'vs-wn-s', targetHandle: 'k' },
    { id: 'vs-e2', source: 'vs-ms', sourceHandle: 'out', target: 'vs-wn-s', targetHandle: 'm' },
    // sprung freq (Hz) — reuse wn_s through ctrl.natural_freq_hz by feeding k=ks,m=ms
    { id: 'vs-e3', source: 'vs-ks', sourceHandle: 'out', target: 'vs-fn-s', targetHandle: 'k' },
    { id: 'vs-e4', source: 'vs-ms', sourceHandle: 'out', target: 'vs-fn-s', targetHandle: 'm' },
    {
      id: 'vs-e5',
      source: 'vs-fn-s',
      sourceHandle: 'out',
      target: 'vs-disp-fn-s',
      targetHandle: 'value',
    },
    // damping ratio
    { id: 'vs-e6', source: 'vs-cs', sourceHandle: 'out', target: 'vs-zeta', targetHandle: 'c' },
    { id: 'vs-e7', source: 'vs-ks', sourceHandle: 'out', target: 'vs-zeta', targetHandle: 'k' },
    { id: 'vs-e8', source: 'vs-ms', sourceHandle: 'out', target: 'vs-zeta', targetHandle: 'm' },
    {
      id: 'vs-e9',
      source: 'vs-zeta',
      sourceHandle: 'out',
      target: 'vs-disp-zeta',
      targetHandle: 'value',
    },
    // overshoot
    { id: 'vs-e10', source: 'vs-zeta', sourceHandle: 'out', target: 'vs-os', targetHandle: 'zeta' },
    {
      id: 'vs-e11',
      source: 'vs-os',
      sourceHandle: 'out',
      target: 'vs-disp-os',
      targetHandle: 'value',
    },
    // unsprung natural freq (rad/s)
    { id: 'vs-e12', source: 'vs-ku', sourceHandle: 'out', target: 'vs-wn-u', targetHandle: 'k' },
    { id: 'vs-e13', source: 'vs-mu', sourceHandle: 'out', target: 'vs-wn-u', targetHandle: 'm' },
    // unsprung freq (Hz)
    { id: 'vs-e14', source: 'vs-ku', sourceHandle: 'out', target: 'vs-fn-u', targetHandle: 'k' },
    { id: 'vs-e15', source: 'vs-mu', sourceHandle: 'out', target: 'vs-fn-u', targetHandle: 'm' },
    {
      id: 'vs-e16',
      source: 'vs-fn-u',
      sourceHandle: 'out',
      target: 'vs-disp-fn-u',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
