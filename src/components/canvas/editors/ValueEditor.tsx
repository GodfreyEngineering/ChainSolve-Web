/**
 * ValueEditor — rich input for port values: literal, constant, or variable (W12.2).
 *
 * Replaces bare `<input type="number">` on unconnected/overridden ports.
 *
 * Modes:
 *   - compact=true  → inline on the node (narrow, single row)
 *   - compact=false → inspector layout (wider)
 *
 * When bound to a constant or variable, shows a chip with the name
 * and resolved value. Clicking the chip opens the picker popover.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { InputBinding } from '../../../blocks/types'
import { useBindingContext } from '../../../contexts/BindingContext'
import { useVariablesStore } from '../../../stores/variablesStore'

interface ValueEditorProps {
  binding: InputBinding | undefined
  onChange: (binding: InputBinding) => void
  compact?: boolean
  override?: boolean
  className?: string
}

// ── Styles ──────────────────────────────────────────────────────────────

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.2rem',
  padding: '0.15rem 0.4rem',
  borderRadius: 4,
  fontSize: '0.68rem',
  fontFamily: "'JetBrains Mono', monospace",
  cursor: 'pointer',
  maxWidth: '100%',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  border: '1px solid',
}

const constChip: React.CSSProperties = {
  ...chipStyle,
  background: 'rgba(168,85,247,0.12)',
  borderColor: 'rgba(168,85,247,0.35)',
  color: '#c084fc',
}

const varChip: React.CSSProperties = {
  ...chipStyle,
  background: 'rgba(59,130,246,0.12)',
  borderColor: 'rgba(59,130,246,0.35)',
  color: '#93c5fd',
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 100,
  width: 220,
  maxHeight: 260,
  background: 'rgba(30,30,30,0.98)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.35rem 0.5rem',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  background: 'transparent',
  color: '#F4F4F3',
  fontSize: '0.75rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const listItemStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem',
  fontSize: '0.73rem',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const sectionLabel: React.CSSProperties = {
  padding: '0.3rem 0.5rem 0.15rem',
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: 'rgba(244,244,243,0.35)',
  textTransform: 'uppercase',
  userSelect: 'none',
}

// ── Component ───────────────────────────────────────────────────────────

export function ValueEditor({ binding, onChange, compact, override }: ValueEditorProps) {
  const { constants, catalog } = useBindingContext()
  const variables = useVariablesStore((s) => s.variables)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close popover on click outside
  useEffect(() => {
    if (!popoverOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [popoverOpen])

  // Focus search on open
  useEffect(() => {
    if (popoverOpen) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [popoverOpen])

  const openPopover = useCallback(() => {
    setSearch('')
    setPopoverOpen(true)
  }, [])

  const selectConst = useCallback(
    (opId: string) => {
      onChange({ kind: 'const', constOpId: opId })
      setPopoverOpen(false)
    },
    [onChange],
  )

  const selectVar = useCallback(
    (varId: string) => {
      onChange({ kind: 'var', varId })
      setPopoverOpen(false)
    },
    [onChange],
  )

  const switchToLiteral = useCallback(() => {
    // Resolve current binding to a number for a smooth transition
    let value = 0
    if (binding?.kind === 'const') {
      value = constants.get(binding.constOpId) ?? 0
    } else if (binding?.kind === 'var') {
      value = variables[binding.varId]?.value ?? 0
    } else if (binding?.kind === 'literal') {
      value = binding.value
    }
    onChange({ kind: 'literal', value })
    setPopoverOpen(false)
  }, [binding, constants, variables, onChange])

  const inputStyle: React.CSSProperties = {
    width: compact ? 52 : '100%',
    padding: compact ? '0.12rem 0.3rem' : '0.24rem 0.4rem',
    borderRadius: compact ? 4 : 5,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.2)',
    color: '#F4F4F3',
    fontSize: compact ? '0.65rem' : '0.78rem',
    fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
    boxSizing: 'border-box' as const,
    ...(override ? { borderColor: 'rgba(28,171,176,0.5)', color: '#1CABB0' } : {}),
  }

  // Filter catalog entries for the picker
  const lowerSearch = search.toLowerCase()
  const constEntries = catalog.filter(
    (e) =>
      e.nodeKind === 'csSource' &&
      e.inputs.length === 0 &&
      constants.has(e.opId) &&
      (e.label.toLowerCase().includes(lowerSearch) || e.opId.toLowerCase().includes(lowerSearch)),
  )
  const varEntries = Object.values(variables).filter(
    (v) => v.name.toLowerCase().includes(lowerSearch) || v.id.toLowerCase().includes(lowerSearch),
  )

  return (
    <div
      ref={containerRef}
      className={compact ? 'nodrag' : undefined}
      style={{
        position: 'relative',
        display: compact ? 'inline-flex' : 'flex',
        alignItems: 'center',
        gap: '0.2rem',
      }}
    >
      {/* Literal mode: number input + picker button */}
      {(!binding || binding.kind === 'literal') && (
        <>
          <input
            type="number"
            className={compact ? 'nodrag' : undefined}
            style={inputStyle}
            value={binding?.kind === 'literal' ? binding.value : ''}
            placeholder="0"
            step="any"
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) onChange({ kind: 'literal', value: v, raw: e.target.value })
            }}
            title={override ? 'Manual override (connected to upstream)' : 'Manual value'}
          />
          <button
            className={compact ? 'nodrag' : undefined}
            onClick={openPopover}
            style={{
              width: compact ? 14 : 20,
              height: compact ? 14 : 20,
              padding: 0,
              flexShrink: 0,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 3,
              color: 'rgba(244,244,243,0.4)',
              cursor: 'pointer',
              fontSize: compact ? '0.5rem' : '0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
            title="Bind to constant or variable"
          >
            &#8943;
          </button>
        </>
      )}

      {/* Const binding: show chip */}
      {binding?.kind === 'const' && (
        <button
          className={compact ? 'nodrag' : undefined}
          onClick={openPopover}
          style={{ ...constChip, fontSize: compact ? '0.6rem' : '0.68rem' }}
          title={`Constant: ${binding.constOpId} = ${constants.get(binding.constOpId) ?? '?'}`}
        >
          <span style={{ opacity: 0.6 }}>C</span>
          {catalog.find((e) => e.opId === binding.constOpId)?.label ?? binding.constOpId}
        </button>
      )}

      {/* Var binding: show chip */}
      {binding?.kind === 'var' && (
        <button
          className={compact ? 'nodrag' : undefined}
          onClick={openPopover}
          style={{ ...varChip, fontSize: compact ? '0.6rem' : '0.68rem' }}
          title={`Variable: ${variables[binding.varId]?.name ?? binding.varId} = ${variables[binding.varId]?.value ?? '?'}`}
        >
          <span style={{ opacity: 0.6 }}>x</span>
          {variables[binding.varId]?.name ?? binding.varId}
        </button>
      )}

      {/* Popover */}
      {popoverOpen && (
        <div style={popoverStyle}>
          <input
            ref={searchRef}
            style={searchInputStyle}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search constants & variables..."
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Literal option */}
            <div style={{ ...listItemStyle, color: '#F4F4F3' }} onMouseDown={switchToLiteral}>
              Literal value
            </div>

            {/* Variables */}
            {varEntries.length > 0 && (
              <>
                <div style={sectionLabel}>Variables</div>
                {varEntries.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      ...listItemStyle,
                      color: '#93c5fd',
                      background:
                        binding?.kind === 'var' && binding.varId === v.id
                          ? 'rgba(59,130,246,0.1)'
                          : undefined,
                    }}
                    onMouseDown={() => selectVar(v.id)}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.12)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background =
                        binding?.kind === 'var' && binding.varId === v.id
                          ? 'rgba(59,130,246,0.1)'
                          : ''
                    }}
                  >
                    <span>{v.name}</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        opacity: 0.6,
                      }}
                    >
                      {v.value}
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Constants */}
            {constEntries.length > 0 && (
              <>
                <div style={sectionLabel}>Constants</div>
                {constEntries.slice(0, 50).map((entry) => (
                  <div
                    key={entry.opId}
                    style={{
                      ...listItemStyle,
                      color: '#c084fc',
                      background:
                        binding?.kind === 'const' && binding.constOpId === entry.opId
                          ? 'rgba(168,85,247,0.1)'
                          : undefined,
                    }}
                    onMouseDown={() => selectConst(entry.opId)}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.12)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background =
                        binding?.kind === 'const' && binding.constOpId === entry.opId
                          ? 'rgba(168,85,247,0.1)'
                          : ''
                    }}
                  >
                    <span>{entry.label}</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        opacity: 0.6,
                      }}
                    >
                      {constants.get(entry.opId)?.toPrecision(6) ?? '?'}
                    </span>
                  </div>
                ))}
              </>
            )}

            {constEntries.length === 0 && varEntries.length === 0 && search && (
              <div
                style={{
                  padding: '0.6rem 0.5rem',
                  textAlign: 'center',
                  color: 'rgba(244,244,243,0.3)',
                  fontSize: '0.73rem',
                }}
              >
                No matches
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
