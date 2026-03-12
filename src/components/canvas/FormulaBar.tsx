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

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node } from '@xyflow/react'
import type { NodeData } from '../../blocks/types'
import { BLOCK_DESCRIPTIONS } from '../../blocks/blockDescriptions'
import { isScalar } from '../../engine/value'
import type { Value } from '../../engine/value'
import { safeEvalFormula } from '../../lib/formulaEval'

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

interface FormulaBarProps {
  nodeId: string | null
  node: Node<NodeData> | null
  computedValue: Value | undefined
  /** Called when the user commits a new expression for a source node. */
  onCommit: (nodeId: string, value: number) => void
}

export function FormulaBar({ nodeId, node, computedValue, onCommit }: FormulaBarProps) {
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

  const editing = editingNodeId !== null && editingNodeId === nodeId

  const startEdit = useCallback(() => {
    if (!isEditable || !nodeId) return
    const raw =
      nd?.value !== undefined && !isNaN(nd.value as number) ? String(nd.value) : ''
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
        <input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(false)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
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
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            padding: '0 4px',
          }}
        />
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
              (nodeId
                ? ''
                : t('formulaBar.hint', 'Select a node to see its formula'))}
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
