/**
 * ProbeNode — dedicated debugging sink with rich value display.
 *
 * Like Display but with expanded formatting:
 * - Scalar: large value + full precision subtitle
 * - Vector: scrollable list (up to 50 items)
 * - Table: mini table preview (first 5 rows)
 * - Error: red message + "Jump to source" button
 *
 * Has 1 target handle ("value"), no source handles.
 * Value badge is always shown (not gated by badge toggle).
 */

import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue, isError, isScalar, isVector, isTable } from '../../../engine/value'
import { formatValueFull, copyValueToClipboard } from '../../../engine/valueFormat'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'

function ProbeNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)

  const compact = formatValue(value)
  const full = formatValueFull(value)

  const hasError = value !== undefined && isError(value)
  const isErrOrNaN =
    hasError || (value !== undefined && isScalar(value) && isNaN(value.value))

  const handleCopy = useCallback(() => {
    copyValueToClipboard(value, 'compact')
  }, [value])

  const handleCopyJson = useCallback(() => {
    copyValueToClipboard(value, 'json')
  }, [value])

  return (
    <div style={{ ...s.node, minWidth: 160, maxWidth: 280, ...(selected ? s.nodeSelected : {}) }}>
      <div style={{ ...s.header, background: 'rgba(168,85,247,0.15)' }}>
        <span style={s.headerLabel}>{nd.label}</span>
        <span style={{ ...s.headerValue, fontSize: '0.68rem' }}>{compact}</span>
      </div>

      <div
        className="cs-node-body"
        style={{
          ...s.body,
          position: 'relative',
          minHeight: 40,
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id="value"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* ── Scalar display ──────────────────────────────────────────── */}
        {value !== undefined && isScalar(value) && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                ...s.displayValue,
                color: isErrOrNaN ? '#f87171' : '#1CABB0',
              }}
            >
              {compact}
            </div>
            {full !== compact && (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem',
                  color: 'rgba(244,244,243,0.4)',
                  marginTop: -4,
                }}
              >
                {full}
              </div>
            )}
          </div>
        )}

        {/* ── Vector display ──────────────────────────────────────────── */}
        {value !== undefined && isVector(value) && (
          <div
            style={{
              maxHeight: 160,
              overflow: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem',
              color: '#a78bfa',
            }}
          >
            {value.value.slice(0, 50).map((v, i) => (
              <div key={i} style={{ padding: '0.05rem 0' }}>
                <span style={{ color: 'rgba(244,244,243,0.3)', marginRight: 6 }}>[{i}]</span>
                {v}
              </div>
            ))}
            {value.value.length > 50 && (
              <div style={{ color: 'rgba(244,244,243,0.3)', fontStyle: 'italic' }}>
                ...{value.value.length - 50} more
              </div>
            )}
          </div>
        )}

        {/* ── Table display ───────────────────────────────────────────── */}
        {value !== undefined && isTable(value) && (
          <div style={{ overflow: 'auto', maxHeight: 160 }}>
            <table
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.65rem',
                borderCollapse: 'collapse',
                width: '100%',
              }}
            >
              <thead>
                <tr>
                  {value.columns.map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '0.15rem 0.3rem',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        color: '#f59e0b',
                        fontWeight: 600,
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.rows.slice(0, 5).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: '0.1rem 0.3rem',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          color: 'var(--text)',
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {value.rows.length > 5 && (
              <div
                style={{
                  fontSize: '0.62rem',
                  color: 'rgba(244,244,243,0.3)',
                  fontStyle: 'italic',
                  padding: '0.15rem 0.3rem',
                }}
              >
                ...{value.rows.length - 5} more rows
              </div>
            )}
          </div>
        )}

        {/* ── Error display ───────────────────────────────────────────── */}
        {hasError && isError(value) && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                color: '#f87171',
                fontSize: '0.78rem',
                fontWeight: 600,
                wordBreak: 'break-word',
              }}
            >
              {value.message}
            </div>
          </div>
        )}

        {/* ── No value yet ────────────────────────────────────────────── */}
        {value === undefined && (
          <div
            style={{
              textAlign: 'center',
              color: 'rgba(244,244,243,0.3)',
              fontStyle: 'italic',
              fontSize: '0.75rem',
            }}
          >
            —
          </div>
        )}
      </div>

      {/* Footer with copy buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button className="nodrag" onClick={handleCopy} style={footerBtn}>
          Copy
        </button>
        <button className="nodrag" onClick={handleCopyJson} style={footerBtn}>
          JSON
        </button>
      </div>
    </div>
  )
}

const footerBtn: React.CSSProperties = {
  padding: '0.12rem 0.4rem',
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: 'rgba(244,244,243,0.6)',
  cursor: 'pointer',
  fontSize: '0.62rem',
  fontWeight: 500,
  fontFamily: 'inherit',
}

export const ProbeNode = memo(ProbeNodeInner)
