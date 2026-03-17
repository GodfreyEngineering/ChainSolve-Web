/**
 * numerical-blocks.ts — Numerical methods block pack.
 *
 * Rootfinding: Newton-Raphson, Brent's method, polynomial roots.
 * Evaluation handled by Rust/WASM engine ops.
 */

import type { BlockDef } from './types'

export function registerNumericalBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'root_newton',
    label: 'Newton-Raphson Root',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [{ id: 'x0', label: 'Initial Guess' }],
    defaultData: { blockType: 'root_newton', label: 'Newton-Raphson Root', formula: '' },
    description:
      'Find a root of f(x) = 0 using Newton-Raphson with numerical derivatives and backtracking line search. Set the formula in block settings (variable: x).',
    synonyms: ['newton', 'root finding', 'zero finding', 'solve equation'],
    tags: ['numerical', 'rootfinding'],
  })

  register({
    type: 'root_brent',
    label: "Brent's Method Root",
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'Bracket a' },
      { id: 'b', label: 'Bracket b' },
    ],
    defaultData: { blockType: 'root_brent', label: "Brent's Method Root", formula: '' },
    description:
      "Find a root of f(x) = 0 in [a, b] using Brent's method. Guaranteed convergence when f(a) and f(b) have opposite signs. Set the formula in block settings (variable: x).",
    synonyms: ['brent', 'bracketed root', 'bisection', 'guaranteed convergence'],
    tags: ['numerical', 'rootfinding'],
  })

  register({
    type: 'root_polynomial',
    label: 'Polynomial Roots',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [{ id: 'coeffs', label: 'Coefficients' }],
    defaultData: { blockType: 'root_polynomial', label: 'Polynomial Roots' },
    description:
      'Find all real roots of a polynomial from its coefficient vector [c0, c1, ..., cn] representing c0 + c1*x + ... + cn*x^n. Uses companion matrix eigenvalues.',
    synonyms: ['polynomial zeros', 'poly roots', 'companion matrix'],
    tags: ['numerical', 'rootfinding', 'polynomial'],
  })
}
