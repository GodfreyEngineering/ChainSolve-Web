/**
 * types.ts — Shared types for the block system.
 *
 * Extracted into its own module to break circular dependencies between
 * registry.ts and the block-pack files (data-blocks, vector-blocks, etc.).
 * Both registry.ts and individual block files import from here.
 */

export type BlockCategory =
  | 'input'
  | 'variable'
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
  | 'constMath'
  | 'constPhysics'
  | 'constAtmos'
  | 'constThermo'
  | 'constElec'
  | 'presetMaterials'
  | 'presetFluids'
  | 'customFunctions'
  | 'chem'
  | 'structural'
  | 'aerospace'
  | 'controlSystems'
  | 'lifeSci'
  | 'finOptions'
  | 'dateTime'
  | 'text'
  | 'interval'
  | 'signal'
  | 'complex'
  | 'matrix'
  | 'optimization'
  | 'machineLearning'
  | 'neuralNetworks'
  | 'odeSolvers'
  | 'vehicleSim'
  | 'numerical'
  | 'simulation'
  | 'visualization'

/** Which React Flow custom-node renderer to use. */
export type NodeKind =
  | 'csSource'
  | 'csOperation'
  | 'csDisplay'
  | 'csData'
  | 'csPlot'
  | 'csListTable'
  | 'csGroup'
  | 'csPublish'
  | 'csSubscribe'
  | 'csAnnotation'
  | 'csMaterial'
  | 'csOptimizer'
  | 'csMLModel'
  | 'csNeuralNet'
  | 'csTest'
  | 'csAssertion'
  | 'csWebSocket'
  | 'csRestApi'
  | 'csScope'
  | 'csTimer'
  | 'csLogger'
  | 'csMathSheet'
  | 'csDeadZone'
  | 'csFileInput'
  | 'csSqlQuery'
  | 'csTimeSeries'
  | 'csUnitInput'
  | 'csTransferFunction'
  | 'csStateSpace'
  | 'csZOH'
  | 'csRateTransition'
  | 'csStateMachine'
  | 'csCodeBlock'
  | 'csTirFileInput'
  | 'csViewport3D'
  | 'csOnnxInference'
  | 'csFmuImport'
  | 'csPythonScript'
  | 'csCustomRust'
  | 'csHdf5Import'
  | 'csCADImport'
  | 'csOpenDrive'

// ── Plot configuration types ────────────────────────────────────────────────

export type ChartType =
  | 'xyLine'
  | 'xyScatter'
  | 'histogram'
  | 'bar'
  | 'heatmap'
  | 'boxplot'
  | 'violin'
  | 'parallelCoords'
  | 'contour'
  | 'bode'
  | 'nyquist'
  | 'pareto'
  | 'waterfall'
  | 'sankey'
  | 'surface3d'
export type ScaleType = 'linear' | 'log'
export type LegendPosition = 'right' | 'bottom' | 'none'
export type PlotThemePreset = 'paper-single' | 'paper-double' | 'presentation' | 'report'

export type AnnotationType = 'line' | 'band' | 'text'

export interface ReferenceLine {
  /** Annotation kind: reference line, shaded band, or floating text label. Default: 'line'. */
  type?: AnnotationType
  /** Primary axis value (for line) or band start (for band), or ignored (for text). */
  axis?: 'x' | 'y'
  value?: number
  /** Band end value (type='band' only). */
  value2?: number
  /** Text content (type='text') or line label (type='line'). */
  text?: string
  /** X coordinate for floating text annotation (type='text'). */
  x?: number
  /** Y coordinate for floating text annotation (type='text'). */
  y?: number
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
  /** For Table input: column names for Y series (left / primary axis). */
  yColumns?: string[]
  /** Time column for animation (xyLine/xyScatter): scrubs data row by row. */
  animTimeColumn?: string
  /** Secondary Y-axis columns (right axis, xyLine/xyScatter only). */
  yColumns2?: string[]
  /** Right-axis label. */
  y2Label?: string
  /** Right-axis scale. */
  y2Scale?: ScaleType
  /** Show ChainSolve branding in exports (default false). */
  showBranding?: boolean
}

export interface PortDef {
  /** Unique within the block — used as targetHandle / sourceHandle. */
  id: string
  label: string
}

// ── Input binding types (W12.2) ──────────────────────────────────────────────

/** Binding for an unconnected (or overridden) input port. */
export type InputBinding =
  | { kind: 'literal'; value: number; raw?: string }
  | { kind: 'const'; constOpId: string }
  | { kind: 'var'; varId: string }

