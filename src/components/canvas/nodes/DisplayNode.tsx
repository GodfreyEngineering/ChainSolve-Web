/**
 * DisplayNode — output block that shows the computed value prominently.
 * Has one target handle (left) and no source handle.
 */

import { memo, useMemo } from 'react'
import { Handle, Position, useEdges, useNodes, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { isError, isScalar } from '../../../engine/value'
import { useFormatValue } from '../../../hooks/useFormatValue'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'

function DisplayNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)
  const formatValue = useFormatValue()
  const edges = useEdges()
  const nodes = useNodes()

  const isErrVal =
    value !== undefined && (isError(value) || (isScalar(value) && isNaN(value.value)))
  const displayStyle: React.CSSProperties = {
    ...s.displayValue,
    ...(isErrVal ? { color: '#f87171', opacity: 0.7 } : {}),
  }

  // G4-1: Derive a source label from the connected upstream block
  const sourceLabel = useMemo(() => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'value')
    if (!edge) return null
    const srcNode = nodes.find((n) => n.id === edge.source)
    if (!srcNode) return null
    const srcData = srcNode.data as NodeData | undefined
    const srcDef = srcData ? BLOCK_REGISTRY.get(srcData.blockType) : undefined
    return srcDef?.label ?? srcData?.label ?? null
  }, [edges, nodes, id])

  return (
    <div style={{ ...s.node, minWidth: 140, ...(selected ? s.nodeSelected : {}) }}>
      <div style={s.header}>
        <span style={s.headerLabel}>{nd.label}</span>
      </div>

      <div
        className="cs-node-body"
        style={{
          ...s.body,
          textAlign: 'center',
          position: 'relative',
          minHeight: 48,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id="value"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />
        <span style={displayStyle}>{formatValue(value)}</span>
        {sourceLabel && (
          <span
            style={{
              fontSize: '0.55rem',
              color: 'rgba(244,244,243,0.3)',
              letterSpacing: '0.03em',
              userSelect: 'none',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sourceLabel}
          </span>
        )}
      </div>
    </div>
  )
}

export const DisplayNode = memo(DisplayNodeInner)
