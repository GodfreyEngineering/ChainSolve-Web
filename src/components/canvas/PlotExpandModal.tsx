/**
 * PlotExpandModal — Full-size chart modal with export controls.
 *
 * Renders the chart at full theme-preset dimensions.
 * Export buttons: SVG, PNG (with scale selector), CSV, Open SVG in new tab.
 *
 * Default-exported for React.lazy() compatibility.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Modal } from '../ui/Modal'
import type { Value } from '../../engine/value'
import { isTable } from '../../engine/value'
import type { PlotConfig } from '../../blocks/types'
import { loadVega, type VegaAPI } from '../../lib/vega-loader'
import { buildFullSpec, THEME_PRESETS } from '../../lib/plot-spec'
import { exportSVG, exportPNG, exportCSV, openSVGInNewTab } from '../../lib/plot-export'

interface PlotExpandModalProps {
  value: Value | undefined
  config: PlotConfig
  label: string
  onClose: () => void
}

const btnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.75rem',
  padding: '0.35rem 0.7rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}

export default function PlotExpandModal({ value, config, label, onClose }: PlotExpandModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewRef = useRef<any>(null)
  const [vegaApi, setVegaApi] = useState<VegaAPI | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [pngScale, setPngScale] = useState(2)

  // ── 6.7: XY animation state ────────────────────────────────────────────────
  const animCol = config.animTimeColumn
  const animTable =
    animCol && value && isTable(value) && value.columns.includes(animCol) ? value : null
  const timeColIdx = animTable ? animTable.columns.indexOf(animCol!) : -1

  // Extract sorted unique time values from the time column
  const timeValues: number[] = animTable
    ? Array.from(
        new Set(animTable.rows.map((r) => r[timeColIdx] as number)),
      ).sort((a, b) => a - b)
    : []

  const [frameIdx, setFrameIdx] = useState(timeValues.length > 0 ? timeValues.length - 1 : 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1) // frames per 100ms tick
  const animIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentTime = timeValues[frameIdx] ?? 0

  // Filtered value: rows where time col <= currentTime
  const animValue: Value | undefined =
    animTable && timeValues.length > 0
      ? {
          kind: 'table',
          columns: animTable.columns,
          rows: animTable.rows.filter((r) => (r[timeColIdx] as number) <= currentTime),
        }
      : value

  const stopAnimation = useCallback(() => {
    if (animIntervalRef.current !== null) {
      clearInterval(animIntervalRef.current)
      animIntervalRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const startAnimation = useCallback(() => {
    if (timeValues.length === 0) return
    setIsPlaying(true)
    animIntervalRef.current = setInterval(() => {
      setFrameIdx((prev) => {
        const next = prev + speed
        if (next >= timeValues.length - 1) {
          clearInterval(animIntervalRef.current!)
          animIntervalRef.current = null
          setIsPlaying(false)
          return timeValues.length - 1
        }
        return next
      })
    }, 100)
  }, [timeValues.length, speed])

  // Clean up interval on unmount
  useEffect(() => () => { if (animIntervalRef.current !== null) clearInterval(animIntervalRef.current) }, [])

  const theme = THEME_PRESETS[config.themePreset ?? 'paper-single']
  const modalWidth = Math.max(theme.width + 80, 500)

  useEffect(() => {
    let cancelled = false
    loadVega().then((api) => {
      if (!cancelled) setVegaApi(api)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!vegaApi || !containerRef.current) return

    const result = buildFullSpec(animValue, config)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setError(null)

    try {
      if (viewRef.current) {
        viewRef.current.finalize()
      }
      containerRef.current.innerHTML = ''

      const compiled = vegaApi.compile(result.spec)
      const runtime = vegaApi.parse(compiled.spec)
      const view = new vegaApi.View(runtime, {
        renderer: 'svg',
        container: containerRef.current,
        hover: true,
        expr: vegaApi.expressionInterpreter,
      })
      void (view as unknown as { runAsync: () => Promise<void> }).runAsync()
      viewRef.current = view
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render error')
    }
  }, [vegaApi, animValue, config])

  useEffect(() => {
    return () => {
      if (viewRef.current) {
        viewRef.current.finalize()
      }
    }
  }, [])

  const safeName = label.replace(/[^a-zA-Z0-9_-]/g, '_')
  const ts = Date.now()

  const handleExport = async (format: 'svg' | 'png' | 'csv' | 'tab') => {
    if (!viewRef.current && format !== 'csv') return
    setExporting(true)
    try {
      const view = viewRef.current
      if (format === 'svg') await exportSVG(view, `${safeName}_${ts}.svg`)
      if (format === 'png') await exportPNG(view, `${safeName}_${ts}.png`, pngScale)
      if (format === 'csv') exportCSV(value, `${safeName}_${ts}.csv`)
      if (format === 'tab') await openSVGInNewTab(view)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={label} width={modalWidth}>
      {error ? (
        <div style={{ color: 'var(--danger-text)', padding: '1rem', textAlign: 'center' }}>
          {error}
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            className="nodrag nowheel"
            style={{ overflow: 'auto', textAlign: 'center' }}
          />

          {/* 6.7: Animation controls (shown when animTimeColumn is set) */}
          {animTable && timeValues.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.6rem',
                padding: '0.4rem 0.6rem',
                background: 'rgba(0,0,0,0.15)',
                borderRadius: 8,
                flexWrap: 'wrap',
              }}
            >
              <button
                style={{ ...btnStyle, minWidth: '4rem', fontWeight: 600 }}
                onClick={() => {
                  if (isPlaying) {
                    stopAnimation()
                  } else {
                    if (frameIdx >= timeValues.length - 1) setFrameIdx(0)
                    startAnimation()
                  }
                }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                style={{ ...btnStyle }}
                onClick={() => { stopAnimation(); setFrameIdx(0) }}
              >
                ↩ Reset
              </button>
              <input
                type="range"
                min={0}
                max={timeValues.length - 1}
                value={frameIdx}
                onChange={(e) => { stopAnimation(); setFrameIdx(Number(e.target.value)) }}
                style={{ flex: 1, minWidth: '6rem', accentColor: 'var(--primary)' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'rgba(244,244,243,0.6)', minWidth: '3rem', textAlign: 'right' }}>
                t={currentTime.toPrecision(4)}
              </span>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ ...btnStyle, padding: '0.25rem 0.35rem', fontSize: '0.7rem' }}
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={5}>5×</option>
                <option value={10}>10×</option>
              </select>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '1rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <button
              style={{ ...btnStyle, opacity: exporting ? 0.5 : 1 }}
              onClick={() => void handleExport('svg')}
              disabled={exporting}
            >
              Export SVG
            </button>
            <button
              style={{ ...btnStyle, opacity: exporting ? 0.5 : 1 }}
              onClick={() => void handleExport('png')}
              disabled={exporting}
            >
              Export PNG ({pngScale}x)
            </button>
            <select
              value={pngScale}
              onChange={(e) => setPngScale(Number(e.target.value))}
              style={{
                ...btnStyle,
                padding: '0.3rem 0.4rem',
                fontSize: '0.7rem',
              }}
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
            <button
              style={{ ...btnStyle, opacity: exporting ? 0.5 : 1 }}
              onClick={() => void handleExport('csv')}
              disabled={exporting}
            >
              Export CSV
            </button>
            <button
              style={{ ...btnStyle, opacity: exporting ? 0.5 : 1 }}
              onClick={() => void handleExport('tab')}
              disabled={exporting}
            >
              Open SVG in tab
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
