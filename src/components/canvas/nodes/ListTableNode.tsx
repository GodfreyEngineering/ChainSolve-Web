/**
 * ListTableNode — terminal output block that displays list data
 * as a scrollable table with summary statistics (H2-3).
 *
 * Accepts a vector on port "data" and renders:
 * - A scrollable index/value table
 * - Summary row: count, sum, min, max, mean, std dev
 */

import { memo, useMemo, useCallback, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputed } from '../../../contexts/ComputedContext'
import { isVector, isError } from '../../../engine/value'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

const ROW_H = 22
const MAX_VISIBLE_H = 180
const OVERSCAN = 8

interface Stats {
  count: number
  sum: number
  min: number
  max: number
  mean: number
  stddev: number
}

function computeStats(values: readonly number[]): Stats {
  const count = values.length
  if (count === 0) {
    return { count: 0, sum: 0, min: NaN, max: NaN, mean: NaN, stddev: NaN }
  }
  let sum = 0
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  const mean = sum / count
  let variance = 0
  for (const v of values) {
    const d = v - mean
    variance += d * d
  }
  const stddev = Math.sqrt(variance / count)
  return { count, sum, min, max, mean, stddev }
}

function fmtNum(n: number): string {
  if (isNaN(n)) return 'NaN'
  if (!isFinite(n)) return n > 0 ? '+\u221E' : '\u2212\u221E'
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  if (abs >= 1e6 || (abs > 0 && abs < 1e-3)) return n.toExponential(4)
  // Up to 6 significant digits
  return parseFloat(n.toPrecision(6)).toString()
}

const cellStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  padding: '1px 4px',
  whiteSpace: 'nowrap',
}

const idxCellStyle: React.CSSProperties = {
  ...cellStyle,
  color: 'rgba(244,244,243,0.3)',
  textAlign: 'right',
  width: 30,
  flexShrink: 0,
}

const valCellStyle: React.CSSProperties = {
  ...cellStyle,
  color: 'var(--text)',
  flex: 1,
  textAlign: 'right',
}

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.58rem',
  color: 'rgba(244,244,243,0.4)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}

const statValueStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.62rem',
  color: 'var(--primary)',
}

function ListTableNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)
  const { t } = useTranslation()

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const values = useMemo(() => {
    if (value && isVector(value)) return value.value
    return null
  }, [value])

  const stats = useMemo(() => {
    if (!values) return null
    return computeStats(values)
  }, [values])

  const errorMsg = useMemo(() => {
    if (!value) return t('listTable.noData')
    if (isError(value)) return value.message
    if (!isVector(value)) return t('listTable.expectList')
    return null
  }, [value, t])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop)
  }, [])

  // Virtual scroll for large lists
  const totalH = (values?.length ?? 0) * ROW_H
  const visibleH = Math.min(MAX_VISIBLE_H, totalH)
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const endIdx = values
    ? Math.min(values.length, Math.ceil((scrollTop + visibleH) / ROW_H) + OVERSCAN)
    : 0

  return (
    <div
      style={{
        ...s.node,
        minWidth: 180,
        maxWidth: 280,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
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
        {stats && (
          <span style={s.headerValue}>
            {stats.count} {t('listTable.items')}
          </span>
        )}
      </div>

      <div className="cs-node-body" style={{ ...s.body, padding: '0.3rem 0.4rem' }}>
        <Handle
          type="target"
          position={Position.Left}
          id="data"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        {errorMsg && (
          <div
            style={{
              color: 'var(--danger-text)',
              fontSize: '0.7rem',
              textAlign: 'center',
              padding: '0.5rem 0',
              opacity: 0.7,
            }}
          >
            {errorMsg}
          </div>
        )}

        {values && values.length > 0 && (
          <>
            {/* Column headers */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                marginBottom: 2,
              }}
            >
              <span style={{ ...idxCellStyle, fontWeight: 700, fontSize: '0.58rem' }}>#</span>
              <span style={{ ...valCellStyle, fontWeight: 700, fontSize: '0.58rem' }}>
                {t('listTable.value')}
              </span>
            </div>

            {/* Scrollable table body */}
            <div
              ref={containerRef}
              className="nodrag nowheel"
              onScroll={handleScroll}
              style={{
                maxHeight: MAX_VISIBLE_H,
                overflowY: 'auto',
                overflowX: 'hidden',
                position: 'relative',
              }}
            >
              <div style={{ height: totalH, position: 'relative' }}>
                {Array.from({ length: endIdx - startIdx }, (_, i) => {
                  const idx = startIdx + i
                  const v = values[idx]
                  return (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        top: idx * ROW_H,
                        left: 0,
                        right: 0,
                        height: ROW_H,
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      <span style={idxCellStyle}>{idx}</span>
                      <span
                        style={{
                          ...valCellStyle,
                          ...(isNaN(v) ? { color: 'var(--danger-text)', opacity: 0.7 } : {}),
                        }}
                      >
                        {fmtNum(v)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Summary statistics */}
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                marginTop: 4,
                paddingTop: 4,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2px 8px',
              }}
            >
              {stats && (
                <>
                  <div>
                    <span style={statLabelStyle}>{t('listTable.statMin')}</span>{' '}
                    <span style={statValueStyle}>{fmtNum(stats.min)}</span>
                  </div>
                  <div>
                    <span style={statLabelStyle}>{t('listTable.statMax')}</span>{' '}
                    <span style={statValueStyle}>{fmtNum(stats.max)}</span>
                  </div>
                  <div>
                    <span style={statLabelStyle}>{t('listTable.statMean')}</span>{' '}
                    <span style={statValueStyle}>{fmtNum(stats.mean)}</span>
                  </div>
                  <div>
                    <span style={statLabelStyle}>{t('listTable.statStdDev')}</span>{' '}
                    <span style={statValueStyle}>{fmtNum(stats.stddev)}</span>
                  </div>
                  <div>
                    <span style={statLabelStyle}>{t('listTable.statSum')}</span>{' '}
                    <span style={statValueStyle}>{fmtNum(stats.sum)}</span>
                  </div>
                  <div>
                    <span style={statLabelStyle}>{t('listTable.statCount')}</span>{' '}
                    <span style={statValueStyle}>{stats.count}</span>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {values && values.length === 0 && (
          <div
            style={{
              fontSize: '0.7rem',
              textAlign: 'center',
              padding: '0.5rem 0',
              color: 'rgba(244,244,243,0.4)',
            }}
          >
            {t('listTable.empty')}
          </div>
        )}
      </div>
    </div>
  )
}

export const ListTableNode = memo(ListTableNodeInner)
