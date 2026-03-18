/**
 * onnx-blocks.ts — 2.96: ONNX model import block registration.
 *
 * Registers the `nn.onnxInference` block for running inference on
 * user-loaded .onnx models via onnxruntime-web (browser WASM backend).
 *
 * Execution model (UI-only):
 *  - User loads a .onnx file via file picker in the node UI
 *  - Model is stored as a base64 data URL in data.modelData
 *  - Input vector from connected port is fed to the model
 *  - Output (first output tensor, flattened) is stored in data.outputValues
 *  - Bridge maps to 'vector' so the Rust engine sees the output as a vector
 *
 * Bridge: nn.onnxInference → 'vector' (data.outputValues as number[]).
 */

import type { BlockDef } from './registry'

export function registerOnnxBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'nn.onnxInference',
    label: 'ONNX Inference',
    category: 'neuralNetworks',
    nodeKind: 'csOnnxInference',
    inputs: [{ id: 'data', label: 'Input data (vector)' }],
    proOnly: false,
    defaultData: {
      blockType: 'nn.onnxInference',
      label: 'ONNX Inference',
      /** Base64-encoded .onnx file content (null = no model loaded). */
      modelData: null as string | null,
      /** Original filename for display. */
      modelName: null as string | null,
      /** Input/output shape info. */
      inputShape: [] as number[],
      outputShape: [] as number[],
      inputNames: [] as string[],
      outputNames: [] as string[],
      /** Inferred output values (flattened Float32Array as number[]). Bridge reads this as 'vectorData'. */
      vectorData: [] as number[],
      /** Last inference error, if any. */
      inferenceError: null as string | null,
      /** True while inference is running. */
      inferring: false,
    },
    synonyms: [
      'onnx',
      'inference',
      'model',
      'neural network',
      'import',
      'tensorflow',
      'pytorch',
      'keras',
      'onnxruntime',
      'load model',
    ],
    tags: ['nn', 'onnx', 'inference', 'import', 'model'],
    description:
      'Load a pre-trained .onnx model file and run inference on input data. ' +
      'Supports models exported from PyTorch, TensorFlow, Keras, scikit-learn, etc. ' +
      'Runs in the browser using onnxruntime-web (WASM backend). ' +
      'Connect a vector to the input port; the first model output is flattened and passed downstream.',
  })
}
