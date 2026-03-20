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
    description: 'XY line or scatter plot. Connect vector or table data to visualize trends.',
    synonyms: ['line chart', 'scatter plot', 'graph', 'xy chart'],
    tags: ['plot', 'visualization'],
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
    description: 'Histogram chart showing the frequency distribution of a data set.',
    synonyms: ['frequency distribution', 'bin chart', 'distribution plot'],
    tags: ['plot', 'visualization', 'statistics'],
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
    description: 'Bar chart displaying categorical data as vertical bars.',
    synonyms: ['bar graph', 'column chart', 'categorical chart'],
    tags: ['plot', 'visualization'],
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
    description: 'Heatmap visualization rendering a table as a color-coded grid.',
    synonyms: ['heat map', 'color grid', 'density map'],
    tags: ['plot', 'visualization'],
  })

  register({
    type: 'bodePlot',
    label: 'Bode Plot',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    synonyms: ['bode diagram', 'frequency response', 'transfer function plot'],
    tags: ['plot', 'control', 'frequency'],
    description:
      'Bode plot for control systems: magnitude (dB) vs frequency on a log axis, with optional phase panel below. Expects a Table with columns: freq, mag_dB, and optionally phase_deg.',
    defaultData: {
      blockType: 'bodePlot',
      label: 'Bode Plot',
      plotConfig: {
        chartType: 'bode',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
        xLabel: 'Frequency (rad/s)',
        yLabel: 'Magnitude (dB)',
      } satisfies PlotConfig,
    },
  })

  register({
    type: 'nyquistPlot',
    label: 'Nyquist Plot',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    synonyms: ['nyquist diagram', 'complex plane', 'stability plot'],
    tags: ['plot', 'control', 'frequency'],
    description:
      'Nyquist plot: real part vs imaginary part of G(jω). Expects a Table with columns re, im (and optionally freq for tooltip). Includes a unit-circle reference and critical point marker at (−1, 0).',
    defaultData: {
      blockType: 'nyquistPlot',
      label: 'Nyquist Plot',
      plotConfig: {
        chartType: 'nyquist',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
        xLabel: 'Re[G(jω)]',
        yLabel: 'Im[G(jω)]',
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
    synonyms: ['box and whisker', 'quartile plot', 'distribution summary'],
    tags: ['plot', 'statistics'],
    description:
      'Box-and-whisker plot showing median, IQR (25th-75th percentile), and outliers. For a Table input use the first column as group and second as value. For a Vector input shows a single distribution.',
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
    synonyms: ['kde plot', 'density distribution', 'violin chart'],
    tags: ['plot', 'statistics'],
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
    synonyms: ['parallel axes', 'multivariate plot', 'multi-dimensional'],
    tags: ['plot', 'visualization'],
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
    synonyms: ['contour map', 'density plot', 'kde contour'],
    tags: ['plot', 'visualization'],
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
    type: 'waterfallPlot',
    label: 'Waterfall Chart',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    synonyms: ['waterfall', 'bridge chart', 'cumulative change'],
    tags: ['plot', 'finance'],
    description:
      'Waterfall chart showing cumulative incremental changes. Expects a Table with columns [category, value]. Positive increments are green, negative are red, bars float from the running total.',
    defaultData: {
      blockType: 'waterfallPlot',
      label: 'Waterfall Chart',
      plotConfig: {
        chartType: 'waterfall',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
        xLabel: 'Category',
        yLabel: 'Value',
      } satisfies PlotConfig,
    },
  })

  register({
    type: 'paretoPlot',
    label: 'Pareto Plot',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    synonyms: ['pareto front', 'multi-objective', 'trade-off plot'],
    tags: ['plot', 'optimization'],
    description:
      'Pareto front plot for multi-objective optimisation. Expects a Table with two numeric columns [objective1, objective2]. Non-dominated (Pareto-optimal) points are highlighted in cyan with a staircase front line.',
    defaultData: {
      blockType: 'paretoPlot',
      label: 'Pareto Plot',
      plotConfig: {
        chartType: 'pareto',
        showGrid: true,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
        xLabel: 'Objective 1',
        yLabel: 'Objective 2',
      } satisfies PlotConfig,
    },
  })

  register({
    type: 'sankeyPlot',
    label: 'Sankey Diagram',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    synonyms: ['sankey', 'flow diagram', 'alluvial chart'],
    tags: ['plot', 'visualization'],
    description:
      'Sankey / flow diagram. Expects a Table with at least 3 columns: source (integer node ID), target (integer node ID), value (flow amount). Node labels default to "Node 0", "Node 1", ... Use the config panel to set custom labels.',
    defaultData: {
      blockType: 'sankeyPlot',
      label: 'Sankey Diagram',
      plotConfig: {
        chartType: 'sankey',
        showGrid: false,
        showLegend: false,
        legendPosition: 'right',
        themePreset: 'paper-single',
      } satisfies PlotConfig,
    },
  })

  register({
    type: 'surfacePlot',
    label: '3D Surface Plot',
    category: 'plot',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Data' }],
    proOnly: true,
    synonyms: ['3d plot', 'surface chart', 'mesh plot', 'wireframe'],
    tags: ['plot', 'visualization', '3d'],
    description:
      '3D surface plot with interactive rotation. Expects a DataTable where each row is an x-slice and each column is a y-slice - values are treated as z heights. Drag to rotate; toggle wireframe with the button.',
    defaultData: {
      blockType: 'surfacePlot',
      label: '3D Surface',
      plotConfig: {
        chartType: 'surface3d',
        showGrid: false,
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
    description:
      'Displays list or table data in a scrollable table with summary statistics (count, min, max, mean, std dev, sum).',
    synonyms: ['data table', 'results table', 'table view'],
    tags: ['output', 'data'],
  })
}
