/**
 * FormulaBar — UX-16: Hideable formula/expression bar below canvas toolbar.
 *
 * - Number/Slider source nodes: editable `= {value}` input; supports math expressions
 *   (2*pi, sqrt(2), sin(30*pi/180), etc.) which are parsed on Enter/blur commit.
 * - Operation nodes: read-only `= {formula}` derived from block description output clause.
 * - All other nodes: read-only label display.
 *
 * Positioned absolute at top of canvas wrapper div.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node } from '@xyflow/react'
import type { NodeData } from '../../blocks/types'
import { BLOCK_DESCRIPTIONS } from '../../blocks/blockDescriptions'
import { isScalar } from '../../engine/value'
import type { Value } from '../../engine/value'
import { safeEvalFormula, validateFormula, FORMULA_SYMBOLS } from '../../lib/formulaEval'
import type { FormulaSymbol } from '../../lib/formulaEval'

/** Extract the formula clause from a block description (e.g. "Output = A + B"). */
function extractFormula(blockType: string): string {
  const desc = BLOCK_DESCRIPTIONS[blockType]
  if (!desc) return blockType
  const match = desc.match(/[Oo]utput\s*=\s*([^.]+)/)
  if (match) return match[1].trim()
  // Second heuristic: "Returns X" pattern
  const returnsMatch = desc.match(/[Rr]eturns\s+([^.]+)/)
  if (returnsMatch) return returnsMatch[1].trim()
  return blockType
}

// ── Component ────────────────────────────────────────────────────────────────

export const FORMULA_BAR_HEIGHT = 28

/** 6.06: Upstream variable info for context-aware autocomplete. */
export interface FormulaUpstreamVar {
  /** Variable or node label (e.g. "Force", "length"). */
  name: string
  /** Current computed value, if available. */
  value?: number
  /** Source node ID. */
  nodeId: string
}

interface FormulaBarProps {
  nodeId: string | null
  node: Node<NodeData> | null
  computedValue: Value | undefined
  /** Called when the user commits a new expression for a source node. */
  onCommit: (nodeId: string, value: number) => void
  /** 6.06: Upstream variables available for context-aware autocomplete. */
  upstreamVars?: FormulaUpstreamVar[]
}

