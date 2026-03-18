/**
 * algorithmDocs.ts
 *
 * Embedded mathematical reference for every algorithm in ChainSolve.
 * Covers ODE solvers, optimisation, automatic differentiation, linear algebra,
 * signal processing, rootfinding, interpolation, and numerical integration.
 *
 * Each AlgorithmDoc entry contains:
 * - Human-readable description
 * - Mathematical formulation (LaTeX strings)
 * - Complexity analysis
 * - Stability / convergence properties
 * - Parameters and their meanings
 * - Practical guidance
 * - Literature references
 */

export type AlgorithmCategory =
  | 'ode'
  | 'optimisation'
  | 'autodiff'
  | 'linalg'
  | 'signal'
  | 'rootfinding'
  | 'interpolation'
  | 'integration'
  | 'ml'
  | 'statistics'
  | 'symbolic'

export interface AlgorithmParam {
  name: string
  symbol: string
  description: string
  unit?: string
  defaultValue?: string
  range?: string
}

export interface AlgorithmDoc {
  id: string
  name: string
  category: AlgorithmCategory
  shortDescription: string
  fullDescription: string
  /** LaTeX strings for the main equations */
  equations: string[]
  /** Asymptotic complexity in Big-O notation */
  complexity: {
    time: string
    space: string
    notes?: string
  }
  /** Order of accuracy / convergence rate */
  convergenceOrder?: string
  /** Stability region or condition (LaTeX) */
  stabilityRegion?: string
  parameters: AlgorithmParam[]
  strengths: string[]
  weaknesses: string[]
  /** When to prefer this algorithm over alternatives */
  guidance: string
  relatedAlgorithms: string[]
  references: Array<{ title: string; authors: string; year: number; doi?: string }>
}

// ---------------------------------------------------------------------------
// ODE Solvers
// ---------------------------------------------------------------------------

const rk4: AlgorithmDoc = {
  id: 'ode.rk4',
  name: 'Runge-Kutta 4 (RK4)',
  category: 'ode',
  shortDescription: 'Classic fourth-order fixed-step explicit ODE integrator.',
  fullDescription:
    'The classical Runge-Kutta method of order 4 approximates the solution of ' +
    'dy/dt = f(t, y) by computing four weighted slope estimates per step. ' +
    'The method is explicit, self-starting, and requires exactly 4 function ' +
    'evaluations per step. It achieves O(h⁴) local truncation error and O(h⁴) ' +
    'global error for sufficiently smooth problems. Despite its age it remains ' +
    'the workhorse for non-stiff ODEs with moderate accuracy requirements.',
  equations: [
    'k_1 = h \\cdot f(t_n,\\, y_n)',
    'k_2 = h \\cdot f\\!\\left(t_n + \\tfrac{h}{2},\\, y_n + \\tfrac{k_1}{2}\\right)',
    'k_3 = h \\cdot f\\!\\left(t_n + \\tfrac{h}{2},\\, y_n + \\tfrac{k_2}{2}\\right)',
    'k_4 = h \\cdot f(t_n + h,\\, y_n + k_3)',
    'y_{n+1} = y_n + \\tfrac{1}{6}(k_1 + 2k_2 + 2k_3 + k_4)',
  ],
  complexity: {
    time: 'O(N) where N = (t_end - t_start) / h',
    space: 'O(1) per step (no history)',
    notes: '4 function evaluations per step',
  },
  convergenceOrder: 'Order 4 globally (O(h⁴) global error, O(h⁵) local truncation error)',
  stabilityRegion:
    'Stability region: |1 + z + z^2/2 + z^3/6 + z^4/24| \\le 1,\\; z = h\\lambda \\in \\mathbb{C}. ' +
    'Along the negative real axis the method is stable for |z| \\le 2.785.',
  parameters: [
    {
      name: 'Step size',
      symbol: 'h',
      description: 'Fixed time step. Must be chosen small enough for stability and accuracy.',
      unit: 's (or matching time unit)',
      guidance: 'Rule of thumb: h < 2.785 / |λ_max| for stability on linear problems.',
    } as AlgorithmParam,
  ],
  strengths: [
    'Simple, well-understood, no solver tuning required',
    'Excellent for smooth, non-stiff problems',
    '4 FLOP multiplier per step is cheap',
    'Deterministic step count — useful for real-time applications',
  ],
  weaknesses: [
    'Fixed step: inefficient for problems with widely varying time scales',
    'No error estimate without doubling cost',
    'Unstable for stiff problems unless h is very small',
    'No dense output without extra interpolation',
  ],
  guidance:
    'Use RK4 when the ODE is non-stiff, the solution is smooth, and you need ' +
    'deterministic runtime. Switch to RK45 when step-size control matters, ' +
    'or to BDF/Radau for stiff problems.',
  relatedAlgorithms: ['ode.rk45', 'ode.bdf', 'ode.radau'],
  references: [
    {
      title: 'Solving Ordinary Differential Equations I',
      authors: 'Hairer, Nørsett, Wanner',
      year: 1993,
      doi: '10.1007/978-3-540-78862-1',
    },
  ],
}

const rk45: AlgorithmDoc = {
  id: 'ode.rk45',
  name: 'Dormand-Prince RK45 (DOPRI5)',
  category: 'ode',
  shortDescription:
    'Embedded 4th/5th-order Runge-Kutta with adaptive step-size control (DOPRI5).',
  fullDescription:
    'The Dormand-Prince method (DOPRI5) is the most widely used adaptive explicit ODE solver. ' +
    'It uses an embedded Runge-Kutta pair: a 5th-order solution to advance the state and a ' +
    '4th-order solution to estimate the local error, both computed from the same 6 function ' +
    'evaluations (7 with the FSAL trick). The step size is adjusted so that the estimated ' +
    'error stays within the user-specified tolerances. The FSAL (First Same As Last) property ' +
    'means the last stage of step n equals the first stage of step n+1, saving one evaluation ' +
    'per accepted step in the steady state.',
  equations: [
    '\\text{Advance: } y_{n+1} = y_n + \\sum_{i=1}^{7} b_i k_i \\quad (\\text{5th order})',
    '\\text{Error estimate: } \\hat{y}_{n+1} = y_n + \\sum_{i=1}^{7} \\hat{b}_i k_i \\quad (\\text{4th order})',
    'e = \\|y_{n+1} - \\hat{y}_{n+1}\\|',
    '\\text{Step control: } h_{n+1} = h_n \\cdot \\min\\!\\left(h_{\\max}, \\max\\!\\left(h_{\\min}, S \\cdot \\left(\\frac{\\varepsilon}{e}\\right)^{0.2}\\right)\\right)',
  ],
  complexity: {
    time: 'O(N_accepted) — variable, depends on solution smoothness',
    space: 'O(1) per step',
    notes: '6 function evaluations per accepted step (FSAL: 7 on first step, 6 thereafter)',
  },
  convergenceOrder:
    'Order 5 for the propagated solution; local truncation error is O(h⁶). ' +
    'Step control targets O(h⁵) global error.',
  stabilityRegion:
    'Explicit method: stability boundary intersects negative real axis at ≈ 3.5. ' +
    'Unsuitable for stiff problems.',
  parameters: [
    {
      name: 'Absolute tolerance',
      symbol: '\\varepsilon_{abs}',
      description: 'Absolute error bound per component.',
      defaultValue: '1e-6',
    } as AlgorithmParam,
    {
      name: 'Relative tolerance',
      symbol: '\\varepsilon_{rel}',
      description: 'Relative error bound per component.',
      defaultValue: '1e-3',
    } as AlgorithmParam,
    {
      name: 'Safety factor',
      symbol: 'S',
      description: 'Multiplier applied to the step-size proposal (typically 0.9).',
      defaultValue: '0.9',
      range: '[0.8, 1.0]',
    } as AlgorithmParam,
  ],
  strengths: [
    'Automatic step-size control — no manual tuning',
    'Efficient for non-stiff problems with tight tolerances',
    'Dense output available via continuous extension',
    'Gold standard in scientific computing (used in MATLAB ode45, SciPy solve_ivp)',
  ],
  weaknesses: [
    'Explicit — unstable for stiff problems',
    'Step rejection wastes function evaluations',
    'Not suitable when evaluation cost is extremely high',
  ],
  guidance:
    'Default choice for non-stiff ODEs. Set rtol=1e-3 for engineering, rtol=1e-6 for ' +
    'scientific accuracy. If the solver takes tiny steps (stiffness detected), switch to BDF or Radau.',
  relatedAlgorithms: ['ode.rk4', 'ode.bdf', 'ode.radau'],
  references: [
    {
      title: "A family of embedded Runge-Kutta formulae",
      authors: 'Dormand, Prince',
      year: 1980,
      doi: '10.1016/0771-050X(80)90013-3',
    },
  ],
}

