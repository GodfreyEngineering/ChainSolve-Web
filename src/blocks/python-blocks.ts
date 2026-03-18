/**
 * python-blocks.ts — Python scripting block pack (2.127).
 *
 * PythonScript: execute Python 3.11 (Pyodide WASM) with numpy/scipy/pandas.
 * Input ports become Python variables. Last expression = output.
 */

import type { BlockDef } from './types'

export function registerPythonBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'scripting.python',
    label: 'Python Script',
    category: 'customFunctions',
    nodeKind: 'csPythonScript',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'scripting.python',
      label: 'Python Script',
      pyCode: '# Python 3.11 (Pyodide)\n# last expression = output\nimport numpy as np\nnp.sqrt(x1)',
      pyVars: [{ id: 'pv_default', name: 'x1' }],
      value: 0,
      pyResultJson: null,
      pyError: null,
      pyRunning: false,
    },
    synonyms: [
      'python', 'pyodide', 'numpy', 'scipy', 'pandas', 'scikit-learn',
      'script', 'custom code', 'python script', 'python block',
    ],
    tags: ['python', 'scripting', 'custom', 'pyodide', 'numpy'],
    description:
      'Execute Python 3.11 code in the browser using Pyodide (WASM-compiled CPython). ' +
      'Input ports become Python variables. The last expression value (or `result = ...`) ' +
      'is the output. NumPy is pre-loaded; use `await micropip.install("pkg")` for others. ' +
      'Pyodide (~8MB) downloads from CDN on first use. Output: scalar (or first list element).',
  })
}
