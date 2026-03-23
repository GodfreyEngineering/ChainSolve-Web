/**
 * PythonScriptNode — 2.127: Python script block using Pyodide WASM CPython 3.11.
 *
 * Provides a code editor where users write Python code. Input ports become
 * Python variables. The last expression (or `result = ...`) is the output.
 *
 * Pyodide loads lazily from CDN on first execution (~8MB download).
 * Execution runs in a shared Web Worker (non-blocking).
 *
 * Bridge: scripting.python → 'number' (data.value) for scalar outputs.
 *         data.pyResultJson holds the full output for inspection.
 *
 * Supports up to 8 input variables.
 */

import { memo, useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { Handle, Position, useReactFlow, type NodeProps, useEdges } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { useComputedValue } from '../../../contexts/ComputedContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PythonVar {
  id: string
  name: string
}

interface PythonScriptNodeData extends NodeData {
  pyCode: string
  pyVars: PythonVar[]
  /** Numeric output for the Rust engine bridge (data.value). */
  value: number
  /** Full Python output serialised as JSON string for display. */
  pyResultJson: string | null
  pyError: string | null
  pyRunning: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

import type { Value } from '../../../engine/value'

function valueToInput(v: Value | undefined): unknown {
  if (!v) return undefined
  if (v.kind === 'scalar') return v.value
  if (v.kind === 'vector') return [...v.value]
  if (v.kind === 'table') return v.rows.map((r) => [...r])
  return undefined
}

// ── Component ─────────────────────────────────────────────────────────────────

function PythonScriptNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as PythonScriptNodeData
  const { updateNodeData } = useReactFlow()
  const edges = useEdges()
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pyodideLoading, setPyodideLoading] = useState(false)
  const [pyodideReady, setPyodideReady] = useState(false)

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const pyVars: PythonVar[] = useMemo(
    () => (nd.pyVars as PythonVar[] | undefined) ?? [],
    [nd.pyVars],
  )

  // Fixed 8-slot upstream reads (React hooks must not be called in loops)
  const slotId = (i: number) => pyVars[i]?.id ?? `__slot_${i}`
  const e0 = edges.find((e) => e.target === id && e.targetHandle === slotId(0))
  const e1 = edges.find((e) => e.target === id && e.targetHandle === slotId(1))
  const e2 = edges.find((e) => e.target === id && e.targetHandle === slotId(2))
  const e3 = edges.find((e) => e.target === id && e.targetHandle === slotId(3))
  const e4 = edges.find((e) => e.target === id && e.targetHandle === slotId(4))
  const e5 = edges.find((e) => e.target === id && e.targetHandle === slotId(5))
  const e6 = edges.find((e) => e.target === id && e.targetHandle === slotId(6))
  const e7 = edges.find((e) => e.target === id && e.targetHandle === slotId(7))
  const v0 = useComputedValue(e0?.source ?? '')
  const v1 = useComputedValue(e1?.source ?? '')
  const v2 = useComputedValue(e2?.source ?? '')
  const v3 = useComputedValue(e3?.source ?? '')
  const v4 = useComputedValue(e4?.source ?? '')
  const v5 = useComputedValue(e5?.source ?? '')
  const v6 = useComputedValue(e6?.source ?? '')
  const v7 = useComputedValue(e7?.source ?? '')
  const slotVals = useMemo(() => [v0, v1, v2, v3, v4, v5, v6, v7], [v0, v1, v2, v3, v4, v5, v6, v7])

  // ── Run Python ─────────────────────────────────────────────────────────────

  const runPython = useCallback(async () => {
    const code = nd.pyCode
    if (!code?.trim()) return

    // Build variable bindings from current slot values
    const varValues: Record<string, unknown> = {}
    pyVars.forEach((pv, i) => {
      const val = valueToInput(slotVals[i])
      if (val !== undefined) varValues[pv.name] = val
    })

    setPyodideLoading(true)
    updateNodeData(id, { pyRunning: true, pyError: null })

    try {
      const { runPython: run } = await import('../../../lib/pyodide-runner')
      setPyodideReady(true)
      const { result, error } = await run(id, code, varValues)

      if (error) {
        updateNodeData(id, { pyError: error, pyRunning: false })
        return
      }

      // Coerce result to number for the engine bridge
      let numericValue = 0
      if (typeof result === 'number') numericValue = result
      else if (typeof result === 'boolean') numericValue = result ? 1 : 0
      else if (Array.isArray(result) && result.length > 0) {
        numericValue = typeof result[0] === 'number' ? result[0] : 0
      }

      updateNodeData(id, {
        value: numericValue,
        pyResultJson: JSON.stringify(result, null, 2),
        pyError: null,
        pyRunning: false,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updateNodeData(id, { pyError: msg, pyRunning: false })
    } finally {
      setPyodideLoading(false)
    }
  }, [id, nd.pyCode, pyVars, slotVals, updateNodeData])

  // Debounced re-run on code/input change
  useEffect(() => {
    if (runTimer.current) clearTimeout(runTimer.current)
    runTimer.current = setTimeout(() => void runPython(), 400)
    return () => {
      if (runTimer.current) clearTimeout(runTimer.current)
    }
  }, [runPython])

  // ── Var management ─────────────────────────────────────────────────────────

  const addVar = useCallback(() => {
    if (pyVars.length >= 8) return
    const newId = `pv_${Date.now()}`
    updateNodeData(id, {
      pyVars: [...pyVars, { id: newId, name: `x${pyVars.length + 1}` }],
    })
  }, [id, pyVars, updateNodeData])

  const removeVar = useCallback(
    (varId: string) => {
      updateNodeData(id, { pyVars: pyVars.filter((v) => v.id !== varId) })
    },
    [id, pyVars, updateNodeData],
  )

  const renameVar = useCallback(
    (varId: string, name: string) => {
      if (!name.trim() || !/^[a-zA-Z_]\w*$/.test(name)) return
      updateNodeData(id, { pyVars: pyVars.map((v) => (v.id === varId ? { ...v, name } : v)) })
    },
    [id, pyVars, updateNodeData],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  const statusText = nd.pyRunning
    ? pyodideLoading
      ? '⏳ Loading…'
      : '⟳ Running…'
    : nd.pyError
      ? '✗'
      : pyodideReady
        ? '✓'
        : '·'

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper?.border,
        minWidth: 220,
        maxWidth: 320,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? 'Python Script'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>
          {statusText}
        </span>
      </div>

      <div style={s.nodeBody}>
        {/* Input variables */}
        {pyVars.map((pv, i) => (
          <div
            key={pv.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 3,
              position: 'relative',
            }}
          >
            <input
              className="nodrag"
              value={pv.name}
              onChange={(e) => renameVar(pv.id, e.target.value)}
              style={{
                flex: 1,
                padding: '1px 4px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                fontSize: 9,
                color: 'var(--text)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <button
              className="nodrag"
              onClick={() => removeVar(pv.id)}
              style={{
                padding: '0 4px',
                fontSize: 10,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
              }}
            >
              ×
            </button>
            <Handle
              type="target"
              position={Position.Left}
              id={pv.id}
              style={{ top: `${44 + i * 23}px` }}
              title={pv.name}
            />
          </div>
        ))}

        {pyVars.length < 8 && (
          <button
            className="nodrag"
            onClick={addVar}
            style={{
              width: '100%',
              padding: '2px 0',
              fontSize: 9,
              background: 'none',
              border: '1px dashed var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
              color: 'var(--muted)',
              marginBottom: 4,
            }}
          >
            + variable
          </button>
        )}

        {/* Code editor */}
        <textarea
          className="nodrag"
          value={nd.pyCode ?? ''}
          onChange={(e) => updateNodeData(id, { pyCode: e.target.value })}
          spellCheck={false}
          placeholder={
            '# Python 3 (Pyodide)\n# output = last expression\nimport numpy as np\nnp.sqrt(x1)'
          }
          style={{
            width: '100%',
            minHeight: 80,
            padding: '4px 6px',
            background: 'var(--surface-2)',
            border: `1px solid ${nd.pyError ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 4,
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text)',
            resize: 'vertical',
            lineHeight: 1.4,
            boxSizing: 'border-box',
          }}
        />

        {/* Error */}
        {nd.pyError && (
          <div
            style={{
              marginTop: 4,
              padding: '2px 4px',
              background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
              border: '1px solid var(--danger)',
              borderRadius: 3,
              fontSize: 8,
              color: 'var(--danger)',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all' as const,
              maxHeight: 60,
              overflow: 'auto',
            }}
          >
            {nd.pyError}
          </div>
        )}

        {/* Result preview */}
        {nd.pyResultJson !== null && !nd.pyError && (
          <div
            style={{
              marginTop: 4,
              padding: '2px 4px',
              background: 'var(--surface-2)',
              borderRadius: 3,
              fontSize: 8,
              color: 'var(--muted)',
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'pre',
              maxHeight: 40,
            }}
          >
            {nd.pyResultJson.slice(0, 120)}
            {nd.pyResultJson.length > 120 ? '…' : ''}
          </div>
        )}

        {pyodideLoading && !nd.pyError && (
          <div style={{ marginTop: 4, fontSize: 8, color: 'var(--muted)', fontStyle: 'italic' }}>
            Downloading Pyodide from CDN (~8MB, first use only)
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ top: '50%' }}
        title="Output (scalar or first element)"
      />
    </div>
  )
}

export const PythonScriptNode = memo(PythonScriptNodeInner)
export default PythonScriptNode