export function FormulaBar({ nodeId, node, computedValue, onCommit, upstreamVars }: FormulaBarProps) {
  const { t } = useTranslation()
  const nd = node?.data as NodeData | undefined
  const isEditable =
    nd !== undefined &&
    (nd.blockType === 'number' || nd.blockType === 'slider' || nd.blockType === 'variableSource')

  // Live draft while editing
  const [draft, setDraft] = useState('')
  // Track which node is being edited (null = not editing).
  // Using node ID instead of a boolean avoids useEffect-based reset.
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [acItems, setAcItems] = useState<FormulaSymbol[]>([])
  const [acIndex, setAcIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const editing = editingNodeId !== null && editingNodeId === nodeId

  /** Extract the current word being typed (for autocomplete). */
  const getWordAtCursor = useCallback((text: string, cursorPos: number): string => {
    const before = text.slice(0, cursorPos)
    const match = before.match(/[a-zA-Z_]\w*$/)
    return match ? match[0].toLowerCase() : ''
  }, [])

  // 6.06: Build upstream variable symbols for autocomplete
  const upstreamSymbols = useMemo((): FormulaSymbol[] => {
    if (!upstreamVars?.length) return []
    return upstreamVars.map((v) => ({
      name: v.name.toLowerCase().replace(/\s+/g, '_'),
      kind: 'constant' as const,
      description: v.value !== undefined ? `= ${v.value} (from ${v.name})` : `from ${v.name}`,
    }))
  }, [upstreamVars])

  /** Update autocomplete suggestions based on current draft. */
  const updateAutocomplete = useCallback(
    (text: string, cursorPos: number) => {
      const word = getWordAtCursor(text, cursorPos)
      if (word.length >= 1) {
        // 6.06: Merge upstream vars (shown first) with formula symbols
        const allSymbols = [...upstreamSymbols, ...FORMULA_SYMBOLS]
        const matches = allSymbols.filter((s) => s.name.startsWith(word) && s.name !== word)
        setAcItems(matches.slice(0, 8))
        setAcIndex(0)
      } else {
        setAcItems([])
      }
      // Live validation
      const stripped = text.trim().replace(/^=\s*/, '')
      if (stripped) {
        const msg = validateFormula(stripped)
        setValidationMsg(msg)
      } else {
        setValidationMsg(null)
      }
    },
    [getWordAtCursor, upstreamSymbols],
  )

  /** Accept an autocomplete suggestion. */
  const acceptAutocomplete = useCallback(
    (symbol: FormulaSymbol) => {
      const input = inputRef.current
      if (!input) return
      const cursorPos = input.selectionStart ?? draft.length
      const word = getWordAtCursor(draft, cursorPos)
      const before = draft.slice(0, cursorPos - word.length)
      const after = draft.slice(cursorPos)
      const insertion = symbol.kind === 'function' ? symbol.name + '(' : symbol.name
      const newDraft = before + insertion + after
      setDraft(newDraft)
      setAcItems([])
      // Move cursor after insertion
      const newPos = before.length + insertion.length
      requestAnimationFrame(() => {
        input.setSelectionRange(newPos, newPos)
        input.focus()
      })
    },
    [draft, getWordAtCursor],
  )

  // Memoize tooltip for hovered autocomplete items
  const acTooltip = useMemo(() => {
    if (acItems.length === 0) return null
    const item = acItems[acIndex]
    return item ? `${item.signature ?? item.name}: ${item.description}` : null
  }, [acItems, acIndex])

  const startEdit = useCallback(() => {
    if (!isEditable || !nodeId) return
    const raw = nd?.value !== undefined && !isNaN(nd.value as number) ? String(nd.value) : ''
    setDraft(raw)
    setEditingNodeId(nodeId)
    setError(false)
  }, [isEditable, nodeId, nd])

  const commit = useCallback(() => {
    if (!nodeId || !editing) {
      setEditingNodeId(null)
      return
    }
    const trimmed = draft.trim().replace(/^=\s*/, '')
    const n = safeEvalFormula(trimmed)
    if (n !== null) {
      onCommit(nodeId, n)
      setError(false)
    } else {
      setError(true)
    }
    setEditingNodeId(null)
  }, [nodeId, editing, draft, onCommit])

  const cancel = useCallback(() => {
    setEditingNodeId(null)
    setError(false)
  }, [])

  // Derive display text
  const getDisplayText = (): string => {
    if (!nd || !nodeId) return ''
    if (isEditable) {
      const numVal = computedValue && isScalar(computedValue) ? computedValue.value : nd.value
      if (numVal !== undefined && !isNaN(numVal as number)) return String(numVal)
      return ''
    }
    // Operation / other nodes: show formula from description
    return extractFormula(nd.blockType)
  }

  const displayText = getDisplayText()
  const nodeLabel = nd?.label ?? (nodeId ? '…' : '')

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 12,
        height: FORMULA_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
        fontSize: '0.78rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }}
    >
      {/* Node label badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          borderRight: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text-faint)',
          minWidth: 100,
          maxWidth: 160,
          fontSize: '0.7rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          flexShrink: 0,
        }}
        title={nodeLabel}
      >
        {nodeLabel || t('formulaBar.noSelection', 'No selection')}
      </div>

      {/* "=" sign */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 6px',
          color: error ? 'var(--danger-text)' : 'var(--accent)',
          fontWeight: 700,
          fontSize: '0.9rem',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        =
      </div>

      {/* Formula input (editing) or display (read-only / idle) */}
      {editing && isEditable && nodeId ? (
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(false)
              updateAutocomplete(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }}
            onBlur={() => {
              // Delay to allow autocomplete click
              setTimeout(() => {
                setAcItems([])
                commit()
              }, 150)
            }}
            onKeyDown={(e) => {
              // Autocomplete navigation
              if (acItems.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setAcIndex((i) => Math.min(i + 1, acItems.length - 1))
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setAcIndex((i) => Math.max(i - 1, 0))
                  return
                }
                if (e.key === 'Tab' || (e.key === 'Enter' && acItems.length > 0)) {
                  e.preventDefault()
                  acceptAutocomplete(acItems[acIndex])
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setAcItems([])
                  return
                }
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
            placeholder={t('canvas.formulaBarPlaceholder')}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              padding: '0 4px',
              height: '100%',
              ...(validationMsg
                ? { textDecoration: 'underline wavy var(--danger-text)', textUnderlineOffset: '3px' }
                : {}),
            }}
            title={validationMsg ?? acTooltip ?? undefined}
          />
          {/* Autocomplete dropdown */}
          {acItems.length > 0 && (
            <div style={acDropdownStyle}>
              {acItems.map((item, i) => (
                <div
                  key={item.name}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    acceptAutocomplete(item)
                  }}
                  style={{
                    ...acItemStyle,
                    background: i === acIndex ? 'var(--primary-dim)' : 'transparent',
                  }}
                >
                  <span style={{ fontWeight: 600, color: item.kind === 'function' ? 'var(--primary)' : 'var(--warning)' }}>
                    {item.signature ?? item.name}
                  </span>
                  <span style={{ opacity: 0.5, marginLeft: 8 }}>{item.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={isEditable ? startEdit : undefined}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: '0 4px',
            color: error
              ? 'var(--danger-text)'
              : nodeId
                ? isEditable
                  ? 'var(--text)'
                  : 'var(--text-muted)'
                : 'var(--text-faint)',
            cursor: isEditable ? 'text' : 'default',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
          title={isEditable ? t('formulaBar.clickToEdit', 'Click or press = to edit') : displayText}
        >
          {error
            ? t('formulaBar.error', 'Invalid expression')
            : displayText ||
              (nodeId ? '' : t('formulaBar.hint', 'Select a block to see its formula'))}
        </div>
      )}

      {/* Keyboard hint */}
      {isEditable && !editing && nodeId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 6px',
            color: 'var(--text-faint)',
            fontSize: '0.6rem',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {t('formulaBar.hint2', 'Click or = to edit')}
        </div>
      )}
    </div>
  )
}

// ── Autocomplete styles ─────────────────────────────────────────────────────

const acDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 100,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderTop: 'none',
  borderRadius: '0 0 6px 6px',
  boxShadow: 'var(--shadow-lg)',
  maxHeight: 200,
  overflowY: 'auto',
  fontFamily: "ui-monospace, 'Cascadia Code', monospace",
  fontSize: '0.72rem',
}

const acItemStyle: React.CSSProperties = {
  padding: '4px 8px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
}