const bdf: AlgorithmDoc = {
  id: 'ode.bdf',
  name: 'Backward Differentiation Formula (BDF)',
  category: 'ode',
  shortDescription:
    'A-stable implicit multistep methods (orders 1–6) for stiff ODEs, variable step and order.',
  fullDescription:
    'Backward Differentiation Formulas (BDF, Gear methods) are implicit linear multistep ' +
    'methods widely used for stiff ODEs and DAEs. At each step the method solves a nonlinear ' +
    'algebraic system using a modified Newton iteration with a frozen or updated Jacobian. ' +
    'BDF1 is backward Euler (A-stable), BDF2 is the most common workhorse (A-stable), and ' +
    'BDF3–6 are A(α)-stable. Variable-order/variable-step implementations (as in VODE, LSODE, ' +
    'CVODE) select the order automatically to balance accuracy and cost.',
  equations: [
    '\\sum_{k=0}^{q} \\alpha_k y_{n+k} = h \\beta_q f(t_{n+q}, y_{n+q})',
    '\\text{BDF1: } y_{n+1} - y_n = h f(t_{n+1}, y_{n+1})',
    '\\text{BDF2: } \\tfrac{3}{2} y_{n+1} - 2 y_n + \\tfrac{1}{2} y_{n-1} = h f(t_{n+1}, y_{n+1})',
    '\\text{Newton iteration: } (I - h \\beta_q J) \\delta = -G(y^{(k)}), \\quad J = \\partial f / \\partial y',
  ],
  complexity: {
    time: 'O(N · n³) for dense Jacobian (n = state dimension)',
    space: 'O(n²) for Jacobian storage; O(q · n) for multistep history',
    notes:
      'Cost dominated by linear solves. Use sparse/banded Jacobian when n is large.',
  },
  convergenceOrder: 'BDF-q is order q (q = 1…6). Convergence requires |arg(λh)| < α_q (A(α)-stability).',
  stabilityRegion:
    'BDF1, BDF2: A-stable (entire left half-plane). BDF3–6: A(α)-stable with α decreasing. ' +
    'All BDF methods are zero-stable.',
  parameters: [
    { name: 'Max order', symbol: 'q_{max}', description: 'Maximum BDF order (1–6). BDF2 is often sufficient.', defaultValue: '5' } as AlgorithmParam,
    { name: 'Relative tolerance', symbol: '\\varepsilon_{rel}', description: 'Relative error tolerance.', defaultValue: '1e-3' } as AlgorithmParam,
    { name: 'Absolute tolerance', symbol: '\\varepsilon_{abs}', description: 'Absolute error tolerance per component.', defaultValue: '1e-6' } as AlgorithmParam,
  ],
  strengths: [
    'Handles stiff problems efficiently',
    'A-stable for orders 1 and 2',
    'Variable order automatically adapts to solution smoothness',
    'Foundation of MATLAB ode15s, SciPy BDF solver',
  ],
  weaknesses: [
    'Requires Jacobian evaluation and nonlinear solve per step',
    'Not suitable for Hamiltonian/symplectic problems',
    'Order > 2 loses full A-stability',
  ],
  guidance:
    'Use for stiff problems: chemical kinetics, electrical circuits with fast dynamics, ' +
    'structural dynamics with stiff springs. Provide Jacobian analytically when possible ' +
    'to reduce cost and improve robustness.',
  relatedAlgorithms: ['ode.rk45', 'ode.radau'],
  references: [
    { title: 'Numerical Solution of Initial Value Problems in Differential-Algebraic Equations', authors: 'Brenan, Campbell, Petzold', year: 1996, doi: '10.1137/1.9781611971224' },
  ],
}

const radau: AlgorithmDoc = {
  id: 'ode.radau',
  name: 'Radau IIA (implicit Runge-Kutta)',
  category: 'ode',
  shortDescription:
    'L-stable, stiffly accurate 5th-order implicit RK method for stiff ODEs and DAEs.',
  fullDescription:
    'Radau IIA is a 3-stage fully implicit Runge-Kutta method of order 5. All eigenvalues ' +
    'of the stability function lie inside the unit disk for all Re(z) < 0 (L-stable), making ' +
    'it ideal for stiff and differential-algebraic problems. Each step solves a 3n×3n ' +
    'block-structured nonlinear system using a simplified Newton iteration that exploits the ' +
    'method\'s Kronecker product structure to reduce to two n×n complex linear solves. ' +
    'It is the reference implementation for stiff problems in Hairer & Wanner\'s "Solving ODEs II".',
  equations: [
    '\\text{Butcher tableau: } c_i, a_{ij}, b_i \\text{ chosen so that order} = 2s - 1',
    '\\text{Stage equations: } Y_i = y_n + h \\sum_j a_{ij} f(t_n + c_j h, Y_j)',
    '\\text{Solution: } y_{n+1} = y_n + h \\sum_i b_i f(t_n + c_i h, Y_i)',
    '\\text{Stability function: } R(z) = \\frac{\\det(I - zA + z\\mathbf{1}b^T)}{\\det(I - zA)}, \\; |R(\\infty)| = 0 \\text{ (L-stable)}',
  ],
  complexity: {
    time: 'O(N · n³) — three-stage Newton solve with complex factorisation',
    space: 'O(n²)',
    notes: 'More expensive per step than BDF but often takes larger steps on stiff problems',
  },
  convergenceOrder: 'Order 5. Stiffly accurate: y_last stage = y_{n+1}.',
  stabilityRegion: 'L-stable: entire left half-plane, and R(∞) = 0 (damped at infinity).',
  parameters: [
    { name: 'Relative tolerance', symbol: '\\varepsilon_{rel}', defaultValue: '1e-3', description: 'Per-component relative error.' } as AlgorithmParam,
    { name: 'Absolute tolerance', symbol: '\\varepsilon_{abs}', defaultValue: '1e-6', description: 'Per-component absolute error floor.' } as AlgorithmParam,
  ],
  strengths: [
    'L-stable — ideal for very stiff problems and DAEs',
    'Stiffly accurate: solution inherits stage value, no oscillations',
    'Dense output with 4th-order continuous extension',
    'Handles index-1 DAEs directly',
  ],
  weaknesses: [
    'High cost per step (3n×3n system)',
    'Implementation complexity',
    'Not competitive with BDF on mildly stiff problems',
  ],
  guidance:
    'Choose Radau for highly stiff problems, DAEs, or when L-stability is essential ' +
    '(e.g., parabolic PDEs, reaction-diffusion). For moderately stiff systems BDF is often faster.',
  relatedAlgorithms: ['ode.bdf', 'ode.rk45'],
  references: [
    { title: 'Solving Ordinary Differential Equations II: Stiff and Differential-Algebraic Problems', authors: 'Hairer, Wanner', year: 1996, doi: '10.1007/978-3-642-05221-7' },
  ],
}

