/**
 * nn-blocks.ts — Neural Network block pack (5.09).
 *
 * Blocks for building, training, and using neural networks in the browser.
 * Web limit: max 1M parameters. Evaluation handled by Rust/WASM engine ops (nn.* namespace).
 */

import type { BlockDef } from './types'

export function registerNNBlocks(register: (def: BlockDef) => void): void {
  // ── Input/Output ────────────────────────────────────────────────────────

  register({
    type: 'nn.input',
    label: 'NN Input',
    category: 'neuralNetworks',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: {
      blockType: 'nn.input',
      label: 'NN Input',
      manualValues: { shape: 2 },
    },
    synonyms: ['neural network input', 'input layer'],
    tags: ['nn', 'input'],
    description:
      'Defines the input shape for a neural network. Set the number of input features.',
  })

  // ── Layers ──────────────────────────────────────────────────────────────

  register({
    type: 'nn.dense',
    label: 'Dense Layer',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'input', label: 'Input' }],
    defaultData: {
      blockType: 'nn.dense',
      label: 'Dense Layer',
      manualValues: { units: 16 },
    },
    synonyms: ['dense', 'fully connected', 'linear layer', 'FC'],
    tags: ['nn', 'layer'],
    description:
      'Fully connected (dense) layer. Configurable number of units and activation function.',
  })

  register({
    type: 'nn.conv1d',
    label: 'Conv1D Layer',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'input', label: 'Input' }],
    defaultData: {
      blockType: 'nn.conv1d',
      label: 'Conv1D',
      manualValues: { filters: 8, kernelSize: 3 },
    },
    synonyms: ['convolution', '1d convolution', 'conv'],
    tags: ['nn', 'layer', 'convolution'],
    description:
      'One-dimensional convolution layer. Good for time-series and signal data.',
  })

  register({
    type: 'nn.dropout',
    label: 'Dropout',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'input', label: 'Input' }],
    defaultData: {
      blockType: 'nn.dropout',
      label: 'Dropout',
      manualValues: { rate: 0.2 },
    },
    synonyms: ['dropout', 'regularization'],
    tags: ['nn', 'layer', 'regularization'],
    description:
      'Randomly sets input elements to zero during training to prevent overfitting.',
  })

  register({
    type: 'nn.activation',
    label: 'Activation',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'input', label: 'Input' }],
    defaultData: { blockType: 'nn.activation', label: 'Activation' },
    synonyms: ['relu', 'sigmoid', 'tanh', 'softmax', 'activation function'],
    tags: ['nn', 'activation'],
    description:
      'Applies an activation function: ReLU, Sigmoid, Tanh, or Softmax.',
  })

  // ── Model Assembly ──────────────────────────────────────────────────────

  register({
    type: 'nn.sequential',
    label: 'Sequential Model',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'layers', label: 'Layers' }],
    defaultData: { blockType: 'nn.sequential', label: 'Sequential Model' },
    synonyms: ['sequential', 'model', 'network'],
    tags: ['nn', 'model'],
    description:
      'Chains layers into a sequential neural network model. Connect layers in order.',
  })

  // ── Training & Inference ────────────────────────────────────────────────

  register({
    type: 'nn.trainer',
    label: 'NN Trainer',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'model', label: 'Model' },
      { id: 'trainX', label: 'Training data' },
      { id: 'trainY', label: 'Training labels' },
    ],
    defaultData: {
      blockType: 'nn.trainer',
      label: 'NN Trainer',
      manualValues: { epochs: 100, batchSize: 32, learningRate: 0.01 },
    },
    synonyms: ['train', 'backpropagation', 'SGD'],
    tags: ['nn', 'training'],
    description:
      'Trains a neural network using backpropagation. Configurable epochs, batch size, learning rate, and loss function.',
  })

  register({
    type: 'nn.predict',
    label: 'NN Predict',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'model', label: 'Trained model' },
      { id: 'data', label: 'Input data' },
    ],
    defaultData: { blockType: 'nn.predict', label: 'NN Predict' },
    synonyms: ['predict', 'inference', 'forward pass'],
    tags: ['nn', 'predict'],
    description:
      'Runs inference on a trained neural network. Feed new data to get predictions.',
  })

  register({
    type: 'nn.export',
    label: 'Export Model',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'model', label: 'Trained model' }],
    defaultData: { blockType: 'nn.export', label: 'Export Model' },
    synonyms: ['export', 'ONNX', 'save model'],
    tags: ['nn', 'export'],
    description:
      'Exports a trained neural network to ONNX format for use in other tools.',
  })
}
