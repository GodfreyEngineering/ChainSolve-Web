/**
 * consoleHelpers.ts — Error explanation and report formatting for the Debug Console.
 *
 * K4-1: base error explanation engine.
 * K4-2: scientific workflow guidance (type mismatches, empty vectors,
 *        probability domains, missing inputs, custom function hints).
 */

import type { LogEntry, LogScope } from '../stores/debugConsoleStore'

// ── Error explanation ─────────────────────────────────────────────────────────

export interface ErrorExplanation {
  /** Plain language description of what went wrong. */
  explanation: string
  /** Suggested next step to fix the issue. */
  suggestion: string
  /** Relevant docs section to link to, if any. */
  docsSection?: string
  /** Quick action type, if applicable. */
  actionType?: 'docs' | 'variables'
}

interface PatternRule {
  test: (msg: string, scope: LogScope) => boolean
  explain: (msg: string) => ErrorExplanation
}

const RULES: PatternRule[] = [
  // Division by zero: "OpName: var = 0"
  {
    test: (msg) => /:\s*\w+\s*=\s*0\b/.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):\s*(\w+)\s*=\s*0/)
      const op = match?.[1] ?? 'Operation'
      const v = match?.[2] ?? 'variable'
      return {
        explanation: `${op} failed because "${v}" is zero, causing a division by zero.`,
        suggestion: `Check that "${v}" has a valid non-zero value before this block runs.`,
        docsSection: 'troubleshooting',
        actionType: 'variables',
      }
    },
  },
  // Discriminant < 0 (quadratic formula) — must precede geometric constraints
  {
    test: (msg) => /discriminant/i.test(msg),
    explain: () => ({
      explanation:
        'The quadratic formula produced a negative discriminant, meaning there are no real solutions. The equation has complex (imaginary) roots.',
      suggestion:
        'Check your coefficients (a, b, c). If you need complex roots, ChainSolve currently only supports real numbers.',
      docsSection: 'block-math',
      actionType: 'variables',
    }),
  },
  // Geometric constraints: "OpName: d_inner > d_outer"
  {
    test: (msg) => /:\s*\w+\s*[><=!]+\s*\w+/.test(msg) && !/= 0/.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):\s*(.+)$/)
      const op = match?.[1] ?? 'Operation'
      const constraint = match?.[2] ?? 'constraint violated'
      return {
        explanation: `${op} failed a geometric or logical constraint: ${constraint}.`,
        suggestion: `Review the input values to ensure they satisfy the constraint.`,
        docsSection: 'troubleshooting',
        actionType: 'variables',
      }
    },
  },
  // Cycle detection
  {
    test: (msg) => /cycle/i.test(msg),
    explain: () => ({
      explanation:
        'A cycle was detected in the graph. Blocks form a circular dependency where outputs feed back into their own inputs.',
      suggestion:
        'Break the cycle by removing or redirecting one of the edges that creates the loop. Check the Graph Health tab for details.',
      docsSection: 'troubleshooting',
    }),
  },
  // Worker errors
  {
    test: (msg, scope) => scope === 'engine' && /worker|watchdog/i.test(msg),
    explain: () => ({
      explanation:
        'The computation engine encountered a problem. This can happen when the engine takes too long or encounters an unexpected state.',
      suggestion:
        'Try simplifying your graph or refreshing the page. If the issue persists, export your project and report a bug.',
      docsSection: 'troubleshooting',
    }),
  },
  // Save / persistence conflicts
  {
    test: (msg, scope) => scope === 'persistence' && /conflict/i.test(msg),
    explain: () => ({
      explanation:
        'A save conflict was detected. This usually means the project was modified in another tab or browser session.',
      suggestion: 'Reload the project to get the latest version, then re-apply your changes.',
      docsSection: 'troubleshooting',
    }),
  },
  // Network errors
  {
    test: (_msg, scope) => scope === 'network',
    explain: () => ({
      explanation: 'A network request failed. Check your internet connection.',
      suggestion: 'Verify that you are online and try refreshing the page.',
      docsSection: 'troubleshooting',
    }),
  },
  // Missing input / unconnected
  {
    test: (msg) => /missing|unconnected|not connected/i.test(msg),
    explain: () => ({
      explanation: 'One or more required inputs are not connected.',
      suggestion:
        'Open the block inspector to see which inputs need connections, then draw edges from output ports to the missing inputs.',
      docsSection: 'troubleshooting',
      actionType: 'variables',
    }),
  },
  // Zero variance (stats)
  {
    test: (msg) => /zero variance/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):/)
      const op = match?.[1] ?? 'Statistical operation'
      return {
        explanation: `${op} requires variation in the data, but all input values are identical.`,
        suggestion: 'Provide at least two distinct values so the calculation is meaningful.',
        docsSection: 'block-stats',
      }
    },
  },

  // ── K4-2: Scientific workflow guidance ──────────────────────────────────────

  // Type broadcast mismatch: "Cannot broadcast vector with table"
  {
    test: (msg) => /cannot broadcast/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/cannot broadcast (\w+) with (\w+)/i)
      const a = match?.[1] ?? 'type'
      const b = match?.[2] ?? 'type'
      return {
        explanation: `The operation received incompatible data types: a ${a} and a ${b}. Scalars broadcast to vectors (element-wise), but vectors and tables cannot be combined directly.`,
        suggestion: `Ensure both inputs are the same type, or use a scalar on one side so it broadcasts across the other.`,
        docsSection: 'block-data',
      }
    },
  },
  // Expected vector or table — must precede "expected vector"
  {
    test: (msg) => /expected vector or table/i.test(msg),
    explain: () => ({
      explanation:
        'This operation requires a vector or table as input, but received a scalar value instead.',
      suggestion:
        'Connect a block that outputs a vector (list) or table. Scalar values cannot be used where multi-value data is expected.',
      docsSection: 'block-data',
      actionType: 'variables',
    }),
  },
  // Expected vector input: "{OpName}: expected vector"
  {
    test: (msg) => /expected vector/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):\s*expected vector/i)
      const op = match?.[1] ?? 'This block'
      return {
        explanation: `${op} requires a vector (list of numbers) as input, but received a scalar or table instead.`,
        suggestion: `Connect a block that outputs a vector, such as a List block or another operation that produces lists. You can also use a Collect block to build a vector from multiple scalars.`,
        docsSection: 'block-data',
        actionType: 'variables',
      }
    },
  },
  // Empty vector: "Mean: empty vector" / "Min: empty vector"
  {
    test: (msg) => /empty vector/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):\s*empty vector/i)
      const op = match?.[1] ?? 'This statistical block'
      return {
        explanation: `${op} received an empty list with no data points. Statistical operations need at least one value to compute a result.`,
        suggestion: `Check that your data source is connected and provides values. If using a List block, ensure it has at least one entry.`,
        docsSection: 'block-stats',
        actionType: 'variables',
      }
    },
  },
  // No input / no data: "{OpName}: no input" or "No data"
  {
    test: (msg) => /:\s*no input\b/i.test(msg) || /^no data$/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):\s*no input/i)
      const op = match?.[1] ?? 'This block'
      return {
        explanation: `${op} has a required input port that is not receiving any data. This usually means an edge is missing or the upstream block has no output.`,
        suggestion: `Connect the required input port to an upstream block that provides the expected data type.`,
        docsSection: 'troubleshooting',
        actionType: 'variables',
      }
    },
  },
  // Probability domain: "p must be in [0,1]"
  {
    test: (msg) => /must be in \[0,\s*1\]/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):/i)
      const op = match?.[1] ?? 'This probability block'
      return {
        explanation: `${op} requires a probability value between 0 and 1 (inclusive). The value provided is outside this range.`,
        suggestion: `Ensure the probability input is between 0 (impossible) and 1 (certain). For example, 50% probability = 0.5.`,
        docsSection: 'block-stats',
        actionType: 'variables',
      }
    },
  },
  // Non-negative integer: "must be non-negative integers" — must precede positive domain
  {
    test: (msg) => /non-negative integer/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):/i)
      const op = match?.[1] ?? 'This combinatorics block'
      return {
        explanation: `${op} requires whole number (integer) inputs that are zero or positive. Fractional or negative values are not valid for this operation.`,
        suggestion: `Use a Round or Floor block to convert decimal values to integers before passing them to this block.`,
        docsSection: 'block-math',
        actionType: 'variables',
      }
    },
  },
  // Positive domain: "must be > 0" or "must be >= 0" or "must be non-negative"
  {
    test: (msg) => /must be [>≥]|must be non-negative/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/^(.+?):/i)
      const op = match?.[1] ?? 'This block'
      return {
        explanation: `${op} requires a positive (or non-negative) input value. Negative or zero values are outside the mathematical domain of this operation.`,
        suggestion: `Check that the input values are positive. Common causes: a sign error, an uninitialized input defaulting to zero, or upstream subtraction producing a negative result.`,
        docsSection: 'troubleshooting',
        actionType: 'variables',
      }
    },
  },
  // Custom function with no formula
  {
    test: (msg) => /no formula/i.test(msg),
    explain: () => ({
      explanation:
        'A custom function block has no formula defined. Without a formula, the block cannot compute a result.',
      suggestion:
        'Open the block inspector and enter a formula in the expression field. Use the function wizard for guidance on available syntax.',
      docsSection: 'block-library',
      actionType: 'variables',
    }),
  },
  // Map: expected scalar multiplier
  {
    test: (msg) => /expected scalar multiplier/i.test(msg),
    explain: () => ({
      explanation:
        'The Map block applies a scalar operation to each element of a vector, but the multiplier input is not a scalar.',
      suggestion: 'Ensure the multiplier input is a single number (scalar), not a vector or table.',
      docsSection: 'block-data',
      actionType: 'variables',
    }),
  },
  // Unknown block type
  {
    test: (msg) => /unknown block type/i.test(msg),
    explain: (msg) => {
      const match = msg.match(/unknown block type:\s*(.+)/i)
      const blockType = match?.[1] ?? 'unknown'
      return {
        explanation: `The block type "${blockType}" is not recognized by the engine. This may happen if a project uses blocks from a newer version or a removed extension.`,
        suggestion: `Delete the unrecognized block and replace it with the correct block type from the block library.`,
        docsSection: 'block-library',
      }
    },
  },
]

