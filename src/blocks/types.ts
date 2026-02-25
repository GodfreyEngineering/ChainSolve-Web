/**
 * types.ts — Shared types for the block system.
 *
 * Extracted into its own module to break circular dependencies between
 * registry.ts and the block-pack files (data-blocks, vector-blocks, etc.).
 * Both registry.ts and individual block files import from here.
 */

import type { Value } from '../engine/value'

export type BlockCategory =
  | 'input'
  | 'math'
  | 'trig'
  | 'constants'
  | 'logic'
  | 'output'
  | 'data'
  | 'vectorOps'
  | 'tableOps'

/** Which React Flow custom-node renderer to use. */
export type NodeKind = 'csSource' | 'csOperation' | 'csDisplay' | 'csData'

export interface PortDef {
  /** Unique within the block — used as targetHandle / sourceHandle. */
  id: string
  label: string
}

/** Data payload stored inside each ReactFlow node. */
export interface NodeData extends Record<string, unknown> {
  blockType: string
  label: string
  /** For Number + Slider + Display passthrough value. */
  value?: number
  /** Slider range. */
  min?: number
  max?: number
  step?: number
  /**
   * Per-port manual values for operation nodes.
   * portId → number. Used when port is disconnected or portOverrides[portId]=true.
   */
  manualValues?: Record<string, number>
  /**
   * Per-port override flags. When true for a connected port, manualValues[portId]
   * is used instead of the upstream computed value.
   */
  portOverrides?: Record<string, boolean>
  /** Vector data for vectorInput nodes. */
  vectorData?: number[]
  /** Table data for tableInput / csvImport nodes. */
  tableData?: { columns: string[]; rows: number[][] }
  /** Storage path of an uploaded CSV file. */
  csvStoragePath?: string
}

export interface BlockDef {
  type: string
  label: string
  category: BlockCategory
  /** Which React Flow node component to render. */
  nodeKind: NodeKind
  inputs: PortDef[]
  defaultData: NodeData
  /** True for Pro-only blocks (data, vectorOps, tableOps). */
  proOnly?: boolean
  /**
   * Pure evaluation function operating on the polymorphic Value type.
   * `inputs` is ordered by `inputs[]`; null = port disconnected.
   * Must never throw — return mkError(...) on any error.
   */
  evaluate: (inputs: ReadonlyArray<Value | null>, data: NodeData) => Value
}
