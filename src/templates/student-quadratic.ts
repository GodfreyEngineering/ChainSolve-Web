/**
 * student-quadratic.ts — Quadratic Formula template.
 *
 * Computes the positive root of the quadratic equation ax² + bx + c = 0:
 *   x₁ = (-b + √(b² - 4ac)) / (2a)
 *
 * Default values: a = 1, b = -3, c = 2
 *   → x₁ = 2  (roots are 2 and 1)
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildStudentQuadratic(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'quad-a',
      type: 'csSource',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'a', value: 1 },
    },
    {
      id: 'quad-b',
      type: 'csSource',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'b', value: -3 },
    },
    {
      id: 'quad-c',
      type: 'csSource',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'c', value: 2 },
    },
    // constant 4 for discriminant
    {
      id: 'quad-four',
      type: 'csSource',
      position: { x: 0, y: 360 },
      data: { blockType: 'number', label: '4', value: 4 },
    },
    // constant 2 for denominator
    {
      id: 'quad-two',
      type: 'csSource',
      position: { x: 0, y: 480 },
      data: { blockType: 'number', label: '2', value: 2 },
    },

    // ── Operations ────────────────────────────────────────────────────
    // neg_b = -b
    {
      id: 'quad-negb',
      type: 'csOperation',
      position: { x: 240, y: 120 },
      data: { blockType: 'negate', label: '-b' },
    },
    // b_squared = b * b
    {
      id: 'quad-bsq',
      type: 'csOperation',
      position: { x: 240, y: 240 },
      data: { blockType: 'multiply', label: 'b²' },
    },
    // four_ac = 4 * a * c  (split into two multiplies: 4a first, then *c)
    {
      id: 'quad-4a',
      type: 'csOperation',
      position: { x: 240, y: 360 },
      data: { blockType: 'multiply', label: '4a' },
    },
    {
      id: 'quad-4ac',
      type: 'csOperation',
      position: { x: 440, y: 360 },
      data: { blockType: 'multiply', label: '4ac' },
    },
    // discriminant = b² - 4ac
    {
      id: 'quad-disc',
      type: 'csOperation',
      position: { x: 640, y: 300 },
      data: { blockType: 'subtract', label: 'b²-4ac' },
    },
    // sqrt_disc = √(b²-4ac)
    {
      id: 'quad-sqrt',
      type: 'csOperation',
      position: { x: 840, y: 300 },
      data: { blockType: 'sqrt', label: '√(b²-4ac)' },
    },
    // numerator = -b + √(b²-4ac)
    {
      id: 'quad-numer',
      type: 'csOperation',
      position: { x: 1040, y: 200 },
      data: { blockType: 'add', label: '-b + √disc' },
    },
    // denom = 2 * a
    {
      id: 'quad-denom',
      type: 'csOperation',
      position: { x: 240, y: 480 },
      data: { blockType: 'multiply', label: '2a' },
    },
    // x1 = numerator / (2a)
    {
      id: 'quad-x1',
      type: 'csOperation',
      position: { x: 1240, y: 300 },
      data: { blockType: 'divide', label: 'x₁' },
    },

    // ── Output ────────────────────────────────────────────────────────
    {
      id: 'quad-disp',
      type: 'csDisplay',
      position: { x: 1440, y: 300 },
      data: { blockType: 'display', label: 'Root x₁' },
    },
  ]

  const edges = [
    // -b
    {
      id: 'quad-e1',
      source: 'quad-b',
      sourceHandle: 'out',
      target: 'quad-negb',
      targetHandle: 'a',
    },
    // b²
    { id: 'quad-e2', source: 'quad-b', sourceHandle: 'out', target: 'quad-bsq', targetHandle: 'a' },
    { id: 'quad-e3', source: 'quad-b', sourceHandle: 'out', target: 'quad-bsq', targetHandle: 'b' },
    // 4a
    {
      id: 'quad-e4',
      source: 'quad-four',
      sourceHandle: 'out',
      target: 'quad-4a',
      targetHandle: 'a',
    },
    { id: 'quad-e5', source: 'quad-a', sourceHandle: 'out', target: 'quad-4a', targetHandle: 'b' },
    // 4ac
    {
      id: 'quad-e6',
      source: 'quad-4a',
      sourceHandle: 'out',
      target: 'quad-4ac',
      targetHandle: 'a',
    },
    { id: 'quad-e7', source: 'quad-c', sourceHandle: 'out', target: 'quad-4ac', targetHandle: 'b' },
    // discriminant = b² - 4ac
    {
      id: 'quad-e8',
      source: 'quad-bsq',
      sourceHandle: 'out',
      target: 'quad-disc',
      targetHandle: 'a',
    },
    {
      id: 'quad-e9',
      source: 'quad-4ac',
      sourceHandle: 'out',
      target: 'quad-disc',
      targetHandle: 'b',
    },
    // sqrt
    {
      id: 'quad-e10',
      source: 'quad-disc',
      sourceHandle: 'out',
      target: 'quad-sqrt',
      targetHandle: 'a',
    },
    // numerator = -b + sqrt
    {
      id: 'quad-e11',
      source: 'quad-negb',
      sourceHandle: 'out',
      target: 'quad-numer',
      targetHandle: 'a',
    },
    {
      id: 'quad-e12',
      source: 'quad-sqrt',
      sourceHandle: 'out',
      target: 'quad-numer',
      targetHandle: 'b',
    },
    // 2a
    {
      id: 'quad-e13',
      source: 'quad-two',
      sourceHandle: 'out',
      target: 'quad-denom',
      targetHandle: 'a',
    },
    {
      id: 'quad-e14',
      source: 'quad-a',
      sourceHandle: 'out',
      target: 'quad-denom',
      targetHandle: 'b',
    },
    // x1 = numer / denom
    {
      id: 'quad-e15',
      source: 'quad-numer',
      sourceHandle: 'out',
      target: 'quad-x1',
      targetHandle: 'a',
    },
    {
      id: 'quad-e16',
      source: 'quad-denom',
      sourceHandle: 'out',
      target: 'quad-x1',
      targetHandle: 'b',
    },
    // display
    {
      id: 'quad-e17',
      source: 'quad-x1',
      sourceHandle: 'out',
      target: 'quad-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
