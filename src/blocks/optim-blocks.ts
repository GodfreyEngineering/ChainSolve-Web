/**
 * optim-blocks.ts — Optimization, sweep, and Monte Carlo block pack (5.01).
 *
 * Blocks for gradient descent, genetic algorithm, Nelder-Mead, parametric
 * sweep, Monte Carlo simulation, sensitivity analysis, and DOE.
 * Evaluation handled by Rust/WASM engine ops (optim.* namespace).
 */

import type { BlockDef } from './types'

export function registerOptimBlocks(register: (def: BlockDef) => void): void {
  // ── Design & Objective ──────────────────────────────────────────────────

  register({
    type: 'optim.designVariable',
    label: 'Design Variable',
    category: 'optimization',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: {
      blockType: 'optim.designVariable',
      label: 'Design Variable',
      value: 0,
      min: -10,
      max: 10,
      step: 0.1,
    },
    synonyms: ['design variable', 'parameter', 'decision variable'],
    tags: ['optimization', 'variable'],
    description:
      'A variable that the optimizer will adjust. Set the range (min/max) and initial value.',
  })

  register({
    type: 'optim.objectiveFunction',
    label: 'Objective Function',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [{ id: 'value', label: 'Value to minimize' }],
    defaultData: { blockType: 'optim.objectiveFunction', label: 'Objective Function' },
    synonyms: ['objective', 'cost function', 'fitness', 'loss'],
    tags: ['optimization', 'objective'],
    description:
      'Wraps a computed value as the objective (cost) function. The optimizer will try to minimize this value.',
  })

  // ── Optimizers ──────────────────────────────────────────────────────────

  register({
    type: 'optim.gradientDescent',
    label: 'Gradient Descent',
    category: 'optimization',
    nodeKind: 'csOptimizer',
    inputs: [
      { id: 'objective', label: 'Objective' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: { blockType: 'optim.gradientDescent', label: 'Gradient Descent' },
    synonyms: ['gradient descent', 'steepest descent', 'GD'],
    tags: ['optimization', 'gradient'],
    description:
      'Minimizes the objective using gradient descent. Supports configurable learning rate, momentum, and max iterations.',
  })

  register({
    type: 'optim.geneticAlgorithm',
    label: 'Genetic Algorithm',
    category: 'optimization',
    nodeKind: 'csOptimizer',
    inputs: [
      { id: 'objective', label: 'Objective' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: { blockType: 'optim.geneticAlgorithm', label: 'Genetic Algorithm' },
    synonyms: ['genetic algorithm', 'GA', 'evolutionary'],
    tags: ['optimization', 'evolutionary'],
    description:
      'Population-based optimizer using selection, crossover, and mutation. Good for non-smooth or multi-modal problems.',
  })

  register({
    type: 'optim.nelderMead',
    label: 'Nelder-Mead',
    category: 'optimization',
    nodeKind: 'csOptimizer',
    inputs: [
      { id: 'objective', label: 'Objective' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: { blockType: 'optim.nelderMead', label: 'Nelder-Mead' },
    synonyms: ['nelder mead', 'simplex', 'amoeba'],
    tags: ['optimization', 'simplex'],
    description:
      'Derivative-free simplex optimizer (Nelder-Mead). Works well for low-dimensional smooth problems.',
  })

  register({
    type: 'optim.responseSurface',
    label: 'Response Surface',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'x', label: 'Feature columns (table)' },
      { id: 'y', label: 'Response vector' },
    ],
    defaultData: {
      blockType: 'optim.responseSurface',
      label: 'Response Surface',
      method: 'quadratic',
    },
    synonyms: ['metamodel', 'surrogate', 'polynomial fit', 'kriging', 'rbf', 'rsm', 'response surface methodology'],
    tags: ['optimization', 'metamodel', 'surrogate'],
    description:
      'Fit a polynomial or RBF metamodel to DOE results. Methods: "linear" (main effects only), "quadratic" (default: main + squared + interactions), "cubic" (adds cubic terms), "rbf" (Gaussian radial basis functions). Returns coefficient table with R².',
  })

  register({
    type: 'optim.lbfgsb',
    label: 'L-BFGS-B',
    category: 'optimization',
    nodeKind: 'csOptimizer',
    inputs: [
      { id: 'objective', label: 'Objective' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: {
      blockType: 'optim.lbfgsb',
      label: 'L-BFGS-B',
      maxIterations: 1000,
      memory: 10,
      tolerance: 1e-8,
    },
    synonyms: ['l-bfgs', 'bfgs', 'quasi-newton', 'gradient based', 'l-bfgs-b'],
    tags: ['optimization', 'gradient-based'],
    description:
      'L-BFGS-B: Limited-memory BFGS with bound constraints. Uses numerical gradients (central differences). memory = history size (default 10). The workhorse gradient-based optimizer for smooth, convex or mildly non-convex problems.',
  })

  register({
    type: 'optim.cmaes',
    label: 'CMA-ES',
    category: 'optimization',
    nodeKind: 'csOptimizer',
    inputs: [
      { id: 'objective', label: 'Objective' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: {
      blockType: 'optim.cmaes',
      label: 'CMA-ES',
      maxGenerations: 1000,
      sigma0: 0.3,
      tolerance: 1e-10,
      seed: 42,
      lambda: 0,
    },
    synonyms: ['covariance matrix adaptation', 'evolution strategy', 'cma-es', 'cmaes', 'evolutionary'],
    tags: ['optimization', 'gradient-free', 'evolutionary'],
    description:
      'CMA-ES: Covariance Matrix Adaptation Evolution Strategy. State-of-the-art gradient-free optimizer for non-convex, multimodal problems. Self-adapts step size and variable correlations. σ₀ = initial step size (0 = auto). λ = population size (0 = auto: 4+3·ln(n)).',
  })

  register({
    type: 'optim.trustRegion',
    label: 'Trust-Region',
    category: 'optimization',
    nodeKind: 'csOptimizer',
    inputs: [
      { id: 'objective', label: 'Objective' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: {
      blockType: 'optim.trustRegion',
      label: 'Trust-Region',
      maxIterations: 1000,
      tolerance: 1e-6,
    },
    synonyms: ['trust region', 'dogleg', 'powell dogleg', 'globally convergent'],
    tags: ['optimization', 'gradient-based'],
    description:
      'Trust-Region Dogleg: globally convergent second-order method. Adapts trust-region radius each iteration. Combines Cauchy (steepest descent) and Newton steps via the dogleg path. Robust for non-convex problems.',
  })

  register({
    type: 'optim.sqp',
    label: 'SQP',
    category: 'optimization',
    nodeKind: 'csOptimizer',
    inputs: [
      { id: 'objective', label: 'Objective' },
      { id: 'variables', label: 'Variables' },
      { id: 'eq_constraints', label: 'Equality constraints' },
      { id: 'ineq_constraints', label: 'Inequality constraints' },
    ],
    defaultData: {
      blockType: 'optim.sqp',
      label: 'SQP',
      maxIterations: 100,
      tolerance: 1e-6,
      eq_constraints: [],
      ineq_constraints: [],
    },
    synonyms: ['sqp', 'sequential quadratic programming', 'augmented lagrangian', 'constrained optimization'],
    tags: ['optimization', 'constrained'],
    description:
      'SQP (Sequential Quadratic Programming) via Augmented Lagrangian. Handles equality constraints h(x)=0 and inequality constraints g(x)≤0 plus variable bounds. Outer loop updates Lagrange multipliers; inner loop uses projected gradient descent.',
  })

  // ── Visualization & Results ─────────────────────────────────────────────

  register({
    type: 'optim.convergencePlot',
    label: 'Convergence Plot',
    category: 'optimization',
    nodeKind: 'csPlot',
    inputs: [{ id: 'data', label: 'Optimizer output' }],
    defaultData: {
      blockType: 'optim.convergencePlot',
      label: 'Convergence Plot',
      plotConfig: { chartType: 'xyLine', xLabel: 'Iteration', yLabel: 'Objective' },
    },
    synonyms: ['convergence', 'optimization progress'],
    tags: ['optimization', 'plot'],
    description: 'Visualizes optimizer convergence: objective value vs iteration count.',
  })

  register({
    type: 'optim.resultsTable',
    label: 'Optimization Results',
    category: 'optimization',
    nodeKind: 'csDisplay',
    inputs: [{ id: 'data', label: 'Optimizer output' }],
    defaultData: { blockType: 'optim.resultsTable', label: 'Optimization Results' },
    synonyms: ['results', 'optimal values', 'solution'],
    tags: ['optimization', 'results'],
    description: 'Displays final optimal variable values, objective value, and convergence status.',
  })

  // ── Sweep & Monte Carlo (5.04, 5.05) ───────────────────────────────────

  register({
    type: 'optim.parametricSweep',
    label: 'Parametric Sweep',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'objective', label: 'Function' },
      { id: 'variable', label: 'Variable' },
    ],
    defaultData: {
      blockType: 'optim.parametricSweep',
      label: 'Parametric Sweep',
      manualValues: { steps: 100 },
    },
    synonyms: ['sweep', 'parameter study', 'sensitivity'],
    tags: ['optimization', 'sweep'],
    description:
      'Evaluates a function over linearly spaced values of a variable. Outputs an input→output table for sensitivity analysis.',
  })

  register({
    type: 'optim.monteCarlo',
    label: 'Monte Carlo',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'objective', label: 'Function' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: {
      blockType: 'optim.monteCarlo',
      label: 'Monte Carlo',
      manualValues: { samples: 1000 },
    },
    synonyms: ['monte carlo', 'random sampling', 'stochastic'],
    tags: ['optimization', 'simulation'],
    description:
      'Runs N random samples from specified distributions. Outputs statistics (mean, std, percentiles) and histogram.',
  })

  // ── Sensitivity & DOE (5.14, 5.15) ─────────────────────────────────────

  register({
    type: 'optim.sensitivity',
    label: 'Sensitivity Analysis',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'objective', label: 'Function' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: { blockType: 'optim.sensitivity', label: 'Sensitivity Analysis' },
    synonyms: ['tornado', 'one-at-a-time', 'OAT'],
    tags: ['optimization', 'sensitivity'],
    description:
      'Varies each input one at a time while holding others constant. Produces a tornado chart of parameter sensitivity.',
  })

  register({
    type: 'optim.doe',
    label: 'Design of Experiments',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [{ id: 'variables', label: 'Variables' }],
    defaultData: {
      blockType: 'optim.doe',
      label: 'Design of Experiments',
    },
    synonyms: ['DOE', 'factorial', 'latin hypercube', 'sobol', 'box behnken', 'central composite', 'taguchi'],
    tags: ['optimization', 'DOE'],
    description:
      'Generates experiment matrices. Methods: "factorial", "lhs" (Latin Hypercube), "sobol", "box_behnken" (3+ factors, no corners), "ccc" (Central Composite Circumscribed, rotatable), "ccf" (Central Composite Face-centered), "taguchi" (L-array). Outputs table of configurations.',
  })
}
