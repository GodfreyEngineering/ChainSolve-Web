/**
 * lodHandles.test.ts — Regression test for LOD handle visibility.
 *
 * CSS `display: none` on `.cs-node-body` removes React Flow handles from
 * the DOM layout, causing edges to collapse to node origin (0,0) at low
 * zoom. This test guards against reintroducing that pattern.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('LOD handle regression', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../index.css'), 'utf-8')

  it('never uses display:none on .cs-node-body (would unmount handles)', () => {
    // Match any LOD rule that sets display:none specifically on .cs-node-body
    const lines = css.split('\n')
    const violations: string[] = []
    let inLodRule = false
    let ruleSelector = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.match(/\[data-lod=/)) {
        ruleSelector = trimmed
        if (trimmed.includes('.cs-node-body') && !trimmed.includes('.cs-node-header')) {
          inLodRule = true
        }
      }
      if (inLodRule && trimmed.match(/display\s*:\s*none/i)) {
        violations.push(`${ruleSelector} → ${trimmed}`)
      }
      if (trimmed === '}') {
        inLodRule = false
        ruleSelector = ''
      }
    }

    expect(violations).toEqual([])
  })
})
