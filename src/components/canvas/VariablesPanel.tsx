/**
 * VariablesPanel — project-level variable manager (H6-1, UX-17).
 *
 * Table-like layout with search, sorting, bulk operations, and inline editing.
 * UX-17 additions:
 *   - Value slider on each row (visible on hover)
 *   - "N bound" badge with jump-to-bound click
 *   - CSV import / export
 *   - Prefix-based variable groups
 *   - Influence analysis (which output nodes each variable affects)
 */

import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useVariablesStore } from '../../stores/variablesStore'
import type { ProjectVariable } from '../../lib/variables'
import type { NodeData } from '../../blocks/registry'
import { useTranslation } from 'react-i18next'
import { HelpLink } from '../ui/HelpLink'

export interface VariablesPanelProps {
  open: boolean
  onClose: () => void
  /** Current canvas nodes — passed from CanvasPage to avoid ReactFlowProvider dependency. */
  nodes: Node<NodeData>[]
  /** Current canvas edges — passed from CanvasPage to avoid ReactFlowProvider dependency. */
  edges: Edge[]
  /** Pan/zoom to show specific nodes by ID (delegates to CanvasAreaHandle.fitViewToNodes). */
  onFitViewToNodes: (nodeIds: string[]) => void
}

type SortKey = 'name' | 'value' | 'unit'
type SortDir = 'asc' | 'desc'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Export variables as a CSV string (name,value,unit,description). */
function buildVariablesCSV(vars: ProjectVariable[]): string {
  const rows = vars.map((v) => {
    const esc = (s: string) =>
      s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    return [esc(v.name), String(v.value), esc(v.unit ?? ''), esc(v.description ?? '')].join(',')
  })
  return ['name,value,unit,description', ...rows].join('\n')
}

/** Parse a CSV string into ProjectVariable objects. Skips rows with non-numeric value. */
function parseCSVVariables(text: string): Omit<ProjectVariable, 'id'>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  // Detect header row
  const header = lines[0].toLowerCase()
  const dataLines = header.includes('name') ? lines.slice(1) : lines
  const result: Omit<ProjectVariable, 'id'>[] = []
  for (const line of dataLines) {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const name = cells[0] ?? ''
    const value = parseFloat(cells[1] ?? '')
    if (!name || isNaN(value)) continue
    result.push({
      name,
      value,
      unit: cells[2] || undefined,
      description: cells[3] || undefined,
    })
  }
  return result
}

/** Forward-DFS from a set of start nodes to find all reachable output nodes. */
function findAffectedOutputs(
  startIds: string[],
  allNodes: Node<NodeData>[],
  allEdges: Edge[],
): string[] {
  const outputIds: string[] = []
  const visited = new Set<string>()
  const queue = [...startIds]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const node = allNodes.find((n) => n.id === id)
    if (node) {
      const bt = (node.data as NodeData).blockType
      if (bt === 'display' || bt === 'publish') outputIds.push(id)
    }
    for (const e of allEdges) {
      if (e.source === id && !visited.has(e.target)) queue.push(e.target)
    }
  }
  return outputIds
}

/** Extract group prefix from a variable name (text before first `_`, if any). */
function getGroupPrefix(name: string): string | null {
  const idx = name.indexOf('_')
  if (idx < 1) return null
  return name.slice(0, idx)
}

// ── Styles ──────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 40,
  left: 12,
  width: 580,
  maxHeight: 540,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 50,
  backdropFilter: 'blur(12px)',
  boxShadow: 'var(--shadow-lg)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 0.65rem',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  gap: '0.4rem',
}

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--font-sm)',
  fontWeight: 600,
  color: 'var(--text)',
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
}

const countBadge: React.CSSProperties = {
  fontSize: '0.6rem',
  padding: '0 4px',
  borderRadius: 3,
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--text-muted)',
  fontWeight: 600,
  marginLeft: 4,
}

const searchInput: React.CSSProperties = {
  flex: 1,
  minWidth: 80,
  maxWidth: 140,
  padding: '0.2rem 0.4rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  outline: 'none',
}

