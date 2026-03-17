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

  register({
    type: 'boxPlot',
    label: 'Box Plot',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    description:
      'Box-and-whisker plot showing median, IQR (25th–75th percentile), and outliers. For a Table input use the first column as group and second as value. For a Vector input shows a single distribution.',
    defaultData: {
      blockType: 'boxPlot',
      label: 'Box Plot',
      plotConfig: {
        chartType: 'boxplot',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
      } satisfies PlotConfig,
    },
  })

  register({
    type: 'violinPlot',
    label: 'Violin Plot',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    description:
      'Violin plot showing the kernel density estimate of a distribution. For a Table input use the first column as group and second as value. For a Vector input shows a single violin.',
    defaultData: {
      blockType: 'violinPlot',
      label: 'Violin Plot',
      plotConfig: {
        chartType: 'violin',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
      } satisfies PlotConfig,
    },
  })

  register({
    type: 'parallelCoords',
    label: 'Parallel Coordinates',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    description:
      'Parallel coordinates plot for multi-dimensional data. Each column becomes a normalised axis. Accepts a Table input. Optionally set xColumn to a nominal column to colour lines by group.',
    defaultData: {
      blockType: 'parallelCoords',
      label: 'Parallel Coordinates',
      plotConfig: {
        chartType: 'parallelCoords',
        showGrid: false,
        showLegend: true,
        legendPosition: 'right',
        themePreset: 'paper-single',
      } satisfies PlotConfig,
    },
  })

  register({
    type: 'contourPlot',
    label: 'Contour / Density Plot',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    description:
      'Contour / density plot: for a 2-column Table (x,y), overlays a scatter with density contours. For a Vector, renders the 1D kernel density estimate as a filled area curve.',
    defaultData: {
      blockType: 'contourPlot',
      label: 'Contour / Density Plot',
      plotConfig: {
        chartType: 'contour',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
      } satisfies PlotConfig,
    },
  })

  register({
    type: 'listTable',
    label: 'Table Output',
    category: 'output',
    nodeKind: 'csListTable',
    inputs: [{ id: 'data', label: 'Data' }],
    defaultData: {
      blockType: 'listTable',
      label: 'Table Output',
    },
  })
}
