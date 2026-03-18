/**
 * Hdf5ImportNode — 4.7: HDF5 import block.
 *
 * Accepts .h5 / .hdf5 files, reads all numeric datasets using h5wasm
 * (libhdf5 compiled to WASM), and outputs a table of the first dataset
 * (or combined 1D datasets as columns).
 *
 * Bridge: data.hdf5Import → 'tableInput' (reads data.tableData).
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

interface Hdf5ImportNodeData extends NodeData {
  hdf5FileName: string | null
  hdf5DatasetPaths: string[]
  hdf5SelectedDataset: string | null
  tableData: { columns: string[]; rows: number[][] } | null
}

function Hdf5ImportNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as Hdf5ImportNodeData
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
        const buffer = await file.arrayBuffer()
        const { readHdf5, datasetsToTable } = await import('../../../lib/hdf5')
        const datasets = await readHdf5(buffer)

        const paths = datasets.map((d) => d.path)
        const tableData = datasetsToTable(datasets)

        updateNodeData(id, {
          hdf5FileName: file.name,
          hdf5DatasetPaths: paths,
          hdf5SelectedDataset: paths[0] ?? null,
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

  const loaded = Boolean(nd.hdf5FileName)

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
        <span style={s.nodeHeaderLabel}>{nd.label ?? 'HDF5 Import'}</span>
      </div>

      <div style={s.nodeBody}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".h5,.hdf5,.he5,.nc"
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
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Reading HDF5…' : (nd.hdf5FileName ?? 'Load .h5 / .hdf5…')}
        </button>

        {loaded && nd.hdf5DatasetPaths.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)' }}>
            {nd.hdf5DatasetPaths.length} dataset{nd.hdf5DatasetPaths.length !== 1 ? 's' : ''}:{' '}
            {nd.hdf5DatasetPaths.slice(0, 3).join(', ')}
            {nd.hdf5DatasetPaths.length > 3 ? '…' : ''}
          </div>
        )}

        {nd.tableData && (
          <div style={{ marginTop: 3, fontSize: 9, color: 'var(--muted)' }}>
            {nd.tableData.rows.length}×{nd.tableData.columns.length} table
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
        title="Output: table of HDF5 datasets"
      />
    </div>
  )
}

export const Hdf5ImportNode = memo(Hdf5ImportNodeInner)
export default Hdf5ImportNode
