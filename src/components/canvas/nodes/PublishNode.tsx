/**
 * PublishNode — output block that publishes its input value under a named channel (H7-1).
 *
 * Has 1 target handle ("value"), no source handles.
 * The channel name is editable inline. After engine evaluation, the CanvasArea
 * writes the computed value to publishedOutputsStore keyed by channel name.
 */

import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputed } from '../../../contexts/ComputedContext'
import { useFormatValue } from '../../../hooks/useFormatValue'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'

function PublishNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)
  const formatValue = useFormatValue()
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()

  const channelName = nd.publishChannelName ?? ''

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { publishChannelName: e.target.value })
    },
    [id, updateNodeData],
  )

  return (
    <div style={{ ...s.node, minWidth: 160, ...(selected ? s.nodeSelected : {}) }}>
      <div style={{ ...s.header, background: 'rgba(16,185,129,0.15)' }}>
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
          type="target"
          position={Position.Left}
          id="value"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        <input
          className="nodrag"
          type="text"
          value={channelName}
          onChange={handleNameChange}
          placeholder={t('publishSubscribe.channelPlaceholder')}
          style={{
            ...s.numInput,
            fontSize: '0.75rem',
            textAlign: 'left',
            fontFamily: "'Montserrat', system-ui, sans-serif",
          }}
        />

        {!channelName && (
          <div
            style={{
              fontSize: '0.62rem',
              color: '#f59e0b',
              fontStyle: 'italic',
            }}
          >
            {t('publishSubscribe.setChannel')}
          </div>
        )}
      </div>
    </div>
  )
}

export const PublishNode = memo(PublishNodeInner)