// ---------------------------------------------------------------------------
// Optimisation
// ---------------------------------------------------------------------------

const gradientDescent: AlgorithmDoc = {
  id: 'opt.gradient_descent',
  name: 'Gradient Descent',
  category: 'optimisation',
  shortDescription: 'First-order iterative minimiser following the negative gradient.',
  fullDescription:
    'Gradient descent minimises a differentiable function f(x) by repeatedly stepping ' +
    'in the direction of steepest descent (−∇f). Vanilla GD uses a fixed learning rate; ' +
    'line-search variants (Armijo, Wolfe) choose the step size adaptively. Convergence is ' +
    'linear for strongly convex functions (rate 1 − μ/L) and sub-linear in general.',
  equations: [
    'x_{k+1} = x_k - \\alpha_k \\nabla f(x_k)',
    '\\text{Armijo condition: } f(x_k - \\alpha g_k) \\le f(x_k) - c_1 \\alpha \\|g_k\\|^2',
    '\\text{Convergence (strongly convex): } f(x_k) - f^* \\le \\left(1 - \\frac{\\mu}{L}\\right)^k (f(x_0) - f^*)',
  ],
  complexity: { time: 'O(k · d) per k iterations on d-dimensional problem', space: 'O(d)' },
  convergenceOrder: 'Linear (R-linear) for strongly convex; sub-linear in general.',
  parameters: [
    { name: 'Learning rate', symbol: '\\alpha', description: 'Step size. Too large → divergence; too small → slow convergence.', range: '(0, 2/L]' } as AlgorithmParam,
    { name: 'Max iterations', symbol: 'k_{max}', description: 'Iteration budget.', defaultValue: '1000' } as AlgorithmParam,
    { name: 'Tolerance', symbol: '\\varepsilon', description: 'Stop when ‖∇f‖ < ε.', defaultValue: '1e-6' } as AlgorithmParam,
  ],
  strengths: [
    'Simple to implement, works for any differentiable function',
    'Memory-efficient for high-dimensional problems',
    'Foundation for all first-order methods (Adam, Adagrad, etc.)',
  ],
  weaknesses: [
    'Slow convergence on ill-conditioned problems (high L/μ ratio)',
    'Sensitive to learning rate choice',
    'Can get stuck in saddle points',
  ],
  guidance:
    'Use for large-scale ML problems. For small-to-medium optimisation prefer L-BFGS or ' +
    'Newton methods. Use Adam for stochastic settings.',
  relatedAlgorithms: ['opt.lbfgs', 'opt.nelder_mead', 'opt.nsga2'],
  references: [
    { title: 'Convex Optimization', authors: 'Boyd, Vandenberghe', year: 2004 },
  ],
}

const lbfgs: AlgorithmDoc = {
  id: 'opt.lbfgs',
  name: 'L-BFGS (Limited-Memory BFGS)',
  category: 'optimisation',
  shortDescription: 'Quasi-Newton method storing only the last m gradient differences.',
  fullDescription:
    'L-BFGS approximates the inverse Hessian using the last m (typically 5–20) vector pairs ' +
    '{s_k, y_k} where s_k = x_{k+1} − x_k, y_k = ∇f_{k+1} − ∇f_k. The two-loop recursion ' +
    'computes H_k ∇f_k in O(md) without forming the full Hessian. Convergence is superlinear ' +
    'near the solution for strongly convex problems.',
  equations: [
    's_k = x_{k+1} - x_k, \\quad y_k = \\nabla f_{k+1} - \\nabla f_k',
    '\\rho_k = (y_k^T s_k)^{-1}',
    'H_k = (I - \\rho_k s_k y_k^T) H_{k-1} (I - \\rho_k y_k s_k^T) + \\rho_k s_k s_k^T',
    'p_k = -H_k \\nabla f_k \\quad \\text{(via two-loop recursion, O}(md))',
  ],
  complexity: {
    time: 'O(k · m · d) for k iterations',
    space: 'O(m · d) — key advantage over full BFGS O(d²)',
  },
  convergenceOrder: 'Superlinear near solution (q-superlinear for strongly convex), linear globally.',
  parameters: [
    { name: 'History size', symbol: 'm', description: 'Number of s/y pairs stored. More = better Hessian approx, more memory.', defaultValue: '10', range: '[3, 20]' } as AlgorithmParam,
    { name: 'Tolerance', symbol: '\\varepsilon', description: 'Stop when ‖∇f‖ < ε · ‖∇f_0‖.', defaultValue: '1e-5' } as AlgorithmParam,
  ],
  strengths: [
    'Fast convergence with low memory (O(md) vs O(d²))',
    'Works well for smooth, unconstrained medium-to-large problems',
    'Invariant to diagonal scaling',
  ],
  weaknesses: [
    'Requires gradient evaluation',
    'Curvature condition y_k^T s_k > 0 can fail — needs safeguard',
    'Not suitable for non-smooth or constrained problems directly',
  ],
  guidance:
    'Preferred method for smooth unconstrained problems with d > 100. For small d (< 50) ' +
    'full BFGS or Newton is faster. Add L2 regularisation for ill-conditioned problems.',
  relatedAlgorithms: ['opt.gradient_descent', 'opt.nelder_mead'],
  references: [
    { title: 'Numerical Optimization', authors: 'Nocedal, Wright', year: 2006, doi: '10.1007/978-0-387-40065-5' },
  ],
}

