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
    synonyms: [
      'metamodel',
      'surrogate',
      'polynomial fit',
      'kriging',
      'rbf',
      'rsm',
      'response surface methodology',
    ],
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
    synonyms: [
      'covariance matrix adaptation',
      'evolution strategy',
      'cma-es',
      'cmaes',
      'evolutionary',
    ],
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
    synonyms: [
      'sqp',
      'sequential quadratic programming',
      'augmented lagrangian',
      'constrained optimization',
    ],
    tags: ['optimization', 'constrained'],
    description:
      'SQP (Sequential Quadratic Programming) via Augmented Lagrangian. Handles equality constraints h(x)=0 and inequality constraints g(x)≤0 plus variable bounds. Outer loop updates Lagrange multipliers; inner loop uses projected gradient descent.',
  })

  // ── UQ & Robust Design ─────────────────────────────────────────────────

  register({
    type: 'optim.uqPce',
    label: 'UQ / PCE',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'x', label: 'Samples (table)' },
      { id: 'y', label: 'Responses' },
    ],
    defaultData: {
      blockType: 'optim.uqPce',
      label: 'UQ / PCE',
      degree: 2,
      basis: 'legendre',
    },
    synonyms: ['polynomial chaos', 'pce', 'uncertainty quantification', 'uq', 'sobol indices'],
    tags: ['optimization', 'uq', 'reliability'],
    description:
      'Polynomial Chaos Expansion (PCE): fits a sparse polynomial surrogate to sample data. Outputs mean, variance, std, R², and Sobol first-order sensitivity indices per variable. Basis: "legendre" (Uniform inputs) or "hermite" (Gaussian inputs). Degree 1–5.',
  })

  register({
    type: 'optim.form',
    label: 'FORM Reliability',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [{ id: 'variables', label: 'Variables' }],
    defaultData: {
      blockType: 'optim.form',
      label: 'FORM Reliability',
      n_vars: 1,
      beta0: 2.0,
      maxIterations: 100,
      tolerance: 1e-6,
    },
    synonyms: [
      'form',
      'reliability',
      'failure probability',
      'first order reliability',
      'hlrf',
      'mpp',
    ],
    tags: ['optimization', 'reliability', 'uq'],
    description:
      'FORM (First-Order Reliability Method) via HLRF algorithm. Finds the Most Probable Point (MPP) of failure in standard normal space. Outputs reliability index β and failure probability P_f = Φ(-β).',
  })

  register({
    type: 'optim.robustDesign',
    label: 'Robust Design',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'objective', label: 'Objective' },
      { id: 'variables', label: 'Variables' },
    ],
    defaultData: {
      blockType: 'optim.robustDesign',
      label: 'Robust Design',
      noiseStd: 0.1,
      nMc: 50,
      nPareto: 10,
      kMax: 5.0,
      maxIterations: 200,
    },
    synonyms: ['robust', 'taguchi', 'noise', 'mean variance', 'pareto robust'],
    tags: ['optimization', 'robust', 'uncertainty'],
    description:
      'Robust Design: minimises f_robust = μ + k·σ over a Pareto sweep of k ∈ [0, k_max]. Each Pareto point is optimised with L-projected gradient descent. Outputs table of (k, mean, std, robust_obj, x*) for plotting the Pareto front.',
  })

  register({
    type: 'optim.topologyOpt',
    label: 'Topology Optimisation',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: {
      blockType: 'optim.topologyOpt',
      label: 'Topology Optimisation',
      nx: 40,
      ny: 20,
      volFrac: 0.4,
      rMin: 1.5,
      maxIterations: 100,
      tolerance: 1e-3,
    },
    synonyms: [
      'simp',
      'topology',
      'structural optimization',
      'compliance minimization',
      'density field',
    ],
    tags: ['optimization', 'structural', 'FEM'],
    description:
      'SIMP Topology Optimisation: minimises structural compliance on a 2D cantilever beam mesh using the Solid Isotropic Material with Penalization method. Outputs density field [x, y, density] suitable for contour plot. nx×ny mesh, volume fraction vf, filter radius r_min.',
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
    synonyms: [
      'DOE',
      'factorial',
      'latin hypercube',
      'sobol',
      'box behnken',
      'central composite',
      'taguchi',
    ],
    tags: ['optimization', 'DOE'],
    description:
      'Generates experiment matrices. Methods: "factorial", "lhs" (Latin Hypercube), "sobol", "box_behnken" (3+ factors, no corners), "ccc" (Central Composite Circumscribed, rotatable), "ccf" (Central Composite Face-centered), "taguchi" (L-array). Outputs table of configurations.',
  })

  // ── Parameter Estimation ────────────────────────────────────────────────

  register({
    type: 'optim.paramEst',
    label: 'Parameter Estimation',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'data', label: 'Observed Data (table)' },
      { id: 'y0', label: 'Initial State' },
    ],
    defaultData: {
      blockType: 'optim.paramEst',
      label: 'Parameter Estimation',
      equations: 'dy/dt = -k*y',
      params: 'k',
      param_init: '1.0',
      param_lower: '0.0',
      param_upper: '1e6',
      max_iter: 200,
      tol: 1e-8,
      dt: 0.01,
    },
    synonyms: [
      'parameter estimation',
      'curve fit',
      'LM',
      'Levenberg-Marquardt',
      'system identification',
    ],
    tags: ['optimization', 'ODE', 'fitting'],
    description:
      'Fits ODE model parameters to experimental data using Levenberg-Marquardt. Inputs: observed data table (column "t" required) and initial state y0. Configure equations (semicolon-separated), param names (comma-separated), initial/lower/upper bounds. Outputs table with param_idx, value, std_error columns.',
  })

  // ── Bayesian Optimisation ────────────────────────────────────────────────

  register({
    type: 'optim.bayesian',
    label: 'Bayesian Optimisation',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [{ id: 'variables', label: 'Variables' }],
    defaultData: {
      blockType: 'optim.bayesian',
      label: 'Bayesian Optimisation',
      n_initial: 5,
      n_iterations: 20,
      acquisition: 'ei',
      kappa: 2.576,
      xi: 0.01,
      seed: 42,
    },
    synonyms: [
      'bayesian',
      'gaussian process',
      'GP',
      'EI',
      'UCB',
      'expected improvement',
      'surrogate',
    ],
    tags: ['optimization', 'bayesian', 'gaussian process', 'surrogate'],
    description:
      'Bayesian optimisation with Gaussian Process (Matérn 5/2) surrogate. Acquisition: "ei" (Expected Improvement), "ucb" (Upper Confidence Bound, kappa controls exploration), "pi" (Probability of Improvement, xi shifts threshold). Returns convergence history table.',
  })

  // ── Hyperparameter Optimisation (2.100) ─────────────────────────────────────

  register({
    type: 'optim.hyperopt',
    label: 'Hyperparameter Opt.',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: {
      blockType: 'optim.hyperopt',
      label: 'Hyperparameter Opt.',
      param_names: 'learning_rate;n_layers',
      param_mins: '0.0001;1',
      param_maxes: '0.1;5',
      objective: 'learning_rate^2 + n_layers',
      n_trials: 30,
      n_initial: 5,
      acquisition: 'ei',
      kappa: 2.0,
      xi: 0.01,
      seed: 42,
    },
    synonyms: ['hyperparameter', 'hyperopt', 'HPO', 'tuning', 'bayesian tuning', 'model tuning'],
    tags: ['optimization', 'hyperparameter', 'bayesian', 'tuning'],
    description:
      'Bayesian hyperparameter optimisation using GP surrogate (Matérn 5/2) with Expected Improvement. Define parameters (semicolon-separated names, mins, maxes) and an objective expression. Returns trial history table {trial, best_score, param0, param1, ...}. acquisition: "ei"/"ucb"/"pi". kappa (UCB exploration), xi (EI threshold shift).',
  })

  // ── GP Surrogate (2.99) ─────────────────────────────────────────────────────

  register({
    type: 'optim.surrogate',
    label: 'GP Surrogate',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'train', label: 'Train (table)' },
      { id: 'query', label: 'Query (table)' },
    ],
    defaultData: {
      blockType: 'optim.surrogate',
      label: 'GP Surrogate',
      length_scale: 1.0,
      sigma_f: 1.0,
      sigma_n: 0.001,
    },
    synonyms: ['gaussian process', 'GP', 'surrogate model', 'kriging', 'emulator', 'metamodel'],
    tags: ['optimization', 'surrogate', 'gaussian process', 'machine learning'],
    description:
      'Gaussian Process surrogate model (Matérn 5/2 kernel). Train table: feature columns + last column = target. Query table: feature columns only. Returns predictions table {mean, std}. Tune length_scale, sigma_f (signal), sigma_n (noise). Ideal for expensive simulations.',
  })

  // ── AutoML (2.101) ──────────────────────────────────────────────────────────

  register({
    type: 'optim.automl',
    label: 'AutoML',
    category: 'machineLearning',
    nodeKind: 'csOperation',
    inputs: [{ id: 'data', label: 'Data (table)' }],
    defaultData: {
      blockType: 'optim.automl',
      label: 'AutoML',
      target_col: '',
      cv_folds: 5,
    },
    synonyms: ['automl', 'auto machine learning', 'model selection', 'auto fit', 'best model'],
    tags: ['machine learning', 'automation', 'model selection', 'cross-validation'],
    description:
      'AutoML: auto-tries linear regression, polynomial (degree 2), decision tree, and GP surrogate on your data. Uses k-fold cross-validation (default 5). target_col: name of target column (default = last column). Returns table {model_idx, cv_rmse, r2, is_best} — model_idx: 0=linear, 1=poly2, 2=decision_tree, 3=gp_surrogate.',
  })

  // ── NSGA-III ────────────────────────────────────────────────────────────────

  register({
    type: 'optim.nsga3',
    label: 'NSGA-III',
    category: 'optimization',
    nodeKind: 'csOperation',
    inputs: [{ id: 'variables', label: 'Variables' }],
    defaultData: {
      blockType: 'optim.nsga3',
      label: 'NSGA-III',
      objectives: 'x0^2;(x0-1)^2',
      pop_size: 60,
      n_generations: 100,
      divisions: 4,
      crossover_prob: 0.9,
      mutation_prob: 0.1,
      eta_c: 20.0,
      eta_m: 20.0,
      seed: 42,
    },
    synonyms: [
      'NSGA-III',
      'NSGA3',
      'multi-objective',
      'pareto',
      'many-objective',
      'reference directions',
      'MOEA',
    ],
    tags: ['optimization', 'multi-objective', 'pareto', 'evolutionary'],
    description:
      'NSGA-III: Reference-direction-based multi-objective evolutionary algorithm. Superior to NSGA-II for ≥3 objectives. Uses Das-Dennis reference points for diversity preservation. Configure objectives as semicolon-separated expressions (x0, x1, ...). Returns Pareto front table with columns x0..xN, f0..fM.',
  })
}
