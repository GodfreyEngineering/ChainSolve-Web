/**
 * FmuImportNode — 2.125: FMI 2.0/3.0 FMU import block.
 *
 * Accepts a .fmu file, parses modelDescription.xml to discover:
 *   - Model name, GUID, FMI version
 *   - Input/output/parameter variable names and initial values
 *
 * The block outputs a Table: each row = one output variable with
 * columns [name, valueReference, start, unit].
 * The data is stored in data.tableData for the Rust engine (tableInput bridge).
 *
 * Note: Binary FMU execution is not performed in the browser.
 * The block exposes the FMU interface and initial values only.
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FmuImportNodeData extends NodeData {
  fmuName: string | null
  fmuVersion: string | null
  fmuModelName: string | null
  fmuDescription: string | null
  fmuInputCount: number
  fmuOutputCount: number
  fmuParamCount: number
  /** Table data for the Rust engine: rows of output variable initial values. */
  tableData: { columns: string[]; rows: number[][] } | null
}

// ── Component ─────────────────────────────────────────────────────────────────

function FmuImportNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as FmuImportNodeData
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
        const { parseFmu } = await import('../../../lib/fmu')
        const info = await parseFmu(buffer)

        // Build tableData from output variables (initial values)
        const allOutputs = [...info.outputs, ...info.parameters]
        const tableData =
          allOutputs.length > 0
            ? {
                columns: allOutputs.map((v) => v.name),
                rows: [allOutputs.map((v) => v.start)],
              }
            : null

        updateNodeData(id, {
          fmuName: file.name,
          fmuVersion: info.fmiVersion,
          fmuModelName: info.modelName,
          fmuDescription: info.description ?? null,
          fmuInputCount: info.inputs.length,
          fmuOutputCount: info.outputs.length,
          fmuParamCount: info.parameters.length,
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

  const loaded = Boolean(nd.fmuName)

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper?.border,
        minWidth: 200,
        maxWidth: 270,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? 'FMU Import'}</span>
      </div>

      <div style={s.nodeBody}>
        {/* File picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".fmu"
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
          {loading ? 'Parsing FMU…' : nd.fmuName ?? 'Load .fmu file…'}
        </button>

        {/* Model info */}
        {loaded && (
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)', lineHeight: 1.5 }}>
            {nd.fmuModelName && <div title={nd.fmuDescription ?? undefined}>{nd.fmuModelName}</div>}
            <div>FMI {nd.fmuVersion ?? '?'}</div>
            <div>
              in:{nd.fmuInputCount} out:{nd.fmuOutputCount} param:{nd.fmuParamCount}
            </div>
          </div>
        )}

        {/* Error */}
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

        {/* Note about binary execution */}
        {loaded && (
          <div style={{ marginTop: 4, fontSize: 8, color: 'var(--muted)', fontStyle: 'italic' }}>
            Initial values only — binary FMU simulation via server required
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ top: '50%' }}
        title="Output: table of FMU output variable initial values"
      />
    </div>
  )
}

export const FmuImportNode = memo(FmuImportNodeInner)
export default FmuImportNode