const nelderMead: AlgorithmDoc = {
  id: 'opt.nelder_mead',
  name: 'Nelder-Mead Simplex',
  category: 'optimisation',
  shortDescription:
    'Derivative-free direct search method using a simplex of n+1 points in n dimensions.',
  fullDescription:
    'The Nelder-Mead method maintains a simplex (n+1 vertices) and updates it using ' +
    'reflection, expansion, contraction, and shrink operations. It requires only function ' +
    'evaluations, making it suitable for noisy or non-smooth objectives. Convergence is not ' +
    'guaranteed in general (can stagnate), but it is robust in practice for moderate dimensions.',
  equations: [
    'x_r = (1 + \\alpha) \\bar{x} - \\alpha x_{n+1} \\quad \\text{(reflection, } \\alpha=1)',
    'x_e = (1 + \\gamma) \\bar{x} - \\gamma x_{n+1} \\quad \\text{(expansion, } \\gamma=2)',
    'x_c = (1 - \\beta) \\bar{x} + \\beta x_{n+1} \\quad \\text{(contraction, } \\beta=0.5)',
    '\\text{Shrink: } x_i \\leftarrow x_1 + \\delta(x_i - x_1),\\; i=2,\\ldots,n+1 \\quad (\\delta=0.5)',
  ],
  complexity: { time: 'O(k · n) function evaluations for n-dimensional problem', space: 'O(n²)' },
  convergenceOrder: 'No proven convergence order. Empirically O(1/k) for smooth convex problems.',
  parameters: [
    { name: 'Reflection coefficient', symbol: '\\alpha', defaultValue: '1.0', description: 'Controls reflection step length.' } as AlgorithmParam,
    { name: 'Expansion coefficient', symbol: '\\gamma', defaultValue: '2.0', description: 'Controls expansion step.' } as AlgorithmParam,
    { name: 'Contraction coefficient', symbol: '\\beta', defaultValue: '0.5', description: 'Controls contraction step.' } as AlgorithmParam,
    { name: 'Shrink coefficient', symbol: '\\delta', defaultValue: '0.5', description: 'Controls shrink step.' } as AlgorithmParam,
  ],
  strengths: [
    'No gradient required — works for non-smooth, noisy objectives',
    'Easy to implement',
    'Often effective in low dimensions (n ≤ 10)',
  ],
  weaknesses: [
    'No convergence guarantee for n ≥ 2',
    'Scales poorly with dimension (n > 20 typically problematic)',
    'Can stagnate on flat regions',
  ],
  guidance:
    'Use for low-dimensional (≤10), noisy, or black-box problems. Not recommended for ' +
    'high-dimensional or constrained problems. For smooth problems prefer L-BFGS.',
  relatedAlgorithms: ['opt.gradient_descent', 'opt.nsga2'],
  references: [
    { title: 'A simplex method for function minimization', authors: 'Nelder, Mead', year: 1965, doi: '10.1093/comjnl/7.4.308' },
  ],
}

const nsga2: AlgorithmDoc = {
  id: 'opt.nsga2',
  name: 'NSGA-II (Non-dominated Sorting Genetic Algorithm II)',
  category: 'optimisation',
  shortDescription: 'Multi-objective evolutionary algorithm generating a Pareto-optimal front.',
  fullDescription:
    'NSGA-II maintains a population of candidate solutions and evolves it via selection, ' +
    'crossover, and mutation. Solutions are ranked by non-domination level (Pareto rank) and ' +
    'spread along the front is maintained using a crowding distance metric. The algorithm ' +
    'converges to an approximation of the Pareto-optimal front while maintaining diversity. ' +
    'It runs in O(M N² log N) per generation for M objectives and population size N.',
  equations: [
    '\\text{Pareto rank: } r(x) = |\\{y : y \\succ x\\}|',
    '\\text{Crowding distance: } d_i = \\sum_m \\frac{f_m^{i+1} - f_m^{i-1}}{f_m^{max} - f_m^{min}}',
    '\\text{Selection: prefer lower rank, break ties with larger crowding distance}',
  ],
  complexity: { time: 'O(G · M · N²) where G = generations, M = objectives, N = population', space: 'O(N · d)' },
  convergenceOrder: 'Stochastic convergence; theoretical Pareto front convergence in probability.',
  parameters: [
    { name: 'Population size', symbol: 'N', defaultValue: '100', description: 'Number of candidates per generation.', range: '[50, 1000]' } as AlgorithmParam,
    { name: 'Generations', symbol: 'G', defaultValue: '200', description: 'Number of evolutionary generations.', range: '[50, 2000]' } as AlgorithmParam,
    { name: 'Crossover probability', symbol: 'p_c', defaultValue: '0.9', description: 'Probability of applying SBX crossover.', range: '[0.6, 1.0]' } as AlgorithmParam,
    { name: 'Mutation probability', symbol: 'p_m', defaultValue: '1/d', description: 'Per-gene mutation probability (1/d recommended).', range: '[1/d, 0.1]' } as AlgorithmParam,
  ],
  strengths: [
    'Handles multiple conflicting objectives simultaneously',
    'Maintains diverse Pareto front approximation',
    'No gradient required — handles discontinuous/noisy objectives',
    'Well-validated across engineering design problems',
  ],
  weaknesses: [
    'Many function evaluations (N × G)',
    'Scales poorly with number of objectives (> 3 objectives: consider NSGA-III)',
    'Parameters require tuning',
  ],
  guidance:
    'Use for 2-3 objective optimisation with expensive or non-smooth functions. ' +
    'For > 3 objectives consider NSGA-III or MOEA/D. Set N ≥ 100 for reliable Pareto fronts.',
  relatedAlgorithms: ['opt.gradient_descent', 'opt.nelder_mead'],
  references: [
    { title: 'A fast and elitist multiobjective genetic algorithm: NSGA-II', authors: 'Deb, Pratap, Agarwal, Meyarivan', year: 2002, doi: '10.1109/4235.996017' },
  ],
}

const simplex: AlgorithmDoc = {
  id: 'opt.simplex',
  name: 'Simplex Method (Linear Programming)',
  category: 'optimisation',
  shortDescription:
    'Vertex-traversal algorithm for solving linear programs in standard form.',
  fullDescription:
    'The simplex method solves LP: min cᵀx subject to Ax = b, x ≥ 0 by moving along edges ' +
    'of the feasibility polytope from vertex to vertex, strictly decreasing the objective. ' +
    'Despite exponential worst-case complexity, it runs in O(n²m) average-case operations ' +
    'for n variables and m constraints. The revised simplex method stores only the basis ' +
    'matrix B (m×m) and is preferred for large sparse LPs.',
  equations: [
    '\\min c^T x \\text{ s.t. } Ax = b,\\; x \\ge 0',
    '\\text{Reduced costs: } \\bar{c}_N = c_N - c_B^T B^{-1} A_N',
    '\\text{Pivot: enter column } s = \\arg\\min_j \\bar{c}_j < 0; \\text{ leave via min-ratio test}',
    '\\text{Basis update: } B_{new}^{-1} \\leftarrow \\text{rank-1 update of } B^{-1}',
  ],
  complexity: { time: 'O(n²m) average; O(2^n) worst-case', space: 'O(nm)' },
  convergenceOrder: 'Finite convergence (cycling prevented by Bland\'s rule or perturbation).',
  parameters: [
    { name: 'Pivot rule', symbol: '—', description: 'Dantzig (max reduced cost) or Bland (anti-cycling). Dantzig is faster in practice.', defaultValue: 'Dantzig' } as AlgorithmParam,
  ],
  strengths: [
    'Exact solution for LP — no approximation',
    'Efficient in practice even for large problems',
    'Well-supported by sparse matrix techniques',
  ],
  weaknesses: [
    'Only for linear objectives and constraints',
    'Exponential worst-case',
    'Degenerate problems can cycle without anti-cycling rule',
  ],
  guidance:
    'Use for LP subproblems within larger pipelines, resource allocation, and portfolio ' +
    'problems. For QP, use active-set or interior-point methods. For MIP, use branch-and-bound.',
  relatedAlgorithms: ['opt.gradient_descent', 'opt.lbfgs'],
  references: [
    { title: 'Linear Programming', authors: 'Dantzig', year: 1963 },
  ],
}

// ---------------------------------------------------------------------------
// Automatic Differentiation
// ---------------------------------------------------------------------------

