/**
 * OnnxInferenceNode — 2.96: ONNX model import + inference block.
 *
 * UI-only block that:
 *  1. Lets the user load a .onnx model file via a file picker
 *  2. Displays model input/output shape information
 *  3. Reads the upstream vector value from the 'data' input port
 *  4. Runs inference via onnxruntime-web (WASM backend) when inputs change
 *  5. Writes the flattened output tensor to data.vectorData for the Rust engine
 *
 * Bridge: nn.onnxInference → 'vectorInput' (reads data.vectorData).
 * Session cache: sessions are held in lib/onnx.ts keyed by node ID.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps, useEdges, useReactFlow } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { useComputedValue } from '../../../contexts/ComputedContext'
import type { Value } from '../../../engine/value'

// ── Helpers ───────────────────────────────────────────────────────────────────

function valueToNumbers(v: Value | undefined): number[] {
  if (!v) return []
  if (v.kind === 'scalar') return [v.value]
  if (v.kind === 'vector') return [...v.value]
  if (v.kind === 'table') return v.rows.flatMap((r) => [...r])
  return []
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnnxInferenceNodeData extends NodeData {
  modelName: string | null
  inputShape: number[]
  outputShape: number[]
  inputNames: string[]
  outputNames: string[]
  vectorData: number[]
  inferenceError: string | null
  inferring: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

function OnnxInferenceNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as OnnxInferenceNodeData
  const { updateNodeData } = useReactFlow()
  const edges = useEdges()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  // Find the upstream node connected to our 'data' input port
  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'data')
  const sourceId = inputEdge?.source ?? ''
  const upstreamValue = useComputedValue(sourceId)

  // ── Model loading ────────────────────────────────────────────────────────

  const handleLoadModel = useCallback(
    async (file: File) => {
      setLoading(true)
      setLoadError(null)
      try {
        const buffer = await file.arrayBuffer()
        const { loadOnnxSession } = await import('../../../lib/onnx')
        const { info } = await loadOnnxSession(id, buffer)
        updateNodeData(id, {
          modelName: file.name,
          inputNames: info.inputNames,
          outputNames: info.outputNames,
          inferenceError: null,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setLoadError(msg)
      } finally {
        setLoading(false)
      }
    },
    [id, updateNodeData],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleLoadModel(file)
      // Reset so same file can be reloaded
      e.target.value = ''
    },
    [handleLoadModel],
  )

  // ── Inference ─────────────────────────────────────────────────────────────

  const inferenceAbortRef = useRef<AbortController | null>(null)

  const runInference = useCallback(async () => {
    if (!nd.modelName) return
    const inputNumbers = valueToNumbers(upstreamValue)
    if (inputNumbers.length === 0) return

    // Cancel any in-flight inference
    inferenceAbortRef.current?.abort()
    const ctrl = new AbortController()
    inferenceAbortRef.current = ctrl

    updateNodeData(id, { inferring: true })
    try {
      const { runOnnxInference } = await import('../../../lib/onnx')
      if (ctrl.signal.aborted) return
      const result = await runOnnxInference(id, inputNumbers)
      if (ctrl.signal.aborted) return
      if (result) {
        updateNodeData(id, {
          vectorData: Array.from(result.values),
          outputShape: result.shape,
          inferenceError: null,
          inferring: false,
        })
      } else {
        updateNodeData(id, { inferring: false })
      }
    } catch (err) {
      if (ctrl.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      updateNodeData(id, { inferenceError: msg, inferring: false })
    }
  }, [id, nd.modelName, upstreamValue, updateNodeData])

  useEffect(() => {
    void runInference()
  }, [runInference])

  // ── Render ────────────────────────────────────────────────────────────────

  const modelLoaded = Boolean(nd.modelName)
  const displayError = nd.inferenceError ?? loadError
  const outputLen = nd.vectorData?.length ?? 0
  const firstFew = nd.vectorData?.slice(0, 4).map((v) => v.toFixed(4)) ?? []

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>
          {nd.label ?? t('onnxInference.label', 'ONNX Inference')}
        </span>
      </div>

      <div style={s.nodeBody}>
        {/* File picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".onnx"
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
            background: modelLoaded
              ? 'color-mix(in srgb, var(--primary) 20%, transparent)'
              : 'var(--surface-2)',
            border: `1px solid ${modelLoaded ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 10,
            color: modelLoaded ? 'var(--primary)' : 'var(--text)',
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {loading
            ? t('onnxInference.loading', 'Loading…')
            : nd.modelName
              ? nd.modelName
              : t('onnxInference.loadModel', 'Load .onnx model…')}
        </button>

        {/* Model info */}
        {modelLoaded && nd.inputNames.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)' }}>
            <div>in: {nd.inputNames.join(', ')}</div>
            <div>out: {nd.outputNames.join(', ')}</div>
          </div>
        )}

        {/* Error display */}
        {displayError && (
          <div
            style={{
              marginTop: 4,
              padding: '2px 4px',
              background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
              border: '1px solid var(--danger)',
              borderRadius: 3,
              fontSize: 9,
              color: 'var(--danger)',
              wordBreak: 'break-all',
            }}
          >
            {displayError}
          </div>
        )}

        {/* Output preview */}
        {outputLen > 0 && !displayError && (
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted)' }}>
            [{outputLen}]: {firstFew.join(', ')}
            {outputLen > 4 ? '…' : ''}
          </div>
        )}

        {/* Inferring indicator */}
        {nd.inferring && (
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--primary)' }}>
            ⟳ {t('onnxInference.inferring', 'Inferring…')}
          </div>
        )}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="data"
        style={{ top: '50%' }}
        title={t('onnxInference.inputData', 'Input data (vector)')}
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ top: '50%' }}
        title={t('onnxInference.output', 'Output tensor (vector)')}
      />
    </div>
  )
}

export const OnnxInferenceNode = memo(OnnxInferenceNodeInner)
export default OnnxInferenceNode
