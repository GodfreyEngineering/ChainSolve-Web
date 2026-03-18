/**
 * latexGen.ts — CSEL AST → LaTeX code generator (4.17).
 *
 * Converts a parsed ChainSolve Expression Language AST into a LaTeX
 * math-mode string suitable for pasting into papers and reports.
 *
 * Features:
 *   - Binary ops with proper fraction layout (a/b → \frac{a}{b})
 *   - Power: x^n → x^{n}, handles compound exponents
 *   - Named functions: sin, cos, tan, exp, ln, sqrt, abs → \sin, \cos, …
 *   - Constants: pi → \pi, e → e, tau → \tau, phi → \varphi
 *   - Operator precedence: inserts parens only where necessary
 *   - Assignment: x = expr → x = expr (natural)
 *   - Display (trailing =): the expression + = (for display blocks)
 */

import type { CselNode, CselProgram } from './types'

// ── Constant / function name mappings ───────────────────────────────────────

const CONST_MAP: Record<string, string> = {
  pi: '\\pi',
  tau: '\\tau',
  phi: '\\varphi',
  e: 'e',
  inf: '\\infty',
}

const FUNC_MAP: Record<string, string> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  asin: '\\arcsin',
  acos: '\\arccos',
  atan: '\\arctan',
  atan2: '\\text{atan2}',
  sinh: '\\sinh',
  cosh: '\\cosh',
  tanh: '\\tanh',
  exp: '\\exp',
  ln: '\\ln',
  log: '\\log',
  log2: '\\log_2',
  log10: '\\log_{10}',
  sqrt: '\\sqrt',
  abs: '\\left|',
  ceil: '\\lceil',
  floor: '\\lfloor',
  round: '\\text{round}',
  sign: '\\text{sign}',
  max: '\\max',
  min: '\\min',
  sum: '\\sum',
}

// ── Precedence levels for parenthesisation ───────────────────────────────────

function precedence(op: string): number {
  if (op === '+' || op === '-') return 1
  if (op === '*') return 2
  if (op === '/') return 3 // handled separately (frac)
  if (op === '^') return 4
  return 0
}

// ── Core generator ───────────────────────────────────────────────────────────

/**
 * Generate LaTeX for a single CSEL node.
 * @param node  The AST node to render
 * @param parentPrec  Operator precedence of the enclosing context (for parens)
 */
function gen(node: CselNode, parentPrec = 0): string {
  switch (node.type) {
    case 'literal': {
      // Use integer display when whole number; full precision otherwise
      const v = node.value
      if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v)
      return String(v)
    }

    case 'identifier': {
      return CONST_MAP[node.name] ?? node.name
    }

    case 'unary': {
      const inner = gen(node.operand, 3)
      return `-${inner}`
    }

    case 'binary': {
      const { op, left, right } = node

      // Division → \frac{num}{den}
      if (op === '/') {
        return `\\frac{${gen(left)}}{${gen(right)}}`
      }

      const myPrec = precedence(op)

      // Power → base^{exp}
      if (op === '^') {
        const baseStr = gen(left, myPrec + 1)
        const expStr = gen(right)
        const base =
          left.type === 'binary' || left.type === 'call' ? `\\left(${gen(left)}\\right)` : baseStr
        return `${base}^{${expStr}}`
      }

      // Multiplication: omit \cdot between identifier/number pairs
      if (op === '*') {
        const l = gen(left, myPrec)
        const r = gen(right, myPrec)
        // If right is a simple identifier or number, use implicit multiply
        const useImplicit =
          right.type === 'identifier' || (right.type === 'literal' && left.type !== 'literal')
        const joiner = useImplicit ? ' ' : ' \\cdot '
        const lParen = precedence_of(left) < myPrec ? `\\left(${l}\\right)` : l
        const rParen = precedence_of(right) < myPrec ? `\\left(${r}\\right)` : r
        return `${lParen}${joiner}${rParen}`
      }

      // Addition/subtraction
      const l = gen(left, myPrec)
      const r = gen(right, myPrec)
      const lParen = precedence_of(left) < myPrec ? `\\left(${l}\\right)` : l
      // For subtraction, wrap if right precedence is same (a-(b-c) needs parens)
      const needsRParen =
        op === '-' && right.type === 'binary' && (right.op === '+' || right.op === '-')
      const rParen = needsRParen ? `\\left(${r}\\right)` : r

      const opStr = op === '+' ? ' + ' : ' - '
      const expr = `${lParen}${opStr}${rParen}`
      return parentPrec > myPrec ? `\\left(${expr}\\right)` : expr
    }

    case 'call': {
      const { name, args } = node

      // sqrt: single arg → \sqrt{arg}
      if (name === 'sqrt' && args.length === 1) {
        return `\\sqrt{${gen(args[0])}}`
      }

      // abs: |arg|
      if (name === 'abs' && args.length === 1) {
        return `\\left|${gen(args[0])}\\right|`
      }

      // ceil / floor
      if (name === 'ceil' && args.length === 1) {
        return `\\left\\lceil ${gen(args[0])}\\right\\rceil`
      }
      if (name === 'floor' && args.length === 1) {
        return `\\left\\lfloor ${gen(args[0])}\\right\\rfloor`
      }

      const fn = FUNC_MAP[name] ?? `\\text{${name}}`
      const argsStr = args.map((a) => gen(a)).join(', ')
      return `${fn}\\left(${argsStr}\\right)`
    }

    case 'assign': {
      return `${CONST_MAP[node.name] ?? node.name} = ${gen(node.value)}`
    }

    case 'display': {
      return gen(node.expr)
    }
  }
}

/**
 * Effective precedence of a node for parenthesisation decisions.
 */
function precedence_of(node: CselNode): number {
  if (node.type === 'binary') return precedence(node.op)
  return 99 // literals, identifiers, calls — never need outer parens
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a CSEL program (list of statements) to LaTeX.
 *
 * Multiple statements are joined with `;\\;` (LaTeX thick space + semicolon).
 * Assignment statements produce `x = expr`.
 * Display statements produce just `expr`.
 *
 * The result is suitable for wrapping in `$...$` or `\[...\]`.
 */
export function cselToLatex(program: CselProgram): string {
  return program
    .map((stmt) => gen(stmt))
    .filter(Boolean)
    .join(' ;\\; ')
}

/**
 * Convert a single CSEL expression string to LaTeX.
 * Returns `null` on parse error.
 */
export function expressionToLatex(_expr: string): string | null {
  // Dynamic import avoided — caller passes pre-parsed program if available.
  // For direct use, expose via the formula bar which already has the parser.
  // This is the raw single-node generator.
  return null // placeholder — see FormulaBar integration
}
