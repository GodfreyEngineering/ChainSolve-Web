/**
 * codeblock-blocks.ts — 9.15 / 2.134: CodeBlock (inline scripting).
 *
 * An inline code editor block that evaluates JavaScript expressions with
 * named input port values injected as variables. The return value becomes
 * the block output.
 *
 * Block type: 'codeBlock' — nodeKind: 'csCodeBlock' — category: 'input'
 *
 * Execution model:
 *  - Input ports are user-named (e.g., 'x', 'y', 'velocity')
 *  - Code is evaluated via a restricted Function constructor
 *  - Return value (number) is the block output (value)
 *  - Errors are displayed inline; last successful result is retained
 *
 * Example code:
 *   return x * Math.sin(y) + Math.PI;
 *   return velocity > 0 ? velocity * drag : 0;
 *
 * Bridge: codeBlock → 'number' (node.data.value).
 * UI-only: all computation runs in the browser; engine sees a number source.
 *
 * MATLAB-killer feature: lets MATLAB users write familiar imperative code
 * while gaining visual data flow, version control, and reproducibility.
 */

import type { BlockDef } from './registry'

export interface CodeBlockVar {
  name: string
}

export function registerCodeBlockBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'codeBlock',
    label: 'Code Block',
    category: 'input',
    nodeKind: 'csCodeBlock',
    inputs: [
      { id: 'var_x', label: 'x' },
      { id: 'var_y', label: 'y' },
    ],
    proOnly: false,
    defaultData: {
      blockType: 'codeBlock',
      label: 'Code Block',
      value: 0,
      /** Named input variables — each becomes a handle and an in-scope variable. */
      codeVars: [{ name: 'x' }, { name: 'y' }] as CodeBlockVar[],
      /** The user's code (single expression or multi-line with return). */
      code: '// Variables: x, y\nreturn x + y',
      /** Last evaluated output (number). */
      codeOutput: 0,
      /** Last error message, if any. */
      codeError: null as string | null,
    },
    synonyms: [
      'code', 'script', 'formula', 'expression', 'function', 'javascript',
      'custom', 'inline', 'matlab', 'python-like', 'code block',
    ],
    tags: ['input', 'code', 'script', 'custom', 'math'],
    description:
      'Inline code editor: write JavaScript expressions or multi-line code with `return`. ' +
      'Named input ports are injected as variables. ' +
      'The return value is the block output. Ideal for custom transformations, ' +
      'piecewise functions, and any logic too complex for wiring.',
  })
}
