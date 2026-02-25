/**
 * PlotExpandModal — Full-size chart modal with export controls.
 *
 * Renders the chart at full theme-preset dimensions.
 * Export buttons: SVG, PNG (with scale selector), CSV, Open SVG in new tab.
 *
 * Default-exported for React.lazy() compatibility.
 */

import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import type { Value } from '../../engine/value'
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

    const result = buildFullSpec(value, config)
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
  }, [vegaApi, value, config])

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
        <div style={{ color: '#f87171', padding: '1rem', textAlign: 'center' }}>{error}</div>
      ) : (
        <>
          <div
            ref={containerRef}
            className="nodrag nowheel"
            style={{ overflow: 'auto', textAlign: 'center' }}
          />
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
