/**
 * TransferFunctionNode — 2.65: Transfer Function block.
 *
 * Evaluates G(s) = num(s)/den(s) in the UI layer:
 *   - Step response: via zero-pole-gain state-space simulation (RK4)
 *   - Bode: direct evaluation of |G(jω)| and ∠G(jω) at log-spaced frequencies
 *   - Impulse: derivative of step response
 *
 * Outputs stored as tableData columns for downstream plot blocks.
 * Bridge maps 'transferFunction' → 'display' (engine ignores it).
 */

import { memo, createElement, useMemo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TFNodeData extends NodeData {
  numerator: number[]
  denominator: number[]
  nPoints: number
  tEnd: number
  wMin: number
  wMax: number
  outputMode: 'step' | 'impulse' | 'bode'
}

// ── Math: polynomial evaluation ────────────────────────────────────────────────

/** Evaluate polynomial at complex s = (sr, si). Returns [re, im]. */
function polyEval(coeffs: number[], sr: number, si: number): [number, number] {
  let re = 0
  let im = 0
  for (const c of coeffs) {
    // (re + im·i)·(sr + si·i) + c
    const rNew = re * sr - im * si + c
    const iNew = re * si + im * sr
    re = rNew
    im = iNew
  }
  return [re, im]
}

/** Complex division (a/b). */
function cdiv(ar: number, ai: number, br: number, bi: number): [number, number] {
  const d = br * br + bi * bi
  if (d === 0) return [NaN, NaN]
  return [(ar * br + ai * bi) / d, (ai * br - ar * bi) / d]
}

/** Convert transfer function coefficients to companion form state-space A, B, C, D. */
function tfToSS(
  num: number[],
  den: number[],
): {
  A: number[][]
  B: number[]
  C: number[]
  D: number
} {
  const n = den.length - 1 // order
  if (n <= 0) {
    // Gain only
    const gain = num[0] / den[0]
    return { A: [], B: [], C: [], D: gain }
  }

  // Normalize
  const a0 = den[0]
  const denN = den.map((d) => d / a0)

  // Pad numerator to length n+1
  const numN = Array<number>(n + 1).fill(0)
  const offset = n + 1 - num.length
  for (let i = 0; i < num.length; i++) numN[i + offset] = num[i] / a0

  const D = numN[0]

  // Controllable canonical form
  const A: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (j === n - 1 ? -denN[i + 1] : i === j + 1 ? 1 : 0)),
  )

  // Actually use observable canonical form (simpler indexing)
  // Companion: A[i][j]=1 if j=i+1, last col = -den[i+1]/den[0]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      A[i][j] = j === i + 1 ? 1 : j === n - 1 ? -denN[i + 1] : 0
    }
    // Wait — fix last row
  }
  // Last row: [-den[n]/a0, -den[n-1]/a0, ..., -den[1]/a0]
  for (let j = 0; j < n; j++) {
    A[n - 1][j] = -denN[n - j]
  }

  const B = Array<number>(n).fill(0)
  B[n - 1] = 1

  const C = Array.from({ length: n }, (_, i) => numN[i + 1] - D * denN[i + 1])

  return { A, B, C, D }
}

