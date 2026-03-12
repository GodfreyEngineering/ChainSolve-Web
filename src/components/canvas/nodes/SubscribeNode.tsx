/**
 * SubscribeNode — input block that reads a value from a published channel (H7-1).
 *
 * Has 0 target handles, 1 source handle ("out").
 * Displays a dropdown of available published channels and shows the current value.
 */

import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { useFormatValue } from '../../../hooks/useFormatValue'
import { usePublishedOutputsStore } from '../../../stores/publishedOutputsStore'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

function SubscribeNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const value = useComputedValue(id)
  const formatValue = useFormatValue()
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()
  const channels = usePublishedOutputsStore((st) => st.channels)

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const channelName = nd.subscribeChannelName ?? ''
  const channelNames = Object.keys(channels).sort()

  const handleChannelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { subscribeChannelName: e.target.value })
    },
    [id, updateNodeData],
  )

  return (
    <div
      style={{
        ...s.node,
        minWidth: 160,
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
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
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
              color: 'var(--warning)',
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
