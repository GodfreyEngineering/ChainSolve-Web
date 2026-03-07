import { describe, it, expect } from 'vitest'
import { assertUniqueCanvasName, type CanvasRow } from './canvases'

function makeRow(id: string, name: string): CanvasRow {
  return {
    id,
    project_id: 'p-1',
    owner_id: 'u-1',
    name,
    position: 0,
    storage_path: '',
    created_at: '',
    updated_at: '',
  }
}

describe('assertUniqueCanvasName', () => {
  const existing = [
    makeRow('c-1', 'Sheet 1'),
    makeRow('c-2', 'Sheet 2'),
    makeRow('c-3', 'Analysis'),
  ]

  it('passes when name is unique', () => {
    expect(() => assertUniqueCanvasName('Sheet 3', existing)).not.toThrow()
  })

  it('rejects exact duplicate', () => {
    expect(() => assertUniqueCanvasName('Sheet 1', existing)).toThrow(/already exists/)
  })

  it('rejects case-insensitive duplicate', () => {
    expect(() => assertUniqueCanvasName('sheet 1', existing)).toThrow(/already exists/)
    expect(() => assertUniqueCanvasName('ANALYSIS', existing)).toThrow(/already exists/)
  })

  it('rejects duplicate with whitespace padding', () => {
    expect(() => assertUniqueCanvasName('  Sheet 1  ', existing)).toThrow(/already exists/)
  })

  it('allows rename to same canvas id (excludeId)', () => {
    expect(() => assertUniqueCanvasName('Sheet 1', existing, 'c-1')).not.toThrow()
  })

  it('still rejects when excludeId does not match the duplicate', () => {
    expect(() => assertUniqueCanvasName('Sheet 1', existing, 'c-2')).toThrow(/already exists/)
  })

  it('passes with empty existing list', () => {
    expect(() => assertUniqueCanvasName('Sheet 1', [])).not.toThrow()
  })
})
