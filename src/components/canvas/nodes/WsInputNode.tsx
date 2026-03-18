/**
 * WsInputNode — 4.19: WebSocket live data input block.
 *
 * Opens a WebSocket connection to a user-supplied URL. Parses incoming
 * messages as numbers and updates node.data.value at a throttled rate
 * (default 30Hz) so the engine re-evaluates downstream blocks.
 *
 * Message parsing (first match wins):
 *   - Plain numeric string → parseFloat
 *   - JSON { [field]: number } → value at the configured field key
 *   - JSON [number, ...] → first element
 *   - Other → ignored
 *
 * The block has no input handles — it is a pure source. Bridge remaps
 * blockType='wsInput' → 'number' so the engine treats it as a Number node.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WsInputNodeData extends NodeData {
  wsUrl?: string
  wsField?: string
  wsThrottleHz?: number
}

type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseMessage(raw: string, field: string): number | null {
  const trimmed = raw.trim()
  // Plain number
  const direct = parseFloat(trimmed)
  if (!isNaN(direct) && trimmed !== '') return direct
  // JSON
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === 'number') return parsed
    if (Array.isArray(parsed) && typeof parsed[0] === 'number') return parsed[0]
    if (parsed && typeof parsed === 'object' && field in parsed) {
      const v = (parsed as Record<string, unknown>)[field]
      if (typeof v === 'number') return v
      const n = parseFloat(String(v))
      if (!isNaN(n)) return n
    }
  } catch {
    /* not JSON */
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

function WsInputNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as WsInputNodeData
  const { updateNodeData } = useReactFlow()

  const wsUrl = nd.wsUrl ?? 'ws://localhost:8080'
  const wsField = nd.wsField ?? 'value'
  const throttleHz = Math.max(1, Math.min(nd.wsThrottleHz ?? 30, 1000))
  const throttleMs = Math.round(1000 / throttleHz)

  const [status, setStatus] = useState<ConnStatus>('idle')
  const [lastValue, setLastValue] = useState<number>(typeof nd.value === 'number' ? nd.value : 0)
  const [msgCount, setMsgCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [connected, setConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const pendingValueRef = useRef<number | null>(null)
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Flush pending value to node data at throttled rate
  const flushValue = useCallback(() => {
    if (pendingValueRef.current !== null) {
      const v = pendingValueRef.current
      pendingValueRef.current = null
      setLastValue(v)
      updateNodeData(id, { value: v })
    }
    throttleTimerRef.current = null
  }, [id, updateNodeData])

  const handleMessage = useCallback(
    (raw: string) => {
      const v = parseMessage(raw, wsField)
      if (v === null) return
      setMsgCount((c) => c + 1)
      pendingValueRef.current = v
      if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(flushValue, throttleMs)
      }
    },
    [wsField, throttleMs, flushValue],
  )

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('connecting')
    setErrorMsg('')
    setMsgCount(0)
    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.onopen = () => {
        setStatus('connected')
        setConnected(true)
      }
      ws.onmessage = (e) => handleMessage(String(e.data))
      ws.onerror = () => {
        setStatus('error')
        setErrorMsg(t('wsInput.connError', 'Connection error'))
        setConnected(false)
      }
      ws.onclose = (e) => {
        if (status === 'connecting' || status === 'connected') {
          setStatus(e.wasClean ? 'idle' : 'error')
          if (!e.wasClean) setErrorMsg(t('wsInput.connClosed', 'Connection closed unexpectedly'))
        }
        setConnected(false)
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(String(err))
    }
  }, [wsUrl, handleMessage, t, status])

  const disconnect = useCallback(() => {
    wsRef.current?.close(1000, 'user disconnect')
    wsRef.current = null
    setStatus('idle')
    setConnected(false)
    setErrorMsg('')
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current)
    }
  }, [])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const statusColor =
    status === 'connected'
      ? '#22c55e'
      : status === 'connecting'
        ? '#f59e0b'
        : status === 'error'
          ? '#ef4444'
          : 'var(--muted)'

  const statusLabel =
    status === 'connected'
      ? t('wsInput.connected', 'Connected')
      : status === 'connecting'
        ? t('wsInput.connecting', 'Connecting…')
        : status === 'error'
          ? t('wsInput.error', 'Error')
          : t('wsInput.idle', 'Idle')

  return (
    <div
      style={{
        ...s.node,
        minWidth: 190,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
        borderColor: status === 'connected' ? '#22c55e55' : undefined,
        boxShadow: status === 'connected' ? '0 0 0 1px #22c55e33' : undefined,
      }}
      role="group"
      aria-label={`${nd.label} WebSocket input, ${statusLabel}`}
    >
      <div style={{ ...s.header, borderBottom: `2px solid ${statusColor}44` }}>
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            color: statusColor,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
            }}
          />
          {statusLabel}
        </span>
      </div>

      <div className="cs-node-body" style={{ ...s.body, padding: '0.5rem 0.6rem' }}>
        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Current value */}
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: 4 }}>
          {t('wsInput.value', 'Value')}:{' '}
          <span
            style={{
              color: 'var(--text)',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
            }}
          >
            {lastValue.toPrecision(6).replace(/\.?0+$/, '')}
          </span>
          {msgCount > 0 && (
            <span style={{ color: 'var(--muted)', marginLeft: 4 }}>({msgCount} msgs)</span>
          )}
        </div>

        {/* URL input */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginBottom: 2 }}>
            {t('wsInput.url', 'URL')}:
          </div>
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => updateNodeData(id, { wsUrl: e.target.value })}
            placeholder="ws://host:port/path"
            className="nodrag"
            disabled={connected}
            style={{
              width: '100%',
              fontSize: '0.6rem',
              padding: '2px 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: connected ? 'var(--card)' : 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              fontFamily: "'JetBrains Mono', monospace",
              opacity: connected ? 0.6 : 1,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Field + throttle row */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginBottom: 2 }}>
              {t('wsInput.field', 'Field')}:
            </div>
            <input
              type="text"
              value={wsField}
              onChange={(e) => updateNodeData(id, { wsField: e.target.value })}
              placeholder="value"
              className="nodrag"
              style={{
                width: '100%',
                fontSize: '0.6rem',
                padding: '2px 4px',
                borderRadius: 3,
                border: '1px solid var(--border)',
                background: 'var(--input-bg, var(--card))',
                color: 'var(--text)',
                fontFamily: "'JetBrains Mono', monospace",
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginBottom: 2 }}>
              {t('wsInput.hz', 'Rate (Hz)')}:
            </div>
            <input
              type="number"
              value={throttleHz}
              min={1}
              max={1000}
              onChange={(e) =>
                updateNodeData(id, { wsThrottleHz: Math.max(1, parseInt(e.target.value) || 30) })
              }
              className="nodrag"
              style={{
                width: '100%',
                fontSize: '0.6rem',
                padding: '2px 4px',
                borderRadius: 3,
                border: '1px solid var(--border)',
                background: 'var(--input-bg, var(--card))',
                color: 'var(--text)',
                fontFamily: "'JetBrains Mono', monospace",
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Connect / Disconnect button */}
        <button
          onClick={connected ? disconnect : connect}
          className="nodrag"
          style={{
            width: '100%',
            fontSize: '0.65rem',
            fontWeight: 600,
            padding: '3px 6px',
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            background: connected ? '#ef4444' : '#22c55e',
            color: '#fff',
          }}
        >
          {connected ? t('wsInput.disconnect', 'Disconnect') : t('wsInput.connect', 'Connect')}
        </button>

        {/* Error message */}
        {errorMsg && (
          <div
            style={{
              fontSize: '0.6rem',
              color: '#ef4444',
              marginTop: 4,
              wordBreak: 'break-all',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  )
}

export const WsInputNode = memo(WsInputNodeInner)
