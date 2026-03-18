/**
 * TimeSeriesNode — 2.11: Time Series Input block.
 *
 * Accepts CSV files with a timestamp column and numeric signal columns.
 * Parses timestamps (ISO 8601, Unix epoch, or plain numbers in seconds),
 * resamples to a configurable uniform time grid, and stores the result
 * as tableData for the Rust engine.
 *
 * Resampling methods: linear, ZOH (zero-order hold), cubic (monotone spline).
 * Bridge maps blockType='timeSeries' → 'tableInput'.
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableData {
  columns: string[]
  rows: number[][]
}

type ResampleMethod = 'linear' | 'zoh' | 'cubic'

interface TimeSeriesNodeData extends NodeData {
  tableData: TableData
  fileName: string
  timeColumn: string
  resampleMethod: ResampleMethod
  sampleInterval: number
  startTime: string
  endTime: string
  hasHeader: boolean
  parseError: string
}

// ── Timestamp parsing ──────────────────────────────────────────────────────────

/** Convert a raw cell string to seconds (float). Returns NaN on failure. */
function parseTimestamp(raw: string): number {
  const trimmed = raw.trim()
  if (trimmed === '') return NaN

  // Plain number (Unix epoch seconds or plain seconds)
  const asNum = Number(trimmed)
  if (Number.isFinite(asNum)) return asNum

  // ISO 8601 / date string → ms → seconds
  const ms = Date.parse(trimmed)
  if (!isNaN(ms)) return ms / 1000

  return NaN
}

// ── Resampling ────────────────────────────────────────────────────────────────

/** Linear interpolation between two samples. */
function lerpValue(t: number, t0: number, t1: number, v0: number, v1: number): number {
  if (t1 === t0) return v0
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
}

/** Find the index of the last sample with ts ≤ t (binary search). */
function findLeft(times: number[], t: number): number {
  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (times[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Monotone cubic spline — Fritsch-Carlson method. Returns a function f(t). */
function buildCubicSpline(xs: number[], ys: number[]): (t: number) => number {
  const n = xs.length
  if (n < 2) return () => ys[0] ?? NaN

  const d = new Array<number>(n - 1)
  const m = new Array<number>(n)

  for (let i = 0; i < n - 1; i++) {
    d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])
  }

  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) {
    m[i] = (d[i - 1] + d[i]) / 2
  }

  // Enforce monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const alpha = m[i] / d[i]
      const beta = m[i + 1] / d[i]
      const h = Math.hypot(alpha, beta)
      if (h > 3) {
        m[i] = (3 * d[i] * alpha) / h
        m[i + 1] = (3 * d[i] * beta) / h
      }
    }
  }

  return (t: number) => {
    if (t <= xs[0]) return ys[0]
    if (t >= xs[n - 1]) return ys[n - 1]
    const i = findLeft(xs, t)
    const j = Math.min(i + 1, n - 1)
    const h = xs[j] - xs[i]
    const u = (t - xs[i]) / h
    const u2 = u * u
    const u3 = u2 * u
    const h00 = 2 * u3 - 3 * u2 + 1
    const h10 = u3 - 2 * u2 + u
    const h01 = -2 * u3 + 3 * u2
    const h11 = u3 - u2
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[j] + h11 * h * m[j]
  }
}

/** Resample a single column of data to a uniform time grid. */
function resampleColumn(
  times: number[],
  values: number[],
  grid: number[],
  method: ResampleMethod,
): number[] {
  if (times.length === 0) return grid.map(() => NaN)

  if (method === 'cubic') {
    const fn = buildCubicSpline(times, values)
    return grid.map((t) => fn(t))
  }

  return grid.map((t) => {
    const i = findLeft(times, t)
    if (method === 'zoh') {
      return values[i]
    }
    // linear
    const j = Math.min(i + 1, times.length - 1)
    if (i === j) return values[i]
    return lerpValue(t, times[i], times[j], values[i], values[j])
  })
}

// ── CSV parser ────────────────────────────────────────────────────────────────

interface ParsedTimeSeries {
  columns: string[]
  times: number[]
  signalColumns: string[]
  signalData: number[][]
  error?: string
}

