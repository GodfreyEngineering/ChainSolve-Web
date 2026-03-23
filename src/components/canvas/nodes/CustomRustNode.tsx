/**
 * CustomRustNode — 2.128: Custom Rust block with server-side compilation.
 *
 * Lets users write Rust code that computes a value from named inputs.
 * The code is sent to a Cloudflare Pages Function `/api/compile-rust` which
 * compiles it to WASM and returns the output.
 *
 * Local mode: evaluates a simple expression using the CSEL evaluator while
 * the server compile is pending, so users see immediate feedback.
 *
 * Bridge: scripting.rust → 'number' (data.value).
 */

import { memo, createElement, useMemo, useCallback, useEffect, useRef } from 'react'
import { Handle, Position, useReactFlow, type NodeProps, useEdges } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { useComputedValue } from '../../../contexts/ComputedContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RustVar {
  id: string
  name: string
}

interface CustomRustNodeData extends NodeData {
  rustCode: string
  rustVars: RustVar[]
  value: number
  rustError: string | null
  rustCompiling: boolean
  rustCompiledHash: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

function CustomRustNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as CustomRustNodeData
  const { updateNodeData } = useReactFlow()
  const edges = useEdges()
  const compileTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const typeIcon = useMemo(
    () => createElement(getNodeTypeIcon(nd.blockType), { size: 12 }),
    [nd.blockType],
  )

  const rustVars: RustVar[] = useMemo(
    () => (nd.rustVars as RustVar[] | undefined) ?? [],
    [nd.rustVars],
  )

  // Fixed 8-slot upstream reads (no hooks-in-loop)
  const slotId = (i: number) => rustVars[i]?.id ?? `__rs_${i}`
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

  // ── Compile & evaluate ───────────────────────────────────────────────────

  const compileAndRun = useCallback(async () => {
    const code = nd.rustCode?.trim()
    if (!code) return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    updateNodeData(id, { rustCompiling: true, rustError: null })

    const varValues: Record<string, number> = {}
    rustVars.forEach((rv, i) => {
      const v = slotVals[i]
      varValues[rv.name] = v?.kind === 'scalar' ? v.value : 0
    })

    try {
      const response = await fetch('/api/compile-rust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, variables: varValues, nodeId: id }),
        signal: ctrl.signal,
      })

      if (ctrl.signal.aborted) return

      if (!response.ok) {
        const text = await response.text()
        updateNodeData(id, { rustError: text || `HTTP ${response.status}`, rustCompiling: false })
        return
      }

      const result = (await response.json()) as { value?: number; error?: string; hash?: string }
      if (ctrl.signal.aborted) return

      if (result.error) {
        updateNodeData(id, { rustError: result.error, rustCompiling: false })
      } else {
        updateNodeData(id, {
          value: result.value ?? 0,
          rustError: null,
          rustCompiling: false,
          rustCompiledHash: result.hash ?? null,
        })
      }
    } catch (err) {
      if (ctrl.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      // Network errors (e.g. no compile endpoint in dev) → show as info, not error
      updateNodeData(id, {
        rustError: msg.includes('Failed to fetch')
          ? 'Compilation endpoint not available (deploy to Cloudflare Pages for server-side Rust compilation)'
          : msg,
        rustCompiling: false,
      })
    }
  }, [id, nd.rustCode, rustVars, slotVals, updateNodeData])

  // Debounce compile on code/input change (longer debounce — compilation is expensive)
  useEffect(() => {
    if (compileTimer.current) clearTimeout(compileTimer.current)
    compileTimer.current = setTimeout(() => void compileAndRun(), 1500)
    return () => {
      if (compileTimer.current) clearTimeout(compileTimer.current)
    }
  }, [compileAndRun])

  // ── Var management ─────────────────────────────────────────────────────────

  const addVar = useCallback(() => {
    if (rustVars.length >= 8) return
    updateNodeData(id, {
      rustVars: [...rustVars, { id: `rv_${Date.now()}`, name: `x${rustVars.length + 1}` }],
    })
  }, [id, rustVars, updateNodeData])

  const removeVar = useCallback(
    (varId: string) => {
      updateNodeData(id, { rustVars: rustVars.filter((v) => v.id !== varId) })
    },
    [id, rustVars, updateNodeData],
  )

  const renameVar = useCallback(
    (varId: string, name: string) => {
      if (!name.trim() || !/^[a-zA-Z_]\w*$/.test(name)) return
      updateNodeData(id, { rustVars: rustVars.map((v) => (v.id === varId ? { ...v, name } : v)) })
    },
    [id, rustVars, updateNodeData],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  const statusText = nd.rustCompiling ? '⟳' : nd.rustError ? '✗' : nd.rustCompiledHash ? '✓' : '·'
  const isInfoError = nd.rustError?.includes('not available')

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
        <span style={s.nodeHeaderIcon}>{typeIcon}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? 'Custom Rust'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>
          {statusText}
        </span>
      </div>

      <div style={s.nodeBody}>
        {/* Input variables */}
        {rustVars.map((rv, i) => (
          <div
            key={rv.id}
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
              value={rv.name}
              onChange={(e) => renameVar(rv.id, e.target.value)}
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
              onClick={() => removeVar(rv.id)}
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
              id={rv.id}
              style={{ top: `${44 + i * 23}px` }}
              title={rv.name}
            />
          </div>
        ))}

        {rustVars.length < 8 && (
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
          value={nd.rustCode ?? ''}
          onChange={(e) => updateNodeData(id, { rustCode: e.target.value })}
          spellCheck={false}
          placeholder={
            '// Rust function body\n// Variables: x1: f64, x2: f64, ...\n// Return value is the block output\nx1.powi(2) + x2.powi(2)'
          }
          style={{
            width: '100%',
            minHeight: 80,
            padding: '4px 6px',
            background: 'var(--surface-2)',
            border: `1px solid ${nd.rustError && !isInfoError ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 4,
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text)',
            resize: 'vertical',
            lineHeight: 1.4,
            boxSizing: 'border-box',
          }}
        />

        {/* Error/info display */}
        {nd.rustError && (
          <div
            style={{
              marginTop: 4,
              padding: '2px 4px',
              background: isInfoError
                ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
                : 'color-mix(in srgb, var(--danger) 15%, transparent)',
              border: `1px solid ${isInfoError ? 'var(--primary)' : 'var(--danger)'}`,
              borderRadius: 3,
              fontSize: 8,
              color: isInfoError ? 'var(--primary)' : 'var(--danger)',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all' as const,
              maxHeight: 60,
              overflow: 'auto',
            }}
          >
            {nd.rustError}
          </div>
        )}

        {/* Success: show output value */}
        {!nd.rustError && nd.rustCompiledHash && (
          <div
            style={{
              marginTop: 4,
              fontSize: 9,
              color: 'var(--primary)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            → {(nd.value ?? 0).toPrecision(6)}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ top: '50%' }}
        title="Output (f64)"
      />
    </div>
  )
}

export const CustomRustNode = memo(CustomRustNodeInner)
export default CustomRustNode