const btnSmall: React.CSSProperties = {
  padding: '0.18rem 0.5rem',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const bulkBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.3rem 0.65rem',
  borderBottom: '1px solid var(--border)',
  background: 'rgba(28,171,176,0.06)',
  fontSize: '0.72rem',
  flexShrink: 0,
}

const colHeader: React.CSSProperties = {
  fontSize: '0.58rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  userSelect: 'none',
  cursor: 'pointer',
  padding: '0.3rem 0',
  whiteSpace: 'nowrap',
}

const gridCols = '26px 1fr 90px 52px 1fr 52px 24px'

const colHeaderRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: gridCols,
  gap: '0.25rem',
  padding: '0 0.65rem',
  borderBottom: '1px solid var(--border)',
  alignItems: 'center',
  flexShrink: 0,
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: gridCols,
  gap: '0.25rem',
  padding: '0.3rem 0.65rem',
  alignItems: 'center',
}

const cellInput: React.CSSProperties = {
  width: '100%',
  padding: '0.2rem 0.3rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.75rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const cellInputFocus: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
}

const monoCell: React.CSSProperties = {
  ...cellInput,
  fontFamily: "'JetBrains Mono', monospace",
}

const deleteBtn: React.CSSProperties = {
  padding: '0.1rem 0.25rem',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-faint)',
  cursor: 'pointer',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  borderRadius: 'var(--radius-sm)',
  opacity: 0.4,
  lineHeight: 1,
}

const emptyStyle: React.CSSProperties = {
  padding: '2rem 0.75rem',
  textAlign: 'center',
  color: 'var(--text-faint)',
  fontSize: 'var(--font-sm)',
}

// ── VariableRow ─────────────────────────────────────────────────────────────

interface VariableRowProps {
  variable: ProjectVariable
  selected: boolean
  onToggleSelect: (id: string) => void
  /** Number of canvas nodes currently bound to this variable. */
  boundCount: number
  /** Focus canvas view on all nodes bound to this variable. */
  onJumpToBound: () => void
}

const VariableRow = memo(function VariableRow({
  variable,
  selected,
  onToggleSelect,
  boundCount,
  onJumpToBound,
}: VariableRowProps) {
  const { t } = useTranslation()
  const updateValue = useVariablesStore((s) => s.updateValue)
  const renameVariable = useVariablesStore((s) => s.renameVariable)
  const removeVariable = useVariablesStore((s) => s.removeVariable)
  const updateUnit = useVariablesStore((s) => s.updateUnit)
  const updateDescription = useVariablesStore((s) => s.updateDescription)
  const [hovered, setHovered] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const absVal = Math.abs(variable.value) || 1
  const sliderMin = variable.value - absVal * 3
  const sliderMax = variable.value + absVal * 3
  const sliderStep = absVal / 50

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected
          ? 'rgba(28,171,176,0.08)'
          : hovered
            ? 'rgba(255,255,255,0.02)'
            : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={rowStyle}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(variable.id)}
          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--primary)' }}
        />
        <input
          style={{
            ...cellInput,
            fontWeight: 500,
            ...(focusedField === 'name' ? cellInputFocus : {}),
          }}
          value={variable.name}
          onChange={(e) => renameVariable(variable.id, e.target.value)}
          onFocus={() => setFocusedField('name')}
          onBlur={() => setFocusedField(null)}
          placeholder={t('variablesPanel.colName').toLowerCase()}
        />
        <input
          type="number"
          style={{
            ...monoCell,
            ...(focusedField === 'value' ? cellInputFocus : {}),
          }}
          value={variable.value}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) updateValue(variable.id, v)
          }}
          onFocus={() => setFocusedField('value')}
          onBlur={() => setFocusedField(null)}
        />
        <input
          style={{
            ...cellInput,
            color: 'var(--text-muted)',
            ...(focusedField === 'unit' ? cellInputFocus : {}),
          }}
          value={variable.unit ?? ''}
          onChange={(e) => updateUnit(variable.id, e.target.value)}
          onFocus={() => setFocusedField('unit')}
          onBlur={() => setFocusedField(null)}
          placeholder="--"
        />
        <input
          style={{
            ...cellInput,
            color: 'var(--text-muted)',
            fontSize: '0.7rem',
            ...(focusedField === 'desc' ? cellInputFocus : {}),
          }}
          value={variable.description ?? ''}
          onChange={(e) => updateDescription(variable.id, e.target.value)}
          onFocus={() => setFocusedField('desc')}
          onBlur={() => setFocusedField(null)}
          placeholder="--"
        />
        {/* Bound count badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          {boundCount > 0 ? (
            <button
              onClick={onJumpToBound}
              title={t('variablesPanel.jumpToBound', 'Jump to bound blocks')}
              style={{
                fontSize: '0.6rem',
                padding: '1px 5px',
                background: 'rgba(28,171,176,0.1)',
                border: '1px solid rgba(28,171,176,0.3)',
                borderRadius: 3,
                color: 'var(--primary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {boundCount}×
            </button>
          ) : (
            <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', opacity: 0.4 }}>—</span>
          )}
        </div>
        <button
          style={{ ...deleteBtn, opacity: hovered ? 0.8 : 0.3 }}
          onClick={() => removeVariable(variable.id)}
          title={t('variablesPanel.deleteSelected')}
        >
          &times;
        </button>
      </div>

      {/* Value slider — visible on hover */}
      {hovered && (
        <div style={{ padding: '0 0.65rem 0.3rem', marginTop: -2 }}>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={variable.value}
            style={{ width: '100%', accentColor: 'var(--primary)', margin: 0 }}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) updateValue(variable.id, v)
            }}
          />
        </div>
      )}
    </div>
  )
})

