/**
 * OpenDriveNode — 4.15: OpenDRIVE .xodr road geometry import block.
 *
 * Accepts .xodr files, parses road reference lines (line, arc, spiral,
 * poly3, paramPoly3), and outputs a table of sampled road points with
 * columns [road_idx, s, x, y, hdg] for use in vehicle simulation blocks.
 *
 * Bridge: data.openDriveImport → 'tableInput' (reads data.tableData).
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

interface OpenDriveNodeData extends NodeData {
  xodrFileName: string | null
  xodrRoadCount: number
  xodrTotalLength: number
  tableData: { columns: string[]; rows: number[][] } | null
}

function OpenDriveNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as OpenDriveNodeData
  const { updateNodeData } = useReactFlow()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      try {
        const text = await file.text()
        const { parseOpenDrive, xodrToTable } = await import('../../../lib/openDrive')
        const result = parseOpenDrive(text)
        const tableData = xodrToTable(result)

        updateNodeData(id, {
          xodrFileName: file.name,
          xodrRoadCount: result.roads.length,
          xodrTotalLength: result.totalLength,
          tableData,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [id, updateNodeData],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  const loaded = Boolean(nd.xodrFileName)

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper?.border,
        minWidth: 190,
        maxWidth: 260,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? 'OpenDRIVE Import'}</span>
      </div>

      <div style={s.nodeBody}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xodr"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <button
          className="nodrag"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          style={{
            width: '100%',
            padding: '4px 8px',
            background: loaded
              ? 'color-mix(in srgb, var(--primary) 20%, transparent)'
              : 'var(--surface-2)',
            border: `1px solid ${loaded ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 10,
            color: loaded ? 'var(--primary)' : 'var(--text)',
            textAlign: 'left' as const,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {loading ? 'Parsing .xodr…' : (nd.xodrFileName ?? 'Load .xodr…')}
        </button>

        {loaded && (
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)' }}>
            {nd.xodrRoadCount} road{nd.xodrRoadCount !== 1 ? 's' : ''} ·{' '}
            {nd.xodrTotalLength.toFixed(0)} m total
          </div>
        )}

        {nd.tableData && (
          <div style={{ marginTop: 3, fontSize: 9, color: 'var(--muted)' }}>
            {nd.tableData.rows.length} sample points (road_idx, s, x, y, hdg)
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 4,
              padding: '2px 4px',
              background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
              border: '1px solid var(--danger)',
              borderRadius: 3,
              fontSize: 9,
              color: 'var(--danger)',
              wordBreak: 'break-all' as const,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ top: '50%' }}
        title="Output: table of road sample points (road_idx, s, x, y, hdg)"
      />
    </div>
  )
}

export const OpenDriveNode = memo(OpenDriveNodeInner)
export default OpenDriveNode
