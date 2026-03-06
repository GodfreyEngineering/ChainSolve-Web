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
} from 'lucide-react'

// ── Color mapping ──────────────────────────────────────────────────────────

const SOURCE_TYPES = new Set([
  'number',
  'slider',
  'constant',
  'material',
  'material_full',
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
const ANNOTATION_TYPES = new Set([
  'annotation_text',
  'annotation_callout',
  'annotation_highlight',
  'annotation_arrow',
  'annotation_leader',
])

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
  material_full: Gem,
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
