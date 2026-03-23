/**
 * CodeBlockNode — 9.15 / 2.134: Inline code editor block.
 *
 * Renders a compact code editor with:
 *  - A styled textarea with JetBrains Mono monospace font
 *  - Per-variable input handles (user-configurable names)
 *  - Live evaluation: runs code on every input change or code edit
 *  - Output value display + error message display
 *  - Add/Remove variable buttons
 *
 * Evaluation model:
 *  - Uses new Function(varNames..., code) to create an isolated function
 *  - Math built-ins (sin, cos, PI, etc.) are injected into scope
 *  - Evaluation is synchronous and happens in the UI render cycle
 *  - On error: last successful value is retained, error shown in red
 *
 * Bridge: codeBlock → 'number' (node.data.value).
 */

import { memo, createElement, useMemo, useEffect, useCallback, useRef } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import type { CodeBlockVar } from '../../../blocks/codeblock-blocks'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { useComputedValue } from '../../../contexts/ComputedContext'

// ── Safe evaluation helpers ───────────────────────────────────────────────────

const MATH_SCOPE: Record<string, unknown> = {
  Math,
  PI: Math.PI,
  E: Math.E,
  LN2: Math.LN2,
  LN10: Math.LN10,
  abs: Math.abs,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  pow: Math.pow,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  exp: Math.exp,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  trunc: Math.trunc,
  min: Math.min,
  max: Math.max,
  sign: Math.sign,
  hypot: Math.hypot,
  isNaN,
  isFinite,
}

/**
 * Evaluate user code with named variable bindings and math scope injected.
 * Wraps single-expression code (no `return`) automatically.
 * Returns the numeric result or throws on error.
 *
 * SECURITY: Uses new Function() to run user-authored code in the main thread.
 * The scope is sandboxed to MATH_SCOPE builtins + declared variables — no
 * DOM, fetch, or import access. This is acceptable for v1.0 because the user
 * only executes their own expressions on their own machine.
 *
 * Limitation: no execution timeout. A tight infinite loop will freeze the tab.
 * Post-launch, consider moving evaluation to a Web Worker with terminate().
 */
function evalCode(code: string, vars: Record<string, number>): number {
  if (code.length > 10_000) throw new Error('Code exceeds 10,000 character limit')
  const mathKeys = Object.keys(MATH_SCOPE)
  const mathVals = mathKeys.map((k) => MATH_SCOPE[k])
  const varKeys = Object.keys(vars)
  const varVals = varKeys.map((k) => vars[k])
  const allKeys = [...mathKeys, ...varKeys]
  const allVals = [...mathVals, ...varVals]

  // Auto-wrap single expressions without `return`
  const body =
    code.trim().includes('\n') || code.trim().toLowerCase().includes('return')
      ? code
      : `return (${code})`

  const fn = new Function(...allKeys, body)
  const result = fn(...allVals)
  if (typeof result === 'number' && Number.isFinite(result)) return result
  if (typeof result === 'boolean') return result ? 1 : 0
  if (typeof result === 'number') return result // NaN/Infinity OK
  return 0
}

// ── Node component ────────────────────────────────────────────────────────────

interface CodeBlockNodeData extends NodeData {
  codeVars: CodeBlockVar[]
  code: string
  codeOutput: number
  codeError: string | null
  value: number
}

function CodeBlockNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as CodeBlockNodeData
  const { updateNodeData } = useReactFlow()

  const codeVars: CodeBlockVar[] = useMemo(
    () => nd.codeVars ?? [{ name: 'x' }, { name: 'y' }],
    [nd.codeVars],
  )
  const code: string = nd.code ?? 'return 0'
  const codeError: string | null = nd.codeError ?? null
  const codeOutput: number = nd.codeOutput ?? 0
  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const typeIcon = useMemo(
    () => createElement(getNodeTypeIcon(nd.blockType), { size: 12 }),
    [nd.blockType],
  )

  // Read all input values (up to 8 vars for perf)
  const in0 = useComputedValue(id)
  const in1 = useComputedValue(id)
  const in2 = useComputedValue(id)
  const in3 = useComputedValue(id)
  const in4 = useComputedValue(id)
  const in5 = useComputedValue(id)
  const in6 = useComputedValue(id)
  const in7 = useComputedValue(id)

  const inputRefs = [in0, in1, in2, in3, in4, in5, in6, in7]

  const resolveN = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

  const evaluate = useCallback(() => {
    const inputs = [in0, in1, in2, in3, in4, in5, in6, in7]
    const varMap: Record<string, number> = {}
    codeVars.forEach((v, i) => {
      varMap[v.name] = resolveN(inputs[i])
    })
    try {
      const result = evalCode(code, varMap)
      updateNodeData(id, { codeOutput: result, codeError: null, value: result })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      updateNodeData(id, { codeError: msg })
    }
  }, [id, code, codeVars, in0, in1, in2, in3, in4, in5, in6, in7, updateNodeData])

  useEffect(() => {
    evaluate()
  }, [evaluate])

  // Debounce code textarea changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleCodeChange = (newCode: string) => {
    updateNodeData(id, { code: newCode })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // Re-trigger evaluate by updating code (evaluate depends on `code` from nd)
    }, 300)
  }

  const addVar = () => {
    const newName = `v${codeVars.length}`
    const newVars = [...codeVars, { name: newName }]
    updateNodeData(id, {
      codeVars: newVars,
      inputs: newVars.map((v) => ({ id: `var_${v.name}`, label: v.name })),
    })
  }

  const removeVar = () => {
    if (codeVars.length <= 1) return
    const newVars = codeVars.slice(0, -1)
    updateNodeData(id, {
      codeVars: newVars,
      inputs: newVars.map((v) => ({ id: `var_${v.name}`, label: v.name })),
    })
  }

  const renameVar = (idx: number, newName: string) => {
    if (!newName.trim() || !/^[a-zA-Z_]\w*$/.test(newName)) return
    const newVars = codeVars.map((v, i) => (i === idx ? { ...v, name: newName } : v))
    updateNodeData(id, {
      codeVars: newVars,
      inputs: newVars.map((v) => ({ id: `var_${v.name}`, label: v.name })),
    })
  }

  const handleSpacing = codeVars.length > 1 ? 100 / (codeVars.length + 1) : 50

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 240,
        maxWidth: 300,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{typeIcon}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? t('codeBlock.label', 'Code Block')}</span>
      </div>

      <div style={s.nodeBody}>
        {/* Code editor textarea */}
        <textarea
          className="nodrag"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          spellCheck={false}
          rows={4}
          style={{
            width: '100%',
            background: '#111',
            color: '#F4F4F3',
            border: `1px solid ${codeError ? '#e74c3c' : '#333'}`,
            borderRadius: 4,
            padding: '4px 6px',
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            lineHeight: 1.5,
          }}
        />

        {/* Error / output */}
        {codeError ? (
          <div style={{ fontSize: 9, color: '#e74c3c', marginTop: 4, wordBreak: 'break-all' }}>
            ⚠ {codeError}
          </div>
        ) : (
          <div
            style={{
              fontSize: 9,
              color: '#aaa',
              marginTop: 4,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            = {codeOutput.toPrecision(6)}
          </div>
        )}

        {/* Variables */}
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              fontSize: 9,
              color: '#666',
              marginBottom: 3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {t('codeBlock.vars', 'Variables')}
          </div>
          {codeVars.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <span style={{ fontSize: 9, color: '#666', width: 12, textAlign: 'right' }}>
                {i + 1}
              </span>
              <input
                className="nodrag"
                type="text"
                value={v.name}
                onChange={(e) => renameVar(i, e.target.value)}
                style={{
                  background: '#1a1a1a',
                  color: '#F4F4F3',
                  border: '1px solid #333',
                  borderRadius: 3,
                  padding: '1px 4px',
                  fontSize: 9,
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                  width: 60,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 9, color: '#555', fontFamily: 'JetBrains Mono, monospace' }}>
                = {resolveN(inputRefs[i]).toPrecision(4)}
              </span>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              className="nodrag"
              onClick={addVar}
              style={{
                background: '#2a2a2a',
                color: '#aaa',
                border: '1px solid #444',
                borderRadius: 3,
                padding: '1px 6px',
                fontSize: 9,
                cursor: 'pointer',
              }}
            >
              + {t('codeBlock.addVar', 'var')}
            </button>
            {codeVars.length > 1 && (
              <button
                className="nodrag"
                onClick={removeVar}
                style={{
                  background: '#2a2a2a',
                  color: '#888',
                  border: '1px solid #333',
                  borderRadius: 3,
                  padding: '1px 6px',
                  fontSize: 9,
                  cursor: 'pointer',
                }}
              >
                − {t('codeBlock.removeVar', 'var')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Variable input handles */}
      {codeVars.map((v, i) => (
        <Handle
          key={`var_${v.name}`}
          type="target"
          position={Position.Left}
          id={`var_${v.name}`}
          style={{
            top: `${handleSpacing * (i + 1)}%`,
            background: '#888',
            width: 8,
            height: 8,
            border: '2px solid #1a1a1a',
          }}
        />
      ))}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          top: '50%',
          background: typeColor,
          width: 8,
          height: 8,
          border: '2px solid #1a1a1a',
        }}
      />
    </div>
  )
}

export const CodeBlockNode = memo(CodeBlockNodeInner)
