import { describe, it, expect } from 'vitest'
import { MAX_TABLE_INPUT_ROWS, MAX_TABLE_INPUT_COLS, enforceTableLimits } from './tableConstants.ts'

describe('table constants', () => {
  it('MAX_TABLE_INPUT_ROWS is a positive integer', () => {
    expect(Number.isInteger(MAX_TABLE_INPUT_ROWS)).toBe(true)
    expect(MAX_TABLE_INPUT_ROWS).toBeGreaterThan(0)
  })

  it('MAX_TABLE_INPUT_COLS is a positive integer', () => {
    expect(Number.isInteger(MAX_TABLE_INPUT_COLS)).toBe(true)
    expect(MAX_TABLE_INPUT_COLS).toBeGreaterThan(0)
  })
})

describe('enforceTableLimits', () => {
  it('returns data unchanged when within limits', () => {
    const cols = ['A', 'B']
    const rows = [
      [1, 2],
      [3, 4],
    ]
    const result = enforceTableLimits(cols, rows)
    expect(result.columns).toBe(cols) // same reference — no copy
    expect(result.rows).toBe(rows)
    expect(result.truncated).toBe(false)
  })

  it('truncates columns exceeding maxCols', () => {
    const cols = ['A', 'B', 'C', 'D']
    const rows = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]
    const result = enforceTableLimits(cols, rows, 100, 2)
    expect(result.columns).toEqual(['A', 'B'])
    expect(result.rows).toEqual([
      [1, 2],
      [5, 6],
    ])
    expect(result.truncated).toBe(true)
  })

  it('truncates rows exceeding maxRows', () => {
    const cols = ['A']
    const rows = [[1], [2], [3], [4], [5]]
    const result = enforceTableLimits(cols, rows, 3, 50)
    expect(result.rows).toHaveLength(3)
    expect(result.rows).toEqual([[1], [2], [3]])
    expect(result.truncated).toBe(true)
  })

  it('truncates both rows and columns simultaneously', () => {
    const cols = ['A', 'B', 'C']
    const rows = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]
    const result = enforceTableLimits(cols, rows, 2, 2)
    expect(result.columns).toEqual(['A', 'B'])
    expect(result.rows).toEqual([
      [1, 2],
      [4, 5],
    ])
    expect(result.truncated).toBe(true)
  })

  it('handles empty table', () => {
    const result = enforceTableLimits([], [])
    expect(result.columns).toEqual([])
    expect(result.rows).toEqual([])
    expect(result.truncated).toBe(false)
  })

  it('row cells are also trimmed when columns are trimmed', () => {
    const cols = ['A', 'B', 'C']
    const rows = [[1, 2, 3]]
    const result = enforceTableLimits(cols, rows, 1000, 1)
    expect(result.rows[0]).toHaveLength(1)
    expect(result.rows[0]).toEqual([1])
  })

  it('uses MAX_TABLE_INPUT_ROWS and MAX_TABLE_INPUT_COLS as defaults', () => {
    // Build a table at exactly the default limits — should not truncate.
    const cols = Array.from({ length: MAX_TABLE_INPUT_COLS }, (_, i) => `C${i}`)
    const row = new Array(MAX_TABLE_INPUT_COLS).fill(0)
    const rows = Array.from({ length: MAX_TABLE_INPUT_ROWS }, () => row)
    const result = enforceTableLimits(cols, rows)
    expect(result.truncated).toBe(false)
  })
})
