/**
 * blockManifest.test.ts — E5-4: Validate block manifest staging consistency.
 *
 * Ensures the manifest's E5-4 planned blocks all carry a valid subVersion tag
 * and that the distribution across v2/v3/v4 matches the staging document.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

interface PlannedBlock {
  opId: string
  phase: string
  subVersion?: string
  priority?: string
  category?: string
}

interface Manifest {
  planned: PlannedBlock[]
}

const manifest: Manifest = JSON.parse(
  readFileSync(resolve(__dirname, '../../docs/block-manifest.json'), 'utf-8'),
)

const e54Blocks = manifest.planned.filter((b) => b.phase === 'E5-4')

describe('block manifest: E5-4 staging', () => {
  it('has 12 planned E5-4 blocks', () => {
    expect(e54Blocks).toHaveLength(12)
  })

  it('every E5-4 block has a valid subVersion', () => {
    for (const block of e54Blocks) {
      expect(['v2', 'v3', 'v4']).toContain(block.subVersion)
    }
  })

  it('v2 contains 7 stats/distribution blocks', () => {
    const v2 = e54Blocks.filter((b) => b.subVersion === 'v2')
    expect(v2).toHaveLength(7)
    const categories = new Set(v2.map((b) => b.category))
    expect(categories).toContain('probDist')
    expect(categories).toContain('statsRel')
  })

  it('v3 contains 1 combinatorics block', () => {
    const v3 = e54Blocks.filter((b) => b.subVersion === 'v3')
    expect(v3).toHaveLength(1)
    expect(v3[0].opId).toBe('prob.comb.multinomial')
  })

  it('v4 contains 4 utility/interpolation blocks', () => {
    const v4 = e54Blocks.filter((b) => b.subVersion === 'v4')
    expect(v4).toHaveLength(4)
    const opIds = v4.map((b) => b.opId).sort()
    expect(opIds).toEqual(['math.lerp', 'math.map_range', 'util.calc.fib', 'util.calc.is_prime'])
  })

  it('all E5-4 blocks have a priority assigned', () => {
    for (const block of e54Blocks) {
      expect(['high', 'medium', 'low']).toContain(block.priority)
    }
  })
})
