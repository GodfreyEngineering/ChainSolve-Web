/**
 * CSEL Parser — recursive descent parser producing an AST.
 *
 * Grammar:
 *   program    = statement (';' statement)*
 *   statement  = assignment | display | expr
 *   assignment = IDENT '=' expr
 *   display    = expr '='            (trailing '=' creates Display block)
 *   expr       = term (('+' | '-') term)*
 *   term       = power (('*' | '/') power)*
 *   power      = unary ('^' unary)*   (right-associative)
 *   unary      = '-' unary | call
 *   call       = IDENT '(' args ')' | primary
 *   primary    = NUMBER | IDENT | '(' expr ')'
 */

import type { Token } from './lexer.ts'
import type { CselNode, CselProgram } from './types.ts'
import { tokenize } from './lexer.ts'

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private advance(): Token {
    const t = this.tokens[this.pos]
    this.pos++
    return t
  }

  private expect(type: Token['type']): Token {
    const t = this.peek()
    if (t.type !== type) {
      throw { message: `Expected ${type}, got ${t.type} '${t.value}'`, position: t.position }
    }
    return this.advance()
  }

  parse(): CselProgram {
    const stmts: CselNode[] = []
    while (this.peek().type !== 'eof') {
      stmts.push(this.statement())
      // Consume optional semicolons between statements
      while (this.peek().type === 'semicolon') this.advance()
    }
    return stmts
  }

  private statement(): CselNode {
    // Check for assignment: IDENT '=' expr (but not '==' or trailing '=')
    if (
      this.peek().type === 'identifier' &&
      this.pos + 1 < this.tokens.length &&
      this.tokens[this.pos + 1].type === 'equals' &&
      this.pos + 2 < this.tokens.length &&
      this.tokens[this.pos + 2].type !== 'eof' &&
      this.tokens[this.pos + 2].type !== 'semicolon'
    ) {
      const name = this.advance().value
      this.advance() // consume '='
      const value = this.expr()
      return { type: 'assign', name, value }
    }

    const e = this.expr()

    // Trailing '=' means display the result
    if (this.peek().type === 'equals') {
      this.advance()
      return { type: 'display', expr: e }
    }

    return e
  }

  private expr(): CselNode {
    let left = this.term()
    while (this.peek().type === 'plus' || this.peek().type === 'minus') {
      const op = this.advance().value as '+' | '-'
      const right = this.term()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  private term(): CselNode {
    let left = this.power()
    while (this.peek().type === 'star' || this.peek().type === 'slash') {
      const op = this.advance().value as '*' | '/'
      const right = this.power()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  private power(): CselNode {
    const base = this.unary()
    if (this.peek().type === 'caret') {
      this.advance()
      const exp = this.power() // right-associative
      return { type: 'binary', op: '^', left: base, right: exp }
    }
    return base
  }

  private unary(): CselNode {
    if (this.peek().type === 'minus') {
      this.advance()
      const operand = this.unary()
      return { type: 'unary', op: '-', operand }
    }
    return this.call()
  }

  private call(): CselNode {
    if (
      this.peek().type === 'identifier' &&
      this.pos + 1 < this.tokens.length &&
      this.tokens[this.pos + 1].type === 'lparen'
    ) {
      const name = this.advance().value
      this.advance() // consume '('
      const args: CselNode[] = []
      if (this.peek().type !== 'rparen') {
        args.push(this.expr())
        while (this.peek().type === 'comma') {
          this.advance()
          args.push(this.expr())
        }
      }
      this.expect('rparen')
      return { type: 'call', name, args }
    }
    return this.primary()
  }

  private primary(): CselNode {
    const t = this.peek()
    if (t.type === 'number') {
      this.advance()
      return { type: 'literal', value: parseFloat(t.value) }
    }
    if (t.type === 'identifier') {
      this.advance()
      return { type: 'identifier', name: t.value }
    }
    if (t.type === 'lparen') {
      this.advance()
      const e = this.expr()
      this.expect('rparen')
      return e
    }
    throw { message: `Unexpected token: ${t.type} '${t.value}'`, position: t.position }
  }
}

/**
 * Parse a CSEL expression string into an AST.
 * Returns the program AST or throws a CselError.
 */
export function parseCsel(input: string): CselProgram {
  const tokens = tokenize(input)
  const parser = new Parser(tokens)
  return parser.parse()
}
