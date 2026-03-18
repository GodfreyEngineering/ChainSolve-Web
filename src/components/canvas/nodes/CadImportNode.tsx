/**
 * CadImportNode — 4.11: STEP/IGES geometry import block.
 *
 * Accepts .stp/.step (ISO-10303-21) and .igs/.iges files, parses vertex/mesh
 * geometry, and outputs a table of vertex positions (x, y, z columns) for
 * downstream use in viewport3d, FEM, or other mesh-consuming blocks.
 *
 * Bridge: data.stepImport → 'tableInput' (reads data.tableData).
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

interface CadImportNodeData extends NodeData {
  cadFileName: string | null
  cadFormat: 'step' | 'iges' | 'unknown' | null
  cadVertexCount: number
  cadFaceCount: number
  tableData: { columns: string[]; rows: number[][] } | null
}

function CadImportNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as CadImportNodeData
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
        const { parseStep, parseIges, meshToTable, detectCadFormat } = await import(
          '../../../lib/cadImport'
        )
        const fmt = detectCadFormat(file.name)
        const mesh = fmt === 'iges' ? parseIges(text) : parseStep(text)
        const tableData = meshToTable(mesh)

        updateNodeData(id, {
          cadFileName: file.name,
          cadFormat: fmt,
          cadVertexCount: mesh.vertices.length,
          cadFaceCount: mesh.faces.length,
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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) void handleFile(file)
    },
    [handleFile],
  )

  const loaded = Boolean(nd.cadFileName)
  const fmtLabel = nd.cadFormat === 'iges' ? 'IGES' : nd.cadFormat === 'step' ? 'STEP' : ''

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper?.border,
        minWidth: 190,
        maxWidth: 260,
      }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? 'CAD Import'}</span>
      </div>

      <div style={s.nodeBody}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".stp,.step,.p21,.igs,.iges"
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
          {loading
            ? 'Parsing geometry…'
            : nd.cadFileName
              ? `${fmtLabel ? fmtLabel + ' · ' : ''}${nd.cadFileName}`
              : 'Load .stp / .igs…'}
        </button>

        {loaded && (
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)' }}>
            {nd.cadVertexCount} vertices
            {nd.cadFaceCount > 0 ? ` · ${nd.cadFaceCount} triangles` : ''}
          </div>
        )}

        {nd.tableData && (
          <div style={{ marginTop: 3, fontSize: 9, color: 'var(--muted)' }}>
            {nd.tableData.rows.length} rows × {nd.tableData.columns.length} cols (x, y, z)
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

        <div
          style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)', textAlign: 'center' as const }}
        >
          Drag & drop .stp / .igs file
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ top: '50%' }}
        title="Output: table of vertex positions (x, y, z)"
      />
    </div>
  )
}

export const CadImportNode = memo(CadImportNodeInner)
export default CadImportNode
