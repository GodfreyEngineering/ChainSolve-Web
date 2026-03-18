/**
 * RestInputNode — 4.21: REST / GraphQL API client block.
 *
 * Makes HTTP requests via browser fetch(). Extracts a numeric value from
 * the JSON response using a dot-notation path and updates node.data.value,
 * which the engine reads as a Number source (via bridge.ts remap).
 *
 * Supports manual trigger and auto-polling at a configurable interval.
 * GraphQL: POST with Content-Type application/json.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RestInputNodeData extends NodeData {
  restUrl?: string
  restMethod?: string
  restHeaders?: string
  restBody?: string
  restPath?: string
  restPollSec?: number
}

type FetchStatus = 'idle' | 'fetching' | 'ok' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve a dot-notation path in a nested object. Returns null if not found. */
function resolvePath(obj: unknown, path: string): number | null {
  if (path.trim() === '') {
    if (typeof obj === 'number') return obj
    if (typeof obj === 'string') {
      const n = parseFloat(obj)
      return isNaN(n) ? null : n
    }
    return null
  }
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[part]
  }
  if (typeof cur === 'number') return cur
  if (typeof cur === 'string') {
    const n = parseFloat(cur)
    return isNaN(n) ? null : n
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

function RestInputNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as RestInputNodeData
  const { updateNodeData } = useReactFlow()

  const restUrl = nd.restUrl ?? ''
  const restMethod = nd.restMethod ?? 'GET'
  const restHeaders = nd.restHeaders ?? '{}'
  const restBody = nd.restBody ?? ''
  const restPath = nd.restPath ?? ''
  const restPollSec = nd.restPollSec ?? 0

  const [status, setStatus] = useState<FetchStatus>('idle')
  const [lastValue, setLastValue] = useState<number>(typeof nd.value === 'number' ? nd.value : 0)
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [lastFetch, setLastFetch] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doFetch = useCallback(async () => {
    if (!restUrl.trim()) {
      setErrorMsg(t('restInput.noUrl', 'No URL configured'))
      setStatus('error')
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus('fetching')
    setErrorMsg('')

    try {
      let headers: Record<string, string> = {}
      try {
        headers = JSON.parse(restHeaders) as Record<string, string>
      } catch {
        /* ignore invalid headers */
      }

      const opts: RequestInit = {
        method: restMethod,
        headers,
        signal: ctrl.signal,
      }
      if (restBody.trim() && ['POST', 'PUT', 'PATCH'].includes(restMethod)) {
        opts.body = restBody
        if (!headers['Content-Type'] && !headers['content-type']) {
          ;(opts.headers as Record<string, string>)['Content-Type'] = 'application/json'
        }
      }

      const res = await fetch(restUrl, opts)
      setStatusCode(res.status)

      if (!res.ok) {
        setErrorMsg(t('restInput.httpError', `HTTP ${res.status}`).replace('HTTP', `HTTP`))
        setStatus('error')
        return
      }

      const text = await res.text()
      let parsed: unknown = text
      try {
        parsed = JSON.parse(text)
      } catch {
        /* not JSON — try as plain number */
      }

      const v = resolvePath(parsed, restPath)
      if (v === null) {
        setErrorMsg(
          restPath
            ? t('restInput.pathNotFound', `Path "${restPath}" not found or not numeric`)
            : t('restInput.notNumeric', 'Response is not numeric'),
        )
        setStatus('error')
        return
      }

      setLastValue(v)
      updateNodeData(id, { value: v })
      setStatus('ok')
      setLastFetch(new Date().toLocaleTimeString())
      setErrorMsg('')
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setErrorMsg(String(err))
      setStatus('error')
    }
  }, [restUrl, restMethod, restHeaders, restBody, restPath, id, updateNodeData, t])

  // Auto-poll
  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (restPollSec > 0) {
      pollTimerRef.current = setInterval(doFetch, restPollSec * 1000)
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [restPollSec, doFetch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const statusColor =
    status === 'ok'
      ? '#22c55e'
      : status === 'fetching'
        ? '#f59e0b'
        : status === 'error'
          ? '#ef4444'
          : 'var(--muted)'

  const statusLabel =
    status === 'ok'
      ? `${statusCode ?? 200}`
      : status === 'fetching'
        ? t('restInput.fetching', 'Fetching…')
        : status === 'error'
          ? t('restInput.error', 'Error')
          : t('restInput.idle', 'Idle')

  return (
    <div
      style={{
        ...s.node,
        minWidth: 200,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
        borderColor: status === 'ok' ? '#22c55e55' : status === 'error' ? '#ef444455' : undefined,
        boxShadow: status === 'ok' ? '0 0 0 1px #22c55e33' : undefined,
      }}
      role="group"
      aria-label={`${nd.label} REST API input`}
    >
      <div style={{ ...s.header, borderBottom: `2px solid ${statusColor}44` }}>
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: statusColor }}>
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

        {/* Value + last fetch */}
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: 4 }}>
          {t('restInput.value', 'Value')}:{' '}
          <span
            style={{
              color: 'var(--text)',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
            }}
          >
            {lastValue.toPrecision(6).replace(/\.?0+$/, '')}
          </span>
          {lastFetch && (
            <span style={{ color: 'var(--muted)', marginLeft: 4, fontSize: '0.6rem' }}>
              @ {lastFetch}
            </span>
          )}
        </div>

        {/* URL */}
        <div style={{ marginBottom: 4 }}>
          <input
            type="text"
            value={restUrl}
            onChange={(e) => updateNodeData(id, { restUrl: e.target.value })}
            placeholder="https://api.example.com/value"
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

        {/* Method + Path row */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <select
            value={restMethod}
            onChange={(e) => updateNodeData(id, { restMethod: e.target.value })}
            className="nodrag"
            style={{
              width: 60,
              fontSize: '0.6rem',
              padding: '2px 3px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              flexShrink: 0,
            }}
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={restPath}
            onChange={(e) => updateNodeData(id, { restPath: e.target.value })}
            placeholder={t('restInput.pathPlaceholder', 'JSON path (e.g. data.value)')}
            className="nodrag"
            style={{
              flex: 1,
              fontSize: '0.6rem',
              padding: '2px 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              fontFamily: "'JetBrains Mono', monospace",
              minWidth: 0,
            }}
          />
        </div>

        {/* Poll interval */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--muted)', flexShrink: 0 }}>
            {t('restInput.poll', 'Poll')}:
          </span>
          <input
            type="number"
            value={restPollSec}
            min={0}
            step={1}
            onChange={(e) =>
              updateNodeData(id, { restPollSec: Math.max(0, parseFloat(e.target.value) || 0) })
            }
            className="nodrag"
            style={{
              width: 50,
              fontSize: '0.6rem',
              padding: '2px 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
            {t('restInput.sec', 's')} (0={t('restInput.manual', 'manual')})
          </span>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="nodrag"
          style={{
            fontSize: '0.6rem',
            color: 'var(--muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '1px 0',
            marginBottom: showAdvanced ? 4 : 6,
            textDecoration: 'underline',
          }}
        >
          {showAdvanced
            ? t('restInput.hideAdvanced', '▲ Headers / Body')
            : t('restInput.showAdvanced', '▼ Headers / Body')}
        </button>

        {showAdvanced && (
          <>
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginBottom: 2 }}>
                {t('restInput.headers', 'Headers (JSON)')}:
              </div>
              <textarea
                value={restHeaders}
                onChange={(e) => updateNodeData(id, { restHeaders: e.target.value })}
                className="nodrag"
                rows={2}
                style={{
                  width: '100%',
                  fontSize: '0.6rem',
                  padding: '2px 4px',
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  background: 'var(--input-bg, var(--card))',
                  color: 'var(--text)',
                  fontFamily: "'JetBrains Mono', monospace",
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginBottom: 2 }}>
                {t('restInput.body', 'Body')}:
              </div>
              <textarea
                value={restBody}
                onChange={(e) => updateNodeData(id, { restBody: e.target.value })}
                className="nodrag"
                rows={3}
                style={{
                  width: '100%',
                  fontSize: '0.6rem',
                  padding: '2px 4px',
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  background: 'var(--input-bg, var(--card))',
                  color: 'var(--text)',
                  fontFamily: "'JetBrains Mono', monospace",
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </>
        )}

        {/* Fetch button */}
        <button
          onClick={() => void doFetch()}
          disabled={status === 'fetching'}
          className="nodrag"
          style={{
            width: '100%',
            fontSize: '0.65rem',
            fontWeight: 600,
            padding: '3px 6px',
            borderRadius: 4,
            border: 'none',
            cursor: status === 'fetching' ? 'wait' : 'pointer',
            background: status === 'fetching' ? '#f59e0b' : 'var(--primary)',
            color: '#fff',
            opacity: status === 'fetching' ? 0.8 : 1,
          }}
        >
          {status === 'fetching'
            ? t('restInput.fetching', 'Fetching…')
            : t('restInput.fetch', 'Fetch')}
        </button>

        {/* Error */}
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

export const RestInputNode = memo(RestInputNodeInner)
