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

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node } from '@xyflow/react'
import type { NodeData } from '../../blocks/types'
import { BLOCK_DESCRIPTIONS } from '../../blocks/blockDescriptions'
import { isScalar } from '../../engine/value'
import type { Value } from '../../engine/value'
import { safeEvalFormula, validateFormula, FORMULA_SYMBOLS } from '../../lib/formulaEval'
import type { FormulaSymbol } from '../../lib/formulaEval'

// ── 3.49: Expression history stored in localStorage ─────────────────────────

const HISTORY_KEY = 'chainsolve.formulaHistory'
const HISTORY_MAX = 50

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // localStorage may be unavailable (private browsing)
  }
}

/** Prepend an entry, deduplicate, and cap at HISTORY_MAX. */
function pushHistory(history: string[], entry: string): string[] {
  const deduped = [entry, ...history.filter((h) => h !== entry)]
  return deduped.slice(0, HISTORY_MAX)
}

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
  /** Phase 11: Called when user submits a CSEL expression to create blocks. */
  onExpressionSubmit?: (expression: string) => void
}

export function FormulaBar({
  nodeId,
  node,
  computedValue,
  onCommit,
  upstreamVars,
  onExpressionSubmit,
}: FormulaBarProps) {
  const { t } = useTranslation()
  const nd = node?.data as NodeData | undefined
  const isEditable =
    nd !== undefined &&
    (nd.blockType === 'number' || nd.blockType === 'slider' || nd.blockType === 'variableSource')

  // Phase 11: Expression mode — type CSEL expressions to create blocks
  const [expressionMode, setExpressionMode] = useState(false)
  const [exprDraft, setExprDraft] = useState('')
  const [exprError, setExprError] = useState<string | null>(null)

  // 3.49: Expression history — persisted across page reloads
  const [history, setHistory] = useState<string[]>(() => loadHistory())
  /** -1 = live draft; 0..N-1 = navigating history */
  const [historyIdx, setHistoryIdx] = useState(-1)
  /** Save the live draft when entering history navigation */
  const liveDraftRef = useRef('')

  // Keep liveDraftRef in sync with exprDraft when not navigating history
  useEffect(() => {
    if (historyIdx === -1) liveDraftRef.current = exprDraft
  }, [exprDraft, historyIdx])

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
      {/* Phase 11: Expression mode toggle */}
      <button
        onClick={() => {
          setExpressionMode((v) => !v)
          setExprError(null)
          setExprDraft('')
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          border: 'none',
          borderRight: '1px solid var(--border)',
          background: expressionMode ? '#1CABB022' : 'var(--surface-2)',
          color: expressionMode ? '#1CABB0' : 'var(--text-faint)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 700,
          flexShrink: 0,
        }}
        title={
          expressionMode
            ? t('formulaBar.exitExprMode', 'Exit expression mode')
            : t('formulaBar.enterExprMode', 'Expression mode — type to create blocks')
        }
      >
        {expressionMode ? '\u2A2F' : 'fx'}
      </button>

      {/* Phase 11: Expression mode input — full-width for CSEL expressions */}
      {expressionMode ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
          <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem', flexShrink: 0 }}>=</span>
          <input
            autoFocus
            value={exprDraft}
            onChange={(e) => {
              setExprDraft(e.target.value)
              setExprError(null)
              // Typing resets history navigation — user is editing a new expression
              if (historyIdx !== -1) setHistoryIdx(-1)
            }}
            onKeyDown={(e) => {
              // 3.49: Up arrow — navigate backwards through history
              if (e.key === 'ArrowUp' && history.length > 0) {
                e.preventDefault()
                const nextIdx = historyIdx + 1
                if (nextIdx < history.length) {
                  setHistoryIdx(nextIdx)
                  setExprDraft(history[nextIdx])
                  setExprError(null)
                }
                return
              }
              // 3.49: Down arrow — navigate forwards / back to live draft
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (historyIdx > 0) {
                  const nextIdx = historyIdx - 1
                  setHistoryIdx(nextIdx)
                  setExprDraft(history[nextIdx])
                  setExprError(null)
                } else if (historyIdx === 0) {
                  setHistoryIdx(-1)
                  setExprDraft(liveDraftRef.current)
                  setExprError(null)
                }
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const expr = exprDraft.trim()
                if (!expr) return
                try {
                  onExpressionSubmit?.(expr)
                  // 3.49: Save to history on successful submit
                  const newHistory = pushHistory(history, expr)
                  setHistory(newHistory)
                  saveHistory(newHistory)
                  setExprDraft('')
                  setExprError(null)
                  setHistoryIdx(-1)
                  liveDraftRef.current = ''
                } catch (err) {
                  setExprError(String(err))
                }
              }
              if (e.key === 'Escape') {
                setExpressionMode(false)
                setExprDraft('')
                setExprError(null)
                setHistoryIdx(-1)
              }
            }}
            placeholder={t(
              'formulaBar.exprPlaceholder',
              'Type expression... e.g. 1+2= or sin(pi/4)= or x=5; x*2=',
            )}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: exprError ? 'var(--danger)' : 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          />
          {exprError && (
            <span style={{ color: 'var(--danger)', fontSize: '0.65rem', flexShrink: 0 }}>
              {exprError}
            </span>
          )}
        </div>
      ) : (
        <>
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
                  updateAutocomplete(
                    e.target.value,
                    e.target.selectionStart ?? e.target.value.length,
                  )
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
                    ? {
                        textDecoration: 'underline wavy var(--danger-text)',
                        textUnderlineOffset: '3px',
                      }
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
                      <span
                        style={{
                          fontWeight: 600,
                          color: item.kind === 'function' ? 'var(--primary)' : 'var(--warning)',
                        }}
                      >
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
              title={
                isEditable ? t('formulaBar.clickToEdit', 'Click or press = to edit') : displayText
              }
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
        </>
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
