/**
 * neural-network-training.ts — Neural Network Training template.
 *
 * 9.11: Configures a small feedforward network and computes cross-entropy loss
 *       for a single forward pass. Shows architecture parameters and loss.
 *
 * Inputs: learning rate, epochs, batch size, dropout, hidden units.
 * Outputs: estimated parameter count, cross-entropy loss (single sample).
 *
 * Default: lr=0.001, epochs=50, batch=32, dropout=0.2, hidden=64
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildNeuralNetworkTraining(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ─────────────────────────────────────────────────
    {
      id: 'nn-title',
      type: 'csAnnotation',
      position: { x: -20, y: -100 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Neural Network Training\n\nConfigure hyperparameters and inspect the network size.\nCross-entropy loss: H = -Σ y·log(ŷ) — lower is better.\nAdjust hidden units and learning rate to explore trade-offs.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 460,
      },
      style: { width: 460 },
    },

    // ── Hyperparameter inputs ────────────────────────────────────────────
    { id: 'nn-lr', type: 'csSource', position: { x: 0, y: 40 }, data: { blockType: 'number', label: 'Learning rate α', value: 0.001 } },
    { id: 'nn-epochs', type: 'csSource', position: { x: 0, y: 160 }, data: { blockType: 'number', label: 'Epochs', value: 50 } },
    { id: 'nn-batch', type: 'csSource', position: { x: 0, y: 280 }, data: { blockType: 'number', label: 'Batch size', value: 32 } },
    { id: 'nn-dropout', type: 'csSource', position: { x: 0, y: 400 }, data: { blockType: 'number', label: 'Dropout rate p', value: 0.2 } },
    { id: 'nn-hidden', type: 'csSource', position: { x: 0, y: 520 }, data: { blockType: 'number', label: 'Hidden units h', value: 64 } },
    { id: 'nn-inputs', type: 'csSource', position: { x: 0, y: 640 }, data: { blockType: 'number', label: 'Input features n_in', value: 16 } },
    { id: 'nn-outputs', type: 'csSource', position: { x: 0, y: 760 }, data: { blockType: 'number', label: 'Output classes n_out', value: 3 } },

    // ── Loss inputs (predicted logit & true label) ────────────────────────
    { id: 'nn-pred', type: 'csSource', position: { x: 0, y: 900 }, data: { blockType: 'number', label: 'Predicted probability ŷ', value: 0.72 } },
    { id: 'nn-true', type: 'csSource', position: { x: 0, y: 1020 }, data: { blockType: 'number', label: 'True label y (0 or 1)', value: 1 } },

    // ── Operations: network size ──────────────────────────────────────────
    // params_layer1 = n_in × h + h (weights + biases)
    { id: 'nn-p1-wt', type: 'csOperation', position: { x: 320, y: 580 }, data: { blockType: 'math.mul', label: 'n_in × h' } },
    { id: 'nn-p1', type: 'csOperation', position: { x: 320, y: 680 }, data: { blockType: 'math.add', label: 'Layer 1 params' } },
    // params_layer2 = h × n_out + n_out
    { id: 'nn-p2-wt', type: 'csOperation', position: { x: 320, y: 800 }, data: { blockType: 'math.mul', label: 'h × n_out' } },
    { id: 'nn-p2', type: 'csOperation', position: { x: 320, y: 900 }, data: { blockType: 'math.add', label: 'Layer 2 params' } },
    // total params
    { id: 'nn-total-p', type: 'csOperation', position: { x: 320, y: 1000 }, data: { blockType: 'math.add', label: 'Total parameters' } },

    // ── Operations: cross-entropy loss H = -y·log(ŷ) ────────────────────
    { id: 'nn-log', type: 'csOperation', position: { x: 320, y: 1120 }, data: { blockType: 'math.ln', label: 'ln(ŷ)' } },
    { id: 'nn-mul', type: 'csOperation', position: { x: 320, y: 1220 }, data: { blockType: 'math.mul', label: 'y · ln(ŷ)' } },
    { id: 'nn-neg', type: 'csOperation', position: { x: 320, y: 1320 }, data: { blockType: 'math.neg', label: '-y·ln(ŷ)' } },

    // ── Displays ──────────────────────────────────────────────────────────
    { id: 'nn-disp-p1', type: 'csDisplay', position: { x: 560, y: 680 }, data: { blockType: 'display', label: 'Layer 1 params' } },
    { id: 'nn-disp-p2', type: 'csDisplay', position: { x: 560, y: 900 }, data: { blockType: 'display', label: 'Layer 2 params' } },
    { id: 'nn-disp-total', type: 'csDisplay', position: { x: 560, y: 1000 }, data: { blockType: 'display', label: 'Total parameters' } },
    { id: 'nn-disp-loss', type: 'csDisplay', position: { x: 560, y: 1320 }, data: { blockType: 'display', label: 'Cross-entropy loss H' } },

    // ── Guidance annotation ───────────────────────────────────────────────
    {
      id: 'nn-ann2',
      type: 'csAnnotation',
      position: { x: 0, y: 1140 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Interpretation:\n• More hidden units → more parameters → higher capacity but slower training\n• Loss = 0 → perfect prediction; loss → ∞ as ŷ → 0 (confident and wrong)\n• ŷ = 0.5 → H ≈ 0.693 (maximum uncertainty for binary classification)',
        annotationColor: '#fb923c',
        annotationFontSize: 11,
        width: 700,
      },
      style: { width: 700 },
    },
  ]

  const edges = [
    // Layer 1: n_in × h
    { id: 'nn-e1', source: 'nn-inputs', sourceHandle: 'out', target: 'nn-p1-wt', targetHandle: 'in_0' },
    { id: 'nn-e2', source: 'nn-hidden', sourceHandle: 'out', target: 'nn-p1-wt', targetHandle: 'in_1' },
    // Layer 1: (n_in × h) + h
    { id: 'nn-e3', source: 'nn-p1-wt', sourceHandle: 'out', target: 'nn-p1', targetHandle: 'in_0' },
    { id: 'nn-e4', source: 'nn-hidden', sourceHandle: 'out', target: 'nn-p1', targetHandle: 'in_1' },
    { id: 'nn-e5', source: 'nn-p1', sourceHandle: 'out', target: 'nn-disp-p1', targetHandle: 'value' },
    // Layer 2: h × n_out
    { id: 'nn-e6', source: 'nn-hidden', sourceHandle: 'out', target: 'nn-p2-wt', targetHandle: 'in_0' },
    { id: 'nn-e7', source: 'nn-outputs', sourceHandle: 'out', target: 'nn-p2-wt', targetHandle: 'in_1' },
    // Layer 2: (h × n_out) + n_out
    { id: 'nn-e8', source: 'nn-p2-wt', sourceHandle: 'out', target: 'nn-p2', targetHandle: 'in_0' },
    { id: 'nn-e9', source: 'nn-outputs', sourceHandle: 'out', target: 'nn-p2', targetHandle: 'in_1' },
    { id: 'nn-e10', source: 'nn-p2', sourceHandle: 'out', target: 'nn-disp-p2', targetHandle: 'value' },
    // Total params
    { id: 'nn-e11', source: 'nn-p1', sourceHandle: 'out', target: 'nn-total-p', targetHandle: 'in_0' },
    { id: 'nn-e12', source: 'nn-p2', sourceHandle: 'out', target: 'nn-total-p', targetHandle: 'in_1' },
    { id: 'nn-e13', source: 'nn-total-p', sourceHandle: 'out', target: 'nn-disp-total', targetHandle: 'value' },
    // Cross-entropy loss
    { id: 'nn-e14', source: 'nn-pred', sourceHandle: 'out', target: 'nn-log', targetHandle: 'x' },
    { id: 'nn-e15', source: 'nn-true', sourceHandle: 'out', target: 'nn-mul', targetHandle: 'in_0' },
    { id: 'nn-e16', source: 'nn-log', sourceHandle: 'out', target: 'nn-mul', targetHandle: 'in_1' },
    { id: 'nn-e17', source: 'nn-mul', sourceHandle: 'out', target: 'nn-neg', targetHandle: 'x' },
    { id: 'nn-e18', source: 'nn-neg', sourceHandle: 'out', target: 'nn-disp-loss', targetHandle: 'value' },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
