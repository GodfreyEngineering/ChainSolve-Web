/**
 * simulationSeriesStore — 8.7: Live series data for simulation-connected Plot blocks.
 *
 * When a simulation runs in loop mode, scalar metrics from each progress event
 * are accumulated here. PlotNode subscribes to this store and, when a simulation
 * is running on its connected source node, renders the live growing series
 * instead of (or in addition to) the static computed value.
 *
 * Data shape: one row per progress report, one column per metric key.
 * The accumulated data is exposed as a Value::Table-compatible structure that
 * PlotNode can pass directly to buildInlineSpec.
 */

import { create } from 'zustand'
import type { SimTaskMetrics } from './simulationStatusStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SimSeries {
  /** Ordered list of metric names (column headers). */
  labels: string[]
  /** Accumulated rows: each entry is one progress event. */
  rows: number[][]
}

interface SimSeriesStore {
  /** Live series data keyed by simulation nodeId. */
  series: Record<string, SimSeries>

  /** Initialise (or reset) a series for a simulation. */
  initSeries: (nodeId: string) => void

  /**
   * Append one data point to the series.
   * Only numeric metric values are stored; missing metrics get NaN.
   */
  appendPoint: (nodeId: string, iteration: number, metrics: SimTaskMetrics) => void

  /** Remove the series for a completed/cancelled simulation. */
  clearSeries: (nodeId: string) => void
}

// ── Store implementation ───────────────────────────────────────────────────────

export const useSimulationSeriesStore = create<SimSeriesStore>((set) => ({
  series: {},

  initSeries: (nodeId) => {
    set((s) => ({
      series: { ...s.series, [nodeId]: { labels: ['iteration'], rows: [] } },
    }))
  },

  appendPoint: (nodeId, iteration, metrics) => {
    set((s) => {
      const existing = s.series[nodeId]
      if (!existing) return s

      // Determine columns: grow labels as new metric keys appear.
      const metricKeys = Object.keys(metrics).filter(
        (k) => typeof metrics[k] === 'number' && !Number.isNaN(metrics[k]),
      )

      const newLabels = [...existing.labels]
      for (const k of metricKeys) {
        if (!newLabels.includes(k)) newLabels.push(k)
      }

      // Build a row aligned to the (possibly extended) label set.
      const row: number[] = newLabels.map((col) => {
        if (col === 'iteration') return iteration
        const v = metrics[col]
        return typeof v === 'number' ? v : NaN
      })

      // Back-fill existing rows if labels were extended.
      const rows =
        newLabels.length > existing.labels.length
          ? existing.rows.map((r) => [
              ...r,
              ...Array(newLabels.length - existing.labels.length).fill(NaN),
            ])
          : existing.rows

      return {
        series: {
          ...s.series,
          [nodeId]: { labels: newLabels, rows: [...rows, row] },
        },
      }
    })
  },

  clearSeries: (nodeId) => {
    set((s) => {
      const { [nodeId]: _removed, ...rest } = s.series
      return { series: rest }
    })
  },
}))
