/**
 * VariablesPanel — project-level variable manager (H6-1).
 *
 * Table-like layout with search, sorting, bulk operations, and inline editing.
 * Handles hundreds of variables efficiently. Accessible from the bottom toolbar.
 */

import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react'
import { useVariablesStore } from '../../stores/variablesStore'
import type { ProjectVariable } from '../../lib/variables'
import { useTranslation } from 'react-i18next'
import { HelpLink } from '../ui/HelpLink'

export interface VariablesPanelProps {
  open: boolean
  onClose: () => void
}

type SortKey = 'name' | 'value' | 'unit'
type SortDir = 'asc' | 'desc'

// ── Styles ──────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 40,
  left: 12,
  width: 560,
  maxHeight: 520,
  background: 'var(--card-bg)',
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
  maxWidth: 160,
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

const gridCols = '26px 1fr 90px 52px 1fr 24px'

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
  borderBottom: '1px solid rgba(255,255,255,0.04)',
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
}

const VariableRow = memo(function VariableRow({
  variable,
  selected,
  onToggleSelect,
}: VariableRowProps) {
  const updateValue = useVariablesStore((s) => s.updateValue)
  const renameVariable = useVariablesStore((s) => s.renameVariable)
  const removeVariable = useVariablesStore((s) => s.removeVariable)
  const updateUnit = useVariablesStore((s) => s.updateUnit)
  const updateDescription = useVariablesStore((s) => s.updateDescription)
  const [hovered, setHovered] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  return (
    <div
      style={{
        ...rowStyle,
        background: selected
          ? 'rgba(28,171,176,0.08)'
          : hovered
            ? 'rgba(255,255,255,0.02)'
            : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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
        placeholder="name"
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
      <button
        style={{ ...deleteBtn, opacity: hovered ? 0.8 : 0.3 }}
        onClick={() => removeVariable(variable.id)}
        title="Delete variable"
      >
        &times;
      </button>
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

// ── Main panel ──────────────────────────────────────────────────────────────

export function VariablesPanel({ open, onClose }: VariablesPanelProps) {
  const { t } = useTranslation()
  const variables = useVariablesStore((s) => s.variables)
  const setVariable = useVariablesStore((s) => s.setVariable)
  const removeVariable = useVariablesStore((s) => s.removeVariable)
  const panelRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState<'none' | 'unit' | 'value'>('none')

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
    setVariable({
      id,
      name: `var${count + 1}`,
      value: 0,
    })
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
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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

  return (
    <div ref={panelRef} style={panelStyle}>
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
        <div style={{ display: 'flex', gap: '0.3rem' }}>
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
        ) : (
          varList.map((v) => (
            <VariableRow
              key={v.id}
              variable={v}
              selected={selectedIds.has(v.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
