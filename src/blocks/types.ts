/**
 * types.ts — Shared types for the block system.
 *
 * Extracted into its own module to break circular dependencies between
 * registry.ts and the block-pack files (data-blocks, vector-blocks, etc.).
 * Both registry.ts and individual block files import from here.
 */

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
  | 'plot'
  | 'engMechanics'
  | 'engMaterials'
  | 'engSections'
  | 'engInertia'
  | 'engFluids'
  | 'engThermo'
  | 'engElectrical'
  | 'engConversions'
  | 'finTvm'
  | 'finReturns'
  | 'finDepr'
  | 'statsDesc'
  | 'statsRel'
  | 'probComb'
  | 'probDist'
  | 'utilCalc'

/** Which React Flow custom-node renderer to use. */
export type NodeKind = 'csSource' | 'csOperation' | 'csDisplay' | 'csData' | 'csPlot' | 'csGroup'

// ── Plot configuration types ────────────────────────────────────────────────

export type ChartType = 'xyLine' | 'xyScatter' | 'histogram' | 'bar' | 'heatmap'
export type ScaleType = 'linear' | 'log'
export type LegendPosition = 'right' | 'bottom' | 'none'
export type PlotThemePreset = 'paper-single' | 'paper-double' | 'presentation' | 'report'

export interface ReferenceLine {
  axis: 'x' | 'y'
  value: number
  label?: string
  color?: string
}

export interface PlotConfig {
  chartType: ChartType
  title?: string
  subtitle?: string
  xLabel?: string
  yLabel?: string
  xScale?: ScaleType
  yScale?: ScaleType
  showGrid?: boolean
  showLegend?: boolean
  legendPosition?: LegendPosition
  themePreset?: PlotThemePreset
  referenceLines?: ReferenceLine[]
  /** Max data points to render (LTTB downsampling). Full data always exported. */
  maxPoints?: number
  /** Bin count for histogram charts. */
  binCount?: number
  /** For Table input: column name for X axis. */
  xColumn?: string
  /** For Table input: column names for Y series. */
  yColumns?: string[]
  /** Show ChainSolve branding in exports (default false). */
  showBranding?: boolean
}

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
  /** Plot visualization configuration (csPlot nodes). */
  plotConfig?: PlotConfig
  /** Group color — hex string, default '#1CABB0' (csGroup nodes only). */
  groupColor?: string
  /** Optional notes/annotations for the group (csGroup nodes only). */
  groupNotes?: string
  /** Whether the group is collapsed — members hidden, proxy handles shown (csGroup nodes only). */
  groupCollapsed?: boolean
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
}
