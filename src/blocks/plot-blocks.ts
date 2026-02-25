/**
 * plot-blocks.ts — Plot visualization blocks (Pro only).
 *
 * All use csPlot node kind. Evaluation is handled by the
 * Rust/WASM engine (W9.1).
 * Exports a registration function called by registry.ts (no circular imports).
 *
 * Plot blocks are terminal (like Display) — they consume input data
 * and return a scalar representing the data point count for the header.
 */

import type { BlockDef, PlotConfig } from './types'

export function registerPlotBlocks(register: (def: BlockDef) => void): void {
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
  })

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
  })

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
  })

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
  })
}