const forwardAD: AlgorithmDoc = {
  id: 'ad.forward',
  name: 'Forward Mode Automatic Differentiation',
  category: 'autodiff',
  shortDescription:
    'Computes directional derivatives by propagating dual numbers through the computation.',
  fullDescription:
    'Forward mode AD augments each real number x with a dual part ẋ (the derivative with ' +
    'respect to a chosen input direction). Arithmetic is extended to dual numbers: ' +
    '(a + bε)(c + dε) = ac + (ad + bc)ε. A single forward pass computes f(x) and ' +
    'Jv (the Jacobian-vector product) simultaneously. Computing all n input derivatives ' +
    'requires n passes. Optimal when the number of inputs << number of outputs.',
  equations: [
    '\\text{Dual arithmetic: } (a, \\dot{a}) \\oplus (b, \\dot{b}) = (a+b, \\dot{a}+\\dot{b})',
    '(a, \\dot{a}) \\otimes (b, \\dot{b}) = (ab,\\; a\\dot{b} + b\\dot{a})',
    '\\sin(a, \\dot{a}) = (\\sin a,\\; \\dot{a} \\cos a)',
    '\\text{For } f: \\mathbb{R}^n \\to \\mathbb{R}^m,\\; \\text{cost} = O(n) \\text{ passes for full Jacobian}',
  ],
  complexity: {
    time: 'O(n · T(f)) for full Jacobian where T(f) = cost of one function evaluation',
    space: 'O(1) extra memory (no tape)',
    notes: 'One pass computes one Jv product (directional derivative)',
  },
  convergenceOrder: 'Exact (machine precision) — not iterative.',
  parameters: [
    { name: 'Seed vector', symbol: 'v', description: 'Input direction for directional derivative. Use identity basis vectors to compute full Jacobian.' } as AlgorithmParam,
  ],
  strengths: [
    'Memory-efficient: no tape storage',
    'Simple to implement via operator overloading',
    'Efficient when n_inputs << n_outputs',
    'Supports higher-order derivatives via nested dual numbers',
  ],
  weaknesses: [
    'Expensive for large n_inputs (n passes needed)',
    'Not suitable for functions with many inputs and few outputs',
  ],
  guidance:
    'Use forward mode when computing gradients of f: ℝ^n → ℝ^m with n << m. ' +
    'For n >> m (e.g., training neural networks with scalar loss), reverse mode is far more efficient.',
  relatedAlgorithms: ['ad.reverse', 'ad.vjp'],
  references: [
    { title: 'Evaluating Derivatives: Principles and Techniques of Algorithmic Differentiation', authors: 'Griewank, Walther', year: 2008, doi: '10.1137/1.9780898717761' },
  ],
}

const reverseAD: AlgorithmDoc = {
  id: 'ad.reverse',
  name: 'Reverse Mode Automatic Differentiation (Backpropagation)',
  category: 'autodiff',
  shortDescription:
    'Computes full gradients in O(T(f)) by replaying the computation tape backwards.',
  fullDescription:
    'Reverse mode AD (a.k.a. backpropagation for neural networks) computes the gradient ' +
    '∇f in a single reverse sweep after recording the forward computation on a tape (Wengert ' +
    'list). Each intermediate value v_i accumulates a co-tangent v̄_i (partial derivative of ' +
    'the output with respect to v_i). The reverse sweep propagates co-tangents backward through ' +
    'the computational graph. Total cost: 1 forward pass (O(T(f))) + 1 reverse pass (O(T(f))), ' +
    'independent of the number of inputs.',
  equations: [
    '\\text{Forward: record } v_i = \\phi_i(v_{\\text{pa}(i)})',
    '\\bar{v}_i = \\frac{\\partial f}{\\partial v_i} = \\sum_{j: i \\in \\text{pa}(j)} \\bar{v}_j \\frac{\\partial \\phi_j}{\\partial v_i}',
    '\\text{Gradient: } \\nabla_{x_k} f = \\bar{v}_{x_k}',
    '\\text{Total cost} \\le c_r \\cdot T(f) \\text{ (usually } c_r \\le 4)',
  ],
  complexity: {
    time: 'O(c_r · T(f)) — constant multiple of forward pass time, independent of n_inputs',
    space: 'O(T(f)) — tape stores all intermediate values',
    notes: 'Memory can be reduced via gradient checkpointing at O(√T) checkpoints.',
  },
  convergenceOrder: 'Exact (machine precision) — not iterative.',
  parameters: [
    { name: 'Checkpointing segments', symbol: 's', description: 'Number of checkpoints for memory reduction (grad-checkpoint). Memory: O(s·n), recomputation: O(log s) extra passes.', defaultValue: 'none' } as AlgorithmParam,
  ],
  strengths: [
    'Computes full gradient in O(T(f)) regardless of n_inputs — ideal for ML',
    'Foundation of all modern deep learning (backpropagation)',
    'Exact to machine precision',
  ],
  weaknesses: [
    'Memory cost proportional to tape length',
    'Tape construction overhead',
    'Requires re-implementation or tracing for each new function',
  ],
  guidance:
    'Use reverse mode for f: ℝ^n → ℝ with n >> 1 (e.g., neural network training). ' +
    'For Jacobians of f: ℝ^n → ℝ^m with m < n, use VJP (Vector-Jacobian Products) in batch. ' +
    'Enable gradient checkpointing if tape memory exceeds RAM.',
  relatedAlgorithms: ['ad.forward', 'ad.vjp'],
  references: [
    { title: 'Learning representations by back-propagating errors', authors: 'Rumelhart, Hinton, Williams', year: 1986, doi: '10.1038/323533a0' },
    { title: 'Evaluating Derivatives', authors: 'Griewank, Walther', year: 2008 },
  ],
}

const vjp: AlgorithmDoc = {
  id: 'ad.vjp',
  name: 'VJP (Vector-Jacobian Product) / Custom VJP',
  category: 'autodiff',
  shortDescription:
    'User-defined pullback functions for efficient reverse-mode differentiation through custom ops.',
  fullDescription:
    'A VJP (pullback) specifies how co-tangents flow backwards through a custom primitive. ' +
    'For an operation y = f(x), the VJP defines the function g such that x̄ = g(ȳ, x, y), ' +
    'where ȳ is the incoming co-tangent and x̄ is the outgoing co-tangent. ' +
    'Custom VJPs allow efficient closed-form gradients for ops that would be expensive to ' +
    'differentiate symbolically (e.g., iterative solvers, special functions, ODE solutions).',
  equations: [
    '\\text{Forward: } y = f(x)',
    '\\text{Pullback: } \\bar{x} = g(\\bar{y}, x, y) = \\bar{y}^T J_f(x)',
    '\\text{Example (ODE adjoint): } \\bar{x}_0 = -\\int_{t_1}^{t_0} \\lambda^T \\frac{\\partial f}{\\partial x} dt',
    '\\lambda^T = \\bar{y}^T,\\; \\dot{\\lambda} = -\\lambda^T \\frac{\\partial f}{\\partial x}',
  ],
  complexity: {
    time: 'Depends on the custom pullback; can be O(1) for analytical forms',
    space: 'O(1) if pullback is analytical',
    notes: 'Adjoint ODE method for differentiating ODE solutions requires one backward ODE solve.',
  },
  convergenceOrder: 'Exact if the VJP is analytically correct.',
  parameters: [],
  strengths: [
    'Enables exact gradients through iterative algorithms (linear solvers, ODEs)',
    'Can be orders of magnitude faster than differentiating through all iterations',
    'Supports implicit differentiation via implicit function theorem',
  ],
  weaknesses: [
    'Requires mathematical derivation of the pullback',
    'Errors in the custom VJP are not easily detected',
  ],
  guidance:
    'Implement custom VJPs for: ODE/PDE solutions (adjoint method), fixed-point iterations, ' +
    'linear solvers (Ax=b → gradient via adjoint), special functions with known derivatives.',
  relatedAlgorithms: ['ad.reverse', 'ad.forward'],
  references: [
    { title: 'Differentiating through an ODE', authors: 'Chen et al. (Neural ODE)', year: 2018 },
  ],
}

