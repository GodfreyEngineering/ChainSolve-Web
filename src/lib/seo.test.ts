import { describe, it, expect } from 'vitest'
import { pageTitle } from './seo'

describe('pageTitle', () => {
  it('formats page title with brand suffix', () => {
    expect(pageTitle('Docs')).toBe('Docs — ChainSolve')
  })

  it('handles empty page name', () => {
    expect(pageTitle('')).toBe(' — ChainSolve')
  })
})