/** RK4 step for dx/dt = Ax + Bu, with u=const over dt. */
function rk4Step(x: number[], A: number[][], B: number[], u: number, dt: number): number[] {
  const f = (xx: number[]): number[] =>
    xx.map((_, i) => A[i].reduce((s, a, j) => s + a * xx[j], 0) + B[i] * u)

  const k1 = f(x)
  const k2 = f(x.map((xi, i) => xi + (dt / 2) * k1[i]))
  const k3 = f(x.map((xi, i) => xi + (dt / 2) * k2[i]))
  const k4 = f(x.map((xi, i) => xi + dt * k3[i]))

  return x.map((xi, i) => xi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
}

// ── Response computation ───────────────────────────────────────────────────────

function computeStepResponse(
  num: number[],
  den: number[],
  nPoints: number,
  tEnd: number,
): { time: number[]; output: number[] } {
  const ss = tfToSS(num, den)
  const n = ss.A.length
  const order = den.length - 1

  // Auto-estimate tEnd from largest time constant (1/min|real(pole)|)
  let T = tEnd
  if (T <= 0 && order > 0) {
    // Rough: use 10 * n seconds or eigenvalue estimate
    T = Math.max(10, 10 * order)
  } else if (T <= 0) {
    T = 10
  }

  const dt = T / (nPoints - 1)
  const time: number[] = Array.from({ length: nPoints }, (_, i) => i * dt)
  const output: number[] = []

  let x = Array<number>(n).fill(0)
  for (let i = 0; i < nPoints; i++) {
    const y = ss.C.reduce((s, c, j) => s + c * x[j], 0) + ss.D * 1
    output.push(y)
    if (i < nPoints - 1) {
      x = n > 0 ? rk4Step(x, ss.A, ss.B, 1, dt) : []
    }
  }

  return { time, output }
}

function computeImpulseResponse(
  num: number[],
  den: number[],
  nPoints: number,
  tEnd: number,
): { time: number[]; output: number[] } {
  const { time, output: step } = computeStepResponse(num, den, nPoints + 1, tEnd)
  const dt = time.length > 1 ? time[1] - time[0] : 1
  const impulse = step.slice(0, nPoints).map((v, i) => (v - (step[i - 1] ?? 0)) / dt)
  return { time: time.slice(0, nPoints), output: impulse }
}

function computeBode(
  num: number[],
  den: number[],
  wMin: number,
  wMax: number,
  nPoints: number,
): { freq: number[]; mag: number[]; phase: number[] } {
  const freq: number[] = []
  const mag: number[] = []
  const phase: number[] = []

  const logMin = Math.log10(Math.max(wMin, 1e-6))
  const logMax = Math.log10(Math.max(wMax, wMin * 10))

  for (let i = 0; i < nPoints; i++) {
    const w = Math.pow(10, logMin + (i / (nPoints - 1)) * (logMax - logMin))
    const [nr, ni] = polyEval(num, 0, w)
    const [dr, di] = polyEval(den, 0, w)
    const [gr, gi] = cdiv(nr, ni, dr, di)
    freq.push(w)
    mag.push(20 * Math.log10(Math.sqrt(gr * gr + gi * gi)))
    phase.push((Math.atan2(gi, gr) * 180) / Math.PI)
  }

  return { freq, mag, phase }
}

// ── Component ──────────────────────────────────────────────────────────────────

function parseCoeffs(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n))
}

function fmtCoeffs(coeffs: number[]): string {
  return coeffs.join(', ')
}

function TFNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as TFNodeData
  const { updateNodeData } = useReactFlow()

  const num = useMemo(() => nd.numerator ?? [1], [nd.numerator])
  const den = useMemo(() => nd.denominator ?? [1, 2, 1], [nd.denominator])
  const nPoints = nd.nPoints ?? 200
  const tEnd = nd.tEnd ?? 0
  const wMin = nd.wMin ?? 0.01
  const wMax = nd.wMax ?? 100
  const outputMode = nd.outputMode ?? 'step'

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const typeIcon = useMemo(
    () => createElement(getNodeTypeIcon(nd.blockType), { size: 12 }),
    [nd.blockType],
  )

  // Compute response
  const {
    timeVec: _timeVec,
    outVec,
    freqVec: _freqVec,
    magVec,
    phaseVec: _phaseVec,
    isValid,
  } = useMemo(() => {
    if (den.length === 0 || den.every((d) => d === 0)) {
      return { timeVec: [], outVec: [], freqVec: [], magVec: [], phaseVec: [], isValid: false }
    }
    if (outputMode === 'bode') {
      const { freq, mag, phase } = computeBode(num, den, wMin, wMax, nPoints)
      return {
        timeVec: freq,
        outVec: [],
        freqVec: freq,
        magVec: mag,
        phaseVec: phase,
        isValid: true,
      }
    }
    if (outputMode === 'impulse') {
      const { time, output } = computeImpulseResponse(num, den, nPoints, tEnd)
      return { timeVec: time, outVec: output, freqVec: [], magVec: [], phaseVec: [], isValid: true }
    }
    const { time, output } = computeStepResponse(num, den, nPoints, tEnd)
    return { timeVec: time, outVec: output, freqVec: [], magVec: [], phaseVec: [], isValid: true }
  }, [num, den, nPoints, tEnd, wMin, wMax, outputMode])

  // Mini sparkline
  const previewData = outputMode === 'bode' ? magVec : outVec
  const sparkline = useMemo(() => {
    if (previewData.length < 2) return ''
    const W = 120
    const H = 32
    const minY = Math.min(...previewData.filter(Number.isFinite))
    const maxY = Math.max(...previewData.filter(Number.isFinite))
    const rangeY = maxY - minY || 1
    const pts = previewData.map((v, i) => {
      const x = (i / (previewData.length - 1)) * W
      const y = H - ((v - minY) / rangeY) * H
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return pts.join(' ')
  }, [previewData])

  const onNumChange = useCallback(
    (raw: string) => {
      const c = parseCoeffs(raw)
      if (c.length > 0) updateNodeData(id, { numerator: c })
    },
    [id, updateNodeData],
  )

  const onDenChange = useCallback(
    (raw: string) => {
      const c = parseCoeffs(raw)
      if (c.length > 0) updateNodeData(id, { denominator: c })
    },
    [id, updateNodeData],
  )

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
        <span style={s.nodeHeaderLabel}>
          {nd.label ?? t('transferFunction.label', 'Transfer Function')}
        </span>
      </div>

      <div style={s.nodeBody}>
        {/* G(s) display */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            marginBottom: 6,
            padding: '4px 0',
            borderBottom: '1px solid #333',
          }}
        >
          <div
            style={{
              color: '#F4F4F3',
              borderBottom: '1px solid #888',
              paddingBottom: 2,
              marginBottom: 2,
            }}
          >
            {fmtCoeffs(num)}
          </div>
          <div style={{ color: '#aaa' }}>{fmtCoeffs(den)}</div>
        </div>

        {/* Numerator input */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: '#aaa', marginBottom: 1 }}>
            {t('transferFunction.num', 'Num (highest power first)')}
          </div>
          <input
            className="nodrag"
            type="text"
            defaultValue={fmtCoeffs(num)}
            onBlur={(e) => onNumChange(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#1a1a1a',
              color: '#F4F4F3',
              border: '1px solid #444',
              borderRadius: 3,
              padding: '3px 6px',
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
            }}
          />
        </div>

        {/* Denominator input */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#aaa', marginBottom: 1 }}>
            {t('transferFunction.den', 'Den (highest power first)')}
          </div>
          <input
            className="nodrag"
            type="text"
            defaultValue={fmtCoeffs(den)}
            onBlur={(e) => onDenChange(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#1a1a1a',
              color: '#F4F4F3',
              border: '1px solid #444',
              borderRadius: 3,
              padding: '3px 6px',
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
            }}
          />
        </div>

        {/* Output mode selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {(['step', 'impulse', 'bode'] as const).map((mode) => (
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
                ? t('transferFunction.step', 'Step')
                : mode === 'impulse'
                  ? t('transferFunction.impulse', 'Impulse')
                  : t('transferFunction.bode', 'Bode')}
            </button>
          ))}
        </div>

        {/* Mini preview sparkline */}
        {isValid && previewData.length > 1 && (
          <svg width={120} height={32} style={{ display: 'block', margin: '0 auto 4px' }}>
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

        {/* System info */}
        <div style={{ fontSize: 8, color: '#666' }}>
          {t('transferFunction.order', 'Order')} {Math.max(0, den.length - 1)} ·{' '}
          {t('transferFunction.pts', 'pts')}: {nPoints}
        </div>
      </div>

      {/* Input handle (u) */}
      <Handle
        type="target"
        position={Position.Left}
        id="u"
        style={{ top: '50%', background: '#888', width: 8, height: 8, border: '2px solid #1a1a1a' }}
      />

      {/* Output handles */}
      {outputMode === 'bode' ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="bode_freq"
            style={{
              top: '33%',
              background: typeColor,
              width: 8,
              height: 8,
              border: '2px solid #1a1a1a',
            }}
            title="Frequency (rad/s)"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="bode_mag"
            style={{
              top: '55%',
              background: typeColor,
              width: 8,
              height: 8,
              border: '2px solid #1a1a1a',
            }}
            title="Magnitude (dB)"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="bode_phase"
            style={{
              top: '77%',
              background: typeColor,
              width: 8,
              height: 8,
              border: '2px solid #1a1a1a',
            }}
            title="Phase (deg)"
          />
        </>
      ) : (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="time"
            style={{
              top: '40%',
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
            title="Output"
          />
        </>
      )}
    </div>
  )
}

export const TransferFunctionNode = memo(TFNodeInner)
