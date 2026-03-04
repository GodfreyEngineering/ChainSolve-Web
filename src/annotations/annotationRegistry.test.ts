/**
 * annotationRegistry.test.ts — V2-022: Annotation registry structural tests.
 */

import { describe, it, expect } from 'vitest'
import { ANNOTATION_REGISTRY } from './annotationRegistry'

describe('ANNOTATION_REGISTRY', () => {
  it('has 5 entries', () => {
    expect(ANNOTATION_REGISTRY.size).toBe(5)
  })

  it('every entry has a blockType starting with annotation_', () => {
    for (const [key, def] of ANNOTATION_REGISTRY) {
      expect(def.defaultData.blockType).toBe(key)
      expect(key.startsWith('annotation_')).toBe(true)
    }
  })

  it('every entry has valid color and fontSize', () => {
    for (const [, def] of ANNOTATION_REGISTRY) {
      expect(def.defaultData.annotationColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(def.defaultData.annotationFontSize).toBeGreaterThanOrEqual(8)
    }
  })

  it('bold and italic default to false', () => {
    for (const [, def] of ANNOTATION_REGISTRY) {
      expect(def.defaultData.annotationBold).toBe(false)
      expect(def.defaultData.annotationItalic).toBe(false)
    }
  })

  it('includes the leader type', () => {
    const leader = ANNOTATION_REGISTRY.get('annotation_leader')
    expect(leader).toBeDefined()
    expect(leader!.defaultData.annotationType).toBe('leader')
  })

  it('text types have annotationText', () => {
    for (const key of ['annotation_text', 'annotation_callout', 'annotation_leader']) {
      const def = ANNOTATION_REGISTRY.get(key)
      expect(def).toBeDefined()
      expect(def!.defaultData.annotationText).toBeTruthy()
    }
  })
})
