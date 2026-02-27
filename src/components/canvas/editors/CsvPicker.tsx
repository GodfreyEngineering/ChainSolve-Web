/**
 * CsvPicker — file upload component for CSVImport nodes.
 *
 * Triggers a hidden <input type="file"> to pick a CSV, parses it
 * via a Web Worker, and updates the node's tableData.
 */

import { useState, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/registry'
import { useProjectStore } from '../../../stores/projectStore'
import { MAX_UPLOAD_BYTES } from '../../../lib/storage'

interface CsvPickerProps {
  nodeId: string
  data: NodeData
}

export function CsvPicker({ nodeId, data }: CsvPickerProps) {
  const { updateNodeData } = useReactFlow()
  const projectId = useProjectStore((s) => s.projectId)
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'parsing' | 'error'>(
    data.tableData ? 'idle' : 'idle',
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const td = data.tableData as { columns: string[]; rows: number[][] } | undefined

  const handleFile = useCallback(
    (file: File) => {
      setStatus('parsing')
      setErrorMsg(null)

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const worker = new Worker(new URL('../../../engine/csv-worker.ts', import.meta.url), {
            type: 'module',
          })
          worker.onmessage = (e: MessageEvent) => {
            worker.terminate()
            const msg = e.data as
              | { ok: true; columns: string[]; rows: number[][] }
              | { ok: false; error: string }
            if (msg.ok) {
              updateNodeData(nodeId, {
                tableData: { columns: msg.columns, rows: msg.rows },
                csvStoragePath: file.name,
              })
              setStatus('idle')

              // Background upload to storage (fire-and-forget)
              if (projectId) {
                import('../../../lib/storage')
                  .then(({ uploadCsv }) => uploadCsv(projectId, file))
                  .catch(() => {
                    /* best effort — CSV already works locally */
                  })
              }
            } else {
              setStatus('error')
              setErrorMsg(msg.error)
            }
          }
          worker.onerror = (err) => {
            worker.terminate()
            setStatus('error')
            setErrorMsg(err.message || 'Worker error')
          }
          worker.postMessage({ text: reader.result as string })
        } catch (err) {
          setStatus('error')
          setErrorMsg(err instanceof Error ? err.message : 'Parse error')
        }
      }
      reader.onerror = () => {
        setStatus('error')
        setErrorMsg('Failed to read file')
      }
      reader.readAsText(file)
    },
    [nodeId, updateNodeData, projectId],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > MAX_UPLOAD_BYTES) {
        setStatus('error')
        setErrorMsg(t('canvas.csvFileTooLarge', { maxMb: MAX_UPLOAD_BYTES / 1024 / 1024 }))
        e.target.value = ''
        return
      }
      handleFile(file)
      e.target.value = ''
    },
    [handleFile, t],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />

      {td ? (
        <div
          style={{
            fontSize: '0.68rem',
            color: '#1CABB0',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {data.csvStoragePath ?? 'CSV'}: {td.rows.length} rows, {td.columns.length} cols
        </div>
      ) : (
        <div style={{ fontSize: '0.68rem', color: 'rgba(244,244,243,0.35)' }}>No CSV loaded</div>
      )}

      {status === 'parsing' && (
        <div style={{ fontSize: '0.65rem', color: 'rgba(244,244,243,0.5)' }}>Parsing...</div>
      )}

      {status === 'error' && errorMsg && (
        <div style={{ fontSize: '0.65rem', color: '#f87171' }}>{errorMsg}</div>
      )}

      <button
        className="nodrag"
        onClick={() => fileRef.current?.click()}
        disabled={status === 'parsing'}
        style={{
          padding: '3px 8px',
          background: 'rgba(28,171,176,0.12)',
          border: '1px solid rgba(28,171,176,0.25)',
          borderRadius: 4,
          color: '#1CABB0',
          cursor: status === 'parsing' ? 'not-allowed' : 'pointer',
          fontSize: '0.68rem',
          fontWeight: 600,
          fontFamily: 'inherit',
          opacity: status === 'parsing' ? 0.5 : 1,
        }}
      >
        Choose CSV
      </button>
    </div>
  )
}
