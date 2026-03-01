/**
 * VariablesPanel — collapsible panel for managing project-level variables (W12.2).
 *
 * Accessible from a button in the bottom toolbar. Lists all variables
 * with inline editing for name, value, and description. Follows the
 * Inspector styling pattern (same bg, fonts, field labels).
 */

import { useRef, useEffect, useCallback } from 'react'
import { useVariablesStore } from '../../stores/variablesStore'
import type { ProjectVariable } from '../../lib/variables'

interface VariablesPanelProps {
  open: boolean
  onClose: () => void
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 40,
  left: 12,
  width: 340,
  maxHeight: 420,
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
  padding: '0.55rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--font-sm)',
  fontWeight: 600,
  color: 'var(--text)',
  letterSpacing: '0.02em',
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
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0.4rem 0',
}

const emptyStyle: React.CSSProperties = {
  padding: '1.5rem 0.75rem',
  textAlign: 'center',
  color: 'var(--text-faint)',
  fontSize: 'var(--font-sm)',
}

const rowStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  borderBottom: '1px solid var(--border)',
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '0.24rem 0.4rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: 'var(--font-sm)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const monoInp: React.CSSProperties = {
  ...inp,
  fontFamily: "'JetBrains Mono', monospace",
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  userSelect: 'none',
}

const deleteBtn: React.CSSProperties = {
  padding: '0.1rem 0.35rem',
  border: 'none',
  background: 'transparent',
  color: 'var(--danger)',
  cursor: 'pointer',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
  opacity: 0.6,
}

function VariableRow({ variable }: { variable: ProjectVariable }) {
  const updateValue = useVariablesStore((s) => s.updateValue)
  const renameVariable = useVariablesStore((s) => s.renameVariable)
  const removeVariable = useVariablesStore((s) => s.removeVariable)
  const updateUnit = useVariablesStore((s) => s.updateUnit)
  const updateDescription = useVariablesStore((s) => s.updateDescription)

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <div style={{ flex: 1 }}>
          <span style={fieldLabel}>Name</span>
          <input
            style={inp}
            value={variable.name}
            onChange={(e) => renameVariable(variable.id, e.target.value)}
            placeholder="Variable name"
          />
        </div>
        <div style={{ width: 90, flexShrink: 0 }}>
          <span style={fieldLabel}>Value</span>
          <input
            type="number"
            style={monoInp}
            value={variable.value}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) updateValue(variable.id, v)
            }}
          />
        </div>
        <div style={{ width: 60, flexShrink: 0 }}>
          <span style={fieldLabel}>Unit</span>
          <input
            style={inp}
            value={variable.unit ?? ''}
            onChange={(e) => updateUnit(variable.id, e.target.value)}
            placeholder="e.g. m/s"
          />
        </div>
        <button
          style={{ ...deleteBtn, alignSelf: 'flex-end', marginBottom: '0.1rem' }}
          onClick={() => removeVariable(variable.id)}
          title="Delete variable"
        >
          &times;
        </button>
      </div>
      <div>
        <span style={fieldLabel}>Description</span>
        <input
          style={inp}
          value={variable.description ?? ''}
          onChange={(e) => updateDescription(variable.id, e.target.value)}
          placeholder="Optional description"
        />
      </div>
    </div>
  )
}

export function VariablesPanel({ open, onClose }: VariablesPanelProps) {
  const variables = useVariablesStore((s) => s.variables)
  const setVariable = useVariablesStore((s) => s.setVariable)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleAdd = useCallback(() => {
    const id = crypto.randomUUID()
    const count = Object.keys(variables).length
    setVariable({
      id,
      name: `var${count + 1}`,
      value: 0,
    })
  }, [variables, setVariable])

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
    // Delay to avoid catching the opening click
    const timer = setTimeout(() => window.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handler)
    }
  }, [open, onClose])

  if (!open) return null

  const varList = Object.values(variables)

  return (
    <div ref={panelRef} style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Variables</span>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button style={btnSmall} onClick={handleAdd}>
            + Add
          </button>
          <button style={{ ...btnSmall, border: 'none' }} onClick={onClose}>
            &times;
          </button>
        </div>
      </div>
      <div style={listStyle}>
        {varList.length === 0 ? (
          <div style={emptyStyle}>
            No variables yet.
            <br />
            Click "+ Add" to create one.
          </div>
        ) : (
          varList.map((v) => <VariableRow key={v.id} variable={v} />)
        )}
      </div>
    </div>
  )
}
