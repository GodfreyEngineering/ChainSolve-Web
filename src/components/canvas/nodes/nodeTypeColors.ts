/**
 * Maps block types to their semantic CSS color variable and a Lucide icon name.
 * V3-UI: Nodes are color-coded by their functional category.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Hash,
  SlidersHorizontal,
  Bookmark,
  Variable,
  Gem,
  Pi,
  Calculator,
  Eye,
  Database,
  BarChart3,
  Table2,
  Layers,
  Upload,
  Download,
  Type,
  MessageSquare,
  Highlighter,
  ArrowRight,
  MoveRight,
  Target,
  Dna,
  Triangle,
  TrendingUp,
  Sparkles,
  GitFork,
  Brain,
  Cpu,
  Zap,
  FileOutput,
} from 'lucide-react'

// ── Color mapping ──────────────────────────────────────────────────────────

const SOURCE_TYPES = new Set([
  'number',
  'slider',
  'constant',
  'material',
  'variableSource',
  'pi',
  'e',
  'tau',
  'phi',
])

const DATA_TYPES = new Set(['csvData', 'data', 'csData'])
const DISPLAY_TYPES = new Set(['display', 'csProbe'])
const PLOT_TYPES = new Set(['plot', 'csPlot'])
const TABLE_TYPES = new Set(['listTable', 'csListTable'])
const GROUP_TYPES = new Set(['group', 'csGroup'])
const PUBLISH_TYPES = new Set(['publish', 'csPublish'])
const SUBSCRIBE_TYPES = new Set(['subscribe', 'csSubscribe'])
const ML_MODEL_TYPES = new Set([
  'ml.linearRegression',
  'ml.polynomialRegression',
  'ml.knnClassifier',
  'ml.decisionTree',
])

const NN_TYPES = new Set([
  'nn.dense',
  'nn.conv1d',
  'nn.dropout',
  'nn.activation',
  'nn.sequential',
  'nn.trainer',
  'nn.export',
])

const OPTIMIZER_TYPES = new Set([
  'optim.gradientDescent',
  'optim.geneticAlgorithm',
  'optim.nelderMead',
])

const ANNOTATION_TYPES = new Set([
  'annotation_text',
  'annotation_callout',
  'annotation_highlight',
  'annotation_arrow',
  'annotation_leader',
])

// ── Domain color mapping (3.30) ─────────────────────────────────────────────

import type { BlockCategory } from '../../../blocks/types'

/**
 * Domain accent colors for node header tinting (3.30).
 * Returns a hex color for the physics/engineering domain, or null for
 * general/math blocks that get the standard operation teal.
 */
export function getCategoryDomainColor(category: BlockCategory | undefined): string | null {
  if (!category) return null
  switch (category) {
    // Mechanical engineering
    case 'engMechanics':
    case 'engSections':
    case 'engInertia':
      return '#3B82F6' // blue

    // Fluid / structural
    case 'engFluids':
    case 'structural':
      return '#06B6D4' // cyan

    // Electrical
    case 'engElectrical':
      return '#EAB308' // yellow

    // Thermal / atmospheric / thermodynamics
    case 'engThermo':
    case 'constThermo':
    case 'constAtmos':
      return '#EF4444' // red

    // Control systems
    case 'controlSystems':
      return '#22C55E' // green

    // Machine learning / neural networks / optimization
    case 'machineLearning':
    case 'neuralNetworks':
    case 'optimization':
    case 'numerical':
      return '#A855F7' // purple

    // Vehicle simulation
    case 'vehicleSim':
      return '#F97316' // orange

    // Aerospace
    case 'aerospace':
      return '#64748B' // slate

    // Chemistry / life sciences
    case 'chem':
    case 'lifeSci':
      return '#10B981' // emerald

    // Finance
    case 'finTvm':
    case 'finReturns':
    case 'finDepr':
    case 'finOptions':
      return '#F59E0B' // amber

    // Signal / complex / interval
    case 'signal':
    case 'complex':
    case 'interval':
      return '#8B5CF6' // violet

    default:
      return null
  }
}

/**
 * Returns the CSS variable name for the node-type color.
 * Can be used directly in inline styles: `color: var(${getNodeTypeColor(bt)})`
 */
export function getNodeTypeColor(blockType: string): string {
  if (SOURCE_TYPES.has(blockType)) return '--node-color-source'
  if (DATA_TYPES.has(blockType)) return '--node-color-data'
  if (DISPLAY_TYPES.has(blockType)) return '--node-color-display'
  if (PLOT_TYPES.has(blockType)) return '--node-color-plot'
  if (TABLE_TYPES.has(blockType)) return '--node-color-display'
  if (GROUP_TYPES.has(blockType)) return '--node-color-group'
  if (PUBLISH_TYPES.has(blockType)) return '--node-color-operation'
  if (SUBSCRIBE_TYPES.has(blockType)) return '--node-color-operation'
  if (OPTIMIZER_TYPES.has(blockType)) return '--node-color-source'
  if (ML_MODEL_TYPES.has(blockType)) return '--node-color-data'
  if (NN_TYPES.has(blockType)) return '--node-color-plot'
  if (ANNOTATION_TYPES.has(blockType)) return '--node-color-group'
  // Default: operation (the largest category)
  return '--node-color-operation'
}

// ── Icon mapping ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  number: Hash,
  slider: SlidersHorizontal,
  constant: Bookmark,
  material: Gem,
  variableSource: Variable,
  pi: Pi,
  e: Hash,
  tau: Hash,
  phi: Hash,

  display: Eye,
  csProbe: Eye,

  csvData: Database,
  data: Database,
  csData: Database,

  plot: BarChart3,
  csPlot: BarChart3,

  listTable: Table2,
  csListTable: Table2,

  group: Layers,
  csGroup: Layers,

  publish: Upload,
  csPublish: Upload,
  subscribe: Download,
  csSubscribe: Download,

  'optim.gradientDescent': Target,
  'optim.geneticAlgorithm': Dna,
  'optim.nelderMead': Triangle,

  'ml.linearRegression': TrendingUp,
  'ml.polynomialRegression': Sparkles,
  'ml.knnClassifier': GitFork,
  'ml.decisionTree': GitFork,

  'nn.dense': Brain,
  'nn.conv1d': Cpu,
  'nn.dropout': Zap,
  'nn.activation': Zap,
  'nn.sequential': Brain,
  'nn.trainer': Brain,
  'nn.export': FileOutput,

  annotation_text: Type,
  annotation_callout: MessageSquare,
  annotation_highlight: Highlighter,
  annotation_arrow: ArrowRight,
  annotation_leader: MoveRight,
}

/**
 * Returns a Lucide icon component for the given block type.
 * Falls back to Calculator for unrecognized operation nodes.
 */
export function getNodeTypeIcon(blockType: string): LucideIcon {
  return ICON_MAP[blockType] ?? Calculator
}
