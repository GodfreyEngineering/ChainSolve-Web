/**
 * SankeyChart — 6.12: Pure SVG Sankey / flow diagram renderer.
 *
 * Expects TableValue data with (at minimum) three columns:
 *   [source_col]  numeric integer node IDs (0-based)
 *   [target_col]  numeric integer node IDs (0-based)
 *   [value_col]   flow amount (positive number)
 *
 * Node labels come from an optional fourth column (node names) OR the
 * nodeLabels array in the config.  Without labels, nodes are shown as
 * "Node 0", "Node 1", etc.
 *
 * The layout is a left-to-right multi-depth Sankey computed entirely in JS:
 *  - Nodes assigned to depth layers by BFS from roots (nodes with no in-edges)
 *  - Link thickness proportional to flow value
 *  - Bezier curves connecting source bar segments to target bar segments
 *
 * No D3 or external dependencies — pure React SVG.
 */

import { useMemo } from 'react'
import type { TableValue } from '../../engine/value'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SankeyChartProps {
  data: TableValue
  width: number
  height: number
  title?: string
  /** Column index for source IDs (default 0). */
  sourceColIdx?: number
  /** Column index for target IDs (default 1). */
  targetColIdx?: number
  /** Column index for flow values (default 2). */
  valueColIdx?: number
  /** Optional human-readable labels for node IDs. nodeLabels[id] = "My Node". */
  nodeLabels?: string[]
}

interface LayoutNode {
  id: number
  depth: number
  x: number
  y: number
  barH: number
  label: string
  color: string
}

interface LayoutLink {
  srcId: number
  tgtId: number
  value: number
  /** Top y-coordinate at the source bar */
  srcY: number
  /** Top y-coordinate at the target bar */
  tgtY: number
  /** Rendered height of the link ribbon */
  ribbonH: number
  color: string
}

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  '#1CABB0',
  '#f97316',
  '#8b5cf6',
  '#22c55e',
  '#ef4444',
  '#eab308',
  '#06b6d4',
  '#ec4899',
  '#a3e635',
  '#fb923c',
]

// ── Layout ────────────────────────────────────────────────────────────────────

const NODE_W = 18
const PAD_X = 14
const PAD_Y = 8
const MIN_BAR_H = 3

