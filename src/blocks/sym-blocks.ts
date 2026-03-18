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
