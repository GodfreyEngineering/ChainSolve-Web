/**
 * stirlings-approximation.ts — Stirling's Approximation tutorial template (12.7).
 *
 * Approximates n! using Stirling's formula:
 *   n! ≈ √(2πn) × (n/e)^n
 *
 * Demonstrates how a complex factorial can be estimated with elementary
 * operations. Shows the approximation error vs the known exact value.
 *
 * Default: n = 10  (10! = 3,628,800; Stirling ≈ 3,598,696 — error ~0.83%)
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildStirlingsApproximation(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    {
      id: 'st-title',
      type: 'csAnnotation',
      position: { x: -20, y: -110 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          "Stirling's Approximation\n\n" +
          'n! ≈ √(2πn) × (n/e)^n\n' +
          'Approximates the factorial of large n using only square-root, power, and multiply.\n' +
          'Accuracy improves rapidly as n increases — fundamental in statistical mechanics and combinatorics.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 640,
      },
      style: { width: 640 },
    },

    // Inputs
    {
      id: 'st-n',
      type: 'csSource',
      position: { x: 0, y: 20 },
      data: { blockType: 'number', label: 'n', value: 10 },
    },
    {
      id: 'st-pi',
      type: 'csSource',
      position: { x: 0, y: 90 },
      data: { blockType: 'number', label: 'π', value: 3.141592653589793 },
    },
    {
      id: 'st-e',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: 'e', value: 2.718281828459045 },
    },
    {
      id: 'st-2',
      type: 'csSource',
      position: { x: 0, y: 230 },
      data: { blockType: 'number', label: '2', value: 2 },
    },

    // ── Left branch: √(2πn) ──────────────────────────────────────────────
    // 2π = 2 × π
    {
      id: 'st-2pi',
      type: 'csOperation',
      position: { x: 220, y: 90 },
      data: { blockType: 'multiply', label: '2π' },
    },
    // 2πn = 2π × n
    {
      id: 'st-2pin',
      type: 'csOperation',
      position: { x: 400, y: 60 },
      data: { blockType: 'multiply', label: '2πn' },
    },
    // √(2πn)
    {
      id: 'st-sqrt',
      type: 'csOperation',
      position: { x: 580, y: 60 },
      data: { blockType: 'sqrt', label: '√(2πn)' },
    },

    // ── Right branch: (n/e)^n ────────────────────────────────────────────
    // n/e
    {
      id: 'st-ne',
      type: 'csOperation',
      position: { x: 220, y: 175 },
      data: { blockType: 'divide', label: 'n/e' },
    },
    // (n/e)^n
    {
      id: 'st-pow',
      type: 'csOperation',
      position: { x: 400, y: 175 },
      data: { blockType: 'power', label: '(n/e)^n' },
    },

    // ── Result: √(2πn) × (n/e)^n ─────────────────────────────────────────
    {
      id: 'st-approx',
      type: 'csOperation',
      position: { x: 760, y: 120 },
      data: { blockType: 'multiply', label: "Stirling's n!" },
    },
    {
      id: 'st-disp',
      type: 'csDisplay',
      position: { x: 960, y: 120 },
      data: { blockType: 'display', label: 'n! approximation' },
    },

    // ── Error section: compare with exact 10! = 3 628 800 ───────────────
    {
      id: 'st-exact',
      type: 'csSource',
      position: { x: 760, y: 240 },
      data: { blockType: 'number', label: 'Exact 10! (reference)', value: 3628800 },
    },
    {
      id: 'st-err',
      type: 'csOperation',
      position: { x: 960, y: 240 },
      data: { blockType: 'subtract', label: 'Approx − Exact' },
    },
    {
      id: 'st-abs',
      type: 'csOperation',
      position: { x: 1140, y: 240 },
      data: { blockType: 'abs', label: '|Error|' },
    },
    {
      id: 'st-reldiv',
      type: 'csOperation',
      position: { x: 1300, y: 240 },
      data: { blockType: 'divide', label: 'Rel. error' },
    },
    {
      id: 'st-100',
      type: 'csSource',
      position: { x: 1140, y: 340 },
      data: { blockType: 'number', label: '100', value: 100 },
    },
    {
      id: 'st-pct',
      type: 'csOperation',
      position: { x: 1460, y: 240 },
      data: { blockType: 'multiply', label: '× 100%' },
    },
    {
      id: 'st-pctout',
      type: 'csDisplay',
      position: { x: 1640, y: 240 },
      data: { blockType: 'display', label: 'Error (%)' },
    },

    {
      id: 'st-ann2',
      type: 'csAnnotation',
      position: { x: 0, y: 400 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Exact factorials for reference:\n' +
          '  n=5  → 120        Stirling: 118.0   error: 1.67%\n' +
          '  n=10 → 3,628,800  Stirling: 3,598,696  error: 0.83%\n' +
          '  n=20 → 2.432×10¹⁸  error: 0.42%\n' +
          '  n=100 → error < 0.08%  (error halves each time n doubles)\n' +
          'Change the exact reference value when exploring different n.',
        annotationColor: '#a855f7',
        annotationFontSize: 11,
        width: 640,
      },
      style: { width: 640 },
    },
  ]

  const edges = [
    // 2π
    {
      id: 'st-e-2pi-2',
      source: 'st-2',
      sourceHandle: 'out',
      target: 'st-2pi',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'st-e-2pi-pi',
      source: 'st-pi',
      sourceHandle: 'out',
      target: 'st-2pi',
      targetHandle: 'b',
      animated: true,
    },
    // 2πn
    {
      id: 'st-e-2pin-2pi',
      source: 'st-2pi',
      sourceHandle: 'out',
      target: 'st-2pin',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'st-e-2pin-n',
      source: 'st-n',
      sourceHandle: 'out',
      target: 'st-2pin',
      targetHandle: 'b',
      animated: true,
    },
    // √(2πn)
    {
      id: 'st-e-sqrt',
      source: 'st-2pin',
      sourceHandle: 'out',
      target: 'st-sqrt',
      targetHandle: 'a',
      animated: true,
    },
    // n/e
    {
      id: 'st-e-ne-n',
      source: 'st-n',
      sourceHandle: 'out',
      target: 'st-ne',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'st-e-ne-e',
      source: 'st-e',
      sourceHandle: 'out',
      target: 'st-ne',
      targetHandle: 'b',
      animated: true,
    },
    // (n/e)^n
    {
      id: 'st-e-pow-b',
      source: 'st-ne',
      sourceHandle: 'out',
      target: 'st-pow',
      targetHandle: 'base',
      animated: true,
    },
    {
      id: 'st-e-pow-e',
      source: 'st-n',
      sourceHandle: 'out',
      target: 'st-pow',
      targetHandle: 'exp',
      animated: true,
    },
    // √(2πn) × (n/e)^n
    {
      id: 'st-e-apr-sq',
      source: 'st-sqrt',
      sourceHandle: 'out',
      target: 'st-approx',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'st-e-apr-pow',
      source: 'st-pow',
      sourceHandle: 'out',
      target: 'st-approx',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'st-e-disp',
      source: 'st-approx',
      sourceHandle: 'out',
      target: 'st-disp',
      targetHandle: 'value',
      animated: true,
    },
    // Error
    {
      id: 'st-e-err-a',
      source: 'st-approx',
      sourceHandle: 'out',
      target: 'st-err',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'st-e-err-b',
      source: 'st-exact',
      sourceHandle: 'out',
      target: 'st-err',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'st-e-abs',
      source: 'st-err',
      sourceHandle: 'out',
      target: 'st-abs',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'st-e-rel-a',
      source: 'st-abs',
      sourceHandle: 'out',
      target: 'st-reldiv',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'st-e-rel-b',
      source: 'st-exact',
      sourceHandle: 'out',
      target: 'st-reldiv',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'st-e-pct-r',
      source: 'st-reldiv',
      sourceHandle: 'out',
      target: 'st-pct',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'st-e-pct-100',
      source: 'st-100',
      sourceHandle: 'out',
      target: 'st-pct',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'st-e-pctout',
      source: 'st-pct',
      sourceHandle: 'out',
      target: 'st-pctout',
      targetHandle: 'value',
      animated: true,
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
