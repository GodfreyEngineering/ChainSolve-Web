/**
 * fourier-series.ts — Fourier Series Approximation tutorial template (12.7).
 *
 * Builds the 3-harmonic Fourier series approximation of a square wave at t = 0.25 s:
 *   f(t) ≈ (4/π) × [sin(ωt) + sin(3ωt)/3 + sin(5ωt)/5]
 *
 * Default: f = 1 Hz (ω = 2π), t = 0.25 s (quarter period)
 * Expected result ≈ 0.933 (converging toward +1.0)
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildFourierSeries(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    {
      id: 'fs-title',
      type: 'csAnnotation',
      position: { x: -20, y: -100 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Fourier Series Approximation\n\n' +
          'Square wave via 3-harmonic Fourier sum: f(t) ≈ (4/π)·[sin(ωt) + sin(3ωt)/3 + sin(5ωt)/5]\n' +
          'Shows how adding harmonics progressively sharpens the approximation of the square wave.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 700,
      },
      style: { width: 700 },
    },

    // Inputs
    {
      id: 'fs-freq',
      type: 'csSource',
      position: { x: 0, y: 20 },
      data: { blockType: 'number', label: 'Fundamental freq (Hz)', value: 1 },
    },
    {
      id: 'fs-pi',
      type: 'csSource',
      position: { x: 0, y: 90 },
      data: { blockType: 'number', label: 'π', value: 3.141592653589793 },
    },
    {
      id: 'fs-two',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: '2', value: 2 },
    },
    {
      id: 'fs-four',
      type: 'csSource',
      position: { x: 0, y: 230 },
      data: { blockType: 'number', label: '4', value: 4 },
    },
    {
      id: 'fs-t',
      type: 'csSource',
      position: { x: 0, y: 310 },
      data: { blockType: 'number', label: 'Time t (s)', value: 0.25 },
    },
    {
      id: 'fs-h3c',
      type: 'csSource',
      position: { x: 0, y: 410 },
      data: { blockType: 'number', label: '3', value: 3 },
    },
    {
      id: 'fs-h5c',
      type: 'csSource',
      position: { x: 0, y: 520 },
      data: { blockType: 'number', label: '5', value: 5 },
    },

    // ω = 2π×f (two separate multiplies: 2×π then 2π×f)
    {
      id: 'fs-2pi',
      type: 'csOperation',
      position: { x: 200, y: 90 },
      data: { blockType: 'multiply', label: '2π' },
    },
    {
      id: 'fs-omega',
      type: 'csOperation',
      position: { x: 390, y: 60 },
      data: { blockType: 'multiply', label: 'ω = 2πf' },
    },

    // 4/π coefficient
    {
      id: 'fs-coeff',
      type: 'csOperation',
      position: { x: 200, y: 200 },
      data: { blockType: 'divide', label: '4/π' },
    },

    // Harmonic 1: sin(ωt)
    {
      id: 'fs-h1-mul',
      type: 'csOperation',
      position: { x: 200, y: 320 },
      data: { blockType: 'multiply', label: 'ω·t' },
    },
    {
      id: 'fs-h1-sin',
      type: 'csOperation',
      position: { x: 390, y: 320 },
      data: { blockType: 'sin', label: 'sin(ωt)' },
    },

    // Harmonic 3: sin(3ωt)/3 — use two steps for 3×ω, then (3ω)×t
    {
      id: 'fs-h3-3w',
      type: 'csOperation',
      position: { x: 200, y: 420 },
      data: { blockType: 'multiply', label: '3ω' },
    },
    {
      id: 'fs-h3-mul',
      type: 'csOperation',
      position: { x: 390, y: 420 },
      data: { blockType: 'multiply', label: '3ω·t' },
    },
    {
      id: 'fs-h3-sin',
      type: 'csOperation',
      position: { x: 580, y: 420 },
      data: { blockType: 'sin', label: 'sin(3ωt)' },
    },
    {
      id: 'fs-h3-div',
      type: 'csOperation',
      position: { x: 750, y: 420 },
      data: { blockType: 'divide', label: '/3' },
    },

    // Harmonic 5: sin(5ωt)/5 — use two steps for 5×ω, then (5ω)×t
    {
      id: 'fs-h5-5w',
      type: 'csOperation',
      position: { x: 200, y: 530 },
      data: { blockType: 'multiply', label: '5ω' },
    },
    {
      id: 'fs-h5-mul',
      type: 'csOperation',
      position: { x: 390, y: 530 },
      data: { blockType: 'multiply', label: '5ω·t' },
    },
    {
      id: 'fs-h5-sin',
      type: 'csOperation',
      position: { x: 580, y: 530 },
      data: { blockType: 'sin', label: 'sin(5ωt)' },
    },
    {
      id: 'fs-h5-div',
      type: 'csOperation',
      position: { x: 750, y: 530 },
      data: { blockType: 'divide', label: '/5' },
    },

    // Sum harmonics and scale by 4/π
    {
      id: 'fs-sum',
      type: 'csOperation',
      position: { x: 920, y: 420 },
      data: { blockType: 'add', label: 'Σ harmonics', dynamicInputCount: 3 },
    },
    {
      id: 'fs-scale',
      type: 'csOperation',
      position: { x: 1100, y: 420 },
      data: { blockType: 'multiply', label: '(4/π)·Σ' },
    },
    {
      id: 'fs-disp',
      type: 'csDisplay',
      position: { x: 1280, y: 420 },
      data: { blockType: 'display', label: 'f(t) at t=0.25 s' },
    },

    {
      id: 'fs-ann2',
      type: 'csAnnotation',
      position: { x: 0, y: 640 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'At t = 0.25 s (quarter period of a 1 Hz square wave) the ideal value is +1.\n' +
          '3-harmonic approximation: (4/π)·(1 + 1/3 + 1/5) ≈ 0.933\n' +
          'Add more harmonics to reduce the Gibbs ripple at the discontinuities.',
        annotationColor: '#f97316',
        annotationFontSize: 11,
        width: 700,
      },
      style: { width: 700 },
    },
  ]

  const edges = [
    // ω = 2π×f
    {
      id: 'fs-e-2pi-pi',
      source: 'fs-pi',
      sourceHandle: 'out',
      target: 'fs-2pi',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-2pi-two',
      source: 'fs-two',
      sourceHandle: 'out',
      target: 'fs-2pi',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'fs-e-omega-2pi',
      source: 'fs-2pi',
      sourceHandle: 'out',
      target: 'fs-omega',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-omega-f',
      source: 'fs-freq',
      sourceHandle: 'out',
      target: 'fs-omega',
      targetHandle: 'b',
      animated: true,
    },
    // 4/π
    {
      id: 'fs-e-coeff-4',
      source: 'fs-four',
      sourceHandle: 'out',
      target: 'fs-coeff',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-coeff-pi',
      source: 'fs-pi',
      sourceHandle: 'out',
      target: 'fs-coeff',
      targetHandle: 'b',
      animated: true,
    },
    // Harmonic 1: ω×t → sin
    {
      id: 'fs-e-h1-omega',
      source: 'fs-omega',
      sourceHandle: 'out',
      target: 'fs-h1-mul',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h1-t',
      source: 'fs-t',
      sourceHandle: 'out',
      target: 'fs-h1-mul',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'fs-e-h1-sin',
      source: 'fs-h1-mul',
      sourceHandle: 'out',
      target: 'fs-h1-sin',
      targetHandle: 'a',
      animated: true,
    },
    // Harmonic 3: 3ω×t → sin → /3
    {
      id: 'fs-e-h3-3w-3',
      source: 'fs-h3c',
      sourceHandle: 'out',
      target: 'fs-h3-3w',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h3-3w-w',
      source: 'fs-omega',
      sourceHandle: 'out',
      target: 'fs-h3-3w',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'fs-e-h3-mul-3w',
      source: 'fs-h3-3w',
      sourceHandle: 'out',
      target: 'fs-h3-mul',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h3-mul-t',
      source: 'fs-t',
      sourceHandle: 'out',
      target: 'fs-h3-mul',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'fs-e-h3-sin',
      source: 'fs-h3-mul',
      sourceHandle: 'out',
      target: 'fs-h3-sin',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h3-div-s',
      source: 'fs-h3-sin',
      sourceHandle: 'out',
      target: 'fs-h3-div',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h3-div-3',
      source: 'fs-h3c',
      sourceHandle: 'out',
      target: 'fs-h3-div',
      targetHandle: 'b',
      animated: true,
    },
    // Harmonic 5: 5ω×t → sin → /5
    {
      id: 'fs-e-h5-5w-5',
      source: 'fs-h5c',
      sourceHandle: 'out',
      target: 'fs-h5-5w',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h5-5w-w',
      source: 'fs-omega',
      sourceHandle: 'out',
      target: 'fs-h5-5w',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'fs-e-h5-mul-5w',
      source: 'fs-h5-5w',
      sourceHandle: 'out',
      target: 'fs-h5-mul',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h5-mul-t',
      source: 'fs-t',
      sourceHandle: 'out',
      target: 'fs-h5-mul',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'fs-e-h5-sin',
      source: 'fs-h5-mul',
      sourceHandle: 'out',
      target: 'fs-h5-sin',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h5-div-s',
      source: 'fs-h5-sin',
      sourceHandle: 'out',
      target: 'fs-h5-div',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-h5-div-5',
      source: 'fs-h5c',
      sourceHandle: 'out',
      target: 'fs-h5-div',
      targetHandle: 'b',
      animated: true,
    },
    // Sum
    {
      id: 'fs-e-sum-h1',
      source: 'fs-h1-sin',
      sourceHandle: 'out',
      target: 'fs-sum',
      targetHandle: 'in_0',
      animated: true,
    },
    {
      id: 'fs-e-sum-h3',
      source: 'fs-h3-div',
      sourceHandle: 'out',
      target: 'fs-sum',
      targetHandle: 'in_1',
      animated: true,
    },
    {
      id: 'fs-e-sum-h5',
      source: 'fs-h5-div',
      sourceHandle: 'out',
      target: 'fs-sum',
      targetHandle: 'in_2',
      animated: true,
    },
    // Scale
    {
      id: 'fs-e-scale-c',
      source: 'fs-coeff',
      sourceHandle: 'out',
      target: 'fs-scale',
      targetHandle: 'a',
      animated: true,
    },
    {
      id: 'fs-e-scale-s',
      source: 'fs-sum',
      sourceHandle: 'out',
      target: 'fs-scale',
      targetHandle: 'b',
      animated: true,
    },
    {
      id: 'fs-e-disp',
      source: 'fs-scale',
      sourceHandle: 'out',
      target: 'fs-disp',
      targetHandle: 'value',
      animated: true,
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