// ── BulkUnitEditor ──────────────────────────────────────────────────────────

function BulkUnitEditor({ selectedIds, onDone }: { selectedIds: Set<string>; onDone: () => void }) {
  const { t } = useTranslation()
  const updateUnit = useVariablesStore((s) => s.updateUnit)
  const [unit, setUnit] = useState('')

  const handleApply = () => {
    for (const id of selectedIds) {
      updateUnit(id, unit)
    }
    onDone()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <input
        style={{ ...searchInput, maxWidth: 80, fontSize: '0.7rem' }}
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        placeholder={t('variablesPanel.unitPlaceholder', 'unit')}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleApply()
          if (e.key === 'Escape') onDone()
        }}
      />
      <button style={{ ...btnSmall, fontSize: '0.65rem' }} onClick={handleApply}>
        {t('variablesPanel.apply', 'Apply')}
      </button>
    </div>
  )
}

// ── BulkValueEditor ─────────────────────────────────────────────────────────

function BulkValueEditor({
  selectedIds,
  onDone,
}: {
  selectedIds: Set<string>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const updateValue = useVariablesStore((s) => s.updateValue)
  const [value, setValue] = useState('')

  const handleApply = () => {
    const v = parseFloat(value)
    if (isNaN(v)) return
    for (const id of selectedIds) {
      updateValue(id, v)
    }
    onDone()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <input
        type="number"
        style={{
          ...searchInput,
          maxWidth: 80,
          fontSize: '0.7rem',
          fontFamily: "'JetBrains Mono', monospace",
        }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('variablesPanel.valuePlaceholder', '0')}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleApply()
          if (e.key === 'Escape') onDone()
        }}
      />
      <button style={{ ...btnSmall, fontSize: '0.65rem' }} onClick={handleApply}>
        {t('variablesPanel.apply', 'Apply')}
      </button>
    </div>
  )
}

// ── InfluencePanel ──────────────────────────────────────────────────────────

interface InfluencePanelProps {
  variables: ProjectVariable[]
  allNodes: Node<NodeData>[]
  allEdges: Edge[]
}

