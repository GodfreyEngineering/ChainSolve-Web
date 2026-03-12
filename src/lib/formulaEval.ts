/**
 * formulaEval.ts — CSP-safe math expression evaluator (no eval / new Function).
 *
 * Supports:
 * - Numeric literals (integer, decimal, scientific notation)
 * - Binary operators: + - * / ^ (right-assoc power)
 * - Unary operators: - +
 * - Parenthesised sub-expressions
 * - Named constants: pi, tau, phi, e
 * - Math functions: sqrt, abs, sin, cos, tan, asin, acos, atan, atan2,
 *   log (log10), log10, ln (natural log), exp, floor, ceil, round,
 *   min, max, hypot, pow
 */

// ── Constants and functions ──────────────────────────────────────────────────

const CONSTANTS: Readonly<Record<string, number>> = {
  pi: Math.PI,
  tau: 2 * Math.PI,
  phi: (1 + Math.sqrt(5)) / 2,
  e: Math.E,
  inf: Infinity,
}

const FUNCTIONS: Readonly<Record<string, (...args: number[]) => number>> = {
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x),
  abs: (x) => Math.abs(x),
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  asin: (x) => Math.asin(x),
  acos: (x) => Math.acos(x),
  atan: (x) => Math.atan(x),
  atan2: (y, x) => Math.atan2(y, x),
  log10: (x) => Math.log10(x),
  log: (x) => Math.log10(x), // "log" = log base 10
  ln: (x) => Math.log(x),
  exp: (x) => Math.exp(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  round: (x) => Math.round(x),
  trunc: (x) => Math.trunc(x),
  sign: (x) => Math.sign(x),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  hypot: (...args) => Math.hypot(...args),
  pow: (base, exp) => Math.pow(base, exp),
  deg: (x) => x * (180 / Math.PI), // radians → degrees
  rad: (x) => x * (Math.PI / 180), // degrees → radians
}

// ── Tokeniser ────────────────────────────────────────────────────────────────

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'eof' }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    // Whitespace
    if (/\s/.test(ch)) {
      i++
      continue
    }

    // Number: digits, optional dot, optional exponent
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i
      while (j < input.length && /[0-9.]/.test(input[j])) j++
      if (j < input.length && (input[j] === 'e' || input[j] === 'E')) {
        j++
        if (j < input.length && (input[j] === '+' || input[j] === '-')) j++
        while (j < input.length && /[0-9]/.test(input[j])) j++
      }
      tokens.push({ type: 'num', value: parseFloat(input.slice(i, j)) })
      i = j
      continue
    }

    // Identifier (constants/functions)
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i
      while (j < input.length && /[a-zA-Z_0-9]/.test(input[j])) j++
      tokens.push({ type: 'ident', value: input.slice(i, j).toLowerCase() })
      i = j
      continue
    }

    // Operators and punctuation
    if ('+-*/^'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' })
      i++
      continue
    }

    throw new Error(`Unexpected character: '${ch}' at position ${i}`)
  }

  tokens.push({ type: 'eof' })
  return tokens
}

// ── Recursive-descent parser (Pratt-style) ───────────────────────────────────

class Parser {
  private pos = 0
  private readonly tokens: Token[]
  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  peek(): Token {
    return this.tokens[this.pos]
  }

  consume(): Token {
    return this.tokens[this.pos++]
  }

  /** Binary operator precedence (higher = tighter binding). */
  private binaryPrec(op: string): number {
    if (op === '+' || op === '-') return 1
    if (op === '*' || op === '/') return 2
    if (op === '^') return 3
    return -1
  }

  /** Parse expression with minimum precedence (Pratt parsing). */
  parseExpr(minPrec = 0): number {
    let left = this.parseUnary()

    while (true) {
      const tok = this.peek()
      if (tok.type !== 'op') break
      const prec = this.binaryPrec(tok.value)
      if (prec <= minPrec) break
      this.consume()
      // Right-associative: ^ uses prec-1 so equal-prec chains also go right
      const right = tok.value === '^' ? this.parseExpr(prec - 1) : this.parseExpr(prec)
      switch (tok.value) {
        case '+':
          left = left + right
          break
        case '-':
          left = left - right
          break
        case '*':
          left = left * right
          break
        case '/':
          left = left / right
          break
        case '^':
          left = Math.pow(left, right)
          break
      }
    }

    return left
  }

  parseUnary(): number {
    const tok = this.peek()
    if (tok.type === 'op' && tok.value === '-') {
      this.consume()
      return -this.parseUnary()
    }
    if (tok.type === 'op' && tok.value === '+') {
      this.consume()
      return this.parseUnary()
    }
    return this.parsePrimary()
  }

  parsePrimary(): number {
    const tok = this.consume()

    if (tok.type === 'num') return tok.value

    if (tok.type === 'lparen') {
      const val = this.parseExpr(0)
      const closing = this.consume()
      if (closing.type !== 'rparen') throw new Error('Expected closing )')
      return val
    }

    if (tok.type === 'ident') {
      const name = tok.value
      // Named constant
      if (name in CONSTANTS) return CONSTANTS[name]
      // Function call
      if (name in FUNCTIONS) {
        const lp = this.consume()
        if (lp.type !== 'lparen') throw new Error(`Expected '(' after '${name}'`)
        const args: number[] = []
        if (this.peek().type !== 'rparen') {
          args.push(this.parseExpr(0))
          while (this.peek().type === 'comma') {
            this.consume()
            args.push(this.parseExpr(0))
          }
        }
        const rp = this.consume()
        if (rp.type !== 'rparen') throw new Error(`Expected ')' after args to '${name}'`)
        return FUNCTIONS[name](...args)
      }
      throw new Error(`Unknown identifier: '${name}'`)
    }

    throw new Error(`Unexpected token: ${JSON.stringify(tok)}`)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate a math expression string.
 * Returns the numeric result, or null if the expression is invalid.
 * Never throws.
 */
export function safeEvalFormula(expr: string): number | null {
  const trimmed = expr.trim()
  if (!trimmed) return null
  try {
    const tokens = tokenize(trimmed)
    const parser = new Parser(tokens)
    const result = parser.parseExpr(0)
    // Ensure all tokens consumed (no trailing garbage)
    if (parser.peek().type !== 'eof') return null
    if (typeof result === 'number' && isFinite(result)) return result
    return null
  } catch {
    return null
  }
}
