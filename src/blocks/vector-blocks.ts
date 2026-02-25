/**
 * vector-blocks.ts — Vector operation blocks (Pro only).
 *
 * All use csOperation node kind and Value-aware evaluate.
 * Exports a registration function called by registry.ts (no circular imports).
 */

import type { BlockDef } from './types'
import { type Value, mkScalar, mkVector, mkError, isVector, isScalar } from '../engine/value'

type ErrorValue = { readonly kind: 'error'; readonly message: string }

function requireVector(v: Value | null, name: string): number[] | ErrorValue {
  if (v === null) return { kind: 'error', message: `${name}: no input` } as const
  if (!isVector(v)) return { kind: 'error', message: `${name}: expected vector` } as const
  return v.value as number[]
}

function isErr(v: number[] | ErrorValue): v is ErrorValue {
  return 'kind' in v && v.kind === 'error'
}

export function registerVectorBlocks(register: (def: BlockDef) => void): void {
  // ── Vector Length ─────────────────────────────────────────────────────────

  register({
    type: 'vectorLength',
    label: 'Vec Length',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorLength', label: 'Length' },
    evaluate: ([vec]) => {
      const arr = requireVector(vec, 'Length')
      return isErr(arr) ? arr : mkScalar(arr.length)
    },
  })

  // ── Vector Sum ────────────────────────────────────────────────────────────

  register({
    type: 'vectorSum',
    label: 'Vec Sum',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorSum', label: 'Sum' },
    evaluate: ([vec]) => {
      const arr = requireVector(vec, 'Sum')
      if (isErr(arr)) return arr
      return mkScalar(arr.reduce((a, b) => a + b, 0))
    },
  })

  // ── Vector Mean ───────────────────────────────────────────────────────────

  register({
    type: 'vectorMean',
    label: 'Vec Mean',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMean', label: 'Mean' },
    evaluate: ([vec]) => {
      const arr = requireVector(vec, 'Mean')
      if (isErr(arr)) return arr
      if (arr.length === 0) return mkError('Mean: empty vector')
      return mkScalar(arr.reduce((a, b) => a + b, 0) / arr.length)
    },
  })

  // ── Vector Min ────────────────────────────────────────────────────────────

  register({
    type: 'vectorMin',
    label: 'Vec Min',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMin', label: 'Min' },
    evaluate: ([vec]) => {
      const arr = requireVector(vec, 'Min')
      if (isErr(arr)) return arr
      if (arr.length === 0) return mkError('Min: empty vector')
      return mkScalar(Math.min(...arr))
    },
  })

  // ── Vector Max ────────────────────────────────────────────────────────────

  register({
    type: 'vectorMax',
    label: 'Vec Max',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMax', label: 'Max' },
    evaluate: ([vec]) => {
      const arr = requireVector(vec, 'Max')
      if (isErr(arr)) return arr
      if (arr.length === 0) return mkError('Max: empty vector')
      return mkScalar(Math.max(...arr))
    },
  })

  // ── Vector Sort ───────────────────────────────────────────────────────────

  register({
    type: 'vectorSort',
    label: 'Vec Sort',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorSort', label: 'Sort' },
    evaluate: ([vec]) => {
      const arr = requireVector(vec, 'Sort')
      if (isErr(arr)) return arr
      return mkVector([...arr].sort((a, b) => a - b))
    },
  })

  // ── Vector Reverse ────────────────────────────────────────────────────────

  register({
    type: 'vectorReverse',
    label: 'Vec Reverse',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorReverse', label: 'Reverse' },
    evaluate: ([vec]) => {
      const arr = requireVector(vec, 'Reverse')
      if (isErr(arr)) return arr
      return mkVector([...arr].reverse())
    },
  })

  // ── Vector Slice ──────────────────────────────────────────────────────────

  register({
    type: 'vectorSlice',
    label: 'Vec Slice',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'vec', label: 'Vec' },
      { id: 'start', label: 'Start' },
      { id: 'end', label: 'End' },
    ],
    proOnly: true,
    defaultData: { blockType: 'vectorSlice', label: 'Slice' },
    evaluate: ([vec, start, end]) => {
      const arr = requireVector(vec, 'Slice')
      if (isErr(arr)) return arr
      const s = start && isScalar(start) ? Math.floor(start.value) : 0
      const e = end && isScalar(end) ? Math.floor(end.value) : arr.length
      return mkVector(arr.slice(s, e))
    },
  })

  // ── Vector Concat ─────────────────────────────────────────────────────────

  register({
    type: 'vectorConcat',
    label: 'Vec Concat',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    proOnly: true,
    defaultData: { blockType: 'vectorConcat', label: 'Concat' },
    evaluate: ([a, b]) => {
      const arrA = requireVector(a, 'Concat')
      if (isErr(arrA)) return arrA
      const arrB = requireVector(b, 'Concat')
      if (isErr(arrB)) return arrB
      return mkVector([...arrA, ...arrB])
    },
  })

  // ── Vector Map (element-wise multiply by scalar) ──────────────────────────

  register({
    type: 'vectorMap',
    label: 'Vec × Scalar',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'vec', label: 'Vec' },
      { id: 'scalar', label: 'Scalar' },
    ],
    proOnly: true,
    defaultData: { blockType: 'vectorMap', label: 'Vec × Scalar' },
    evaluate: ([vec, scalar]) => {
      const arr = requireVector(vec, 'Map')
      if (isErr(arr)) return arr
      if (scalar === null || !isScalar(scalar)) return mkError('Map: expected scalar multiplier')
      return mkVector(arr.map((v) => v * scalar.value))
    },
  })
}