function InfluencePanel({ variables, allNodes, allEdges }: InfluencePanelProps) {
  const { t } = useTranslation()

  const rows = useMemo(() => {
    return variables
      .map((v) => {
        const boundNodeIds = allNodes
          .filter((n) => (n.data as NodeData).varId === v.id)
          .map((n) => n.id)
        const affectedOutputIds = findAffectedOutputs(boundNodeIds, allNodes, allEdges)
        const affectedLabels = affectedOutputIds.map((id) => {
          const n = allNodes.find((x) => x.id === id)
          return n ? (n.data as NodeData).label || (n.data as NodeData).blockType : id
        })
        return { variable: v, affectedCount: affectedOutputIds.length, affectedLabels }
      })
      .sort((a, b) => b.affectedCount - a.affectedCount)
  }, [variables, allNodes, allEdges])

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: '1rem',
          color: 'var(--text-faint)',
          fontSize: '0.72rem',
          textAlign: 'center',
        }}
      >
        {t('variablesPanel.noVariables', 'No variables to analyse.')}
      </div>
    )
  }

  return (
    <div style={{ padding: '0.5rem 0.65rem', overflowY: 'auto', maxHeight: 220 }}>
      <p
        style={{
          fontSize: '0.65rem',
          color: 'var(--text-faint)',
          margin: '0 0 0.5rem',
          lineHeight: 1.4,
        }}
      >
        {t(
          'variablesPanel.influenceHint',
          "Each variable's downstream reach — which output nodes (Display / Publish) it feeds.",
        )}
      </p>
      {rows.map(({ variable, affectedCount, affectedLabels }) => (
        <div
          key={variable.id}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.4rem',
            padding: '0.2rem 0',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            fontSize: '0.72rem',
          }}
        >
          <span
            style={{
              fontWeight: 500,
              color: 'var(--text)',
              minWidth: 90,
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={variable.name}
          >
            {variable.name}
          </span>
          {affectedCount === 0 ? (
            <span style={{ color: 'var(--text-faint)' }}>no outputs reached</span>
          ) : (
            <>
              <span
                style={{
                  padding: '0 4px',
                  background: 'rgba(28,171,176,0.12)',
                  borderRadius: 3,
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  flexShrink: 0,
                }}
              >
                {affectedCount}
              </span>
              <span
                style={{
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={affectedLabels.join(', ')}
              >
                → {affectedLabels.join(', ')}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main panel ──────────────────────────────────────────────────────────────

export function VariablesPanel({
  open,
  onClose,
  nodes,
  edges,
  onFitViewToNodes,
}: VariablesPanelProps) {
  const { t } = useTranslation()
  const variables = useVariablesStore((s) => s.variables)
  const setVariable = useVariablesStore((s) => s.setVariable)
  const removeVariable = useVariablesStore((s) => s.removeVariable)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState<'none' | 'unit' | 'value'>('none')
  const [showInfluence, setShowInfluence] = useState(false)

  // Compute how many nodes are bound to each variable
  const boundCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const node of nodes) {
      const varId = (node.data as NodeData).varId
      if (varId) counts[varId] = (counts[varId] ?? 0) + 1
    }
    return counts
  }, [nodes])

  // Filter and sort variables
  const varList = useMemo(() => {
    let list = Object.values(variables)
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.description ?? '').toLowerCase().includes(q) ||
          (v.unit ?? '').toLowerCase().includes(q) ||
          String(v.value).includes(q),
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'value') cmp = a.value - b.value
      else if (sortKey === 'unit') cmp = (a.unit ?? '').localeCompare(b.unit ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [variables, search, sortKey, sortDir])

  // Group variables by name prefix (text before first `_`)
  const groupedRows = useMemo(() => {
    if (search.trim()) return null // no groups when searching
    // Count prefix occurrences
    const prefixCounts: Record<string, number> = {}
    for (const v of varList) {
      const prefix = getGroupPrefix(v.name)
      if (prefix) prefixCounts[prefix] = (prefixCounts[prefix] ?? 0) + 1
    }
    // Only group if ≥2 variables share a prefix
    const activeGroups = new Set(
      Object.entries(prefixCounts)
        .filter(([, c]) => c >= 2)
        .map(([k]) => k),
    )
    if (activeGroups.size === 0) return null

    // Build grouped list
    const result: Array<
      { type: 'group'; prefix: string } | { type: 'var'; variable: ProjectVariable }
    > = []
    const seenGroups = new Set<string>()
    for (const v of varList) {
      const prefix = getGroupPrefix(v.name)
      if (prefix && activeGroups.has(prefix)) {
        if (!seenGroups.has(prefix)) {
          seenGroups.add(prefix)
          result.push({ type: 'group', prefix })
        }
        result.push({ type: 'var', variable: v })
      } else {
        result.push({ type: 'var', variable: v })
      }
    }
    return result
  }, [varList, search])

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
    },
    [sortKey],
  )

  const handleAdd = useCallback(() => {
    const id = crypto.randomUUID()
    const count = Object.keys(variables).length
    setVariable({ id, name: `var${count + 1}`, value: 0 })
  }, [variables, setVariable])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    const visibleIds = varList.map((v) => v.id)
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(visibleIds)
    })
  }, [varList])

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) {
      removeVariable(id)
    }
    setSelectedIds(new Set())
  }, [selectedIds, removeVariable])

  const handleJumpToBound = useCallback(
    (varId: string) => {
      const boundNodeIds = nodes
        .filter((n) => (n.data as NodeData).varId === varId)
        .map((n) => n.id)
      if (boundNodeIds.length > 0) {
        onFitViewToNodes(boundNodeIds)
      }
    },
    [nodes, onFitViewToNodes],
  )

  const handleExportCSV = useCallback(() => {
    const csv = buildVariablesCSV(Object.values(variables))
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'variables.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [variables])

  const handleImportCSV = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const rows = parseCSVVariables(text)
        for (const row of rows) {
          const id = crypto.randomUUID()
          setVariable({ id, ...row })
        }
      }
      reader.readAsText(file)
    },
    [setVariable],
  )

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as unknown as globalThis.Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => window.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handler)
    }
  }, [open, onClose])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setSelectedIds(new Set())
  }, [])

  if (!open) return null

  const allCount = Object.keys(variables).length
  const visibleIds = varList.map((v) => v.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''

  const renderRow = (v: ProjectVariable) => (
    <VariableRow
      key={v.id}
      variable={v}
      selected={selectedIds.has(v.id)}
      onToggleSelect={toggleSelect}
      boundCount={boundCounts[v.id] ?? 0}
      onJumpToBound={() => handleJumpToBound(v.id)}
    />
  )

  return (
    <div ref={panelRef} style={panelStyle} data-tour="variables-panel">
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={titleStyle}>{t('variablesPanel.title', 'Variables')}</span>
          <span style={countBadge}>{allCount}</span>
          <HelpLink section="variables" />
        </div>
        <input
          style={searchInput}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('variablesPanel.search', 'Search...')}
        />
        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
          <button
            style={{
              ...btnSmall,
              color: showInfluence ? 'var(--primary)' : undefined,
              borderColor: showInfluence ? 'rgba(28,171,176,0.4)' : undefined,
            }}
            onClick={() => setShowInfluence((v) => !v)}
            title={t('variablesPanel.influenceTitle', 'Show influence analysis')}
          >
            ∿ Influence
          </button>
          <button
            style={btnSmall}
            onClick={handleExportCSV}
            title={t('variablesPanel.exportCSV', 'Export as CSV')}
          >
            ↓ CSV
          </button>
          <button
            style={btnSmall}
            onClick={() => fileInputRef.current?.click()}
            title={t('variablesPanel.importCSV', 'Import from CSV')}
          >
            ↑ CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportCSV(file)
              e.target.value = ''
            }}
          />
          <button style={btnSmall} onClick={handleAdd}>
            + {t('variablesPanel.add', 'Add')}
          </button>
          <button
            style={{ ...btnSmall, border: 'none' }}
            onClick={onClose}
            title={t('ui.close')}
            aria-label={t('ui.close')}
          >
            &times;
          </button>
        </div>
      </div>

      {/* Influence analysis panel */}
      {showInfluence && (
        <div
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'rgba(28,171,176,0.03)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '0.3rem 0.65rem 0',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
            }}
          >
            Influence Analysis
          </div>
          <InfluencePanel variables={varList} allNodes={nodes} allEdges={edges} />
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div style={bulkBar}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
            {selectedIds.size} {t('variablesPanel.selected', 'selected')}
          </span>
          <button
            style={{ ...btnSmall, fontSize: '0.65rem' }}
            onClick={() => setBulkMode(bulkMode === 'value' ? 'none' : 'value')}
          >
            {t('variablesPanel.setValues', 'Set value')}
          </button>
          <button
            style={{ ...btnSmall, fontSize: '0.65rem' }}
            onClick={() => setBulkMode(bulkMode === 'unit' ? 'none' : 'unit')}
          >
            {t('variablesPanel.setUnits', 'Set unit')}
          </button>
          {bulkMode === 'unit' && (
            <BulkUnitEditor selectedIds={selectedIds} onDone={() => setBulkMode('none')} />
          )}
          {bulkMode === 'value' && (
            <BulkValueEditor selectedIds={selectedIds} onDone={() => setBulkMode('none')} />
          )}
          <div style={{ marginLeft: 'auto' }}>
            <button
              style={{
                ...btnSmall,
                fontSize: '0.65rem',
                color: 'var(--danger)',
                borderColor: 'rgba(239,68,68,0.3)',
              }}
              onClick={handleBulkDelete}
            >
              {t('variablesPanel.deleteSelected', 'Delete')}
            </button>
          </div>
        </div>
      )}

      {/* Column headers */}
      <div style={colHeaderRow}>
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={toggleSelectAll}
          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--primary)' }}
          title={t('variablesPanel.selectAll', 'Select all')}
        />
        <span style={colHeader} onClick={() => handleSort('name')}>
          {t('variablesPanel.colName', 'Name')}
          {sortArrow('name')}
        </span>
        <span style={colHeader} onClick={() => handleSort('value')}>
          {t('variablesPanel.colValue', 'Value')}
          {sortArrow('value')}
        </span>
        <span style={colHeader} onClick={() => handleSort('unit')}>
          {t('variablesPanel.colUnit', 'Unit')}
          {sortArrow('unit')}
        </span>
        <span style={{ ...colHeader, cursor: 'default' }}>
          {t('variablesPanel.colDescription', 'Description')}
        </span>
        <span
          style={{ ...colHeader, cursor: 'default', textAlign: 'right' }}
          title={t('variablesPanel.boundHint', 'Nodes bound to this variable — click to focus')}
        >
          Bound
        </span>
        <span />
      </div>

      {/* Variable rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {varList.length === 0 ? (
          <div style={emptyStyle}>
            {search ? (
              t('variablesPanel.noResults', 'No variables match your search.')
            ) : (
              <>
                {t('variablesPanel.empty', 'No variables yet.')}
                <br />
                {t('variablesPanel.emptyHint', 'Click "+ Add" to create one.')}
              </>
            )}
          </div>
        ) : groupedRows ? (
          groupedRows.map((item, idx) =>
            item.type === 'group' ? (
              <div
                key={`group-${item.prefix}-${idx}`}
                style={{
                  padding: '0.35rem 0.65rem 0.1rem',
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--text-faint)',
                  textTransform: 'uppercase',
                  borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                  marginTop: idx > 0 ? '0.15rem' : 0,
                  userSelect: 'none',
                }}
              >
                {item.prefix}
              </div>
            ) : (
              renderRow(item.variable)
            ),
          )
        ) : (
          varList.map(renderRow)
        )}
      </div>
    </div>
  )
}
