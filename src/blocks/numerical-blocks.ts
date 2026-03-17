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

  // ── Interpolation ────────────────────────────────────────────

  register({
    type: 'interp_cubic_spline',
    label: 'Cubic Spline Interpolation',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'xs', label: 'X Points' },
      { id: 'ys', label: 'Y Points' },
      { id: 'query', label: 'Query' },
    ],
    defaultData: {
      blockType: 'interp_cubic_spline',
      label: 'Cubic Spline Interpolation',
      boundary: 'natural',
    },
    description:
      'Cubic spline interpolation through data points. Supports natural, clamped, and not-a-knot boundary conditions. Query can be scalar or vector.',
    synonyms: ['spline', 'cubic interpolation', 'curve fitting', 'smooth interpolation'],
    tags: ['numerical', 'interpolation', 'spline'],
  })

  register({
    type: 'interp_akima',
    label: 'Akima Interpolation',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'xs', label: 'X Points' },
      { id: 'ys', label: 'Y Points' },
      { id: 'query', label: 'Query' },
    ],
    defaultData: { blockType: 'interp_akima', label: 'Akima Interpolation' },
    description:
      'Akima sub-spline interpolation. Uses locally-weighted slopes to avoid oscillation near outliers. Better than cubic splines for noisy or uneven data.',
    synonyms: ['akima spline', 'anti-oscillation', 'local interpolation'],
    tags: ['numerical', 'interpolation', 'akima'],
  })

  register({
    type: 'interp_bspline',
    label: 'B-Spline Evaluation',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'ctrl', label: 'Control Points' },
      { id: 'query', label: 'Parameter t' },
    ],
    defaultData: { blockType: 'interp_bspline', label: 'B-Spline Evaluation', degree: 3 },
    description:
      'Evaluate a B-spline curve at parameter t using de Boor\'s algorithm. Control points define the curve shape; degree controls smoothness (default 3 = cubic).',
    synonyms: ['b-spline', 'de boor', 'basis spline', 'NURBS'],
    tags: ['numerical', 'interpolation', 'bspline'],
  })

  // ── Random Number Generation ─────────────────────────────────

  register({
    type: 'rng_uniform',
    label: 'Random Uniform',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'lo', label: 'Lower Bound' },
      { id: 'hi', label: 'Upper Bound' },
    ],
    defaultData: { blockType: 'rng_uniform', label: 'Random Uniform', samples: 100, seed: 42 },
    description:
      'Generate a vector of uniform random numbers using Xoshiro256++ PRNG. Deterministic given seed. Default range [0, 1).',
    synonyms: ['random', 'uniform', 'xoshiro', 'prng', 'random numbers'],
    tags: ['numerical', 'random', 'sampling'],
  })

  register({
    type: 'rng_lhs',
    label: 'Latin Hypercube Sample',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: { blockType: 'rng_lhs', label: 'Latin Hypercube Sample', samples: 100, dims: 1, seed: 42 },
    description:
      'Latin Hypercube Sampling — stratified random sampling where each dimension is divided into equal-probability bins. Better space coverage than pure random.',
    synonyms: ['LHS', 'stratified sampling', 'space-filling'],
    tags: ['numerical', 'random', 'sampling', 'DOE'],
  })

  register({
    type: 'rng_sobol',
    label: 'Sobol Sequence',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: { blockType: 'rng_sobol', label: 'Sobol Sequence', samples: 100, dims: 1 },
    description:
      'Sobol quasi-random low-discrepancy sequence. Fills the space more uniformly than pseudorandom numbers. Ideal for numerical integration and DOE.',
    synonyms: ['sobol', 'quasi-random', 'low discrepancy', 'van der corput'],
    tags: ['numerical', 'random', 'sampling', 'quasi-random'],
  })

  register({
    type: 'rng_halton',
    label: 'Halton Sequence',
    category: 'numerical',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: { blockType: 'rng_halton', label: 'Halton Sequence', samples: 100, dims: 1, skip: 0 },
    description:
      'Halton quasi-random sequence using co-prime bases. Low-discrepancy sequence for up to ~20 dimensions. Optional skip parameter to avoid initial correlations.',
    synonyms: ['halton', 'quasi-random', 'low discrepancy'],
    tags: ['numerical', 'random', 'sampling', 'quasi-random'],
  })
}