// ---------------------------------------------------------------------------
// Linear Algebra
// ---------------------------------------------------------------------------

const luDecomp: AlgorithmDoc = {
  id: 'linalg.lu',
  name: 'LU Decomposition with Partial Pivoting',
  category: 'linalg',
  shortDescription: 'Factorises A = PLU for dense square matrices; stable basis for linear solves.',
  fullDescription:
    'LU with partial pivoting factorises an n×n matrix A into a permutation matrix P, unit ' +
    'lower triangular L, and upper triangular U such that PA = LU. The factorisation costs ' +
    '2n³/3 FLOP. Once computed, solving Ax = b requires two triangular solves (O(n²)) each. ' +
    'Partial pivoting (choosing the largest pivot in each column) ensures numerical stability ' +
    'with a growth factor bound of 2^(n-1) (rarely achieved in practice).',
  equations: [
    'PA = LU',
    'L_{ij} = a_{ij} / a_{kk} \\text{ (below diagonal)}',
    '\\text{Solve: } Ly = Pb, \\quad Ux = y \\quad \\text{each in } O(n^2)',
    '\\text{Determinant: } \\det(A) = (-1)^\\pi \\prod_i u_{ii}',
  ],
  complexity: { time: 'O(n³) factorisation, O(n²) per solve', space: 'O(n²)' },
  parameters: [
    { name: 'Pivot threshold', symbol: '\\tau', description: 'Threshold for treating a pivot as zero.', defaultValue: 'machine epsilon · ‖A‖' } as AlgorithmParam,
  ],
  strengths: [
    'General: works for any non-singular matrix',
    'Reuse factorisation for multiple right-hand sides',
    'Numerically stable with partial pivoting',
  ],
  weaknesses: [
    'O(n³) cost — impractical for large sparse systems',
    'Dense storage only',
  ],
  guidance: 'Use for small-to-medium dense systems (n ≤ 10,000). For sparse systems use sparse LU (SuperLU) or iterative solvers (CG, GMRES).',
  relatedAlgorithms: ['linalg.cholesky', 'linalg.qr', 'linalg.svd'],
  references: [
    { title: 'Matrix Computations', authors: 'Golub, Van Loan', year: 2013, doi: '10.56021/9781421407944' },
  ],
}

const svd: AlgorithmDoc = {
  id: 'linalg.svd',
  name: 'Singular Value Decomposition (SVD)',
  category: 'linalg',
  shortDescription: 'Factorises A = UΣVᵀ; fundamental for rank determination, pseudoinverse, PCA.',
  fullDescription:
    'The SVD of an m×n matrix A is A = UΣVᵀ, where U (m×m) and V (n×n) are orthogonal ' +
    'and Σ is diagonal with non-negative singular values σ₁ ≥ σ₂ ≥ ··· ≥ 0. ' +
    'The numerical rank is determined by the decay of singular values. Applications: ' +
    'pseudoinverse (A⁺ = VΣ⁺Uᵀ), low-rank approximation (Eckart-Young theorem), ' +
    'principal component analysis, and condition number estimation.',
  equations: [
    'A = U \\Sigma V^T, \\quad U^T U = I,\\; V^T V = I',
    '\\|A - A_k\\|_2 = \\sigma_{k+1} \\quad \\text{(Eckart-Young)}',
    'A^+ = V \\Sigma^+ U^T',
    '\\kappa(A) = \\sigma_1 / \\sigma_n',
  ],
  complexity: { time: 'O(mn · min(m,n)) for m×n matrix (using divide-and-conquer bidiagonalization)', space: 'O(mn)' },
  parameters: [
    { name: 'Truncation rank', symbol: 'k', description: 'For thin SVD / low-rank approx: keep top k singular values.', defaultValue: 'full' } as AlgorithmParam,
  ],
  strengths: [
    'Reveals rank, range, null space, condition number',
    'Optimal low-rank approximation (Eckart-Young)',
    'Numerically stable: no pivoting needed',
    'Foundation for PCA, TLS, compressed sensing',
  ],
  weaknesses: [
    'O(mn²) cost — expensive for large matrices',
    'Overkill if only the solution to Ax=b is needed',
  ],
  guidance: 'Use when rank information, pseudoinverse, or low-rank approximation is needed. For dense square systems prefer LU or Cholesky.',
  relatedAlgorithms: ['linalg.lu', 'linalg.qr', 'linalg.cholesky'],
  references: [
    { title: 'Matrix Computations', authors: 'Golub, Van Loan', year: 2013 },
  ],
}

// ---------------------------------------------------------------------------
// Signal Processing
// ---------------------------------------------------------------------------

const fft: AlgorithmDoc = {
  id: 'signal.fft',
  name: 'Fast Fourier Transform (Cooley-Tukey FFT)',
  category: 'signal',
  shortDescription: 'O(N log N) algorithm for the Discrete Fourier Transform.',
  fullDescription:
    'The Cooley-Tukey radix-2 FFT recursively factors the DFT of length N = 2^k into ' +
    'two DFTs of length N/2 using the "butterfly" pattern, exploiting the periodicity of ' +
    'the complex exponential. This reduces the O(N²) naive DFT to O(N log₂ N). ' +
    'For non-power-of-2 lengths, mixed-radix or Bluestein\'s algorithm is used.',
  equations: [
    'X[k] = \\sum_{n=0}^{N-1} x[n] e^{-j 2\\pi k n / N}',
    '\\text{Butterfly: } X[k] = E[k] + W_N^k O[k],\\; X[k + N/2] = E[k] - W_N^k O[k]',
    'W_N^k = e^{-j 2\\pi k / N} \\quad \\text{(twiddle factor)}',
    '\\text{Parseval: } \\sum_n |x[n]|^2 = \\frac{1}{N} \\sum_k |X[k]|^2',
  ],
  complexity: { time: 'O(N log N)', space: 'O(N)' },
  parameters: [
    { name: 'Window function', symbol: 'w[n]', description: 'Applied before FFT to reduce spectral leakage. Options: rectangular, Hann, Hamming, Blackman.', defaultValue: 'Hann' } as AlgorithmParam,
    { name: 'FFT length', symbol: 'N', description: 'Pad to next power of 2 for efficiency.', defaultValue: 'input length' } as AlgorithmParam,
  ],
  strengths: [
    'O(N log N) — orders of magnitude faster than naive O(N²) DFT',
    'Foundation of spectral analysis, filtering, convolution',
    'rustfft handles arbitrary lengths efficiently',
  ],
  weaknesses: [
    'Spectral leakage for non-integer-period signals without windowing',
    'Frequency resolution limited by N/f_s',
    'Complex output requires magnitude/phase extraction for display',
  ],
  guidance: 'Apply a window function (Hann is default) before FFT. Frequency resolution: Δf = f_s/N. Use zero-padding to interpolate the spectrum.',
  relatedAlgorithms: ['signal.fir', 'signal.stft'],
  references: [
    { title: 'An algorithm for the machine calculation of complex Fourier series', authors: 'Cooley, Tukey', year: 1965, doi: '10.1090/S0025-5718-1965-0178586-1' },
  ],
}

// ---------------------------------------------------------------------------
// Rootfinding
// ---------------------------------------------------------------------------

