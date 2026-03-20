/**
 * interval-blocks.ts — Interval arithmetic blocks (SCI-04).
 *
 * All use csOperation node kind. Evaluation is handled by the
 * Rust/WASM engine. Exports a registration function called by registry.ts.
 */

import type { BlockDef } from './types'

export function registerIntervalBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'interval_from',
    label: 'Interval (center ± hw)',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'center', label: 'Center' },
      { id: 'half_width', label: '±' },
    ],
    defaultData: { blockType: 'interval_from', label: 'Interval' },
    description: 'Create an interval [center − half_width, center + half_width].',
    synonyms: ['interval', 'tolerance', 'uncertainty', 'range'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_from_bounds',
    label: 'Interval (lo, hi)',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'lo', label: 'Lo' },
      { id: 'hi', label: 'Hi' },
    ],
    defaultData: { blockType: 'interval_from_bounds', label: 'Interval [lo,hi]' },
    description: 'Create an interval from explicit lower and upper bounds.',
    synonyms: ['interval bounds', 'range', 'lo hi'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_lo',
    label: 'Interval Lo',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [{ id: 'interval', label: 'Interval' }],
    defaultData: { blockType: 'interval_lo', label: 'Interval Lo' },
    description: 'Extract the lower bound of an interval.',
    synonyms: ['lower bound', 'interval min'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_hi',
    label: 'Interval Hi',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [{ id: 'interval', label: 'Interval' }],
    defaultData: { blockType: 'interval_hi', label: 'Interval Hi' },
    description: 'Extract the upper bound of an interval.',
    synonyms: ['upper bound', 'interval max'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_mid',
    label: 'Interval Mid',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [{ id: 'interval', label: 'Interval' }],
    defaultData: { blockType: 'interval_mid', label: 'Interval Mid' },
    description: 'Extract the midpoint (center) of an interval.',
    synonyms: ['midpoint', 'center', 'interval center'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_width',
    label: 'Interval Width',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [{ id: 'interval', label: 'Interval' }],
    defaultData: { blockType: 'interval_width', label: 'Interval Width' },
    description: 'Compute the width (hi − lo) of an interval.',
    synonyms: ['width', 'span', 'interval size'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_contains',
    label: 'Interval Contains',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'interval', label: 'Interval' },
      { id: 'x', label: 'x' },
    ],
    defaultData: { blockType: 'interval_contains', label: 'Contains' },
    description: 'Returns 1 if x is within the interval [lo, hi], else 0.',
    synonyms: ['membership', 'in range', 'contains point'],
    tags: ['interval', 'logic'],
  })

  register({
    type: 'interval_add',
    label: 'Interval Add',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    defaultData: { blockType: 'interval_add', label: 'Interval Add' },
    description: 'Interval addition: [a,b] + [c,d] = [a+c, b+d].',
    synonyms: ['interval add', 'interval sum'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_sub',
    label: 'Interval Subtract',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    defaultData: { blockType: 'interval_sub', label: 'Interval Sub' },
    description: 'Interval subtraction: [a,b] − [c,d] = [a−d, b−c].',
    synonyms: ['interval subtract', 'interval difference'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_mul',
    label: 'Interval Multiply',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    defaultData: { blockType: 'interval_mul', label: 'Interval Mul' },
    description: 'Interval multiplication using all four endpoint products.',
    synonyms: ['interval multiply', 'interval product'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_div',
    label: 'Interval Divide',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    defaultData: { blockType: 'interval_div', label: 'Interval Div' },
    description: 'Interval division. Error if the divisor interval contains zero.',
    synonyms: ['interval divide', 'interval quotient'],
    tags: ['interval', 'arithmetic'],
  })

  register({
    type: 'interval_pow',
    label: 'Interval Power',
    category: 'interval',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'Base' },
      { id: 'n', label: 'n' },
    ],
    defaultData: { blockType: 'interval_pow', label: 'Interval Pow' },
    description: 'Raise an interval to the power n.',
    synonyms: ['interval power', 'interval exponent'],
    tags: ['interval', 'arithmetic'],
  })
}
