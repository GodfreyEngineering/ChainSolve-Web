/**
 * ExperimentPanel.tsx — Experiment tracker comparison view (2.103).
 *
 * Shows a table of experiment runs for the current project and an
 * inline parallel coordinates chart for multi-run comparison.
 *
 * Features:
 *   - List runs with status, params, and final metrics
 *   - Multi-select runs for side-by-side comparison
 *   - Parallel coordinates chart drawn with SVG (no external library)
 *   - Delete runs
 *   - Refresh from Supabase
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getRunsForProject, deleteRun } from '../../lib/experiments.ts'
import type { ExperimentRun } from '../../lib/experiments.ts'
import { usePlan } from '../../contexts/PlanContext'

// ── Parallel Coordinates ─────────────────────────────────────────────────────

interface ParallelCoordsProps {
  runs: ExperimentRun[]
  axes: string[]
}

function normalise(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0.5)
  return values.map((v) => (v - min) / (max - min))
}

const COLORS = [
  '#1CABB0',
  '#f97316',
  '#a855f7',
  '#22c55e',
  '#3b82f6',
  '#ef4444',
  '#eab308',
  '#ec4899',
]

function ParallelCoords({ runs, axes }: ParallelCoordsProps) {
  const width = 600
  const height = 200
  const padX = 60
  const padY = 20

  if (runs.length === 0 || axes.length < 2) {
    return (
      <div style={{ color: 'var(--muted)', padding: 8, fontSize: 11 }}>
        Select 2+ runs and ensure they share numeric metrics to display the chart.
      </div>
    )
  }

  const colX = (i: number) => padX + (i * (width - 2 * padX)) / (axes.length - 1)

  // Extract numeric values per axis
  const axisValues: Record<string, number[]> = {}
  for (const axis of axes) {
    axisValues[axis] = runs.map((r) => {
      const v = (r.metrics[axis] ?? r.params[axis]) as number | undefined
      return typeof v === 'number' ? v : NaN
    })
  }

  // Normalise each axis
  const normalised: Record<string, number[]> = {}
  for (const axis of axes) {
    const filtered = axisValues[axis].map((v) => (isNaN(v) ? 0 : v))
    normalised[axis] = normalise(filtered)
  }

  const lineY = (axisName: string, runIdx: number) => {
    const n = normalised[axisName]?.[runIdx] ?? 0.5
    return padY + (1 - n) * (height - 2 * padY)
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', overflow: 'visible', maxWidth: '100%' }}
      aria-label="Parallel coordinates chart"
    >
      {/* Axis lines */}
      {axes.map((axis, i) => (
        <g key={axis}>
          <line
            x1={colX(i)}
            y1={padY}
            x2={colX(i)}
            y2={height - padY}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text x={colX(i)} y={padY - 4} textAnchor="middle" fontSize={9} fill="var(--muted)">
            {axis}
          </text>
          <text
            x={colX(i)}
            y={height - padY + 12}
            textAnchor="middle"
            fontSize={8}
            fill="var(--muted)"
          >
            {axisValues[axis].reduce(
              (mi, v, idx) => (v < (axisValues[axis][mi] ?? Infinity) ? idx : mi),
              0,
            ) === 0
              ? String(axisValues[axis][0]?.toFixed(3) ?? '')
              : ''}
          </text>
        </g>
      ))}

      {/* Run lines */}
      {runs.map((run, ri) => {
        const points = axes.map((axis, ai) => `${colX(ai)},${lineY(axis, ri)}`).join(' ')
        return (
          <polyline
            key={run.id}
            points={points}
            fill="none"
            stroke={COLORS[ri % COLORS.length]}
            strokeWidth={1.5}
            opacity={0.8}
          />
        )
      })}
    </svg>
  )
}

// ── Run row ──────────────────────────────────────────────────────────────────

interface RunRowProps {
  run: ExperimentRun
  selected: boolean
  onToggle: () => void
  onDelete: () => void
}

