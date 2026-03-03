/**
 * consoleHelpers.ts — Error explanation and report formatting for the Debug Console (K4-1).
 *
 * Provides contextual help for common engine/graph errors, and a redacted
 * error report formatter for clipboard export.
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
