import { describe, it, expect } from 'vitest'
import { getErrorExplanation, formatErrorReport } from './consoleHelpers'
import type { LogEntry } from '../stores/debugConsoleStore'

function makeEntry(
  overrides: Partial<LogEntry> & {
    msg: string
    level?: LogEntry['level']
    scope?: LogEntry['scope']
  },
): LogEntry {
  return {
    id: 1,
    ts: Date.now(),
    level: 'error',
    scope: 'engine',
    ...overrides,
  }
}

describe('getErrorExplanation', () => {
  it('returns null for info entries', () => {
    expect(getErrorExplanation(makeEntry({ msg: 'hello', level: 'info' }))).toBeNull()
  })

  it('explains division by zero pattern', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Power: t = 0' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('Power')
    expect(result!.explanation).toContain('zero')
    expect(result!.suggestion).toContain('t')
  })

  it('explains geometric constraint violation', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Annulus: d_inner > d_outer' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('constraint')
  })

  it('explains cycle detection', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Cycle detected in graph', level: 'warn' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('cycle')
  })

  it('explains worker errors', () => {
    const result = getErrorExplanation(
      makeEntry({ msg: 'Watchdog fired — recreating worker', scope: 'engine' }),
    )
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('engine')
  })

  it('explains persistence conflicts', () => {
    const result = getErrorExplanation(
      makeEntry({ msg: 'Conflict detected', scope: 'persistence', level: 'warn' }),
    )
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('conflict')
  })

  it('explains network errors', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Request failed', scope: 'network' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('network')
  })

  it('explains missing inputs', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Missing input on port A' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('not connected')
  })

  it('explains zero variance errors', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'StdDev: zero variance in X' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('StdDev')
    expect(result!.explanation).toContain('identical')
  })

  it('returns null for unrecognized error messages', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Something happened', level: 'error' }))
    expect(result).toBeNull()
  })

  // K4-2: Scientific workflow guidance tests
  it('explains type broadcast mismatch', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Cannot broadcast vector with table' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('vector')
    expect(result!.explanation).toContain('table')
    expect(result!.docsSection).toBe('block-data')
  })

  it('explains expected vector errors', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Mean: expected vector' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('Mean')
    expect(result!.explanation).toContain('vector')
  })

  it('explains empty vector errors', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Mean: empty vector' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('Mean')
    expect(result!.explanation).toContain('empty')
  })

  it('explains no input errors', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Sort: no input' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('Sort')
    expect(result!.explanation).toContain('not receiving')
  })

  it('explains probability domain errors', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Binomial PMF: p must be in [0,1]' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('probability')
    expect(result!.docsSection).toBe('block-stats')
  })

  it('explains positive domain errors', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Exponential PDF: λ must be > 0' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('positive')
  })

  it('explains non-negative integer requirements', () => {
    const result = getErrorExplanation(
      makeEntry({ msg: 'C(n,k): n,k must be non-negative integers with k ≤ n' }),
    )
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('integer')
  })

  it('explains discriminant < 0', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'v²: discriminant < 0' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('discriminant')
    expect(result!.explanation).toContain('complex')
  })

  it('explains no formula in custom function', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Custom function: no formula' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('formula')
  })

  it('explains unknown block type', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Unknown block type: my_custom_block' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('my_custom_block')
  })

  it('explains expected vector or table', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Expected vector or table' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('vector or table')
  })

  it('explains map scalar multiplier error', () => {
    const result = getErrorExplanation(makeEntry({ msg: 'Map: expected scalar multiplier' }))
    expect(result).not.toBeNull()
    expect(result!.explanation).toContain('Map')
  })
})

describe('formatErrorReport', () => {
  it('reports no errors for empty list', () => {
    expect(formatErrorReport([])).toContain('No errors or warnings')
  })

  it('filters to only errors and warnings', () => {
    const entries: LogEntry[] = [
      makeEntry({ id: 1, msg: 'error msg', level: 'error' }),
      makeEntry({ id: 2, msg: 'info msg', level: 'info' }),
      makeEntry({ id: 3, msg: 'warn msg', level: 'warn' }),
    ]
    const report = formatErrorReport(entries)
    expect(report).toContain('error msg')
    expect(report).toContain('warn msg')
    expect(report).not.toContain('info msg')
    expect(report).toContain('Entries: 2')
  })

  it('includes header and structured format', () => {
    const entries: LogEntry[] = [
      makeEntry({ id: 1, msg: 'Power: t = 0', level: 'error', scope: 'engine' }),
    ]
    const report = formatErrorReport(entries)
    expect(report).toContain('ChainSolve Error Report')
    expect(report).toContain('ERROR')
    expect(report).toContain('[engine]')
    expect(report).toContain('Power: t = 0')
  })
})
