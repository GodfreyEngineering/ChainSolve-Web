/**
 * sym-blocks.ts — Symbolic mathematics (CAS) block pack.
 *
 * Blocks for symbolic differentiation, integration, simplification,
 * expansion, and substitution. Results are returned as LaTeX strings.
 * Backed by the Rust CAS in engine-core/src/symbolic.rs.
 */

import type { BlockDef } from './types'

export function registerSymBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'sym.differentiate',
    label: 'Differentiate',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'expr', label: 'Expression (text)' },
      { id: 'var', label: 'Variable (text)' },
    ],
    defaultData: { blockType: 'sym.differentiate', label: 'Differentiate', var: 'x' },
    synonyms: ['differentiate', 'derivative', 'd/dx', 'symbolic derivative'],
    tags: ['sym', 'calculus', 'derivative'],
    description:
      'Symbolic differentiation: computes d(expr)/d(var). Input expression as text (e.g. "x^2 + sin(x)"). Returns LaTeX string.',
  })

  register({
    type: 'sym.integrate',
    label: 'Integrate',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'expr', label: 'Expression (text)' },
      { id: 'var', label: 'Variable (text)' },
    ],
    defaultData: { blockType: 'sym.integrate', label: 'Integrate', var: 'x' },
    synonyms: ['integrate', 'antiderivative', 'integral', 'symbolic integration'],
    tags: ['sym', 'calculus', 'integral'],
    description:
      'Symbolic integration: computes ∫expr d(var). Returns LaTeX string, or "no elementary antiderivative" if Risch algorithm cannot find one.',
  })

  register({
    type: 'sym.simplify',
    label: 'Simplify',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [{ id: 'expr', label: 'Expression (text)' }],
    defaultData: { blockType: 'sym.simplify', label: 'Simplify' },
    synonyms: ['simplify', 'reduce', 'symbolic simplification'],
    tags: ['sym', 'algebra'],
    description:
      'Simplifies a symbolic expression: cancels zeros, collapses constants, applies trig identities. Returns LaTeX string.',
  })

  register({
    type: 'sym.expand',
    label: 'Expand',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [{ id: 'expr', label: 'Expression (text)' }],
    defaultData: { blockType: 'sym.expand', label: 'Expand' },
    synonyms: ['expand', 'distribute', 'FOIL', 'polynomial expansion'],
    tags: ['sym', 'algebra', 'polynomial'],
    description:
      'Expands a symbolic expression: distributes multiplication over addition. E.g. (x+1)^2 → x^2 + 2x + 1. Returns LaTeX string.',
  })

  register({
    type: 'sym.substitute',
    label: 'Substitute',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'expr', label: 'Expression (text)' },
      { id: 'var', label: 'Variable (text)' },
      { id: 'value', label: 'Value (scalar)' },
    ],
    defaultData: { blockType: 'sym.substitute', label: 'Substitute', var: 'x' },
    synonyms: ['substitute', 'replace', 'plug in', 'evaluate at'],
    tags: ['sym', 'algebra'],
    description:
      'Substitutes a numeric value for a variable in a symbolic expression. Returns simplified LaTeX string.',
  })

  register({
    type: 'sym.compiledEval',
    label: 'Compiled Eval',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: {
      blockType: 'sym.compiledEval',
      label: 'Compiled Eval',
      expr: 'x^2 + y',
    },
    synonyms: ['compiled eval', 'expression eval', 'fast eval', 'jit', 'compiled expression'],
    tags: ['sym', 'expression', 'evaluation', 'performance'],
    description:
      'Evaluates a mathematical expression with pre-compiled AST (no re-parsing on repeated calls). Set expr="x^2+sin(y)" and connect input ports with matching names (x, y, etc.). Equivalent to a custom function but faster in loops. Used internally by ODE solvers for JIT equation compilation.',
  })

  register({
    type: 'sym.expressionInput',
    label: 'Expression Input',
    category: 'input',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: {
      blockType: 'sym.expressionInput',
      label: 'Expression Input',
      expr: 'x^2 + sin(x)',
    },
    synonyms: ['expression input', 'symbolic input', 'formula input', 'math expression', 'latex'],
    tags: ['sym', 'input', 'expression', 'latex', 'symbolic'],
    description:
      'Symbolic expression source block: type a mathematical expression (e.g. "x^2 + sin(x)"). Parses via the symbolic CAS and outputs the expression as a LaTeX string. Connect to Differentiate, Integrate, Simplify, Substitute, or Compiled Eval blocks.',
  })

  register({
    type: 'ad.mixedJacobian',
    label: 'Mixed-Mode Jacobian',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [{ id: 'x', label: 'Eval point (vector)' }],
    defaultData: {
      blockType: 'ad.mixedJacobian',
      label: 'Mixed-Mode Jacobian',
      expressions: 'x*y, x^2+y',
      var_names: 'x,y',
      x: '1,1',
      threshold: 1.0,
    },
    synonyms: ['jacobian', 'mixed mode AD', 'automatic differentiation', 'gradient', 'forward AD', 'reverse AD'],
    tags: ['ad', 'autodiff', 'jacobian', 'gradient', 'differentiation'],
    description:
      'Mixed-mode automatic differentiation: computes the Jacobian of a vector function using forward-mode dual-number AD. Selects forward mode (reported) when n_inputs ≤ threshold × n_outputs, reverse otherwise. expressions: comma-separated output expressions (e.g. "x*y, x^2+y"). var_names: comma-separated variable names. x: evaluation point as Vector port or comma-separated data. Returns Jacobian as Table.',
  })

  register({
    type: 'ad.linSolveSens',
    label: 'Linear Solve Sensitivity',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: {
      A_exprs: 'k;0;0;1',
      b_exprs: '1;1',
      param_names: 'k',
      param_values: '1',
      fd_eps: 1e-6,
    },
    synonyms: ['implicit differentiation', 'linear system', 'sensitivity', 'IFT', 'Ax=b'],
    tags: ['ad', 'linear', 'sensitivity', 'implicit'],
    description:
      'AD through linear solvers via implicit function theorem. Given A(p)x = b(p), computes dx/dp_k = A⁻¹·(db/dp_k − (dA/dp_k)·x) for each parameter. Set A_exprs (semicolon-separated row-major n²entries), b_exprs (n entries), param_names, param_values. Returns Table [param_idx, dx0/dp, dx1/dp, ...].',
  })

  register({
    type: 'ad.odeAdjoint',
    label: 'ODE Adjoint Sensitivity',
    category: 'simulation',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: {
      equations: '-k*y0',
      param_names: 'k',
      objective: '0.5*y0^2',
      t_start: 0,
      t_end: 1,
      dt: 0.01,
      n_checkpoints: 0,
      fd_eps: 1e-6,
    },
    synonyms: ['adjoint', 'sensitivity', 'gradient', 'ODE', 'parameter estimation', 'PINNs'],
    tags: ['ode', 'adjoint', 'ad', 'sensitivity'],
    description:
      'Discrete adjoint method: computes dJ/dp — the gradient of a scalar objective J w.r.t. ODE parameters p — without storing the full forward trajectory. Set equations (semicolon-separated dy_i/dt), param_names (comma-separated), and objective (expression of final state y0, y1, …). Returns Table [param_idx, gradient, objective].',
  })

  register({
    type: 'sym.groebner',
    label: 'Gröbner Basis',
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [{ id: 'polynomials', label: 'Polynomials (text)' }],
    defaultData: {
      blockType: 'sym.groebner',
      label: 'Gröbner Basis',
      variables: 'x,y',
      order: 'grevlex',
      mode: 'basis',
      max_iter: 10000,
    },
    synonyms: ['groebner', 'grobner', 'buchberger', 'polynomial system', 'ideal basis', 'polynomial solve'],
    tags: ['sym', 'algebra', 'polynomial', 'groebner'],
    description:
      'Gröbner basis (Buchberger\'s algorithm): computes a canonical basis for a polynomial ideal. Input: semicolon-separated polynomial expressions (e.g. "x^2+y-1;x+y^2-1"), variables field (comma-separated). order: "grevlex" (default), "lex", "grlex". mode: "basis" (return basis polynomials) or "solve" (find solutions for zero-dimensional ideals). Returns Text.',
  })
}
