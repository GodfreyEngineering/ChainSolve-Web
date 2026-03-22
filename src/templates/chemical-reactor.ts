/**
 * chemical-reactor.ts — CSTR with Arrhenius kinetics template.
 *
 * Models a Continuous Stirred Tank Reactor (CSTR) with first-order
 * irreversible reaction A -> B, using Arrhenius temperature dependence.
 *
 * Calculations:
 *   k   = A·exp(-Ea/RT)          — Arrhenius rate constant
 *   tau = V / Q                   — residence time
 *   X   = k·tau / (1 + k·tau)    — CSTR conversion (1st order)
 *   C_A = C_A0 · (1 - X)         — outlet concentration
 *
 * Default values: T_feed=300 K, C_A0=2.0 mol/L, V=10 L, Q=1 L/min,
 *   Ea=75000 J/mol, A=1e10 1/min, R=8.314 J/mol·K, T=350 K
 *   -> k ~ 0.673 1/min, tau = 10 min, X ~ 0.871, C_A ~ 0.258 mol/L
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildChemicalReactor(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ──────────────────────────────────────────────
    {
      id: 'cr-title',
      type: 'csAnnotation',
      position: { x: -20, y: -100 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'CSTR with Arrhenius Kinetics\n\nFirst-order irreversible reaction A \u2192 B in a continuous stirred-tank reactor.\nAdjust feed conditions, reactor volume, and temperature to see how conversion changes.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 480,
      },
      style: { width: 480 },
    },

    // ── Kinetics annotation ───────────────────────────────────────────
    {
      id: 'cr-ann-kinetics',
      type: 'csAnnotation',
      position: { x: -200, y: 20 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '\u2460 Arrhenius Kinetics\n\nk = A\u00b7exp(\u2212Ea/RT)\nHigher T \u2192 faster reaction.',
        annotationColor: '#60a5fa',
        annotationFontSize: 11,
        width: 160,
      },
      style: { width: 160 },
    },

    // ── Reactor annotation ────────────────────────────────────────────
    {
      id: 'cr-ann-reactor',
      type: 'csAnnotation',
      position: { x: -200, y: 340 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '\u2461 Residence Time & Conversion\n\n\u03c4 = V/Q (how long fluid stays)\nX = k\u03c4/(1+k\u03c4) for 1st-order CSTR.',
        annotationColor: '#60a5fa',
        annotationFontSize: 11,
        width: 180,
      },
      style: { width: 180 },
    },

    // ── Output annotation ─────────────────────────────────────────────
    {
      id: 'cr-ann-output',
      type: 'csAnnotation',
      position: { x: 680, y: 340 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '\u2462 Outlet Concentration\n\nC_A = C_A0\u00b7(1\u2212X)\nFraction of A remaining in the exit stream.',
        annotationColor: '#60a5fa',
        annotationFontSize: 11,
        width: 180,
      },
      style: { width: 180 },
    },

    // ── Inputs: Arrhenius parameters ──────────────────────────────────
    {
      id: 'cr-A',
      type: 'csSource',
      position: { x: 0, y: 40 },
      data: { blockType: 'number', label: 'Pre-exponential A (1/min)', value: 1e10 },
    },
    {
      id: 'cr-Ea',
      type: 'csSource',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'Activation Energy Ea (J/mol)', value: 75000 },
    },
    {
      id: 'cr-R',
      type: 'csSource',
      position: { x: 0, y: 200 },
      data: { blockType: 'number', label: 'Gas Constant R (J/mol\u00b7K)', value: 8.314 },
    },
    {
      id: 'cr-T',
      type: 'csSource',
      position: { x: 0, y: 280 },
      data: { blockType: 'number', label: 'Reactor Temperature T (K)', value: 350 },
    },

    // ── Inputs: Reactor parameters ────────────────────────────────────
    {
      id: 'cr-V',
      type: 'csSource',
      position: { x: 0, y: 400 },
      data: { blockType: 'number', label: 'Volume V (L)', value: 10 },
    },
    {
      id: 'cr-Q',
      type: 'csSource',
      position: { x: 0, y: 480 },
      data: { blockType: 'number', label: 'Flow Rate Q (L/min)', value: 1 },
    },
    {
      id: 'cr-CA0',
      type: 'csSource',
      position: { x: 0, y: 560 },
      data: { blockType: 'number', label: 'Feed Concentration C_A0 (mol/L)', value: 2.0 },
    },
    {
      id: 'cr-Tfeed',
      type: 'csSource',
      position: { x: 0, y: 640 },
      data: { blockType: 'number', label: 'Feed Temperature T_feed (K)', value: 300 },
    },

    // ── Arrhenius rate constant: k = A·exp(-Ea/RT) ───────────────────
    {
      id: 'cr-k',
      type: 'csOperation',
      position: { x: 280, y: 120 },
      data: { blockType: 'chem.arrhenius_rate', label: 'k = A\u00b7exp(\u2212Ea/RT)' },
    },
    {
      id: 'cr-k-disp',
      type: 'csDisplay',
      position: { x: 500, y: 120 },
      data: { blockType: 'display', label: 'Rate Constant k (1/min)' },
    },

    // ── Residence time: tau = V / Q ──────────────────────────────────
    {
      id: 'cr-tau',
      type: 'csOperation',
      position: { x: 280, y: 430 },
      data: { blockType: 'divide', label: '\u03c4 = V / Q (min)' },
    },
    {
      id: 'cr-tau-disp',
      type: 'csDisplay',
      position: { x: 500, y: 430 },
      data: { blockType: 'display', label: 'Residence Time \u03c4 (min)' },
    },

    // ── CSTR conversion: X = k·tau / (1 + k·tau) ────────────────────
    {
      id: 'cr-X',
      type: 'csOperation',
      position: { x: 500, y: 280 },
      data: { blockType: 'chem.CSTR_conv', label: 'CSTR Conversion X' },
    },
    {
      id: 'cr-X-disp',
      type: 'csDisplay',
      position: { x: 700, y: 280 },
      data: { blockType: 'display', label: 'Conversion X' },
    },

    // ── Outlet concentration: C_A = C_A0 · (1 - X) ──────────────────
    {
      id: 'cr-oneMinusX',
      type: 'csOperation',
      position: { x: 700, y: 430 },
      data: { blockType: 'subtract', label: '1 \u2212 X' },
    },
    {
      id: 'cr-one',
      type: 'csSource',
      position: { x: 700, y: 560 },
      data: { blockType: 'number', label: '1', value: 1 },
    },
    {
      id: 'cr-CA',
      type: 'csOperation',
      position: { x: 900, y: 490 },
      data: { blockType: 'multiply', label: 'C_A = C_A0\u00b7(1\u2212X)' },
    },
    {
      id: 'cr-CA-disp',
      type: 'csDisplay',
      position: { x: 1100, y: 490 },
      data: { blockType: 'display', label: 'Outlet C_A (mol/L)' },
    },
  ]

  const edges = [
    // Arrhenius rate constant: k = A·exp(-Ea/RT)
    { id: 'cr-e1', source: 'cr-A', sourceHandle: 'out', target: 'cr-k', targetHandle: 'A' },
    { id: 'cr-e2', source: 'cr-Ea', sourceHandle: 'out', target: 'cr-k', targetHandle: 'Ea' },
    { id: 'cr-e3', source: 'cr-R', sourceHandle: 'out', target: 'cr-k', targetHandle: 'R' },
    { id: 'cr-e4', source: 'cr-T', sourceHandle: 'out', target: 'cr-k', targetHandle: 'T' },
    // k -> display
    {
      id: 'cr-e5',
      source: 'cr-k',
      sourceHandle: 'out',
      target: 'cr-k-disp',
      targetHandle: 'value',
    },

    // Residence time: tau = V / Q
    { id: 'cr-e6', source: 'cr-V', sourceHandle: 'out', target: 'cr-tau', targetHandle: 'a' },
    { id: 'cr-e7', source: 'cr-Q', sourceHandle: 'out', target: 'cr-tau', targetHandle: 'b' },
    // tau -> display
    {
      id: 'cr-e8',
      source: 'cr-tau',
      sourceHandle: 'out',
      target: 'cr-tau-disp',
      targetHandle: 'value',
    },

    // CSTR conversion: X = k·tau / (1 + k·tau)
    { id: 'cr-e9', source: 'cr-k', sourceHandle: 'out', target: 'cr-X', targetHandle: 'k' },
    { id: 'cr-e10', source: 'cr-tau', sourceHandle: 'out', target: 'cr-X', targetHandle: 'tau' },
    // X -> display
    {
      id: 'cr-e11',
      source: 'cr-X',
      sourceHandle: 'out',
      target: 'cr-X-disp',
      targetHandle: 'value',
    },

    // Outlet concentration: C_A = C_A0 · (1 - X)
    {
      id: 'cr-e12',
      source: 'cr-one',
      sourceHandle: 'out',
      target: 'cr-oneMinusX',
      targetHandle: 'a',
    },
    {
      id: 'cr-e13',
      source: 'cr-X',
      sourceHandle: 'out',
      target: 'cr-oneMinusX',
      targetHandle: 'b',
    },
    {
      id: 'cr-e14',
      source: 'cr-CA0',
      sourceHandle: 'out',
      target: 'cr-CA',
      targetHandle: 'a',
    },
    {
      id: 'cr-e15',
      source: 'cr-oneMinusX',
      sourceHandle: 'out',
      target: 'cr-CA',
      targetHandle: 'b',
    },
    // C_A -> display
    {
      id: 'cr-e16',
      source: 'cr-CA',
      sourceHandle: 'out',
      target: 'cr-CA-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