/**
 * Get a contextual explanation for a log entry.
 * Returns null if no known pattern matches.
 */
export function getErrorExplanation(entry: LogEntry): ErrorExplanation | null {
  if (entry.level !== 'error' && entry.level !== 'warn') return null
  for (const rule of RULES) {
    if (rule.test(entry.msg, entry.scope)) return rule.explain(entry.msg)
  }
  return null
}

// ── Error report formatting ──────────────────────────────────────────────────

/**
 * Format a set of log entries into a redacted error report suitable for
 * pasting into a bug report or support request. Meta is already redacted
 * by the store, so this is safe to copy.
 */
export function formatErrorReport(entries: readonly LogEntry[]): string {
  const errors = entries.filter((e) => e.level === 'error' || e.level === 'warn')
  if (errors.length === 0) return 'No errors or warnings to report.'

  const lines: string[] = [
    'ChainSolve Error Report',
    `Generated: ${new Date().toISOString()}`,
    `Entries: ${errors.length}`,
    '---',
  ]

  for (const e of errors) {
    const ts = new Date(e.ts).toISOString().slice(11, 23)
    const meta = e.meta ? ` ${JSON.stringify(e.meta)}` : ''
    lines.push(`[${ts}] ${e.level.toUpperCase()} [${e.scope}] ${e.msg}${meta}`)
  }

  return lines.join('\n')
}
