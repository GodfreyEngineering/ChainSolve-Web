/**
 * aerospace-drag.ts — Aircraft Cruise Drag & Lift template.
 *
 * Showcases the aerospace block pack (aero.*) with a complete
 * cruise-condition analysis pipeline:
 *
 *   1. ISA atmosphere at altitude h: temperature T, density rho, speed of sound a
 *   2. Mach number M = v / a
 *   3. Dynamic pressure q = 1/2 rho v^2
 *   4. Lift L = CL * q * S
 *   5. Drag D = CD * q * S
 *   6. TSFC = fuel_flow / Thrust (thrust = drag at cruise)
 *   7. Lift-to-drag ratio L/D
 *
 * Default values: h = 10 000 m, v = 250 m/s, S = 120 m^2,
 *                 CL = 0.5, CD = 0.03, fuel_flow = 0.8 kg/s
 *   -> T ~ 223.25 K, rho ~ 0.4135 kg/m^3, a ~ 299.5 m/s,
 *      M ~ 0.835, q ~ 12 921 Pa, L ~ 775 260 N, D ~ 46 516 N,
 *      L/D ~ 16.67, TSFC ~ 1.72e-5 kg/(N*s)
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildAerospaceDrag(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ──────────────────────────────────────────────
    {
      id: 'ad-title',
      type: 'csAnnotation',
      position: { x: -20, y: -100 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Aircraft Cruise — Drag & Lift Analysis\n\nComputes ISA atmosphere, dynamic pressure, lift, drag, L/D ratio, and TSFC\nfor straight-and-level flight at cruise altitude using aerospace blocks.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 480,
      },
      style: { width: 480 },
    },

    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'ad-h',
      type: 'csSource',
      position: { x: 0, y: 40 },
      data: { blockType: 'number', label: 'Altitude h (m)', value: 10000 },
    },
    {
      id: 'ad-v',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: 'Velocity v (m/s)', value: 250 },
    },
    {
      id: 'ad-S',
      type: 'csSource',
      position: { x: 0, y: 280 },
      data: { blockType: 'number', label: 'Wing area S (m\u00B2)', value: 120 },
    },
    {
      id: 'ad-CL',
      type: 'csSource',
      position: { x: 0, y: 400 },
      data: { blockType: 'number', label: 'Lift coeff C_L', value: 0.5 },
    },
    {
      id: 'ad-CD',
      type: 'csSource',
      position: { x: 0, y: 520 },
      data: { blockType: 'number', label: 'Drag coeff C_D', value: 0.03 },
    },
    {
      id: 'ad-fuel',
      type: 'csSource',
      position: { x: 0, y: 640 },
      data: { blockType: 'number', label: 'Fuel flow (kg/s)', value: 0.8 },
    },

    // ── Inputs annotation ─────────────────────────────────────────────
    {
      id: 'ad-ann-inputs',
      type: 'csAnnotation',
      position: { x: -200, y: 60 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '\u2460 Flight condition\n\nAdjust altitude, speed, wing geometry,\nand aero coefficients to explore\ndifferent cruise regimes.',
        annotationColor: '#60a5fa',
        annotationFontSize: 11,
        width: 180,
      },
      style: { width: 180 },
    },

    // ── ISA Atmosphere ────────────────────────────────────────────────
    {
      id: 'ad-isa-T',
      type: 'csOperation',
      position: { x: 280, y: 0 },
      data: { blockType: 'aero.ISA_T', label: 'ISA T(h)' },
    },
    {
      id: 'ad-isa-rho',
      type: 'csOperation',
      position: { x: 280, y: 100 },
      data: { blockType: 'aero.ISA_rho', label: 'ISA \u03C1(h)' },
    },
    {
      id: 'ad-isa-a',
      type: 'csOperation',
      position: { x: 280, y: 200 },
      data: { blockType: 'aero.ISA_a', label: 'ISA a(h)' },
    },

    // ── Mach & Dynamic Pressure ───────────────────────────────────────
    {
      id: 'ad-mach',
      type: 'csOperation',
      position: { x: 530, y: 160 },
      data: { blockType: 'aero.mach_from_v', label: 'M = v/a' },
    },
    {
      id: 'ad-q',
      type: 'csOperation',
      position: { x: 530, y: 280 },
      data: { blockType: 'aero.dynamic_q', label: 'q = \u00BD\u03C1v\u00B2' },
    },

    // ── Atmosphere annotation ─────────────────────────────────────────
    {
      id: 'ad-ann-atmo',
      type: 'csAnnotation',
      position: { x: 280, y: -80 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '\u2461 ISA Atmosphere\n\nTemperature, density, and speed of\nsound from the International Standard\nAtmosphere model at altitude h.',
        annotationColor: '#4ade80',
        annotationFontSize: 11,
        width: 180,
      },
      style: { width: 180 },
    },

    // ── Lift & Drag ───────────────────────────────────────────────────
    {
      id: 'ad-lift',
      type: 'csOperation',
      position: { x: 780, y: 320 },
      data: { blockType: 'aero.lift', label: 'L = CL\u00B7q\u00B7S' },
    },
    {
      id: 'ad-drag',
      type: 'csOperation',
      position: { x: 780, y: 460 },
      data: { blockType: 'aero.drag', label: 'D = CD\u00B7q\u00B7S' },
    },

    // ── L/D ratio (divide block) ──────────────────────────────────────
    {
      id: 'ad-ld',
      type: 'csOperation',
      position: { x: 780, y: 600 },
      data: { blockType: 'divide', label: 'L/D Ratio' },
    },

    // ── TSFC (thrust = drag at cruise) ────────────────────────────────
    {
      id: 'ad-tsfc',
      type: 'csOperation',
      position: { x: 780, y: 720 },
      data: { blockType: 'aero.tsfc', label: 'TSFC' },
    },

    // ── Forces annotation ─────────────────────────────────────────────
    {
      id: 'ad-ann-forces',
      type: 'csAnnotation',
      position: { x: 780, y: 230 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '\u2462 Forces & Performance\n\nLift and drag from aero coefficients.\nAt cruise, thrust equals drag \u2014 TSFC\nmeasures fuel efficiency.',
        annotationColor: '#a78bfa',
        annotationFontSize: 11,
        width: 180,
      },
      style: { width: 180 },
    },

    // ── Displays ──────────────────────────────────────────────────────
    {
      id: 'ad-T-disp',
      type: 'csDisplay',
      position: { x: 1060, y: 0 },
      data: { blockType: 'display', label: 'Temperature T (K)' },
    },
    {
      id: 'ad-rho-disp',
      type: 'csDisplay',
      position: { x: 1060, y: 100 },
      data: { blockType: 'display', label: 'Density \u03C1 (kg/m\u00B3)' },
    },
    {
      id: 'ad-mach-disp',
      type: 'csDisplay',
      position: { x: 1060, y: 200 },
      data: { blockType: 'display', label: 'Mach Number M' },
    },
    {
      id: 'ad-q-disp',
      type: 'csDisplay',
      position: { x: 1060, y: 300 },
      data: { blockType: 'display', label: 'Dynamic Pressure q (Pa)' },
    },
    {
      id: 'ad-lift-disp',
      type: 'csDisplay',
      position: { x: 1060, y: 400 },
      data: { blockType: 'display', label: 'Lift L (N)' },
    },
    {
      id: 'ad-drag-disp',
      type: 'csDisplay',
      position: { x: 1060, y: 500 },
      data: { blockType: 'display', label: 'Drag D (N)' },
    },
    {
      id: 'ad-ld-disp',
      type: 'csDisplay',
      position: { x: 1060, y: 600 },
      data: { blockType: 'display', label: 'L/D Ratio' },
    },
    {
      id: 'ad-tsfc-disp',
      type: 'csDisplay',
      position: { x: 1060, y: 720 },
      data: { blockType: 'display', label: 'TSFC (kg/(N\u00B7s))' },
    },

    // ── Results annotation ────────────────────────────────────────────
    {
      id: 'ad-ann-results',
      type: 'csAnnotation',
      position: { x: 1060, y: -80 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '\u2463 Results\n\nAll outputs update in real time.\nDouble-click any display to inspect.',
        annotationColor: '#fb923c',
        annotationFontSize: 11,
        width: 160,
      },
      style: { width: 160 },
    },

    // ── Interpretation annotation ─────────────────────────────────────
    {
      id: 'ad-ann-tips',
      type: 'csAnnotation',
      position: { x: 0, y: 780 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Try it:\n\u2022 Increase altitude \u2192 density drops, Mach rises (thinner air, same TAS)\n\u2022 Reduce C_D \u2192 drag falls, L/D improves, TSFC drops (more efficient cruise)\n\u2022 At L/D \u2248 16\u201318, a transport aircraft is near its optimum cruise condition\n\u2022 Thrust = Drag assumption holds in steady, unaccelerated level flight',
        annotationColor: '#fb923c',
        annotationFontSize: 11,
        width: 780,
      },
      style: { width: 780 },
    },
  ]

  const edges = [
    // ── ISA atmosphere: h feeds all three ISA blocks ──────────────────
    { id: 'ad-e1', source: 'ad-h', sourceHandle: 'out', target: 'ad-isa-T', targetHandle: 'h' },
    { id: 'ad-e2', source: 'ad-h', sourceHandle: 'out', target: 'ad-isa-rho', targetHandle: 'h' },
    { id: 'ad-e3', source: 'ad-h', sourceHandle: 'out', target: 'ad-isa-a', targetHandle: 'h' },

    // ── Mach = v / a ──────────────────────────────────────────────────
    { id: 'ad-e4', source: 'ad-v', sourceHandle: 'out', target: 'ad-mach', targetHandle: 'v' },
    { id: 'ad-e5', source: 'ad-isa-a', sourceHandle: 'out', target: 'ad-mach', targetHandle: 'a' },

    // ── Dynamic pressure q = 0.5 * rho * v^2 ─────────────────────────
    {
      id: 'ad-e6',
      source: 'ad-isa-rho',
      sourceHandle: 'out',
      target: 'ad-q',
      targetHandle: 'rho',
    },
    { id: 'ad-e7', source: 'ad-v', sourceHandle: 'out', target: 'ad-q', targetHandle: 'v' },

    // ── Lift L = CL * q * S ───────────────────────────────────────────
    { id: 'ad-e8', source: 'ad-CL', sourceHandle: 'out', target: 'ad-lift', targetHandle: 'CL' },
    { id: 'ad-e9', source: 'ad-q', sourceHandle: 'out', target: 'ad-lift', targetHandle: 'q' },
    { id: 'ad-e10', source: 'ad-S', sourceHandle: 'out', target: 'ad-lift', targetHandle: 'S' },

    // ── Drag D = CD * q * S ───────────────────────────────────────────
    { id: 'ad-e11', source: 'ad-CD', sourceHandle: 'out', target: 'ad-drag', targetHandle: 'CD' },
    { id: 'ad-e12', source: 'ad-q', sourceHandle: 'out', target: 'ad-drag', targetHandle: 'q' },
    { id: 'ad-e13', source: 'ad-S', sourceHandle: 'out', target: 'ad-drag', targetHandle: 'S' },

    // ── L/D = Lift / Drag (divide block: a=L, b=D) ───────────────────
    { id: 'ad-e14', source: 'ad-lift', sourceHandle: 'out', target: 'ad-ld', targetHandle: 'a' },
    { id: 'ad-e15', source: 'ad-drag', sourceHandle: 'out', target: 'ad-ld', targetHandle: 'b' },

    // ── TSFC = fuel_flow / thrust, where thrust = drag at cruise ──────
    {
      id: 'ad-e16',
      source: 'ad-drag',
      sourceHandle: 'out',
      target: 'ad-tsfc',
      targetHandle: 'thrust',
    },
    {
      id: 'ad-e17',
      source: 'ad-fuel',
      sourceHandle: 'out',
      target: 'ad-tsfc',
      targetHandle: 'fuel_flow',
    },

    // ── Display wiring ────────────────────────────────────────────────
    {
      id: 'ad-e20',
      source: 'ad-isa-T',
      sourceHandle: 'out',
      target: 'ad-T-disp',
      targetHandle: 'value',
    },
    {
      id: 'ad-e21',
      source: 'ad-isa-rho',
      sourceHandle: 'out',
      target: 'ad-rho-disp',
      targetHandle: 'value',
    },
    {
      id: 'ad-e22',
      source: 'ad-mach',
      sourceHandle: 'out',
      target: 'ad-mach-disp',
      targetHandle: 'value',
    },
    {
      id: 'ad-e23',
      source: 'ad-q',
      sourceHandle: 'out',
      target: 'ad-q-disp',
      targetHandle: 'value',
    },
    {
      id: 'ad-e24',
      source: 'ad-lift',
      sourceHandle: 'out',
      target: 'ad-lift-disp',
      targetHandle: 'value',
    },
    {
      id: 'ad-e25',
      source: 'ad-drag',
      sourceHandle: 'out',
      target: 'ad-drag-disp',
      targetHandle: 'value',
    },
    {
      id: 'ad-e26',
      source: 'ad-ld',
      sourceHandle: 'out',
      target: 'ad-ld-disp',
      targetHandle: 'value',
    },
    {
      id: 'ad-e27',
      source: 'ad-tsfc',
      sourceHandle: 'out',
      target: 'ad-tsfc-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
