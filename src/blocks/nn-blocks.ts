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
    description: 'Defines the input shape for a neural network. Set the number of input features.',
  })

  // ── Layers ──────────────────────────────────────────────────────────────

  register({
    type: 'nn.dense',
    label: 'Dense Layer',
    category: 'neuralNetworks',
    nodeKind: 'csNeuralNet',
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
    nodeKind: 'csNeuralNet',
    inputs: [{ id: 'input', label: 'Input' }],
    defaultData: {
      blockType: 'nn.conv1d',
      label: 'Conv1D',
      manualValues: { filters: 8, kernelSize: 3 },
    },
    synonyms: ['convolution', '1d convolution', 'conv'],
    tags: ['nn', 'layer', 'convolution'],
    description: 'One-dimensional convolution layer. Good for time-series and signal data.',
  })

  register({
    type: 'nn.dropout',
    label: 'Dropout',
    category: 'neuralNetworks',
    nodeKind: 'csNeuralNet',
    inputs: [{ id: 'input', label: 'Input' }],
    defaultData: {
      blockType: 'nn.dropout',
      label: 'Dropout',
      manualValues: { rate: 0.2 },
    },
    synonyms: ['dropout', 'regularization'],
    tags: ['nn', 'layer', 'regularization'],
    description: 'Randomly sets input elements to zero during training to prevent overfitting.',
  })

  register({
    type: 'nn.activation',
    label: 'Activation',
    category: 'neuralNetworks',
    nodeKind: 'csNeuralNet',
    inputs: [{ id: 'input', label: 'Input' }],
    defaultData: { blockType: 'nn.activation', label: 'Activation' },
    synonyms: ['relu', 'sigmoid', 'tanh', 'softmax', 'activation function'],
    tags: ['nn', 'activation'],
    description: 'Applies an activation function: ReLU, Sigmoid, Tanh, or Softmax.',
  })

  // ── Model Assembly ──────────────────────────────────────────────────────

  register({
    type: 'nn.sequential',
    label: 'Sequential Model',
    category: 'neuralNetworks',
    nodeKind: 'csNeuralNet',
    inputs: [{ id: 'layers', label: 'Layers' }],
    defaultData: { blockType: 'nn.sequential', label: 'Sequential Model' },
    synonyms: ['sequential', 'model', 'network'],
    tags: ['nn', 'model'],
    description: 'Chains layers into a sequential neural network model. Connect layers in order.',
  })

  // ── Training & Inference ────────────────────────────────────────────────

  register({
    type: 'nn.trainer',
    label: 'NN Trainer',
    category: 'neuralNetworks',
    nodeKind: 'csNeuralNet',
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
    description: 'Runs inference on a trained neural network. Feed new data to get predictions.',
  })

  register({
    type: 'nn.export',
    label: 'Export Model',
    category: 'neuralNetworks',
    nodeKind: 'csNeuralNet',
    inputs: [{ id: 'model', label: 'Trained model' }],
    defaultData: { blockType: 'nn.export', label: 'Export Model' },
    synonyms: ['export', 'ONNX', 'save model'],
    tags: ['nn', 'export'],
    description: 'Exports a trained neural network to ONNX format for use in other tools.',
  })

  // ── Recurrent & Attention Layers ────────────────────────────────────────

  register({
    type: 'nn.lstm',
    label: 'LSTM',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'sequence', label: 'Sequence (table T×D)' }],
    defaultData: {
      blockType: 'nn.lstm',
      label: 'LSTM',
      hiddenSize: 32,
      seed: 42,
      returnSequences: false,
    },
    synonyms: ['lstm', 'long short term memory', 'recurrent', 'rnn'],
    tags: ['nn', 'recurrent', 'sequence'],
    description:
      'LSTM (Long Short-Term Memory) layer. Input: Table [T × D] (timesteps × features). Output: last hidden state vector [H] (returnSequences=false) or full hidden sequence Table [T × H]. Xavier-initialised weights with configurable seed.',
  })

  register({
    type: 'nn.gru',
    label: 'GRU',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'sequence', label: 'Sequence (table T×D)' }],
    defaultData: {
      blockType: 'nn.gru',
      label: 'GRU',
      hiddenSize: 32,
      seed: 42,
      returnSequences: false,
    },
    synonyms: ['gru', 'gated recurrent unit', 'recurrent', 'rnn'],
    tags: ['nn', 'recurrent', 'sequence'],
    description:
      'GRU (Gated Recurrent Unit) layer — simpler than LSTM, often similar performance. Input: Table [T × D]. Output: last hidden state [H] or full sequence [T × H]. Uses reset and update gates.',
  })

  register({
    type: 'nn.attention',
    label: 'Attention',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'query', label: 'Query (table seq_q × d_k)' },
      { id: 'key', label: 'Key (table seq_k × d_k)' },
      { id: 'value', label: 'Value (table seq_k × d_v)' },
    ],
    defaultData: {
      blockType: 'nn.attention',
      label: 'Attention',
      causal: false,
    },
    synonyms: ['attention', 'transformer', 'self-attention', 'scaled dot product'],
    tags: ['nn', 'attention', 'transformer'],
    description:
      'Scaled dot-product attention: Attention(Q,K,V) = softmax(Q·Kᵀ/√d_k)·V. Causal=true masks future positions (for autoregressive models). Q=K=V for self-attention. Output: [seq_q × d_v] table.',
  })

  register({
    type: 'nn.conv2d',
    label: 'Conv2D',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'input', label: 'Input (Matrix/Table)' }],
    defaultData: {
      blockType: 'nn.conv2d',
      label: 'Conv2D',
      n_filters: 4,
      kernel_h: 3,
      kernel_w: 3,
      stride_h: 1,
      stride_w: 1,
      padding: 'valid',
      activation: 'relu',
      seed: 42,
    },
    synonyms: ['conv2d', '2D convolution', 'image', 'CNN', 'convolutional'],
    tags: ['nn', 'conv2d', 'CNN', 'image'],
    description:
      '2D convolutional layer. Accepts Matrix input (H×W) or flattened image. n_filters feature maps, kernel_h×kernel_w spatial kernel, stride, padding ("valid" or "same"). He-initialised weights. Output: Matrix of [out_h*out_w × n_filters].',
  })
}
