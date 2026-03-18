/**
 * catalogSanity.test.ts — F6-2: Block catalog sanity tests.
 *
 * Smoke tests that verify every registered block:
 *   1. Has required metadata (type, label, category, nodeKind, inputs, defaultData)
 *   2. Has consistent defaultData.blockType matching its registry key
 *   3. Has a valid category and nodeKind from the type unions
 *   4. Has unique input port IDs (no duplicates within a block)
 *   5. Can be "instantiated" — defaultData produces valid NodeData shape
 */

import { describe, it, expect } from 'vitest'
import { BLOCK_REGISTRY } from './registry'
import { registerAllBlocks } from './registerAllBlocks'
import type { BlockCategory, NodeKind } from './types'

// Ensure domain block packs are loaded (UI-PERF-05: lazy by default)
registerAllBlocks()

const VALID_CATEGORIES: BlockCategory[] = [
  'input',
  'variable',
  'math',
  'trig',
  'constants',
  'logic',
  'output',
  'data',
  'vectorOps',
  'tableOps',
  'plot',
  'engMechanics',
  'engMaterials',
  'engSections',
  'engInertia',
  'engFluids',
  'engThermo',
  'engElectrical',
  'engConversions',
  'finTvm',
  'finReturns',
  'finDepr',
  'statsDesc',
  'statsRel',
  'probComb',
  'probDist',
  'utilCalc',
  'constMath',
  'constPhysics',
  'constAtmos',
  'constThermo',
  'constElec',
  'presetMaterials',
  'presetFluids',
  'customFunctions',
  'chem',
  'structural',
  'aerospace',
  'controlSystems',
  'lifeSci',
  'finOptions',
  'dateTime',
  'text',
  'interval',
  'complex',
  'matrix',
  'signal',
  'optimization',
  'machineLearning',
  'neuralNetworks',
  'odeSolvers',
  'vehicleSim',
  'numerical',
]

const VALID_NODE_KINDS: NodeKind[] = [
  'csSource',
  'csOperation',
  'csDisplay',
  'csData',
  'csPlot',
  'csListTable',
  'csGroup',
  'csPublish',
  'csSubscribe',
  'csAnnotation',
  'csMaterial',
  'csOptimizer',
  'csMLModel',
  'csNeuralNet',
  'csTest',
  'csAssertion',
  'csWebSocket',
  'csRestApi',
  'csScope',
  'csTimer',
  'csLogger',
  'csMathSheet',
  'csDeadZone',
  'csFileInput',
  'csSqlQuery',
  'csTimeSeries',
  'csUnitInput',
  'csTransferFunction',
  'csStateSpace',
  'csZOH',
  'csRateTransition',
  'csStateMachine',
]

describe('Block catalog sanity (F6-2)', () => {
  it('registry is not empty', () => {
    expect(BLOCK_REGISTRY.size).toBeGreaterThan(100)
  })

  for (const [type, def] of BLOCK_REGISTRY) {
    describe(`block "${type}"`, () => {
      it('has required metadata fields', () => {
        expect(def.type).toBe(type)
        expect(typeof def.label).toBe('string')
        expect(def.label.length).toBeGreaterThan(0)
        expect(def.category).toBeDefined()
        expect(def.nodeKind).toBeDefined()
        expect(Array.isArray(def.inputs)).toBe(true)
        expect(def.defaultData).toBeDefined()
      })

      it('has valid category', () => {
        expect(VALID_CATEGORIES).toContain(def.category)
      })

      it('has valid nodeKind', () => {
        expect(VALID_NODE_KINDS).toContain(def.nodeKind)
      })

      it('defaultData.blockType matches registry key', () => {
        // 'material' uses blockType='material_full' to match the Rust op name (BUG-12).
        const BLOCKTYPE_EXCEPTIONS: Record<string, string> = { material: 'material_full' }
        const expected = BLOCKTYPE_EXCEPTIONS[type] ?? type
        expect(def.defaultData.blockType).toBe(expected)
      })

      it('defaultData.label is a non-empty string', () => {
        expect(typeof def.defaultData.label).toBe('string')
        expect(def.defaultData.label.length).toBeGreaterThan(0)
      })

      it('input port IDs are unique', () => {
        const portIds = def.inputs.map((p) => p.id)
        const uniqueIds = new Set(portIds)
        expect(portIds.length).toBe(uniqueIds.size)
      })

      it('input ports have non-empty id and label', () => {
        for (const port of def.inputs) {
          expect(typeof port.id).toBe('string')
          expect(port.id.length).toBeGreaterThan(0)
          expect(typeof port.label).toBe('string')
          expect(port.label.length).toBeGreaterThan(0)
        }
      })
    })
  }
})