const brent: AlgorithmDoc = {
  id: 'root.brent',
  name: "Brent's Method",
  category: 'rootfinding',
  shortDescription:
    "Superlinearly convergent bracketed rootfinder combining bisection, secant, and inverse quadratic interpolation.",
  fullDescription:
    "Brent's method guarantees convergence (like bisection) while achieving near-secant " +
    "speed when the function is smooth. At each iteration it uses inverse quadratic interpolation " +
    "or the secant method if they promise improvement, and falls back to bisection otherwise. " +
    "This makes it the default rootfinder in MATLAB (fzero), SciPy (brentq), and GNU GSL.",
  equations: [
    '\\text{Bisection: } c = (a + b)/2',
    '\\text{Secant: } c = b - f(b) \\cdot \\frac{b - a}{f(b) - f(a)}',
    '\\text{Inverse quadratic interpolation: } c = \\frac{a f(b) f(c)}{(f(a)-f(b))(f(a)-f(c))} + \\cdots',
    '\\text{Convergence (smooth): } |x_n - x^*| \\le C |x_{n-1} - x^*|^{\\phi} \\quad (\\phi \\approx 1.618)',
  ],
  complexity: { time: 'O(log((b-a)/ε)) evaluations guaranteed', space: 'O(1)' },
  convergenceOrder: 'Superlinear (golden ratio ≈ 1.618) when smooth; bisection fallback guarantees convergence.',
  parameters: [
    { name: 'Bracket [a, b]', symbol: '[a,b]', description: 'Initial bracket with f(a)·f(b) < 0.', range: 'f(a)·f(b) < 0 required' } as AlgorithmParam,
    { name: 'Tolerance', symbol: '\\varepsilon', defaultValue: '1e-10', description: 'Target bracket width for convergence.' } as AlgorithmParam,
  ],
  strengths: [
    'Guaranteed convergence (bisection safety net)',
    'Near-secant speed for smooth functions',
    'No derivative required',
    'Industry standard implementation',
  ],
  weaknesses: [
    'Requires initial bracket (must know a sign change)',
    'Not suitable for multiple roots without pre-processing',
  ],
  guidance: 'Default choice for scalar rootfinding. Ensure a valid bracket first (use sign scan or plot). For vector problems use Newton-Raphson.',
  relatedAlgorithms: ['root.newton'],
  references: [
    { title: "Algorithms for minimization without derivatives", authors: 'Brent', year: 1973 },
  ],
}

const newton: AlgorithmDoc = {
  id: 'root.newton',
  name: 'Newton-Raphson Method',
  category: 'rootfinding',
  shortDescription: 'Quadratically convergent rootfinder using first-order Taylor expansion.',
  fullDescription:
    'Newton-Raphson iterates x_{n+1} = x_n − f(x_n)/f\'(x_n) by linearising f around ' +
    'the current estimate. Convergence is quadratic (doubles correct digits each iteration) ' +
    'near a simple root. For vector systems, each iteration requires solving a Jacobian linear ' +
    'system (J Δx = −f). Modifications: backtracking line search (robust), chord iteration ' +
    '(freeze Jacobian), Shamanskii (update every k steps).',
  equations: [
    'x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)} \\quad (\\text{scalar})',
    'J(x_n) \\Delta x_n = -f(x_n),\\quad x_{n+1} = x_n + \\Delta x_n \\quad (\\text{vector})',
    '|x_{n+1} - x^*| \\le C |x_n - x^*|^2 \\quad (\\text{quadratic convergence})',
  ],
  complexity: { time: 'O(k · n³) for vector system (n×n Jacobian, k iterations)', space: 'O(n²)' },
  convergenceOrder: 'Quadratic (order 2) near a simple root; linear near a multiple root.',
  parameters: [
    { name: 'Initial guess', symbol: 'x_0', description: 'Starting point. Must be close enough to the root for convergence.' } as AlgorithmParam,
    { name: 'Tolerance', symbol: '\\varepsilon', defaultValue: '1e-10', description: 'Stop when |f(x)| < ε or |Δx| < ε.' } as AlgorithmParam,
    { name: 'Max iterations', symbol: 'k_{max}', defaultValue: '50', description: 'Iteration limit.' } as AlgorithmParam,
  ],
  strengths: [
    'Quadratic convergence — fastest local convergence possible',
    'Generalises to systems via Jacobian',
    'Basis of all implicit solvers (BDF, Radau, collocation)',
  ],
  weaknesses: [
    'Requires derivative (Jacobian for systems)',
    'Convergence only guaranteed locally',
    'Fails near singular Jacobians or multiple roots',
  ],
  guidance: 'Provide a good initial guess (use bisection or parameter continuation to get close). Add backtracking line search for robustness.',
  relatedAlgorithms: ['root.brent'],
  references: [
    { title: 'Numerical Recipes', authors: 'Press, Teukolsky, Vetterling, Flannery', year: 2007 },
  ],
}

// ---------------------------------------------------------------------------
// Numerical Integration
// ---------------------------------------------------------------------------

const gaussKronrod: AlgorithmDoc = {
  id: 'int.gauss_kronrod',
  name: 'Adaptive Gauss-Kronrod Quadrature (GK7-15)',
  category: 'integration',
  shortDescription: 'Adaptive quadrature using nested 7-point Gauss and 15-point Kronrod rules.',
  fullDescription:
    'Gauss-Kronrod quadrature pairs a 7-point Gaussian rule with a 15-point Kronrod extension ' +
    'that reuses the 7 Gauss nodes. The Gauss rule is exact for polynomials of degree ≤ 13, ' +
    'the Kronrod rule for degree ≤ 29. The difference provides an error estimate. The adaptive ' +
    'version (QUADPACK DQAGS) recursively bisects subintervals with large error estimates until ' +
    'the global tolerance is satisfied.',
  equations: [
    'Q_{15} = \\sum_{i=1}^{15} w_i^K f(x_i)',
    'Q_{7} = \\sum_{i=1}^{7} w_i^G f(x_{2i-1})',
    '\\text{Error estimate: } |Q_{15} - Q_7|',
    '\\text{Adaptive: split } [a,b] \\text{ if error} > \\varepsilon_{abs} + \\varepsilon_{rel} |Q|',
  ],
  complexity: { time: 'O(k · 15) function evaluations for k subintervals', space: 'O(k) for the interval stack' },
  convergenceOrder: 'Exponential for analytic functions; algebraic O(h^{2p}) for p-smooth functions.',
  parameters: [
    { name: 'Absolute tolerance', symbol: '\\varepsilon_{abs}', defaultValue: '1e-8', description: 'Absolute error goal.' } as AlgorithmParam,
    { name: 'Relative tolerance', symbol: '\\varepsilon_{rel}', defaultValue: '1e-6', description: 'Relative error goal.' } as AlgorithmParam,
    { name: 'Max subintervals', symbol: 'n_{max}', defaultValue: '1000', description: 'Limit on adaptive refinement.' } as AlgorithmParam,
  ],
  strengths: [
    'Highly accurate for smooth integrands',
    'Automatic error estimation and adaptation',
    'Handles endpoint singularities with proper transformation',
    'Used in MATLAB integral(), SciPy quad()',
  ],
  weaknesses: [
    'Expensive for high-dimensional integrals (curse of dimensionality)',
    'Can fail for highly oscillatory integrands without specialised rules',
  ],
  guidance: 'Default for 1D quadrature of smooth functions. For oscillatory integrands use Clenshaw-Curtis or Filon. For d>5 dimensions use Monte Carlo.',
  relatedAlgorithms: ['int.monte_carlo', 'int.clenshaw_curtis'],
  references: [
    { title: 'QUADPACK: A Subroutine Package for Automatic Integration', authors: 'Piessens et al.', year: 1983 },
  ],
}

