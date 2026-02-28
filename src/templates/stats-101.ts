/**
 * stats-101.ts — Stats 101 sample template.
 *
 * Demonstrates descriptive statistics on a 6-point dataset:
 *   - Mean
 *   - Standard deviation
 *
 * The count node (s101-c) and all six data-point nodes are shared between
 * both the Mean and Std Dev calculations.
 *
 * Default dataset: [10, 20, 30, 40, 50, 60]  →  mean = 35, σ ≈ 17.08
 *
 * The layout is plot-ready: add a vector/table input to pipe x1..x6 into
 * a plot block downstream.
 *
 * Note: stats.desc.mean and stats.desc.stddev are Pro-tier blocks.
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildStats101(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Count ─────────────────────────────────────────────────────────
    {
      id: 's101-c',
      type: 'number',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Count n', value: 6 },
    },
    // ── Data points ───────────────────────────────────────────────────
    {
      id: 's101-x1',
      type: 'number',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'x₁', value: 10 },
    },
    {
      id: 's101-x2',
      type: 'number',
      position: { x: 0, y: 220 },
      data: { blockType: 'number', label: 'x₂', value: 20 },
    },
    {
      id: 's101-x3',
      type: 'number',
      position: { x: 0, y: 320 },
      data: { blockType: 'number', label: 'x₃', value: 30 },
    },
    {
      id: 's101-x4',
      type: 'number',
      position: { x: 0, y: 420 },
      data: { blockType: 'number', label: 'x₄', value: 40 },
    },
    {
      id: 's101-x5',
      type: 'number',
      position: { x: 0, y: 520 },
      data: { blockType: 'number', label: 'x₅', value: 50 },
    },
    {
      id: 's101-x6',
      type: 'number',
      position: { x: 0, y: 620 },
      data: { blockType: 'number', label: 'x₆', value: 60 },
    },
    // ── Operations ────────────────────────────────────────────────────
    {
      id: 's101-mean',
      type: 'stats.desc.mean',
      position: { x: 280, y: 160 },
      data: { blockType: 'stats.desc.mean', label: 'Mean', manualValues: { c: 6 } },
    },
    {
      id: 's101-stddev',
      type: 'stats.desc.stddev',
      position: { x: 280, y: 460 },
      data: { blockType: 'stats.desc.stddev', label: 'Std Dev', manualValues: { c: 6 } },
    },
    // ── Outputs ───────────────────────────────────────────────────────
    {
      id: 's101-mean-disp',
      type: 'display',
      position: { x: 500, y: 160 },
      data: { blockType: 'display', label: 'Mean x̄' },
    },
    {
      id: 's101-stddev-disp',
      type: 'display',
      position: { x: 500, y: 460 },
      data: { blockType: 'display', label: 'Std Dev σ' },
    },
  ]

  const edges = [
    // Mean wiring
    {
      id: 's101-e1',
      source: 's101-c',
      sourceHandle: 'out',
      target: 's101-mean',
      targetHandle: 'c',
    },
    {
      id: 's101-e2',
      source: 's101-x1',
      sourceHandle: 'out',
      target: 's101-mean',
      targetHandle: 'x1',
    },
    {
      id: 's101-e3',
      source: 's101-x2',
      sourceHandle: 'out',
      target: 's101-mean',
      targetHandle: 'x2',
    },
    {
      id: 's101-e4',
      source: 's101-x3',
      sourceHandle: 'out',
      target: 's101-mean',
      targetHandle: 'x3',
    },
    {
      id: 's101-e5',
      source: 's101-x4',
      sourceHandle: 'out',
      target: 's101-mean',
      targetHandle: 'x4',
    },
    {
      id: 's101-e6',
      source: 's101-x5',
      sourceHandle: 'out',
      target: 's101-mean',
      targetHandle: 'x5',
    },
    {
      id: 's101-e7',
      source: 's101-x6',
      sourceHandle: 'out',
      target: 's101-mean',
      targetHandle: 'x6',
    },
    {
      id: 's101-e8',
      source: 's101-mean',
      sourceHandle: 'out',
      target: 's101-mean-disp',
      targetHandle: 'value',
    },
    // Std Dev wiring (count and data points shared from above)
    {
      id: 's101-e9',
      source: 's101-c',
      sourceHandle: 'out',
      target: 's101-stddev',
      targetHandle: 'c',
    },
    {
      id: 's101-e10',
      source: 's101-x1',
      sourceHandle: 'out',
      target: 's101-stddev',
      targetHandle: 'x1',
    },
    {
      id: 's101-e11',
      source: 's101-x2',
      sourceHandle: 'out',
      target: 's101-stddev',
      targetHandle: 'x2',
    },
    {
      id: 's101-e12',
      source: 's101-x3',
      sourceHandle: 'out',
      target: 's101-stddev',
      targetHandle: 'x3',
    },
    {
      id: 's101-e13',
      source: 's101-x4',
      sourceHandle: 'out',
      target: 's101-stddev',
      targetHandle: 'x4',
    },
    {
      id: 's101-e14',
      source: 's101-x5',
      sourceHandle: 'out',
      target: 's101-stddev',
      targetHandle: 'x5',
    },
    {
      id: 's101-e15',
      source: 's101-x6',
      sourceHandle: 'out',
      target: 's101-stddev',
      targetHandle: 'x6',
    },
    {
      id: 's101-e16',
      source: 's101-stddev',
      sourceHandle: 'out',
      target: 's101-stddev-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
