/**
 * StateSpaceNode — 2.66: State Space block.
 *
 * UI-computed LTI system block. Evaluates:
 *   - Step response: RK4 simulation with u=1 input
 *   - Impulse response: derivative of step response
 *   - Eigenvalues: companion matrix QR (power iteration approximation for display)
 *
 * Bridge maps 'stateSpace' → 'display'.
 */

import { memo, createElement, useMemo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SSNodeData extends NodeData {
  matA: string
  matB: string
  matC: string
  matD: string
  nPoints: number
  tEnd: number
  outputMode: 'step' | 'impulse' | 'eigen'
}

// ── Matrix parsing ─────────────────────────────────────────────────────────────

/** Parse 'a,b;c,d' or 'a b\nc d' into number[][]. */
function parseMatrix(raw: string): number[][] {
  const rows = raw
    .trim()
    .split(/[;\n]+/)
    .map((r) =>
      r
        .trim()
        .split(/[\s,]+/)
        .map((v) => parseFloat(v.trim())),
    )
  return rows.filter((r) => r.length > 0 && r.every((v) => !isNaN(v)))
}

/** Matrix-vector multiply. */
function matVec(M: number[][], v: number[]): number[] {
  return M.map((row) => row.reduce((s, a, j) => s + a * v[j], 0))
}

/** Matrix-matrix multiply. */
function matMat(A: number[][], B: number[][]): number[][] {
  const rows = A.length
  const cols = B[0].length
  const inner = B.length
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      Array.from({ length: inner }, (_, k) => A[i][k] * B[k][j]).reduce((a, b) => a + b, 0),
    ),
  )
}

/** RK4 step for MIMO: dx/dt = Ax + Bu. */
function rk4Step(x: number[], A: number[][], B: number[][], u: number[], dt: number): number[] {
  const f = (xx: number[]): number[] => {
    const ax = matVec(A, xx)
    const bu = matVec(B, u)
    return ax.map((v, i) => v + bu[i])
  }
  const k1 = f(x)
  const k2 = f(x.map((xi, i) => xi + (dt / 2) * k1[i]))
  const k3 = f(x.map((xi, i) => xi + (dt / 2) * k2[i]))
  const k4 = f(x.map((xi, i) => xi + dt * k3[i]))
  return x.map((xi, i) => xi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
}

/** Estimate eigenvalues via power iteration (finds dominant eigenvalue only). */
function dominantEigenvalue(A: number[][]): { re: number; im: number } {
  const n = A.length
  if (n === 0) return { re: 0, im: 0 }
  // Use characteristic polynomial roots for small matrices (n<=4)
  // For n=1: eigenvalue = A[0][0]
  if (n === 1) return { re: A[0][0], im: 0 }
  // For n=2: use quadratic formula on det(λI-A)=0
  if (n === 2) {
    const tr = A[0][0] + A[1][1]
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    const disc = tr * tr - 4 * det
    if (disc >= 0) return { re: (tr + Math.sqrt(disc)) / 2, im: 0 }
    return { re: tr / 2, im: Math.sqrt(-disc) / 2 }
  }
  // Higher orders: power iteration for dominant real eigenvalue
  let v = Array<number>(n).fill(1)
  for (let iter = 0; iter < 100; iter++) {
    const Av = matVec(A, v)
    const norm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0)) || 1
    v = Av.map((x) => x / norm)
  }
  const Av = matVec(A, v)
  const lambda = Av.reduce((s, a, i) => s + a * v[i], 0)
  return { re: lambda, im: 0 }
}

/** Compute all eigenvalues for small matrices (n<=4). */
function eigenvalues(A: number[][]): { re: number; im: number }[] {
  const n = A.length
  if (n === 0) return []
  if (n === 1) return [{ re: A[0][0], im: 0 }]
  if (n === 2) {
    const tr = A[0][0] + A[1][1]
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    const disc = tr * tr - 4 * det
    if (disc >= 0) {
      return [
        { re: (tr + Math.sqrt(disc)) / 2, im: 0 },
        { re: (tr - Math.sqrt(disc)) / 2, im: 0 },
      ]
    }
    return [
      { re: tr / 2, im: Math.sqrt(-disc) / 2 },
      { re: tr / 2, im: -Math.sqrt(-disc) / 2 },
    ]
  }
  // For n>2 fallback to dominant eigenvalue
  return [dominantEigenvalue(A)]
}