// ---------------------------------------------------------------------------
// Machine Learning
// ---------------------------------------------------------------------------

const linearRegression: AlgorithmDoc = {
  id: 'ml.linear_regression',
  name: 'Linear Regression (Ordinary Least Squares)',
  category: 'ml',
  shortDescription: 'Minimises ‖Xβ − y‖² via normal equations or QR decomposition.',
  fullDescription:
    'OLS linear regression finds the coefficient vector β that minimises the sum of squared ' +
    'residuals. The closed-form solution β = (XᵀX)⁻¹Xᵀy is computed via the normal equations, ' +
    'but numerically the QR decomposition of X is preferred for stability. Regularised variants: ' +
    'Ridge (L2), LASSO (L1), Elastic Net.',
  equations: [
    '\\min_\\beta \\|X\\beta - y\\|_2^2',
    '\\hat{\\beta} = (X^T X)^{-1} X^T y \\quad \\text{(normal equations)}',
    '\\hat{\\beta} = R^{-1} Q^T y \\quad \\text{(QR, numerically preferred)}',
    '\\text{Ridge: } \\hat{\\beta}_\\lambda = (X^T X + \\lambda I)^{-1} X^T y',
  ],
  complexity: { time: 'O(np²) for QR (n samples, p features)', space: 'O(np)' },
  parameters: [
    { name: 'Regularisation', symbol: '\\lambda', description: 'L2 penalty (Ridge). 0 = no regularisation.', defaultValue: '0.0', range: '[0, ∞)' } as AlgorithmParam,
  ],
  strengths: [
    'Closed-form solution — no iteration',
    'Interpretable coefficients',
    'Optimal (BLUE) under Gauss-Markov assumptions',
  ],
  weaknesses: [
    'Assumes linear relationship',
    'Sensitive to outliers without robust modifications',
    'Multicollinearity requires regularisation',
  ],
  guidance: 'Use as baseline for regression tasks. Add Ridge (λ>0) for correlated features. Use LASSO for feature selection.',
  relatedAlgorithms: ['ml.knn', 'ml.decision_tree'],
  references: [
    { title: 'The Elements of Statistical Learning', authors: 'Hastie, Tibshirani, Friedman', year: 2009, doi: '10.1007/978-0-387-84858-7' },
  ],
}

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

const cubicSpline: AlgorithmDoc = {
  id: 'interp.cubic_spline',
  name: 'Cubic Spline Interpolation',
  category: 'interpolation',
  shortDescription: 'C² piecewise cubic interpolant through n data points.',
  fullDescription:
    'Cubic spline interpolation constructs a piecewise cubic polynomial S(x) passing through ' +
    'all n data points with continuous first and second derivatives (C² globally). This avoids ' +
    'the Runge phenomenon of high-degree polynomial interpolation. Boundary conditions: ' +
    'natural (S\'\'=0 at ends), clamped (S\'=known), not-a-knot (third derivative continuous ' +
    'across first/last interior knot). The coefficients are found by solving a tridiagonal ' +
    'linear system in O(n).',
  equations: [
    'S_i(x) = a_i + b_i(x-x_i) + c_i(x-x_i)^2 + d_i(x-x_i)^3',
    'S_i(x_{i+1}) = S_{i+1}(x_{i+1}),\\; S\'_i = S\'_{i+1},\\; S\'\'_i = S\'\'_{i+1}',
    'h_i c_{i-1} + 2(h_i + h_{i+1}) c_i + h_{i+1} c_{i+1} = 3 \\left(\\frac{y_{i+1}-y_i}{h_{i+1}} - \\frac{y_i - y_{i-1}}{h_i}\\right)',
    '\\text{Error: } |f(x) - S(x)| \\le \\frac{5}{384} h^4 \\max |f^{(4)}|',
  ],
  complexity: { time: 'O(n) to build (tridiagonal solve), O(log n) to evaluate (binary search)', space: 'O(n)' },
  convergenceOrder: 'O(h⁴) as max knot spacing h → 0.',
  parameters: [
    { name: 'Boundary condition', symbol: '—', description: 'Natural, clamped, or not-a-knot.', defaultValue: 'not-a-knot' } as AlgorithmParam,
  ],
  strengths: [
    'Smooth (C²), no Runge phenomenon',
    'O(n) construction',
    'Accurate: O(h⁴) error',
  ],
  weaknesses: [
    'Global: changing one point affects all segments',
    'Can oscillate for data with sharp changes (use Akima instead)',
  ],
  guidance: 'Default interpolation for smooth data. Use Akima for data with isolated sharp features. Use B-spline for noisy data (approximation rather than interpolation).',
  relatedAlgorithms: ['interp.akima', 'interp.bspline'],
  references: [
    { title: 'Numerical Analysis', authors: 'Burden, Faires', year: 2010 },
  ],
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const ALGORITHM_DOCS: AlgorithmDoc[] = [
  // ODE
  rk4, rk45, bdf, radau,
  // Optimisation
  gradientDescent, lbfgs, nelderMead, nsga2, simplex,
  // Autodiff
  forwardAD, reverseAD, vjp,
  // Linear algebra
  luDecomp, svd,
  // Signal
  fft,
  // Rootfinding
  brent, newton,
  // Integration
  gaussKronrod,
  // ML
  linearRegression,
  // Interpolation
  cubicSpline,
]

export const ALGORITHM_CATALOG: Record<AlgorithmCategory, AlgorithmDoc[]> = {
  ode: ALGORITHM_DOCS.filter((d) => d.category === 'ode'),
  optimisation: ALGORITHM_DOCS.filter((d) => d.category === 'optimisation'),
  autodiff: ALGORITHM_DOCS.filter((d) => d.category === 'autodiff'),
  linalg: ALGORITHM_DOCS.filter((d) => d.category === 'linalg'),
  signal: ALGORITHM_DOCS.filter((d) => d.category === 'signal'),
  rootfinding: ALGORITHM_DOCS.filter((d) => d.category === 'rootfinding'),
  interpolation: ALGORITHM_DOCS.filter((d) => d.category === 'interpolation'),
  integration: ALGORITHM_DOCS.filter((d) => d.category === 'integration'),
  ml: ALGORITHM_DOCS.filter((d) => d.category === 'ml'),
  statistics: ALGORITHM_DOCS.filter((d) => d.category === 'statistics'),
  symbolic: ALGORITHM_DOCS.filter((d) => d.category === 'symbolic'),
}

/** Look up an algorithm doc by its id (e.g. 'ode.rk45'). */
export function getAlgorithmDoc(id: string): AlgorithmDoc | undefined {
  return ALGORITHM_DOCS.find((d) => d.id === id)
}

/** Full-text search across name, short description, and guidance. */
export function searchAlgorithmDocs(query: string): AlgorithmDoc[] {
  const q = query.toLowerCase()
  return ALGORITHM_DOCS.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.shortDescription.toLowerCase().includes(q) ||
      d.fullDescription.toLowerCase().includes(q) ||
      d.guidance.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q),
  )
}

/** Return all docs for a given category. */
export function getDocsByCategory(category: AlgorithmCategory): AlgorithmDoc[] {
  return ALGORITHM_CATALOG[category] ?? []
}
