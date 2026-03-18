/**
 * AiAssistantPanel — 9.12: AI assistant for natural language → graph.
 *
 * Floating side-panel that lets users describe what they want in plain
 * language. The AI responds with a plan (patch ops) and optional explanation.
 * Users review and click "Apply" to insert the suggested nodes/edges.
 *
 * Features:
 *  - Streaming response via SSE (sendAiRequestStreaming)
 *  - Risk-level colour coding (low=green, medium=amber, high=red)
 *  - Confirmation modal for high-risk patches
 *  - Opt-out gate (aiOptOut preference)
 *  - Conversation history within the session
 */

import {
  memo,
  useCallback,
  useRef,
  useState,
  useEffect,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { Node, Edge } from '@xyflow/react'
import { sendAiRequestStreaming } from '../../lib/ai/aiService'
import { applyPatchOps } from '../../lib/ai/patchExecutor'
import { assessRisk } from '../../lib/ai/riskScoring'
import type { AiApiResponse, AiPatchOp, RiskLevel } from '../../lib/ai/types'
import type { NodeData } from '../../blocks/types'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { useProjectStore } from '../../stores/projectStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  response?: AiApiResponse
  patchOps?: AiPatchOp[]
  risk?: RiskLevel
  streaming?: boolean
}

export interface AiAssistantPanelProps {
  canvasId: string
  nodes: Node<NodeData>[]
  edges: Edge[]
  selectedNodeIds: string[]
  onApplyPatch: (nodes: Node<NodeData>[], edges: Edge[]) => void
  onClose: () => void
}

// ── Risk colours ──────────────────────────────────────────────────────────────

function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return '#22c55e'
    case 'medium': return '#f59e0b'
    case 'high': return '#ef4444'
  }
}

