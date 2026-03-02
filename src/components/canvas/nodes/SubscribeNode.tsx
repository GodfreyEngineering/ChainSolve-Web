/**
 * SubscribeNode — input block that reads a value from a published channel (H7-1).
 *
 * Has 0 target handles, 1 source handle ("out").
 * Displays a dropdown of available published channels and shows the current value.
 */

import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputed } from '../../../contexts/ComputedContext'
import { useFormatValue } from '../../../hooks/useFormatValue'
import { usePublishedOutputsStore } from '../../../stores/publishedOutputsStore'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'

function SubscribeNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)
  const formatValue = useFormatValue()
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()
  const channels = usePublishedOutputsStore((st) => st.channels)

  const channelName = nd.subscribeChannelName ?? ''
  const channelNames = Object.keys(channels).sort()

  const handleChannelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { subscribeChannelName: e.target.value })
    },
    [id, updateNodeData],
  )

  return (
    <div style={{ ...s.node, minWidth: 160, ...(selected ? s.nodeSelected : {}) }}>
      <div style={{ ...s.header, background: 'rgba(59,130,246,0.15)' }}>
        <span style={s.headerLabel}>{nd.label}</span>
        <span style={s.headerValue}>{formatValue(value)}</span>
      </div>

      <div
        className="cs-node-body"
        style={{
          ...s.body,
          position: 'relative',
          minHeight: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
        />

        <select
          className="nodrag"
          value={channelName}
          onChange={handleChannelChange}
          style={{
            ...s.numInput,
            fontSize: '0.75rem',
            textAlign: 'left',
            fontFamily: "'Montserrat', system-ui, sans-serif",
            cursor: 'pointer',
          }}
        >
          <option value="">{t('publishSubscribe.selectChannel')}</option>
          {channelNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {channelName && !channels[channelName] && (
          <div
            style={{
              fontSize: '0.62rem',
              color: '#f59e0b',
              fontStyle: 'italic',
            }}
          >
            {t('publishSubscribe.channelNotFound')}
          </div>
        )}
      </div>
    </div>
  )
}

export const SubscribeNode = memo(SubscribeNodeInner)
