/**
 * plot-blocks.ts — Plot visualization blocks (Pro only).
 *
 * All use csPlot node kind and Value-aware evaluate.
 * Exports a registration function called by registry.ts (no circular imports).
 *
 * Plot blocks are terminal (like Display) — they consume input data
 * and return a scalar representing the data point count for the header.
 */

import type { BlockDef, PlotConfig } from './types'
import { type Value, mkScalar, mkError, isVector, isTable, isError } from '../engine/value'

function dataPointCount(v: Value | null): Value {
  if (v === null) return mkError('No data')
  if (isError(v)) return v
  if (isVector(v)) return mkScalar(v.value.length)
  if (isTable(v)) return mkScalar(v.rows.length)
  return mkError('Expected vector or table')
}

export function registerPlotBlocks(register: (def: BlockDef) => void): void {
  // ── XY Plot (line or scatter) ───────────────────────────────────────────
  register({
    type: 'xyPlot',
    label: 'XY Plot',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    defaultData: {
      blockType: 'xyPlot',
      label: 'XY Plot',
      plotConfig: {
        chartType: 'xyLine',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
        maxPoints: 2000,
      } satisfies PlotConfig,
    },
    evaluate: ([data]) => dataPointCount(data),
  })

  // ── Histogram ──────────────────────────────────────────────────────────
  register({
    type: 'histogram',
    label: 'Histogram',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    defaultData: {
      blockType: 'histogram',
      label: 'Histogram',
      plotConfig: {
        chartType: 'histogram',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
        binCount: 30,
      } satisfies PlotConfig,
    },
    evaluate: ([data]) => dataPointCount(data),
  })

  // ── Bar Chart ──────────────────────────────────────────────────────────
  register({
    type: 'barChart',
    label: 'Bar Chart',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    defaultData: {
      blockType: 'barChart',
      label: 'Bar Chart',
      plotConfig: {
        chartType: 'bar',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
      } satisfies PlotConfig,
    },
    evaluate: ([data]) => dataPointCount(data),
  })

  // ── Heatmap ────────────────────────────────────────────────────────────
  register({
    type: 'heatmap',
    label: 'Heatmap',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    defaultData: {
      blockType: 'heatmap',
      label: 'Heatmap',
      plotConfig: {
        chartType: 'heatmap',
        showGrid: false,
        showLegend: true,
        legendPosition: 'right',
        themePreset: 'paper-single',
      } satisfies PlotConfig,
    },
    evaluate: ([data]) => dataPointCount(data),
  })
}