function riskLabel(level: RiskLevel, t: ReturnType<typeof useTranslation>['t']): string {
  switch (level) {
    case 'low': return t('ai.riskLow', 'Low risk')
    case 'medium': return t('ai.riskMedium', 'Medium risk')
    case 'high': return t('ai.riskHigh', 'High risk — confirm before applying')
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

function AiAssistantPanelInner({
  canvasId,
  nodes,
  edges,
  selectedNodeIds,
  onApplyPatch,
  onClose,
}: AiAssistantPanelProps) {
  const { t, i18n } = useTranslation()
  const aiOptOut = usePreferencesStore((s) => s.aiOptOut)
  const projectId = useProjectStore((s) => s.projectId) ?? ''

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmPending, setConfirmPending] = useState<AiApiResponse | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const send = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt || loading) return
    setInput('')
    const userMsg: ChatMessage = { role: 'user', text: prompt }
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      text: '',
      streaming: true,
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    let finalText = ''
    let finalResponse: AiApiResponse | undefined

    try {
      for await (const event of sendAiRequestStreaming({
        mode: 'plan',
        task: 'chat',
        userMessage: prompt,
        projectId,
        canvasId,
        selectedNodeIds,
        locale: i18n.language,
      })) {
        if (event.type === 'delta') {
          finalText += event.text
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, text: finalText }
            }
            return updated
          })
        } else if (event.type === 'done') {
          finalResponse = event.response
        } else if (event.type === 'error') {
          finalText = `⚠ ${event.error}`
        }
      }
    } catch (err) {
      finalText = `⚠ ${err instanceof Error ? err.message : 'Request failed'}`
    }

    const risk = finalResponse
      ? assessRisk(finalResponse.patchOps ?? []).level
      : undefined
    setMessages((prev) => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.role === 'assistant') {
        updated[updated.length - 1] = {
          ...last,
          text: finalText || finalResponse?.message || t('ai.noResponse', 'No response'),
          response: finalResponse,
          patchOps: finalResponse?.patchOps,
          risk,
          streaming: false,
        }
      }
      return updated
    })
    setLoading(false)
  }, [input, loading, projectId, canvasId, selectedNodeIds, i18n.language, t])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        send()
      }
    },
    [send],
  )

  const applyMessage = useCallback(
    (msg: ChatMessage, force = false) => {
      if (!msg.patchOps?.length) return
      if (!force && msg.risk === 'high') {
        setConfirmPending(msg.response!)
        return
      }
      const result = applyPatchOps(msg.patchOps, nodes, edges, true)
      onApplyPatch(result.nodes as Node<NodeData>[], result.edges)
    },
    [nodes, edges, onApplyPatch],
  )

  if (aiOptOut) {
    return (
      <div style={panelStyle}>
        <PanelHeader onClose={onClose} t={t} />
        <div style={{ padding: '1.5rem 1rem', color: 'var(--text-faint)', fontSize: '0.8rem', textAlign: 'center' }}>
          {t('ai.optedOut', 'AI assistant is disabled. Enable it in Settings → Privacy → ChainSolve AI.')}
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <PanelHeader onClose={onClose} t={t} />

      {/* Message list */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem', opacity: 0.6 }}>
            {t('ai.placeholder', 'Describe what you\'d like to build or change…')}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            <div
              style={{
                maxWidth: '92%',
                padding: '0.45rem 0.65rem',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user' ? 'var(--primary, #1CABB0)' : 'var(--surface-2)',
                color: msg.role === 'user' ? '#fff' : 'var(--text)',
                fontSize: '0.75rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                opacity: msg.streaming ? 0.85 : 1,
              }}
            >
              {msg.text}
              {msg.streaming && <span style={{ opacity: 0.5 }}>▌</span>}
            </div>

            {/* Risk badge + Apply button for assistant messages with patches */}
            {msg.role === 'assistant' && !msg.streaming && msg.patchOps && msg.patchOps.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {msg.risk && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: `${riskColor(msg.risk)}22`,
                      color: riskColor(msg.risk),
                      border: `1px solid ${riskColor(msg.risk)}44`,
                    }}
                  >
                    {riskLabel(msg.risk, t)}
                  </span>
                )}
                <button
                  onClick={() => applyMessage(msg)}
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--primary, #1CABB0)',
                    background: 'rgba(28,171,176,0.1)',
                    color: 'var(--primary, #1CABB0)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {t('ai.apply', 'Apply')} ({msg.patchOps.length})
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input row */}
      <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={2}
          placeholder={t('ai.inputPlaceholder', 'Describe what to build… (Enter to send)')}
          style={{
            flex: 1,
            fontSize: '0.75rem',
            padding: '0.4rem 0.5rem',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--input-bg, var(--card))',
            color: 'var(--text)',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.45,
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: 6,
            border: 'none',
            background: loading || !input.trim() ? 'var(--surface-3, #555)' : 'var(--primary, #1CABB0)',
            color: '#fff',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: '0.7rem',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {loading ? '…' : t('ai.send', 'Send')}
        </button>
      </div>

      {/* High-risk confirmation dialog */}
      {confirmPending && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--danger)',
              borderRadius: 8,
              padding: '1.2rem 1.5rem',
              maxWidth: 320,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>
              ⚠ {t('ai.highRiskTitle', 'High-risk changes')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text)', marginBottom: 16, lineHeight: 1.5 }}>
              {confirmPending.risk?.reasons?.join('. ') || t('ai.highRiskDesc', 'This will significantly modify your graph.')}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmPending(null)}
                style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                {t('ai.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.response === confirmPending)
                  if (msg) applyMessage(msg, true)
                  setConfirmPending(null)
                }}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
              >
                {t('ai.applyAnyway', 'Apply anyway')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PanelHeader({ onClose, t }: { onClose: () => void; t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.6rem 0.75rem',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '1rem' }}>✨</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
          {t('ai.title', 'ChainSolve AI')}
        </span>
        <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: 6, background: 'rgba(28,171,176,0.15)', color: 'var(--primary, #1CABB0)', fontWeight: 600 }}>
          opt-in
        </span>
      </div>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0 }}
        aria-label={t('common.close', 'Close')}
      >
        ×
      </button>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  right: 48,
  top: 8,
  bottom: 8,
  width: 340,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 100,
  overflow: 'hidden',
}

export const AiAssistantPanel = memo(AiAssistantPanelInner)
