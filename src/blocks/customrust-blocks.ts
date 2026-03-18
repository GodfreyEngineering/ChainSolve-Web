/**
 * customrust-blocks.ts — Custom Rust block pack (2.128).
 *
 * CustomRust: write Rust code compiled server-side to WASM.
 */

import type { BlockDef } from './types'

export function registerCustomRustBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'scripting.rust',
    label: 'Custom Rust',
    category: 'customFunctions',
    nodeKind: 'csCustomRust',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'scripting.rust',
      label: 'Custom Rust',
      rustCode: '// Rust expression — variables available as f64\nx1.powi(2) + x2',
      rustVars: [
        { id: 'rv_0', name: 'x1' },
        { id: 'rv_1', name: 'x2' },
      ],
      value: 0,
      rustError: null,
      rustCompiling: false,
      rustCompiledHash: null,
    },
    synonyms: [
      'custom rust', 'rust script', 'custom block', 'rust code', 'native code',
      'wasm compile', 'server compile',
    ],
    tags: ['rust', 'scripting', 'custom', 'wasm', 'native'],
    description:
      'Custom Rust block: write Rust expression code compiled server-side to WASM. ' +
      'Input ports are f64 variables injected into the function body. ' +
      'Requires the /api/compile-rust Cloudflare Pages Function endpoint. ' +
      'The compiled WASM is cached by code hash for fast re-execution. ' +
      'Output: f64 return value.',
  })
}