function sankeyLayout(
  rawLinks: { src: number; tgt: number; val: number }[],
  nodeLabels: string[],
  W: number,
  H: number,
): { nodes: LayoutNode[]; links: LayoutLink[] } | null {
  if (rawLinks.length === 0) return null

  // Collect unique node IDs
  const allIds = new Set<number>()
  for (const l of rawLinks) {
    allIds.add(l.src)
    allIds.add(l.tgt)
  }
  const nodeIds = Array.from(allIds).sort((a, b) => a - b)

  // BFS depth assignment starting from nodes with no incoming edges
  const inSet = new Set(rawLinks.map((l) => l.tgt))
  const depthMap = new Map<number, number>()
  const queue: number[] = []
  for (const id of nodeIds) {
    if (!inSet.has(id)) {
      depthMap.set(id, 0)
      queue.push(id)
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift()!
    const d = depthMap.get(cur) ?? 0
    for (const link of rawLinks) {
      if (link.src === cur) {
        const prev = depthMap.get(link.tgt)
        if (prev === undefined || prev <= d) {
          depthMap.set(link.tgt, d + 1)
          queue.push(link.tgt)
        }
      }
    }
  }
  for (const id of nodeIds) {
    if (!depthMap.has(id)) depthMap.set(id, 0)
  }

  const maxDepth = Math.max(...Array.from(depthMap.values()))

  // Compute total in/out flow per node
  const outFlow = new Map<number, number>()
  const inFlow = new Map<number, number>()
  for (const id of nodeIds) {
    outFlow.set(id, 0)
    inFlow.set(id, 0)
  }
  for (const l of rawLinks) {
    outFlow.set(l.src, (outFlow.get(l.src) ?? 0) + l.val)
    inFlow.set(l.tgt, (inFlow.get(l.tgt) ?? 0) + l.val)
  }

  // Group by depth
  const byDepth = new Map<number, number[]>()
  for (const id of nodeIds) {
    const d = depthMap.get(id) ?? 0
    if (!byDepth.has(d)) byDepth.set(d, [])
    byDepth.get(d)!.push(id)
  }

  // Global max flow for proportional bar heights
  const globalMax = Math.max(
    ...nodeIds.map((id) => Math.max(outFlow.get(id) ?? 0, inFlow.get(id) ?? 0)),
    1,
  )

  const usableW = W - PAD_X * 2 - NODE_W
  const usableH = H - PAD_Y * 2

  const xOf = (d: number) => (maxDepth === 0 ? PAD_X : PAD_X + (d / maxDepth) * usableW)

  const nodeMap = new Map<number, LayoutNode>()

  for (const [d, ids] of byDepth.entries()) {
    const n = ids.length
    const totalPad = PAD_Y * (n + 1)
    const available = usableH - totalPad

    let curY = PAD_Y
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const flow = Math.max(outFlow.get(id) ?? 0, inFlow.get(id) ?? 0, 0.001)
      const barH = Math.max((flow / globalMax) * available, MIN_BAR_H)
      nodeMap.set(id, {
        id,
        depth: d,
        x: xOf(d),
        y: curY,
        barH,
        label: nodeLabels[id] ?? `Node ${id}`,
        color: PALETTE[id % PALETTE.length],
      })
      curY += barH + PAD_Y
    }
  }

  // Compute link ribbons (cumulative y-offsets per node)
  const srcOffset = new Map<number, number>()
  const tgtOffset = new Map<number, number>()
  for (const id of nodeIds) {
    srcOffset.set(id, 0)
    tgtOffset.set(id, 0)
  }

  // Sort links for deterministic ribbon stacking
  const sorted = [...rawLinks].sort((a, b) => a.tgt - b.tgt || a.src - b.src)

  const links: LayoutLink[] = []
  for (const l of sorted) {
    const srcNode = nodeMap.get(l.src)
    const tgtNode = nodeMap.get(l.tgt)
    if (!srcNode || !tgtNode) continue

    const srcTotal = Math.max(outFlow.get(l.src) ?? 1, 1)
    const tgtTotal = Math.max(inFlow.get(l.tgt) ?? 1, 1)
    const srcRibbon = (l.val / srcTotal) * srcNode.barH
    const tgtRibbon = (l.val / tgtTotal) * tgtNode.barH
    const ribbonH = Math.max((srcRibbon + tgtRibbon) / 2, 1)

    const srcOff = srcOffset.get(l.src) ?? 0
    const tgtOff = tgtOffset.get(l.tgt) ?? 0

    links.push({
      srcId: l.src,
      tgtId: l.tgt,
      value: l.val,
      srcY: srcNode.y + srcOff,
      tgtY: tgtNode.y + tgtOff,
      ribbonH,
      color: srcNode.color,
    })

    srcOffset.set(l.src, srcOff + srcRibbon)
    tgtOffset.set(l.tgt, tgtOff + tgtRibbon)
  }

  return { nodes: Array.from(nodeMap.values()), links }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SankeyChart({
  data,
  width,
  height,
  title,
  sourceColIdx = 0,
  targetColIdx = 1,
  valueColIdx = 2,
  nodeLabels = [],
}: SankeyChartProps) {
  const rawLinks = useMemo(() => {
    const result: { src: number; tgt: number; val: number }[] = []
    for (const row of data.rows) {
      const src = row[sourceColIdx]
      const tgt = row[targetColIdx]
      const val = row[valueColIdx]
      if (src != null && tgt != null && val != null && val > 0) {
        result.push({ src: Math.round(src), tgt: Math.round(tgt), val })
      }
    }
    return result
  }, [data.rows, sourceColIdx, targetColIdx, valueColIdx])

  const titleH = title ? 20 : 0
  const chartH = height - titleH

  const layout = useMemo(
    () => sankeyLayout(rawLinks, nodeLabels, width, chartH),
    [rawLinks, nodeLabels, width, chartH],
  )

  if (!layout) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-faint, #888)',
          fontSize: '0.75rem',
          textAlign: 'center',
          padding: '0 1rem',
        }}
      >
        No flow data — connect a table with source (int), target (int), value columns
      </div>
    )
  }

  const { nodes, links } = layout
  const maxDepth = Math.max(...nodes.map((n) => n.depth))

  return (
    <div style={{ width, height, position: 'relative' }}>
      {title && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text, #F4F4F3)',
            paddingTop: 4,
            height: titleH,
            lineHeight: `${titleH}px`,
          }}
        >
          {title}
        </div>
      )}
      <svg width={width} height={chartH} style={{ display: 'block', overflow: 'visible' }}>
        {/* Ribbons drawn first so node bars overlay them */}
        {links.map((link, i) => {
          const srcNode = nodes.find((n) => n.id === link.srcId)!
          const tgtNode = nodes.find((n) => n.id === link.tgtId)!
          const x1 = srcNode.x + NODE_W
          const x2 = tgtNode.x
          const cy = (x1 + x2) / 2
          const y1top = link.srcY
          const y1bot = link.srcY + link.ribbonH
          const y2top = link.tgtY
          const y2bot = link.tgtY + link.ribbonH

          const d =
            `M ${x1} ${y1top}` +
            ` C ${cy} ${y1top}, ${cy} ${y2top}, ${x2} ${y2top}` +
            ` L ${x2} ${y2bot}` +
            ` C ${cy} ${y2bot}, ${cy} ${y1bot}, ${x1} ${y1bot}` +
            ` Z`

          return (
            <path
              key={i}
              d={d}
              fill={link.color}
              fillOpacity={0.38}
              stroke={link.color}
              strokeOpacity={0.2}
              strokeWidth={0.5}
            />
          )
        })}

        {/* Node bars */}
        {nodes.map((node) => {
          const isLast = node.depth === maxDepth
          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={Math.max(node.barH, MIN_BAR_H)}
                fill={node.color}
                rx={2}
              />
              <text
                x={isLast ? node.x - 5 : node.x + NODE_W + 5}
                y={node.y + Math.max(node.barH, MIN_BAR_H) / 2}
                textAnchor={isLast ? 'end' : 'start'}
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--text, #F4F4F3)"
                fontFamily="system-ui, sans-serif"
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