/** Data payload stored inside each ReactFlow node. */
export interface NodeData extends Record<string, unknown> {
  blockType: string
  label: string
  /** For Number + Slider + Display passthrough value. */
  value?: number
  /** Slider range. */
  min?: number | null
  max?: number | null
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
  /**
   * Per-port input bindings (W12.2). Richer replacement for manualValues.
   * portId → InputBinding. Connected ports ignore this unless portOverrides[portId]=true.
   */
  inputBindings?: Record<string, InputBinding>
  /** Bound variable ID for variableSource and slider nodes (W12.2). */
  varId?: string
  /** Selected constant op ID for unified "constant" nodes (D7-3). */
  selectedConstantId?: string
  /** Selected material/fluid preset op ID for unified "material" nodes (D7-4). */
  selectedMaterialId?: string
  /** Vector data for vectorInput nodes. */
  vectorData?: number[]
  /** Table data for tableInput / csvImport nodes. */
  tableData?: { columns: string[]; rows: number[][] } | null
  /** SHA-256 hex digest of the imported dataset content (4.22 — reproducibility). */
  datasetHash?: string
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
  /** UX-21: Whether the group is locked — visual indicator, prevents accidental member edits. */
  groupLocked?: boolean
  /** 3.31: When true, collapsed group renders as a composite block (SubGraph mode). */
  groupAsSubGraph?: boolean
  /** Annotation type discriminator (csAnnotation nodes only). */
  annotationType?:
    | 'text'
    | 'callout'
    | 'highlight'
    | 'arrow'
    | 'leader'
    | 'rectangle'
    | 'ellipse'
    | 'diamond'
    | 'rounded_rectangle'
    | 'sticky_note'
  /** Annotation text content (csAnnotation nodes only). */
  annotationText?: string
  /** Annotation color — hex string (csAnnotation nodes only). */
  annotationColor?: string
  /** Annotation font size in px (csAnnotation text/callout/leader nodes only). */
  annotationFontSize?: number
  /** Annotation bold flag (csAnnotation text/callout/leader nodes only). */
  annotationBold?: boolean
  /** Annotation italic flag (csAnnotation text/callout/leader nodes only). */
  annotationItalic?: boolean
  /** V3-5.1: Annotation text alignment (csAnnotation text/callout/leader). */
  annotationTextAlign?: 'left' | 'center' | 'right'
  /** V3-5.1: Annotation explicit width in pixels (csAnnotation resizable). */
  annotationWidth?: number
  /** V3-5.1: Annotation explicit height in pixels (csAnnotation resizable). */
  annotationHeight?: number
  /** V3-5.1: Z-index layer for annotation ordering. Higher = in front. */
  annotationZIndex?: number
  /** V3-5.2: Shape border width in px (shape annotations). */
  annotationBorderWidth?: number
  /** V3-5.2: Shape fill color (shape annotations). */
  annotationFillColor?: string
  /** V3-5.2: Arrow start marker. */
  annotationArrowStart?: 'none' | 'arrowhead' | 'dot' | 'square'
  /** V3-5.2: Arrow end marker. */
  annotationArrowEnd?: 'none' | 'arrowhead' | 'dot' | 'square'
  /** V3-5.2: Arrow line thickness. */
  annotationArrowThickness?: number
  /** V3-5.2: Arrow dash pattern. */
  annotationArrowDash?: 'solid' | 'dashed' | 'dotted'
  /** UX-22: Monospace font for text/callout/leader annotations. */
  annotationMonospace?: boolean
  /** V3-5.3: Arrow length in px (csAnnotation arrow nodes). */
  annotationArrowLength?: number
  /** V3-5.3: Rotation in degrees (csAnnotation arrow nodes). */
  annotationRotation?: number
  /** V3-5.3: Rich-text HTML content for text/callout/sticky_note annotations. */
  annotationHtml?: string
  /** H1-1: Unit assigned to this node's output. Unit id from unitCatalog. */
  unit?: string
  /** H7-1: Channel name for publish blocks (csPublish nodes only). */
  publishChannelName?: string
  /** H7-1: Channel name subscribed to (csSubscribe nodes only). */
  subscribeChannelName?: string
  /** UX-14: User-chosen accent color for this node (hex string). Tints node background. */
  userColor?: string
  /**
   * PREC-02: Per-node display precision override for Display nodes.
   * Values: 'global' | 'integer' | '2dp' | '4dp' | '8dp' | '15dp' | 'scientific' | 'sig_figs_3' | 'sig_figs_6'
   * 'global' (or undefined) uses global preferences.
   */
  displayPrecision?: string
  /**
   * 4.08: Table output mode for tableInput blocks.
   * 'columns' (default) — one output per column
   * 'table' — single output with full table value
   * 'row' — single output with selected row as vector
   * 'column' — single output with selected column as vector
   */
  tableOutputMode?: 'columns' | 'table' | 'row' | 'column'
  /** 4.08: Selected column index for 'column' output mode. */
  tableOutputCol?: number
  /** 4.08: Selected row index for 'row' output mode. */
  tableOutputRow?: number
  /** 4.09: User notes/comments on this block. */
  nodeNotes?: string
}

export interface BlockDef {
  type: string
  label: string
  category: BlockCategory
  /** Which React Flow node component to render. */
  nodeKind: NodeKind
  inputs: PortDef[]
  defaultData: NodeData
  /** True for Pro-only blocks (data, vectorOps). */
  proOnly?: boolean
  /** E5-5: Alternative names for search (e.g. ["acceleration"] for F=ma). */
  synonyms?: string[]
  /** E5-5: Domain tags for search (e.g. ["mechanics", "dynamics"]). */
  tags?: string[]
  /** G4-1: Human-readable description shown in the Inspector panel. */
  description?: string
  /** Phase 2: When true, this block supports a variable number of inputs.
   *  The UI can add/remove input ports dynamically. Port IDs for variadic
   *  blocks follow the pattern `in_0`, `in_1`, ..., `in_N`. */
  variadic?: boolean
  /** Minimum number of inputs for variadic blocks (default: 2). */
  minInputs?: number
  /** Maximum number of inputs for variadic blocks (default: 64). */
  maxInputs?: number
}
