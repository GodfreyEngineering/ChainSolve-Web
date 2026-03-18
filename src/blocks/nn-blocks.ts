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

  // ── Transfer Learning ────────────────────────────────────────────────────

  register({
    type: 'nn.transferLearn',
    label: 'Transfer Learn',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'features', label: 'Features (table)' },
      { id: 'labels', label: 'Labels (vector/table)' },
    ],
    proOnly: true,
    defaultData: {
      blockType: 'nn.transferLearn',
      label: 'Transfer Learn',
      hiddenSizes: [64],
      epochs: 100,
      lr: 0.001,
      batchSize: 32,
      loss: 'mse',
      seed: 42,
    },
    synonyms: [
      'transfer learning', 'fine-tune', 'fine tuning', 'frozen layers',
      'pretrained', 'feature extraction', 'domain adaptation',
    ],
    tags: ['nn', 'transfer', 'fine-tune', 'pretrained'],
    description:
      'Transfer learning: takes pre-computed features from a frozen base model (e.g. ONNX inference output) ' +
      'and trains a new Dense head on top. ' +
      'Features: table [n_samples × feature_dim]. Labels: vector or table [n_samples × n_classes]. ' +
      'Trains a new MLP head using backpropagation. Output: table of predictions + final loss.',
  })

  // ── Neural Operator (FNO / DeepONet) ────────────────────────────────────

  register({
    type: 'nn.neuralOp',
    label: 'Neural Operator',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [{ id: 'trainData', label: 'Training data (table)' }],
    proOnly: true,
    defaultData: {
      blockType: 'nn.neuralOp',
      label: 'Neural Operator',
      arch: 'fno',
      nPtsIn: 16,
      nPtsOut: 16,
      width: 16,
      nLayers: 4,
      nModes: 8,
      epochs: 500,
      lr: 0.001,
      hidden: [64, 64],
      basisSize: 32,
      seed: 42,
    },
    synonyms: [
      'fno', 'fourier neural operator', 'deeponet', 'operator learning',
      'neural operator', 'pde operator', 'solution operator',
    ],
    tags: ['nn', 'operator', 'fno', 'deeponet', 'pde'],
    description:
      'Neural Operator: learns PDE solution operators from input/output function pairs. ' +
      'arch="fno": Fourier Neural Operator (spectral convolution). ' +
      'arch="deeponet": DeepONet (branch-trunk decomposition). ' +
      'Training data: table where each row = [u_1..u_nPtsIn, v_1..v_nPtsOut]. ' +
      'Output: table of predicted output functions + final loss.',
  })

  // ── Physics-Informed Neural Network ────────────────────────────────────

  register({
    type: 'nn.pinn',
    label: 'PINN Solver',
    category: 'neuralNetworks',
    nodeKind: 'csOperation',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'nn.pinn',
      label: 'PINN Solver',
      // PDE: a·u'' + b·u' + c·u = f_const + f_sin·sin(π·x)
      pde_a: -1,
      pde_b: 0,
      pde_c: 0,
      f_const: 1,
      f_sin: 0,
      domainLo: 0,
      domainHi: 1,
      bcLeft: 0,
      bcRight: 0,
      hiddenSizes: [32, 32, 32],
      epochs: 2000,
      lr: 0.001,
      nCollocation: 64,
      nEval: 100,
      fourierFeatures: 4,
      seed: 42,
    },
    synonyms: [
      'pinn', 'physics-informed', 'neural network pde', 'boundary value problem',
      'bvp', 'ode solver', 'neural pde', 'scientific ml',
    ],
    tags: ['nn', 'pinn', 'pde', 'physics', 'bvp'],
    description:
      'Physics-Informed Neural Network (PINN): trains a neural network to satisfy a 1D BVP ' +
      'of the form a·u\'\' + b·u\' + c·u = f(x) with Dirichlet boundary conditions. ' +
      'Features: Fourier feature embedding for spectral bias mitigation, ' +
      'NTK-based gradient balancing, adaptive collocation resampling. ' +
      'Output: Table [x, u(x)] at n_eval evaluation points.',
  })
}
