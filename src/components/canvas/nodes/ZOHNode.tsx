/**
 * ZOHNode — 2.70: Zero-Order Hold and Rate Transition blocks.
 *
 * Renders two node types via the same component family:
 *  - ZOH: shows sample period, held value, timing diagram sketch
 *  - RateTransition: shows input/output rates, ratio, interpolation mode
 *
 * In reactive eval mode, the block reads the upstream value via useComputedValue
 * and passes it through as 'number'. Full hold semantics require the simulation
 * worker infrastructure (Category 8).
 *
 * Bridge: ctrl.zoh → 'number', ctrl.rateTransition → 'number'.
 */

import { memo, useEffect } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { useComputedValue } from '../../../contexts/ComputedContext'

// ── ZOH Node ──────────────────────────────────────────────────────────────────

interface ZOHNodeData extends NodeData {
  samplePeriod: number
  heldValue: number
  value: number
}

function ZOHNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as ZOHNodeData
  const { updateNodeData } = useReactFlow()

  const samplePeriod = nd.samplePeriod ?? 0.01
  const heldValue = nd.heldValue ?? 0
  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  // Read upstream value and pass through (reactive mode)
  const upstream = useComputedValue(id, 'u')
  useEffect(() => {
    const v = typeof upstream === 'number' && Number.isFinite(upstream) ? upstream : heldValue
    updateNodeData(id, { heldValue: v, value: v })
  }, [id, upstream, heldValue, updateNodeData])

  // Timing diagram points (3 steps)
  const diagramPts = '0,20 0,10 20,10 20,20 40,20 40,5 60,5 60,20 80,20 80,15 100,15 100,20'

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 160,
        maxWidth: 200,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? t('zoh.label', 'ZOH')}</span>
      </div>
      <div style={s.nodeBody}>
        {/* Timing diagram */}
        <svg width={100} height={24} style={{ display: 'block', margin: '0 auto 6px', opacity: 0.7 }}>
          <polyline points={diagramPts} fill="none" stroke={typeColor} strokeWidth={1.5} strokeLinejoin="round" />
        </svg>

        <label style={{ fontSize: 9, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
          {t('zoh.period', 'Sample period (s)')}
          <input
            className="nodrag"
            type="number"
            min={0.0001}
            step={0.001}
            value={samplePeriod}
            onChange={(e) => updateNodeData(id, { samplePeriod: parseFloat(e.target.value) || 0.01 })}
            style={{
              background: '#1a1a1a', color: '#F4F4F3', border: '1px solid #444',
              borderRadius: 3, padding: '2px 6px', fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace', outline: 'none',
            }}
          />
        </label>

        <div style={{ fontSize: 9, color: '#888', fontFamily: 'JetBrains Mono, monospace' }}>
          {t('zoh.fs', 'fs')} = {(1 / samplePeriod).toFixed(1)} Hz
        </div>
        <div style={{ fontSize: 9, color: '#aaa', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
          {t('zoh.held', 'Held')} = {heldValue.toFixed(4)}
        </div>
      </div>

      <Handle type="target" position={Position.Left} id="u"
        style={{ top: '50%', background: '#888', width: 8, height: 8, border: '2px solid #1a1a1a' }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ top: '50%', background: typeColor, width: 8, height: 8, border: '2px solid #1a1a1a' }} />
    </div>
  )
}

export const ZOHNode = memo(ZOHNodeInner)

// ── Rate Transition Node ───────────────────────────────────────────────────────

interface RTNodeData extends NodeData {
  inputRate: number
  outputRate: number
  interpolation: 'zoh' | 'linear'
  value: number
}

function RateTransitionNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as RTNodeData
  const { updateNodeData } = useReactFlow()

  const inputRate = nd.inputRate ?? 1000
  const outputRate = nd.outputRate ?? 100
  const interpolation = nd.interpolation ?? 'zoh'
  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  // Pass through in reactive mode
  const upstream = useComputedValue(id, 'u')
  useEffect(() => {
    const v = typeof upstream === 'number' && Number.isFinite(upstream) ? upstream : 0
    updateNodeData(id, { value: v })
  }, [id, upstream, updateNodeData])

  const ratio = inputRate > 0 ? (outputRate / inputRate) : 1
  const isDown = outputRate < inputRate

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 180,
        maxWidth: 220,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? t('rateTransition.label', 'Rate Transition')}</span>
      </div>
      <div style={s.nodeBody}>
        {/* Rate ratio indicator */}
        <div style={{
          textAlign: 'center', fontSize: 14, fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace', color: typeColor, marginBottom: 6,
        }}>
          {inputRate} Hz {isDown ? '↓' : '↑'} {outputRate} Hz
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 6px', marginBottom: 6 }}>
          <label style={{ fontSize: 9, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {t('rateTransition.inputRate', 'In (Hz)')}
            <input
              className="nodrag"
              type="number"
              min={1}
              value={inputRate}
              onChange={(e) => updateNodeData(id, { inputRate: parseFloat(e.target.value) || 1000 })}
              style={{
                background: '#1a1a1a', color: '#F4F4F3', border: '1px solid #444',
                borderRadius: 3, padding: '2px 5px', fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace', outline: 'none',
              }}
            />
          </label>
          <label style={{ fontSize: 9, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {t('rateTransition.outputRate', 'Out (Hz)')}
            <input
              className="nodrag"
              type="number"
              min={1}
              value={outputRate}
              onChange={(e) => updateNodeData(id, { outputRate: parseFloat(e.target.value) || 100 })}
              style={{
                background: '#1a1a1a', color: '#F4F4F3', border: '1px solid #444',
                borderRadius: 3, padding: '2px 5px', fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace', outline: 'none',
              }}
            />
          </label>
        </div>

        <label style={{ fontSize: 9, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
          {t('rateTransition.interpolation', 'Interpolation')}
          <select
            className="nodrag"
            value={interpolation}
            onChange={(e) => updateNodeData(id, { interpolation: e.target.value as 'zoh' | 'linear' })}
            style={{
              background: '#1a1a1a', color: '#F4F4F3', border: '1px solid #444',
              borderRadius: 3, padding: '2px 4px', fontSize: 9, outline: 'none', flex: 1,
            }}
          >
            <option value="zoh">ZOH</option>
            <option value="linear">Linear</option>
          </select>
        </label>

        <div style={{ fontSize: 8, color: '#666', marginTop: 4 }}>
          {t('rateTransition.ratio', 'Ratio')}: {ratio.toFixed(4)}
          {isDown ? ` (${t('rateTransition.downsample', 'downsample')})` : ` (${t('rateTransition.upsample', 'upsample')})`}
        </div>
      </div>

      <Handle type="target" position={Position.Left} id="u"
        style={{ top: '50%', background: '#888', width: 8, height: 8, border: '2px solid #1a1a1a' }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ top: '50%', background: typeColor, width: 8, height: 8, border: '2px solid #1a1a1a' }} />
    </div>
  )
}

export const RateTransitionNode = memo(RateTransitionNodeInner)
