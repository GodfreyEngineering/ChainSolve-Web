/**
 * curve-fitting.ts — Curve Fitting template.
 *
 * 9.11: Linear regression (y = a + b·x) and R² goodness-of-fit on a dataset.
 *
 * Inputs: x-values vector, y-values vector.
 * Outputs: slope b, intercept a, R² coefficient of determination,
 *          predicted y at a query point x_q.
 *
 * Default dataset: 6-point linear trend with noise.
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildCurveFitting(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ─────────────────────────────────────────────────
    {
      id: 'cf-title',
      type: 'csAnnotation',
      position: { x: -20, y: -90 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Curve Fitting — Linear Regression\n\ny = a + b·x\n\nFit a straight line to your data.\nR² = 1 means perfect fit; R² = 0 means no linear relationship.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 420,
      },
      style: { width: 420 },
    },

    // ── Input vectors ─────────────────────────────────────────────────────
    {
      id: 'cf-x',
      type: 'csData',
      position: { x: 0, y: 40 },
      data: {
        blockType: 'tableInput',
        label: 'x values',
        tableData: { columns: ['x'], rows: [[1], [2], [3], [4], [5], [6]] },
      },
    },
    {
      id: 'cf-y',
      type: 'csData',
      position: { x: 0, y: 180 },
      data: {
        blockType: 'tableInput',
        label: 'y values',
        tableData: { columns: ['y'], rows: [[2.1], [3.9], [6.2], [7.8], [10.1], [11.9]] },
      },
    },

    // ── Query point ───────────────────────────────────────────────────────
    {
      id: 'cf-xq',
      type: 'csSource',
      position: { x: 0, y: 320 },
      data: { blockType: 'number', label: 'Query point x_q', value: 7 },
    },

    // ── Operations ────────────────────────────────────────────────────────
    {
      id: 'cf-slope',
      type: 'csOperation',
      position: { x: 300, y: 60 },
      data: { blockType: 'stats.rel.linreg_slope_vec', label: 'Slope b' },
    },
    {
      id: 'cf-intercept',
      type: 'csOperation',
      position: { x: 300, y: 180 },
      data: { blockType: 'stats.rel.linreg_intercept_vec', label: 'Intercept a' },
    },
    {
      id: 'cf-r2',
      type: 'csOperation',
      position: { x: 300, y: 300 },
      data: { blockType: 'stats.rel.linreg_r2', label: 'R² coefficient' },
    },
    {
      id: 'cf-predict',
      type: 'csOperation',
      position: { x: 300, y: 420 },
      data: { blockType: 'stats.rel.linreg_predict', label: 'Predicted ŷ at x_q' },
    },

    // ── Displays ──────────────────────────────────────────────────────────
    {
      id: 'cf-disp-slope',
      type: 'csDisplay',
      position: { x: 560, y: 60 },
      data: { blockType: 'display', label: 'Slope b' },
    },
    {
      id: 'cf-disp-intercept',
      type: 'csDisplay',
      position: { x: 560, y: 180 },
      data: { blockType: 'display', label: 'Intercept a' },
    },
    {
      id: 'cf-disp-r2',
      type: 'csDisplay',
      position: { x: 560, y: 300 },
      data: { blockType: 'display', label: 'R² (fit quality)' },
    },
    {
      id: 'cf-disp-predict',
      type: 'csDisplay',
      position: { x: 560, y: 420 },
      data: { blockType: 'display', label: 'Predicted ŷ' },
    },

    // ── Guidance annotation ───────────────────────────────────────────────
    {
      id: 'cf-ann2',
      type: 'csAnnotation',
      position: { x: 0, y: 500 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Try it:\n• Replace x and y with your own data (same length)\n• Check R² — closer to 1.0 = better linear fit\n• Use x_q to predict new values from the fitted line',
        annotationColor: '#fb923c',
        annotationFontSize: 11,
        width: 700,
      },
      style: { width: 700 },
    },
  ]

  const edges = [
    // slope
    { id: 'cf-e1', source: 'cf-x', sourceHandle: 'out', target: 'cf-slope', targetHandle: 'x' },
    { id: 'cf-e2', source: 'cf-y', sourceHandle: 'out', target: 'cf-slope', targetHandle: 'y' },
    {
      id: 'cf-e3',
      source: 'cf-slope',
      sourceHandle: 'out',
      target: 'cf-disp-slope',
      targetHandle: 'value',
    },
    // intercept
    { id: 'cf-e4', source: 'cf-x', sourceHandle: 'out', target: 'cf-intercept', targetHandle: 'x' },
    { id: 'cf-e5', source: 'cf-y', sourceHandle: 'out', target: 'cf-intercept', targetHandle: 'y' },
    {
      id: 'cf-e6',
      source: 'cf-intercept',
      sourceHandle: 'out',
      target: 'cf-disp-intercept',
      targetHandle: 'value',
    },
    // R²
    { id: 'cf-e7', source: 'cf-x', sourceHandle: 'out', target: 'cf-r2', targetHandle: 'x' },
    { id: 'cf-e8', source: 'cf-y', sourceHandle: 'out', target: 'cf-r2', targetHandle: 'y' },
    {
      id: 'cf-e9',
      source: 'cf-r2',
      sourceHandle: 'out',
      target: 'cf-disp-r2',
      targetHandle: 'value',
    },
    // predict
    { id: 'cf-e10', source: 'cf-x', sourceHandle: 'out', target: 'cf-predict', targetHandle: 'x' },
    { id: 'cf-e11', source: 'cf-y', sourceHandle: 'out', target: 'cf-predict', targetHandle: 'y' },
    {
      id: 'cf-e12',
      source: 'cf-xq',
      sourceHandle: 'out',
      target: 'cf-predict',
      targetHandle: 'x_new',
    },
    {
      id: 'cf-e13',
      source: 'cf-predict',
      sourceHandle: 'out',
      target: 'cf-disp-predict',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
