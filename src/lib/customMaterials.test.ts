/**
 * customMaterials.test.ts — Tests for custom material types and validation (D7-5).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateMaterialName,
  validateMaterialProperties,
  loadCustomMaterials,
  saveCustomMaterials,
  generateMaterialId,
  MAX_MATERIAL_NAME_LENGTH,
  MATERIAL_PROPERTIES,
  MATERIAL_PROPERTY_META,
  type CustomMaterial,
} from './customMaterials'

// ── Name validation ─────────────────────────────────────────────────────────

describe('validateMaterialName', () => {
  it('accepts a valid name', () => {
    expect(validateMaterialName('Carbon Steel')).toEqual({ ok: true })
  })

  it('rejects an empty name', () => {
    const r = validateMaterialName('')
    expect(r.ok).toBe(false)
  })

  it('rejects a whitespace-only name', () => {
    const r = validateMaterialName('   ')
    expect(r.ok).toBe(false)
  })

  it('rejects a name exceeding max length', () => {
    const r = validateMaterialName('x'.repeat(MAX_MATERIAL_NAME_LENGTH + 1))
    expect(r.ok).toBe(false)
  })

  it('accepts a name at exact max length', () => {
    expect(validateMaterialName('x'.repeat(MAX_MATERIAL_NAME_LENGTH))).toEqual({ ok: true })
  })
})

// ── Properties validation ───────────────────────────────────────────────────

describe('validateMaterialProperties', () => {
  it('accepts valid properties', () => {
    expect(validateMaterialProperties({ rho: 7850, E: 200e9 })).toEqual({ ok: true })
  })

  it('rejects empty properties', () => {
    const r = validateMaterialProperties({})
    expect(r.ok).toBe(false)
  })

  it('rejects NaN values', () => {
    const r = validateMaterialProperties({ rho: NaN })
    expect(r.ok).toBe(false)
  })

  it('rejects Infinity values', () => {
    const r = validateMaterialProperties({ E: Infinity })
    expect(r.ok).toBe(false)
  })

  it('accepts a single property', () => {
    expect(validateMaterialProperties({ mu: 1.002e-3 })).toEqual({ ok: true })
  })
})

// ── localStorage CRUD ───────────────────────────────────────────────────────

describe('localStorage CRUD', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loadCustomMaterials returns empty array when no data', () => {
    expect(loadCustomMaterials()).toEqual([])
  })

  it('saveCustomMaterials + loadCustomMaterials round-trips', () => {
    const materials: CustomMaterial[] = [
      { id: 'test-1', name: 'Test Steel', properties: { rho: 7800, E: 205e9 } },
    ]
    saveCustomMaterials(materials)
    const loaded = loadCustomMaterials()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Test Steel')
    expect(loaded[0].properties.rho).toBe(7800)
  })

  it('loadCustomMaterials handles corrupt data gracefully', () => {
    localStorage.setItem('cs:custom-materials', 'not-json')
    expect(loadCustomMaterials()).toEqual([])
  })

  it('loadCustomMaterials filters out invalid entries', () => {
    localStorage.setItem('cs:custom-materials', JSON.stringify([{ invalid: true }, 42, null]))
    expect(loadCustomMaterials()).toEqual([])
  })
})

// ── ID generation ───────────────────────────────────────────────────────────

describe('generateMaterialId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateMaterialId()))
    expect(ids.size).toBe(10)
  })

  it('generates IDs with cm_ prefix', () => {
    expect(generateMaterialId()).toMatch(/^cm_/)
  })
})

// ── Constants ───────────────────────────────────────────────────────────────

describe('Material property metadata', () => {
  it('has metadata for all property keys', () => {
    for (const key of MATERIAL_PROPERTIES) {
      const meta = MATERIAL_PROPERTY_META[key]
      expect(meta).toBeDefined()
      expect(meta.label).toBeTruthy()
      expect(meta.unit).toBeTruthy()
    }
  })

  it('has exactly 6 standard properties', () => {
    expect(MATERIAL_PROPERTIES).toHaveLength(6)
  })
})
