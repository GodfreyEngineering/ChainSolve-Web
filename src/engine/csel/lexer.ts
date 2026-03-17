/**
 * CSEL Lexer — tokenises an expression string into tokens.
 */

export type TokenType =
  | 'number'
  | 'identifier'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'caret'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'equals'
  | 'semicolon'
  | 'pipe'
  | 'arrow'
  | 'eof'

export interface Token {
  type: TokenType
  value: string
  position: number
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    // Numbers (including decimals and scientific notation)
    if (ch >= '0' && ch <= '9') {
      const start = i
      while (i < input.length && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) i++
      if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
        i++
        if (i < input.length && (input[i] === '+' || input[i] === '-')) i++
        while (i < input.length && input[i] >= '0' && input[i] <= '9') i++
      }
      tokens.push({ type: 'number', value: input.slice(start, i), position: start })
      continue
    }
    // Also handle .5 style numbers
    if (ch === '.' && i + 1 < input.length && input[i + 1] >= '0' && input[i + 1] <= '9') {
      const start = i
      i++
      while (i < input.length && input[i] >= '0' && input[i] <= '9') i++
      tokens.push({ type: 'number', value: input.slice(start, i), position: start })
      continue
    }

    // Identifiers (a-z, A-Z, _, unicode letters, dots for namespaced ops)
    if (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch === '_' ||
      ch.charCodeAt(0) > 127
    ) {
      const start = i
      while (
        i < input.length &&
        ((input[i] >= 'a' && input[i] <= 'z') ||
          (input[i] >= 'A' && input[i] <= 'Z') ||
          (input[i] >= '0' && input[i] <= '9') ||
          input[i] === '_' ||
          input[i] === '.' ||
          input[i].charCodeAt(0) > 127)
      )
        i++
      tokens.push({ type: 'identifier', value: input.slice(start, i), position: start })
      continue
    }

    // Operators and punctuation
    const pos = i
    switch (ch) {
      case '+':
        tokens.push({ type: 'plus', value: '+', position: pos })
        i++
        break
      case '-':
        // Check for arrow ->
        if (i + 1 < input.length && input[i + 1] === '>') {
          tokens.push({ type: 'arrow', value: '->', position: pos })
          i += 2
        } else {
          tokens.push({ type: 'minus', value: '-', position: pos })
          i++
        }
        break
      case '*':
        tokens.push({ type: 'star', value: '*', position: pos })
        i++
        break
      case '/':
        tokens.push({ type: 'slash', value: '/', position: pos })
        i++
        break
      case '^':
        tokens.push({ type: 'caret', value: '^', position: pos })
        i++
        break
      case '(':
        tokens.push({ type: 'lparen', value: '(', position: pos })
        i++
        break
      case ')':
        tokens.push({ type: 'rparen', value: ')', position: pos })
        i++
        break
      case ',':
        tokens.push({ type: 'comma', value: ',', position: pos })
        i++
        break
      case '=':
        tokens.push({ type: 'equals', value: '=', position: pos })
        i++
        break
      case ';':
        tokens.push({ type: 'semicolon', value: ';', position: pos })
        i++
        break
      case '|':
        tokens.push({ type: 'pipe', value: '|', position: pos })
        i++
        break
      default:
        // Skip unknown characters
        i++
        break
    }
  }

  tokens.push({ type: 'eof', value: '', position: i })
  return tokens
}
