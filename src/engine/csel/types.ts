/**
 * CSEL — ChainSolve Expression Language AST types.
 *
 * Supports: arithmetic, function calls, assignments, pipe chains, display output.
 * Example: `x = 5; sin(x * pi / 4) =`
 */

export type CselNode =
  | { type: 'literal'; value: number }
  | { type: 'identifier'; name: string }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: CselNode; right: CselNode }
  | { type: 'unary'; op: '-'; operand: CselNode }
  | { type: 'call'; name: string; args: CselNode[] }
  | { type: 'assign'; name: string; value: CselNode }
  | { type: 'display'; expr: CselNode }

/** A parsed CSEL program is a list of statements. */
export type CselProgram = CselNode[]

/** Parse error with position info. */
export interface CselError {
  message: string
  position: number
}