function parseTimeSeriesCsv(
  text: string,
  timeColumn: string,
  hasHeader: boolean,
): ParsedTimeSeries {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return { columns: [], times: [], signalColumns: [], signalData: [], error: 'Empty file' }

  const delim = (() => {
    const t = (lines[0].match(/\t/g) ?? []).length
    const c = (lines[0].match(/,/g) ?? []).length
    const s = (lines[0].match(/;/g) ?? []).length
    if (t > c && t > s) return '\t'
    if (s > c) return ';'
    return ','
  })()

  const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '')

  let headers: string[]
  let dataLines: string[]

  if (hasHeader) {
    headers = lines[0].split(delim).map(unquote)
    dataLines = lines.slice(1)
  } else {
    const ncols = lines[0].split(delim).length
    headers = Array.from({ length: ncols }, (_, i) => (i === 0 ? 'time' : `Col${i}`))
    dataLines = lines
  }

  // Find time column index
  let timeIdx = headers.findIndex((h) => h.toLowerCase() === timeColumn.toLowerCase())
  if (timeIdx < 0) timeIdx = 0

  const times: number[] = []
  const signalCols: string[] = headers.filter((_, i) => i !== timeIdx)
  const signalData: number[][] = signalCols.map(() => [])

  for (const line of dataLines) {
    const cells = line.split(delim).map(unquote)
    const t = parseTimestamp(cells[timeIdx] ?? '')
    if (isNaN(t)) continue
    times.push(t)

    let si = 0
    for (let ci = 0; ci < headers.length; ci++) {
      if (ci === timeIdx) continue
      const v = parseFloat(cells[ci] ?? 'NaN')
      signalData[si++].push(Number.isFinite(v) ? v : NaN)
    }
  }

  return { columns: headers, times, signalColumns: signalCols, signalData }
}

// ── Component ──────────────────────────────────────────────────────────────────

function TimeSeriesNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as TimeSeriesNodeData
  const { updateNodeData } = useReactFlow()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const tableData: TableData = (nd.tableData as TableData | undefined) ?? { columns: [], rows: [] }
  const timeColumn = nd.timeColumn ?? 'time'
  const resampleMethod: ResampleMethod = (nd.resampleMethod as ResampleMethod) ?? 'linear'
  const sampleInterval = nd.sampleInterval ?? 0
  const hasHeader = nd.hasHeader ?? true

  const processData = useCallback(
    (parsed: ParsedTimeSeries) => {
      if (parsed.error || parsed.times.length === 0) {
        setError(parsed.error ?? t('timeSeries.noTimeData', 'No valid time data'))
        return
      }

      // Build uniform grid
      const tMin = parsed.times[0]
      const tMax = parsed.times[parsed.times.length - 1]
      const startT = nd.startTime !== '' ? parseFloat(nd.startTime) : tMin
      const endT = nd.endTime !== '' ? parseFloat(nd.endTime) : tMax

      let grid: number[]
      if (sampleInterval > 0 && sampleInterval < (endT - startT)) {
        const n = Math.floor((endT - startT) / sampleInterval) + 1
        grid = Array.from({ length: Math.min(n, 100_000) }, (_, i) => startT + i * sampleInterval)
      } else {
        // Keep original time points clipped to range
        grid = parsed.times.filter((t) => t >= startT && t <= endT)
        if (grid.length === 0) grid = parsed.times
      }

      // Resample each signal column
      const columns = ['time', ...parsed.signalColumns]
      const rows: number[][] = grid.map((t, gi) => {
        const row = [t]
        for (let ci = 0; ci < parsed.signalColumns.length; ci++) {
          const vals = parsed.signalData[ci]
          const resampled = resampleColumn(parsed.times, vals, [t], resampleMethod)
          row.push(resampled[gi] ?? NaN)
        }
        return row
      })

      // Fix: resample all at once per column for efficiency
      const colRows: number[][] = parsed.signalColumns.map((_, ci) =>
        resampleColumn(parsed.times, parsed.signalData[ci], grid, resampleMethod),
      )

      const tableRows: number[][] = grid.map((t, ri) => [
        t,
        ...colRows.map((col) => col[ri] ?? NaN),
      ])

      void rows // replaced by tableRows

      updateNodeData(id, {
        tableData: { columns, rows: tableRows },
        parseError: '',
      })
      setError('')
    },
    [id, nd.startTime, nd.endTime, sampleInterval, resampleMethod, t, updateNodeData],
  )

  const processFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError('')
      try {
        const text = await file.text()
        const parsed = parseTimeSeriesCsv(text, timeColumn, hasHeader)
        updateNodeData(id, { fileName: file.name })
        processData(parsed)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('timeSeries.parseError', 'Parse error'))
      } finally {
        setLoading(false)
      }
    },
    [id, timeColumn, hasHeader, t, updateNodeData, processData],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) void processFile(file)
    },
    [processFile],
  )

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)
  const hasData = tableData.columns.length > 0 && tableData.rows.length > 0

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 250,
        maxWidth: 300,
      }}
    >
      {/* Header */}
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? t('timeSeries.label', 'Time Series Input')}</span>
        {hasData && (
          <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.8 }}>
            {tableData.rows.length} {t('timeSeries.pts', 'pts')}
          </span>
        )}
      </div>

      <div style={s.nodeBody}>
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1.5px dashed ${isDragging ? typeColor : '#555'}`,
            borderRadius: 4,
            padding: '8px 6px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 6,
            background: isDragging ? 'rgba(28,171,176,0.08)' : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          {loading ? (
            <span style={{ fontSize: 9, color: '#aaa' }}>{t('timeSeries.loading', 'Parsing…')}</span>
          ) : nd.fileName ? (
            <span style={{ fontSize: 9, color: '#ccc' }}>{nd.fileName}</span>
          ) : (
            <span style={{ fontSize: 9, color: '#666' }}>
              {t('timeSeries.drop', 'Drop CSV or click to browse')}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void processFile(f)
              e.target.value = ''
            }}
          />
        </div>

        {/* Error */}
        {(error || nd.parseError) && (
          <div style={{ fontSize: 9, color: '#f87171', marginBottom: 4 }}>
            {error || nd.parseError}
          </div>
        )}

        {/* Config */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 6px', marginBottom: 6 }}>
          {/* Time column */}
          <label style={{ fontSize: 9, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {t('timeSeries.timeCol', 'Time column')}
            <input
              className="nodrag"
              type="text"
              value={timeColumn}
              onChange={(e) => updateNodeData(id, { timeColumn: e.target.value })}
              style={{ background: '#1a1a1a', color: '#F4F4F3', border: '1px solid #444', borderRadius: 3, padding: '2px 5px', fontSize: 9, outline: 'none' }}
            />
          </label>

          {/* Resample method */}
          <label style={{ fontSize: 9, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {t('timeSeries.method', 'Method')}
            <select
              className="nodrag"
              value={resampleMethod}
              onChange={(e) => updateNodeData(id, { resampleMethod: e.target.value as ResampleMethod })}
              style={{ background: '#1a1a1a', color: '#F4F4F3', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: 9, outline: 'none' }}
            >
              <option value="linear">Linear</option>
              <option value="zoh">ZOH</option>
              <option value="cubic">Cubic</option>
            </select>
          </label>

          {/* Sample interval */}
          <label style={{ fontSize: 9, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {t('timeSeries.interval', 'Interval (s)')}
            <input
              className="nodrag"
              type="number"
              min={0}
              step={0.001}
              value={sampleInterval}
              onChange={(e) => updateNodeData(id, { sampleInterval: parseFloat(e.target.value) || 0 })}
              style={{ background: '#1a1a1a', color: '#F4F4F3', border: '1px solid #444', borderRadius: 3, padding: '2px 5px', fontSize: 9, outline: 'none' }}
            />
          </label>

          {/* Has header */}
          <label
            className="nodrag"
            style={{ fontSize: 9, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4, gridColumn: '2', alignSelf: 'end', paddingBottom: 4 }}
          >
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => updateNodeData(id, { hasHeader: e.target.checked })}
              style={{ width: 10, height: 10 }}
            />
            {t('timeSeries.hasHeader', 'Has header')}
          </label>
        </div>

        {/* Preview */}
        {hasData && (
          <div style={{ fontSize: 9, color: '#888' }}>
            {tableData.columns.length - 1} {t('timeSeries.signals', 'signals')} ·{' '}
            {tableData.rows.length} {t('timeSeries.pts', 'pts')}
          </div>
        )}
      </div>

      {/* Output handles — one per signal column */}
      {hasData ? (
        tableData.columns.map((col, i) => (
          <Handle
            key={`col_${i}`}
            type="source"
            position={Position.Right}
            id={`col_${i}`}
            style={{
              top: `${((i + 0.5) / tableData.columns.length) * 100}%`,
              background: typeColor,
              width: 8,
              height: 8,
              border: '2px solid #1a1a1a',
            }}
            title={col}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ top: '50%', background: typeColor, width: 8, height: 8, border: '2px solid #1a1a1a' }}
        />
      )}
    </div>
  )
}

export const TimeSeriesNode = memo(TimeSeriesNodeInner)