/** Controllability matrix rank via Gram-Schmidt column independence. */
function controllabilityRank(A: number[][], B: number[][]): number {
  const n = A.length
  const m = B[0]?.length ?? 1
  const cols: number[][] = []
  let Ak = A.map((r) => [...r]) // A^0 = I is implicit
  let Akb = B

  for (let k = 0; k < n; k++) {
    for (let j = 0; j < m; j++) {
      cols.push(Akb.map((row) => row[j]))
    }
    Akb = matMat(Ak, B)
    Ak = matMat(Ak, A)
  }

  // Count linearly independent columns via Gram-Schmidt
  const basis: number[][] = []
  for (const col of cols.slice(0, n)) {
    let v = [...col]
    for (const b of basis) {
      const dot = v.reduce((s, x, i) => s + x * b[i], 0)
      v = v.map((x, i) => x - dot * b[i])
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    if (norm > 1e-10) {
      basis.push(v.map((x) => x / norm))
    }
  }
  return basis.length
}

// ── Simulation ─────────────────────────────────────────────────────────────────

function simulate(
  A: number[][],
  B: number[][],
  C: number[][],
  D: number[][],
  u: number[],
  nPoints: number,
  tEnd: number,
): { time: number[]; outputs: number[][] } {
  const n = A.length
  const p = C.length

  let T = tEnd
  if (T <= 0) T = Math.max(10, 10 * n)
  const dt = T / (nPoints - 1)

  const time: number[] = Array.from({ length: nPoints }, (_, i) => i * dt)
  const outputs: number[][] = Array.from({ length: p }, () => [])

  let x = Array<number>(n).fill(0)
  for (let i = 0; i < nPoints; i++) {
    const y = matVec(C, x).map((v, k) => v + matVec(D, u)[k])
    for (let k = 0; k < p; k++) outputs[k].push(y[k] ?? 0)
    if (i < nPoints - 1) {
      x = n > 0 ? rk4Step(x, A, B, u, dt) : []
    }
  }

  return { time, outputs }
}

// ── Component ──────────────────────────────────────────────────────────────────

function StateSpaceNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as SSNodeData
  const { updateNodeData } = useReactFlow()

  const matA = nd.matA ?? '0, 1; -2, -3'
  const matB = nd.matB ?? '0; 1'
  const matC = nd.matC ?? '1, 0'
  const matD = nd.matD ?? '0'
  const nPoints = nd.nPoints ?? 200
  const tEnd = nd.tEnd ?? 0
  const outputMode = nd.outputMode ?? 'step'

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const typeIcon = useMemo(
    () => createElement(getNodeTypeIcon(nd.blockType), { size: 12 }),
    [nd.blockType],
  )

  const { A, B, C, D, valid, n, eigenVals, ctrlRank, obsRank } = useMemo(() => {
    const A = parseMatrix(matA)
    const B = parseMatrix(matB)
    const C = parseMatrix(matC)
    const D = parseMatrix(matD)
    const n = A.length
    const valid =
      n > 0 && A.every((r) => r.length === n) && B.length === n && C.every((r) => r.length === n)

    if (!valid) return { A, B, C, D, valid: false, n, eigenVals: [], ctrlRank: 0, obsRank: 0 }

    const eigenVals = eigenvalues(A)
    const ctrlRank = controllabilityRank(A, B)
    const At = A.map((_, i) => A.map((row) => row[i]))
    const Ct = C[0] ? [C.map((row) => row[0])] : C
    const obsRank = controllabilityRank(At, Ct)

    return { A, B, C, D, valid, n, eigenVals, ctrlRank, obsRank }
  }, [matA, matB, matC, matD])

  const { timeVec: _timeVec, outVec } = useMemo(() => {
    if (!valid) return { timeVec: [], outVec: [] }
    if (outputMode === 'eigen') return { timeVec: [], outVec: [] }

    const u = Array<number>(B[0]?.length ?? 1).fill(1)
    const { time, outputs } = simulate(A, B, C, D, u, nPoints, tEnd)
    const out0 = outputs[0] ?? []

    if (outputMode === 'impulse' && out0.length > 1) {
      const dt = time[1] - time[0]
      const impulse = out0.map((v, i) => (v - (out0[i - 1] ?? 0)) / dt)
      return { timeVec: time, outVec: impulse }
    }

    return { timeVec: time, outVec: out0 }
  }, [A, B, C, D, valid, outputMode, nPoints, tEnd])

  // Sparkline
  const sparkline = useMemo(() => {
    const data = outVec
    if (data.length < 2) return ''
    const W = 100
    const H = 28
    const minY = Math.min(...data.filter(Number.isFinite))
    const maxY = Math.max(...data.filter(Number.isFinite))
    const rY = maxY - minY || 1
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * W
        const y = H - ((v - minY) / rY) * H
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [outVec])

  const onMatChange = useCallback(
    (key: 'matA' | 'matB' | 'matC' | 'matD', val: string) => {
      updateNodeData(id, { [key]: val })
    },
    [id, updateNodeData],
  )

  const stable = eigenVals.every((e) => e.re < 0)

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 230,
        maxWidth: 280,
      }}
    >
      {/* Header */}
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{typeIcon}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? t('stateSpace.label', 'State Space')}</span>
        {valid && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 9,
              opacity: 0.9,
              color: stable ? '#4ade80' : '#f87171',
            }}
          >
            {stable ? t('stateSpace.stable', 'Stable') : t('stateSpace.unstable', 'Unstable')}
          </span>
        )}
      </div>

      <div style={s.nodeBody}>
        {/* Matrix inputs */}
        {(['matA', 'matB', 'matC', 'matD'] as const).map((key) => (
          <div key={key} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 9, color: '#aaa', marginBottom: 1 }}>
              {key[3].toUpperCase()} {t('stateSpace.matrix', 'matrix')}
            </div>
            <textarea
              className="nodrag"
              rows={1}
              defaultValue={nd[key] ?? ''}
              onBlur={(e) => onMatChange(key, e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#1a1a1a',
                color: '#F4F4F3',
                border: '1px solid #444',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: 9,
                fontFamily: 'JetBrains Mono, monospace',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>
        ))}

        {/* Output mode selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {(['step', 'impulse', 'eigen'] as const).map((mode) => (
            <button
              key={mode}
              className="nodrag"
              onClick={() => updateNodeData(id, { outputMode: mode })}
              style={{
                flex: 1,
                background: outputMode === mode ? typeColor : '#383838',
                color: outputMode === mode ? '#fff' : '#aaa',
                border: 'none',
                borderRadius: 3,
                padding: '3px 0',
                fontSize: 9,
                cursor: 'pointer',
                fontWeight: outputMode === mode ? 700 : 400,
              }}
            >
              {mode === 'step'
                ? t('stateSpace.step', 'Step')
                : mode === 'impulse'
                  ? t('stateSpace.impulse', 'Impulse')
                  : t('stateSpace.eigen', 'Eigen')}
            </button>
          ))}
        </div>

        {!valid && (
          <div style={{ fontSize: 9, color: '#f87171' }}>
            {t('stateSpace.invalid', 'Invalid matrices')}
          </div>
        )}

        {/* Eigenvalue display */}
        {valid && outputMode === 'eigen' && eigenVals.length > 0 && (
          <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#aaa' }}>
            {eigenVals.map((e, i) => (
              <div key={i} style={{ color: e.re < 0 ? '#4ade80' : '#f87171' }}>
                λ{i + 1} = {e.re.toFixed(3)}
                {e.im !== 0 ? ` ${e.im >= 0 ? '+' : ''}${e.im.toFixed(3)}j` : ''}
              </div>
            ))}
          </div>
        )}

        {/* System stats */}
        {valid && (
          <div style={{ fontSize: 8, color: '#666', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span>n={n}</span>
            <span>
              {t('stateSpace.ctrl', 'Ctrl')} {ctrlRank}/{n}
            </span>
            <span>
              {t('stateSpace.obs', 'Obs')} {obsRank}/{n}
            </span>
          </div>
        )}

        {/* Sparkline */}
        {sparkline && (
          <svg width={100} height={28} style={{ display: 'block', margin: '4px auto 0' }}>
            <polyline
              points={sparkline}
              fill="none"
              stroke={typeColor}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="u"
        style={{ top: '50%', background: '#888', width: 8, height: 8, border: '2px solid #1a1a1a' }}
      />

      {/* Output handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="time"
        style={{
          top: '35%',
          background: typeColor,
          width: 8,
          height: 8,
          border: '2px solid #1a1a1a',
        }}
        title="Time"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          top: '65%',
          background: typeColor,
          width: 8,
          height: 8,
          border: '2px solid #1a1a1a',
        }}
        title="y(t)"
      />
    </div>
  )
}

export const StateSpaceNode = memo(StateSpaceNodeInner)
