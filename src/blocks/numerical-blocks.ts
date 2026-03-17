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

  // ── Numerical Integration ───────────────────────────────────────

  register({
    type: 'integrate_gk',
    label: 'Gauss-Kronrod Integral',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'Lower Bound' },
      { id: 'b', label: 'Upper Bound' },
    ],
    defaultData: {
      blockType: 'integrate_gk',
      label: 'Gauss-Kronrod Integral',
      formula: '',
    },
    description:
      'Adaptive Gauss-Kronrod G7-K15 quadrature. Integrates f(x) over [a, b] with automatic error control. Set the formula in block settings (variable: x).',
    synonyms: [
      'quadrature',
      'adaptive integration',
      'gauss kronrod',
      'definite integral',
    ],
    tags: ['numerical', 'integration', 'quadrature'],
  })

  register({
    type: 'integrate_cc',
    label: 'Clenshaw-Curtis Integral',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'Lower Bound' },
      { id: 'b', label: 'Upper Bound' },
    ],
    defaultData: {
      blockType: 'integrate_cc',
      label: 'Clenshaw-Curtis Integral',
      formula: '',
    },
    description:
      'Clenshaw-Curtis quadrature using Chebyshev points. Excellent for smooth integrands with exponential convergence. Set the formula in block settings (variable: x).',
    synonyms: ['chebyshev quadrature', 'spectral integration'],
    tags: ['numerical', 'integration', 'quadrature'],
  })

  register({
    type: 'integrate_mc',
    label: 'Monte Carlo Integral',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'Lower Bound' },
      { id: 'b', label: 'Upper Bound' },
    ],
    defaultData: {
      blockType: 'integrate_mc',
      label: 'Monte Carlo Integral',
      formula: '',
      samples: 10000,
      seed: 42,
    },
    description:
      'Monte Carlo quadrature with deterministic seed. Suitable for high-dimensional integrals where deterministic methods are impractical. Set the formula in block settings (variable: x).',
    synonyms: ['random integration', 'stochastic quadrature'],
    tags: ['numerical', 'integration', 'monte carlo'],
  })
}
