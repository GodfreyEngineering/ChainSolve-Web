/**
 * PlotNode — ReactFlow node for plot blocks (csPlot kind).
 *
 * Terminal node: one target handle (left), no source handle.
 * Renders an inline Vega-Lite chart in the node body.
 * Supports expand-to-modal and export.
 */

import { memo, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position, useEdges, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/evaluate'
import type { Value } from '../../../engine/value'
import type { NodeData, PlotConfig } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { loadVega, type VegaAPI } from '../../../lib/vega-loader'
import { buildInlineSpec, type SpecResult } from '../../../lib/plot-spec'

const PlotExpandModalComponent = lazy(() => import('../PlotExpandModal'))

function PlotExpandModalLazy(props: {
  value: Value | undefined
  config: PlotConfig
  label: string
  onClose: () => void
}) {
  return (
    <Suspense fallback={null}>
      <PlotExpandModalComponent {...props} />
    </Suspense>
  )
}

function PlotNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const config = useMemo(
    () => (nd.plotConfig ?? { chartType: 'xyLine' as const }) as PlotConfig,
    [nd.plotConfig],
  )
  const computed = useComputed()
  const edges = useEdges()

  // Find the value connected to this node's 'data' input
  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'data')
  const inputValue = inputEdge ? computed.get(inputEdge.source) : undefined
  const headerValue = computed.get(id)

  // Derive spec result from inputs (pure computation, no side-effects)
  const specResult = useMemo(
    () => buildInlineSpec(inputValue, config),
    [inputValue, config],
  )
  const specError = 'error' in specResult ? specResult.error : null
  const isDownsampled = !specError && (specResult as SpecResult).isDownsampled

  // Vega state
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<{ finalize: () => void } | null>(null)
  const [vegaApi, setVegaApi] = useState<VegaAPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [expandOpen, setExpandOpen] = useState(false)

  // Combined error: spec parsing errors take precedence over render errors
  const error = specError ?? renderError

  // Lazy-load Vega on mount
  useEffect(() => {
    let cancelled = false
    loadVega()
      .then((api) => {
        if (!cancelled) {
          setVegaApi(api)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : 'Failed to load chart library')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Render chart when data, config, or vega API changes
  // setState is only called inside async callbacks (not synchronously in the effect body).
  useEffect(() => {
    if (!vegaApi || !containerRef.current || specError) {
      // Clean up existing view when spec becomes invalid
      if (viewRef.current) {
        viewRef.current.finalize()
        viewRef.current = null
      }
      return
    }

    const spec = (specResult as SpecResult).spec
    const container = containerRef.current
    let cancelled = false

    ;(async () => {
      try {
        // Dispose previous view
        if (viewRef.current) {
          viewRef.current.finalize()
          viewRef.current = null
        }
        container.innerHTML = ''

        const compiled = vegaApi.compile(spec)
        const runtime = vegaApi.parse(compiled.spec)
        const view = new vegaApi.View(runtime, {
          renderer: 'svg',
          container,
          hover: false,
          expr: vegaApi.expressionInterpreter,
        })
        await (view as unknown as { runAsync: () => Promise<void> }).runAsync()
        if (!cancelled) {
          viewRef.current = view
          setRenderError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : 'Render error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [vegaApi, specResult, specError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewRef.current) {
        viewRef.current.finalize()
      }
    }
  }, [])

  const onExpand = useCallback(() => setExpandOpen(true), [setExpandOpen])

  return (
    <>
      <div
        style={{
          ...s.node,
          minWidth: 320,
          maxWidth: 420,
          ...(selected ? {} : {}),
        }}
      >
        <div style={s.header}>
          <span style={s.headerLabel}>{nd.label}</span>
          <span style={s.headerValue}>{formatValue(headerValue)}</span>
        </div>

        <div style={{ ...s.body, padding: '0.3rem', position: 'relative' }}>
          <Handle
            type="target"
            position={Position.Left}
            id="data"
            style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
          />

          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.4 }}>
              Loading chart...
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '1.5rem 0.5rem',
                color: '#f87171',
                fontSize: '0.75rem',
              }}
            >
              {error}
            </div>
          )}

          <div
            ref={containerRef}
            className="nodrag nowheel"
            style={{
              display: loading || error ? 'none' : 'block',
              overflow: 'hidden',
              borderRadius: 6,
            }}
          />

          {/* Downsampled warning */}
          {isDownsampled && !loading && !error && (
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                background: 'rgba(250,204,21,0.9)',
                color: '#1a1a1a',
                fontSize: '0.6rem',
                padding: '1px 5px',
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              downsampled
            </div>
          )}

          {/* Expand button */}
          {!loading && !error && (
            <button
              onClick={onExpand}
              className="nodrag"
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                color: '#F4F4F3',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '0.65rem',
                zIndex: 2,
              }}
              title="Expand chart"
            >
              ⤢
            </button>
          )}
        </div>
      </div>

      {/* Full-size modal */}
      {expandOpen && (
        <PlotExpandModalLazy
          value={inputValue}
          config={config}
          label={nd.label}
          onClose={() => setExpandOpen(false)}
        />
      )}
    </>
  )
}

export const PlotNode = memo(PlotNodeInner)