function RunRow({ run, selected, onToggle, onDelete }: RunRowProps) {
  const statusColor: Record<string, string> = {
    running: '#3b82f6',
    completed: '#22c55e',
    failed: '#ef4444',
    cancelled: '#6b7280',
  }
  const color = statusColor[run.status] ?? '#6b7280'
  const metricKeys = Object.keys(run.metrics).slice(0, 4)

  return (
    <tr
      style={{
        background: selected
          ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
          : 'transparent',
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <td style={{ padding: '4px 6px', width: 16 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select run ${run.name}`}
        />
      </td>
      <td
        style={{
          padding: '4px 6px',
          fontSize: 11,
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {run.name}
      </td>
      <td style={{ padding: '4px 6px' }}>
        <span style={{ color, fontSize: 10, fontWeight: 600 }}>{run.status}</span>
      </td>
      <td style={{ padding: '4px 6px', fontSize: 10, color: 'var(--muted)' }}>
        {metricKeys.map((k) => `${k}: ${(run.metrics[k] as number)?.toFixed(4) ?? '—'}`).join('  ')}
      </td>
      <td style={{ padding: '4px 6px', fontSize: 10, color: 'var(--muted)' }}>
        {new Date(run.createdAt).toLocaleString()}
      </td>
      <td style={{ padding: '4px 6px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete run ${run.name}`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted)',
            fontSize: 12,
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface ExperimentPanelProps {
  projectId: string | null
}

export function ExperimentPanel({ projectId }: ExperimentPanelProps) {
  const { t } = useTranslation()
  const plan = usePlan()
  const [runs, setRuns] = useState<ExperimentRun[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getRunsForProject(projectId)
      if (mountedRef.current) setRuns(data)
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteRun(id)
      setRuns((prev) => prev.filter((r) => r.id !== id))
      setSelected((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const selectedRuns = useMemo(() => runs.filter((r) => selected.has(r.id)), [runs, selected])

  // Collect all numeric metric/param keys shared across selected runs for parallel coords
  const parallelAxes = useMemo(() => {
    if (selectedRuns.length < 2) return []
    const allKeys = new Set<string>()
    for (const run of selectedRuns) {
      for (const [k, v] of Object.entries(run.metrics)) {
        if (typeof v === 'number') allKeys.add(k)
      }
    }
    return Array.from(allKeys).slice(0, 8)
  }, [selectedRuns])

  if (plan === 'free' || plan === 'past_due' || plan === 'canceled') {
    return (
      <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>
        {t('experiments.proRequired', 'Experiment tracking is available on the Pro plan.')}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          {t('experiments.title', 'Experiments')} ({runs.length})
        </span>
        <button
          onClick={() => void load()}
          disabled={loading}
          aria-label={t('experiments.refresh', 'Refresh')}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 6px',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          {loading ? '⟳' : t('experiments.refresh', 'Refresh')}
        </button>
        {selected.size >= 2 && (
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
            {t('experiments.selectedCount', '{{n}} selected for comparison', { n: selected.size })}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '6px 10px',
            background: 'color-mix(in srgb, var(--error) 15%, transparent)',
            fontSize: 11,
            color: 'var(--error)',
          }}
        >
          {error}
        </div>
      )}

      {/* Parallel coordinates (only when 2+ selected) */}
      {selected.size >= 2 && (
        <div
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            {t('experiments.parallelCoords', 'Parallel Coordinates')}
          </div>
          <ParallelCoords runs={selectedRuns} axes={parallelAxes} />
        </div>
      )}

      {/* Run table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {runs.length === 0 && !loading && (
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: 11, textAlign: 'center' }}>
            {t(
              'experiments.noRuns',
              'No experiment runs yet. Training runs from Neural Network blocks will appear here.',
            )}
          </div>
        )}
        {runs.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                <th style={{ padding: '4px 6px', width: 16 }} />
                <th style={{ padding: '4px 6px', textAlign: 'left' }}>
                  {t('experiments.name', 'Name')}
                </th>
                <th style={{ padding: '4px 6px', textAlign: 'left' }}>
                  {t('experiments.status', 'Status')}
                </th>
                <th style={{ padding: '4px 6px', textAlign: 'left' }}>
                  {t('experiments.metrics', 'Metrics')}
                </th>
                <th style={{ padding: '4px 6px', textAlign: 'left' }}>
                  {t('experiments.date', 'Date')}
                </th>
                <th style={{ padding: '4px 6px', width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  selected={selected.has(run.id)}
                  onToggle={() => toggleSelect(run.id)}
                  onDelete={() => void handleDelete(run.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default ExperimentPanel
