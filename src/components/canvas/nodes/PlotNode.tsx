/**
 * PlotNode — ReactFlow node for plot blocks (csPlot kind).
 *
 * Terminal node: one target handle (left), no source handle.
 * Renders an inline Vega-Lite chart in the node body.
 * Supports expand-to-modal and export.
 */

import { useTranslation } from 'react-i18next'
import { memo, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position, useEdges, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/value'
import type { Value } from '../../../engine/value'
import type { NodeData, PlotConfig } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'
import { loadVega, type VegaAPI } from '../../../lib/vega-loader'
import { buildInlineSpec, type SpecResult } from '../../../lib/plot-spec'
import { exportCSV } from '../../../lib/plot-export'

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
  const { t } = useTranslation()
  const nd = data as NodeData
  const config = useMemo(
    () => (nd.plotConfig ?? { chartType: 'xyLine' as const }) as PlotConfig,
    [nd.plotConfig],
  )
  const computed = useComputed()
  const edges = useEdges()
  const { updateNodeData } = useReactFlow()

  // Find the value connected to this node's 'data' input
  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'data')
  const inputValue = inputEdge ? computed.get(inputEdge.source) : undefined
  const headerValue = computed.get(id)

  // Config patcher
  const updateConfig = useCallback(
    (patch: Partial<PlotConfig>) => {
      updateNodeData(id, { plotConfig: { ...config, ...patch } })
    },
    [id, config, updateNodeData],
  )

  // Inline title edit state
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const commitTitle = () => {
    updateConfig({ title: titleDraft.trim() || undefined })
    setTitleEditing(false)
  }

  // Derive spec result from inputs (pure computation, no side-effects)
  const specResult = useMemo(() => buildInlineSpec(inputValue, config, true), [inputValue, config])
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
          hover: true,
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

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const onExpand = useCallback(() => setExpandOpen(true), [setExpandOpen])

  return (
    <>
      <div
        style={{
          ...s.node,
          minWidth: 320,
          maxWidth: 420,
          ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
        }}
        role="group"
        aria-label={`${nd.label} plot block`}
      >
        <div
          style={{
            ...s.header,
            borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
            background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), transparent)`,
          }}
        >
          <div style={s.headerLeft}>
            <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
            <span style={s.headerLabel}>{nd.label}</span>
          </div>
          <span className="cs-node-header-value" style={s.headerValue}>
            {formatValue(headerValue)}
          </span>
        </div>

        <div
          className="cs-node-body"
          style={{ ...s.body, padding: '0.3rem', position: 'relative' }}
        >
          <Handle
            type="target"
            position={Position.Left}
            id="data"
            style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
          />

          {/* Inline chart title — click to edit */}
          <div
            className="nodrag"
            style={{ textAlign: 'center', marginBottom: '0.15rem', minHeight: '1.2rem' }}
          >
            {titleEditing ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle()
                  if (e.key === 'Escape') setTitleEditing(false)
                }}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '0.7rem',
                  background: 'var(--input-bg, var(--card))',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text)',
                  padding: '1px 4px',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <span
                onClick={() => {
                  setTitleDraft(config.title ?? '')
                  setTitleEditing(true)
                }}
                style={{
                  cursor: 'text',
                  fontSize: '0.7rem',
                  color: config.title ? 'var(--text)' : 'var(--muted)',
                  opacity: config.title ? 0.9 : 0.35,
                }}
                title={t('plot.clickToEditTitle', 'Click to set chart title')}
              >
                {config.title || t('plot.addTitle', 'Add title…')}
              </span>
            )}
          </div>

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
                color: 'var(--danger-text)',
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
                bottom: 36,
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
                top: 30,
                right: 8,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                color: 'var(--text)',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '0.65rem',
                zIndex: 2,
              }}
              title={t('plot.expand')}
            >
              ⤢
            </button>
          )}

          {/* Inline toolbar: log scale toggles + CSV export */}
          {!loading && !error && (
            <div
              className="nodrag"
              style={{
                display: 'flex',
                gap: '0.2rem',
                marginTop: '0.25rem',
                alignItems: 'center',
              }}
            >
              <button
                style={{
                  fontFamily: 'inherit',
                  fontSize: '0.6rem',
                  padding: '1px 5px',
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: config.xScale === 'log' ? 'var(--accent)' : 'transparent',
                  color: config.xScale === 'log' ? '#fff' : 'var(--muted)',
                  transition: 'all 0.1s',
                }}
                onClick={() => updateConfig({ xScale: config.xScale === 'log' ? undefined : 'log' })}
                title={t('plot.toggleXLog', 'Toggle X log scale')}
              >
                X log
              </button>
              <button
                style={{
                  fontFamily: 'inherit',
                  fontSize: '0.6rem',
                  padding: '1px 5px',
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: config.yScale === 'log' ? 'var(--accent)' : 'transparent',
                  color: config.yScale === 'log' ? '#fff' : 'var(--muted)',
                  transition: 'all 0.1s',
                }}
                onClick={() => updateConfig({ yScale: config.yScale === 'log' ? undefined : 'log' })}
                title={t('plot.toggleYLog', 'Toggle Y log scale')}
              >
                Y log
              </button>
              <div style={{ flex: 1 }} />
              <button
                style={{
                  fontFamily: 'inherit',
                  fontSize: '0.6rem',
                  padding: '1px 5px',
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--muted)',
                  transition: 'all 0.1s',
                }}
                onClick={() =>
                  exportCSV(
                    inputValue,
                    `${nd.label.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.csv`,
                  )
                }
                title={t('plot.exportCSV', 'Export CSV')}
              >
                CSV ↓
              </button>
            </div>
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
