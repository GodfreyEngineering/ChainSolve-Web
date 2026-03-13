/**
 * AiCopilotWindow — AI Copilot in-app window (AI-1 / AI-2 / AI-3).
 *
 * Opens as an AppWindow via the window manager. Provides:
 *   - Mode selector: Plan / Edit / Bypass
 *   - Scope selector: Active sheet / Selected nodes
 *   - Quick action tabs: Chat / Fix / Explain / Generate
 *   - Chat input + transcript (in-memory only)
 *   - Proposed changes diff preview
 *   - Apply / Cancel with risk-gated confirmation
 *   - Token budget display
 *   - Action history (local only)
 *   - Privacy notice
 *
 * Free users see a locked state with upgrade CTA.
 */

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppWindow } from '../ui/AppWindow'
import type { AiMode, AiTask, AiPatchOp, RiskAssessment } from '../../lib/aiCopilot/types'
import { assessRisk, requiresConfirmation } from '../../lib/aiCopilot/riskScoring'
import { sendCopilotRequest, sendCopilotRequestStreaming } from '../../lib/aiCopilot/aiService'
import { getEntitlements, type Plan } from '../../lib/entitlements'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { AI_COPILOT_WINDOW_ID } from '../../lib/aiCopilot/constants'
export { AI_COPILOT_WINDOW_ID }

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    padding: '0.75rem',
    gap: '0.5rem',
    fontSize: '0.85rem',
  },
  row: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  select: {
    flex: 1,
    padding: '0.3rem 0.5rem',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--fg, #F4F4F3)',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
  },
  label: {
    fontSize: '0.72rem',
    fontWeight: 600,
    opacity: 0.6,
    flexShrink: 0,
    width: 40,
  },
  transcript: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0.5rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.15)',
    fontSize: '0.82rem',
    lineHeight: 1.5,
  },
  msgUser: {
    marginBottom: '0.5rem',
    padding: '0.4rem 0.6rem',
    borderRadius: 8,
    background: 'rgba(28,171,176,0.15)',
    border: '1px solid rgba(28,171,176,0.25)',
  },
  msgAi: {
    marginBottom: '0.5rem',
    padding: '0.4rem 0.6rem',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  inputRow: {
    display: 'flex',
    gap: '0.4rem',
  },
  textarea: {
    flex: 1,
    padding: '0.4rem 0.6rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--fg, #F4F4F3)',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    resize: 'none' as const,
    minHeight: 36,
    maxHeight: 100,
  },
  sendBtn: {
    padding: '0.35rem 0.9rem',
    borderRadius: 8,
    border: 'none',
    background: 'var(--primary)',
    color: 'var(--color-on-primary)',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  } satisfies React.CSSProperties,
  privacyNotice: {
    fontSize: '0.68rem',
    opacity: 0.4,
    textAlign: 'center' as const,
    padding: '0.15rem 0',
  },
  suggestionsRow: {
    display: 'flex',
    gap: '0.3rem',
    flexWrap: 'wrap' as const,
  },
  suggestionChip: {
    padding: '0.2rem 0.55rem',
    borderRadius: 12,
    border: '1px solid rgba(28,171,176,0.3)',
    background: 'rgba(28,171,176,0.08)',
    color: 'var(--primary)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
    transition: 'background 0.12s, border-color 0.12s',
  } satisfies React.CSSProperties,
  opsPreview: {
    padding: '0.4rem 0.5rem',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    fontSize: '0.75rem',
    maxHeight: 100,
    overflowY: 'auto' as const,
    lineHeight: 1.4,
  },
  riskBadge: (level: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '0.12rem 0.45rem',
    borderRadius: 4,
    fontSize: '0.68rem',
    fontWeight: 600,
    background:
      level === 'high'
        ? 'rgba(239,68,68,0.15)'
        : level === 'medium'
          ? 'rgba(245,158,11,0.15)'
          : 'rgba(34,197,94,0.15)',
    color:
      level === 'high' ? 'var(--danger)' : level === 'medium' ? 'var(--warning)' : 'var(--success)',
    border: `1px solid ${level === 'high' ? 'rgba(239,68,68,0.3)' : level === 'medium' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
  }),
  applyRow: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'flex-end',
  },
  ghostBtn: {
    padding: '0.3rem 0.7rem',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(244,244,243,0.7)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  lockedOverlay: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.8rem',
    height: '100%',
    padding: '2rem',
    textAlign: 'center' as const,
  },
  tokenBudget: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.68rem',
    opacity: 0.5,
  },
  tokenBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden' as const,
  },
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  patchOps?: AiPatchOp[]
  risk?: RiskAssessment
  assumptions?: string[]
}

interface ActionHistoryEntry {
  summary: string
  opsCount: number
  timestamp: number
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface AiCopilotWindowProps {
  plan: Plan
  projectId: string | undefined
  canvasId: string | undefined
  selectedNodeIds: string[]
  onApplyPatch: (ops: AiPatchOp[], summary: string) => void
  onUpgrade: () => void
  /** Prefill the user message. */
  initialMessage?: string
  /** G8-1: When true, render content directly without AppWindow wrapper (for docked mode). */
  docked?: boolean
  /** 6.02: Computed values per node for AI context. */
  computedValues?: Record<string, number | string>
}

// ── Component ───────────────────────────────────────────────────────────────

export function AiCopilotWindow({
  plan,
  projectId,
  canvasId,
  selectedNodeIds,
  onApplyPatch,
  onUpgrade,
  initialMessage,
  docked = false,
  computedValues,
}: AiCopilotWindowProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<AiMode>('edit')
  const [activeTask, setActiveTask] = useState<AiTask>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState(initialMessage ?? '')
  const [loading, setLoading] = useState(false)
  const [pendingOps, setPendingOps] = useState<AiPatchOp[] | null>(null)
  const [pendingRisk, setPendingRisk] = useState<RiskAssessment | null>(null)
  const [pendingSummary, setPendingSummary] = useState('')
  const [tokensRemaining, setTokensRemaining] = useState<number | null>(null)
  const [history, setHistory] = useState<ActionHistoryEntry[]>([])
  const transcriptRef = useRef<HTMLDivElement>(null)

  const ent = getEntitlements(plan)
  const aiOptOut = usePreferencesStore((s) => s.aiOptOut)
  const canUse = ent.canUseAi && !aiOptOut
  const isEnterprise = plan === 'enterprise'

  const triggerSuggestion = useCallback(
    (task: AiTask, message: string) => {
      setActiveTask(task)
      setInput(message)
      // Auto-send immediately
      if (!projectId || !canvasId || loading) return
      setMessages((prev) => [...prev, { role: 'user', content: message }])
      setLoading(true)
      setPendingOps(null)
      setPendingRisk(null)

      const effectiveMode =
        task === 'explain_node' || task === 'suggest' ? ('plan' as AiMode) : mode
      sendCopilotRequest({
        mode: effectiveMode,
        task,
        scope:
          task === 'explain_node' && selectedNodeIds.length > 0 ? 'selection' : 'active_canvas',
        userMessage: message,
        projectId,
        canvasId,
        selectedNodeIds,
        computedValues,
      })
        .then((response) => {
          const ops = response.patchOps ?? []
          const risk = assessRisk(ops)
          if (response.tokensRemaining != null) setTokensRemaining(response.tokensRemaining)
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: response.message,
              patchOps: ops,
              risk,
              assumptions: response.assumptions,
            },
          ])
          setHistory((prev) => [
            { summary: response.message.slice(0, 80), opsCount: ops.length, timestamp: Date.now() },
            ...prev.slice(0, 19),
          ])
          if (ops.length > 0 && effectiveMode !== 'plan') {
            const needsConfirm = requiresConfirmation(
              risk.level,
              effectiveMode === 'bypass' ? 'bypass' : 'edit',
              isEnterprise,
            )
            if (!needsConfirm) onApplyPatch(ops, response.message)
            else {
              setPendingOps(ops)
              setPendingRisk(risk)
              setPendingSummary(response.message)
            }
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : t('ai.errorGeneric')
          setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
        })
        .finally(() => {
          setLoading(false)
          setActiveTask('chat')
          setInput('')
          setTimeout(() => {
            if (transcriptRef.current)
              transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
          }, 50)
        })
    },
    [projectId, canvasId, loading, mode, selectedNodeIds, isEnterprise, onApplyPatch, t, computedValues],
  )

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (transcriptRef.current) {
        transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
      }
    }, 50)
  }, [])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || loading || !projectId || !canvasId) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)
    setPendingOps(null)
    setPendingRisk(null)
    scrollToBottom()

    const effectiveMode =
      activeTask === 'explain_node' || activeTask === 'suggest' ? ('plan' as const) : mode
    const requestOpts = {
      mode: effectiveMode,
      task: activeTask,
      scope: (selectedNodeIds.length > 0 && activeTask === 'explain_node'
        ? 'selection'
        : 'active_canvas') as 'selection' | 'active_canvas',
      userMessage: trimmed,
      projectId,
      canvasId,
      selectedNodeIds,
      computedValues,
    }

    try {
      // 6.05: Use streaming for chat-like tasks to show text as it arrives
      let streamingText = ''
      let streamingMsgIndex = -1

      for await (const event of sendCopilotRequestStreaming(requestOpts)) {
        if (event.type === 'delta') {
          streamingText += event.text
          if (streamingMsgIndex === -1) {
            // Add a new assistant message and remember its index
            setMessages((prev) => {
              streamingMsgIndex = prev.length
              return [...prev, { role: 'assistant', content: streamingText }]
            })
          } else {
            // Update the existing streaming message
            const text = streamingText
            setMessages((prev) => {
              const updated = [...prev]
              const idx = updated.length - 1
              if (idx >= 0 && updated[idx].role === 'assistant') {
                updated[idx] = { ...updated[idx], content: text }
              }
              return updated
            })
          }
          scrollToBottom()
        } else if (event.type === 'done') {
          const response = event.response
          const ops = response.patchOps ?? []
          const risk = assessRisk(ops)

          if (response.tokensRemaining != null) {
            setTokensRemaining(response.tokensRemaining)
          }

          // Finalize the streaming message with full data
          const finalMsg: ChatMessage = {
            role: 'assistant',
            content: response.message,
            patchOps: ops,
            risk,
            assumptions: response.assumptions,
          }

          setMessages((prev) => {
            const updated = [...prev]
            // Replace the last streaming message or append
            if (streamingMsgIndex !== -1 && updated.length > 0) {
              updated[updated.length - 1] = finalMsg
            } else {
              updated.push(finalMsg)
            }
            return updated
          })

          setHistory((prev) => [
            {
              summary: response.message.slice(0, 80),
              opsCount: ops.length,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 19),
          ])

          if (ops.length > 0 && effectiveMode !== 'plan') {
            const needsConfirm = requiresConfirmation(
              risk.level,
              effectiveMode === 'bypass' ? 'bypass' : 'edit',
              isEnterprise,
            )
            if (!needsConfirm) {
              onApplyPatch(ops, response.message)
              setMessages((prev) => [...prev, { role: 'assistant', content: t('ai.applied') }])
            } else {
              setPendingOps(ops)
              setPendingRisk(risk)
              setPendingSummary(response.message)
            }
          }
        } else if (event.type === 'error') {
          setMessages((prev) => [...prev, { role: 'assistant', content: event.error }])
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('ai.errorGeneric')
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
    } finally {
      setLoading(false)
      setActiveTask('chat')
      scrollToBottom()
    }
  }, [
    input,
    loading,
    projectId,
    canvasId,
    mode,
    activeTask,
    selectedNodeIds,
    isEnterprise,
    onApplyPatch,
    scrollToBottom,
    t,
    computedValues,
  ])

  const handleApply = useCallback(() => {
    if (pendingOps) {
      onApplyPatch(pendingOps, pendingSummary)
      setMessages((prev) => [...prev, { role: 'assistant', content: t('ai.applied') }])
      setPendingOps(null)
      setPendingRisk(null)
      setPendingSummary('')
    }
  }, [pendingOps, pendingSummary, onApplyPatch, t])

  const handleCancelPending = useCallback(() => {
    setPendingOps(null)
    setPendingRisk(null)
    setPendingSummary('')
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
  )

  // ── Locked state for Free users or opted-out users ──────────────────────
  if (!canUse) {
    const isOptedOut = aiOptOut && ent.canUseAi
    const lockedContent = (
      <div style={s.lockedOverlay}>
        {isOptedOut ? (
          <>
            <strong>{t('ai.optedOutTitle', 'AI Copilot Disabled')}</strong>
            <p style={{ fontSize: '0.84rem', opacity: 0.7, margin: 0 }}>
              {t(
                'ai.optedOutBody',
                'You have opted out of AI features in Privacy settings. No canvas data is sent to external services.',
              )}
            </p>
            <p style={{ fontSize: '0.72rem', opacity: 0.5, margin: 0 }}>
              {t('ai.optedOutHint', 'To re-enable, go to Settings > Privacy and turn off "Opt out of AI".')}
            </p>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                padding: '0.35rem 0.9rem',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)',
                opacity: 0.5,
              }}
            >
              PRO
            </div>
            <strong>{t('ai.upgradeTitle')}</strong>
            <p style={{ fontSize: '0.84rem', opacity: 0.7, margin: 0 }}>{t('ai.upgradeBody')}</p>
            <button style={s.sendBtn} onClick={onUpgrade}>
              {t('ai.upgradeTitle')}
            </button>
          </>
        )}
      </div>
    )
    if (docked) return lockedContent
    return (
      <AppWindow
        windowId={AI_COPILOT_WINDOW_ID}
        title={t('ai.title')}
        minWidth={360}
        minHeight={260}
      >
        {lockedContent}
      </AppWindow>
    )
  }

  const mainContent = (
    <div style={s.container}>
      {/* Mode selector */}
      <div style={s.row}>
        <span style={s.label}>{t('ai.modeLabel')}</span>
        <select style={s.select} value={mode} onChange={(e) => setMode(e.target.value as AiMode)}>
          <option value="plan">{t('ai.modePlan')}</option>
          <option value="edit">{t('ai.modeEdit')}</option>
          {isEnterprise && <option value="bypass">{t('ai.modeBypass')}</option>}
        </select>
      </div>

      {/* Smart suggestion chips (ADV-01) */}
      {messages.length === 0 && !loading && (
        <div style={s.suggestionsRow}>
          <button
            style={s.suggestionChip}
            onClick={() =>
              triggerSuggestion('explain_node', t('ai.suggestExplainGraph', 'Explain this graph'))
            }
            title={t('ai.suggestExplainGraphTip', 'Describe what the current canvas computes')}
          >
            {t('ai.suggestExplainGraph', 'Explain this graph')}
          </button>
          <button
            style={s.suggestionChip}
            onClick={() =>
              triggerSuggestion('fix_graph', t('ai.suggestFindErrors', 'Find and fix errors'))
            }
            title={t('ai.suggestFindErrorsTip', 'Analyse the Problems panel and suggest fixes')}
          >
            {t('ai.suggestFindErrors', 'Find errors')}
          </button>
          <button
            style={s.suggestionChip}
            onClick={() =>
              triggerSuggestion('generate_template', t('ai.suggestGenTemplate', 'Save as template'))
            }
            title={t(
              'ai.suggestGenTemplateTip',
              'Package the selected blocks as a reusable template',
            )}
          >
            {t('ai.suggestGenTemplate', 'Save as template')}
          </button>
          <button
            style={s.suggestionChip}
            onClick={() =>
              triggerSuggestion('optimize', t('ai.suggestOptimize', 'Optimize graph'))
            }
            title={t('ai.suggestOptimizeTip', 'Find redundancies and suggest structural improvements')}
          >
            {t('ai.suggestOptimize', 'Optimize')}
          </button>
          <button
            style={s.suggestionChip}
            onClick={() =>
              triggerSuggestion('suggest', t('ai.suggestImprovements', 'Suggest improvements'))
            }
            title={t(
              'ai.suggestImprovementsTip',
              'Recommend missing validations, better blocks, or additional outputs',
            )}
          >
            {t('ai.suggestImprovements', 'Suggest improvements')}
          </button>
        </div>
      )}

      {/* Token budget */}
      {tokensRemaining != null && (
        <div style={s.tokenBudget}>
          <span>{t('ai.tokensRemaining', 'Tokens left')}:</span>
          <div style={s.tokenBar}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (tokensRemaining / 200000) * 100)}%`,
                background: tokensRemaining < 20000 ? 'var(--danger)' : 'var(--primary)',
                borderRadius: 2,
              }}
            />
          </div>
          <span>{Math.round(tokensRemaining / 1000)}k</span>
        </div>
      )}

      {/* Transcript */}
      <div ref={transcriptRef} style={s.transcript}>
        {messages.length === 0 && (
          <div style={{ opacity: 0.4, textAlign: 'center', padding: '1rem 0', fontSize: '0.8rem' }}>
            {t('ai.promptPlaceholder')}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? s.msgUser : s.msgAi}>
            <div>{msg.content}</div>
            {msg.assumptions && msg.assumptions.length > 0 && (
              <div style={{ marginTop: '0.3rem', opacity: 0.6, fontSize: '0.75rem' }}>
                <strong>{t('ai.assumptions')}:</strong> {msg.assumptions.join('; ')}
              </div>
            )}
            {msg.risk && msg.patchOps && msg.patchOps.length > 0 && (
              <div
                style={{
                  marginTop: '0.3rem',
                  display: 'flex',
                  gap: '0.4rem',
                  alignItems: 'center',
                }}
              >
                <span style={s.riskBadge(msg.risk.level)}>
                  {msg.risk.level === 'high'
                    ? t('ai.riskHigh')
                    : msg.risk.level === 'medium'
                      ? t('ai.riskMedium')
                      : t('ai.riskLow')}
                </span>
                <span style={{ opacity: 0.5, fontSize: '0.72rem' }}>
                  {t('ai.opsCount', { count: msg.patchOps.length })}
                </span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ ...s.msgAi, opacity: 0.6, fontStyle: 'italic' }}>{t('ai.generating')}</div>
        )}
      </div>

      {/* Pending ops preview */}
      {pendingOps && pendingRisk && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>
            {t('ai.proposedChanges')}
          </div>
          <div style={s.opsPreview}>
            {pendingOps.map((op, i) => (
              <div key={i} style={{ opacity: 0.8 }}>
                {op.op === 'addNode' && `+ ${op.node.blockType} "${op.node.label ?? op.node.id}"`}
                {op.op === 'addEdge' && `+ chain ${op.edge.source} \u2192 ${op.edge.target}`}
                {op.op === 'updateNodeData' && `~ update ${op.nodeId}`}
                {op.op === 'removeNode' && `- remove node ${op.nodeId}`}
                {op.op === 'removeEdge' && `- remove chain ${op.edgeId}`}
                {op.op === 'setInputBinding' && `~ bind ${op.nodeId}:${op.portId}`}
                {op.op === 'createVariable' && `+ var "${op.variable.name}"`}
                {op.op === 'updateVariable' && `~ var ${op.varId}`}
                {op.op === 'createMaterial' && `+ material "${op.material.name}"`}
                {op.op === 'createCustomFunction' && `+ function "${op.fn.name}"`}
                {op.op === 'createGroup' &&
                  `+ group "${op.label ?? 'Group'}" (${op.nodeIds.length} nodes)`}
              </div>
            ))}
          </div>
          <div style={{ ...s.row, marginTop: '0.3rem' }}>
            <span style={s.riskBadge(pendingRisk.level)}>
              {pendingRisk.level === 'high'
                ? t('ai.riskHigh')
                : pendingRisk.level === 'medium'
                  ? t('ai.riskMedium')
                  : t('ai.riskLow')}
            </span>
            <span style={{ flex: 1, fontSize: '0.72rem', opacity: 0.5 }}>
              {pendingRisk.level === 'high' ? t('ai.confirmDestructive') : t('ai.confirmMedium')}
            </span>
          </div>
          <div style={{ ...s.applyRow, marginTop: '0.4rem' }}>
            <button style={s.ghostBtn} onClick={handleCancelPending}>
              {t('ai.cancel')}
            </button>
            <button style={s.sendBtn} onClick={handleApply}>
              {t('ai.apply')}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={s.inputRow}>
        <textarea
          style={s.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('ai.promptPlaceholder')}
          disabled={loading}
          maxLength={4000}
          rows={2}
        />
        <button
          style={{ ...s.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }}
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
        >
          {loading ? t('ai.generating') : t('ai.send')}
        </button>
      </div>

      {/* Action history (collapsible) */}
      {history.length > 0 && (
        <details style={{ fontSize: '0.7rem', opacity: 0.6 }}>
          <summary style={{ cursor: 'pointer' }}>
            {t('ai.actionHistory', 'History')} ({history.length})
          </summary>
          <div style={{ marginTop: '0.3rem', maxHeight: 80, overflowY: 'auto' }}>
            {history.map((h, i) => (
              <div
                key={i}
                style={{ padding: '0.15rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                {h.summary}
                {h.opsCount > 0 && ` (${h.opsCount} ops)`}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Privacy notice */}
      <div style={s.privacyNotice}>{t('ai.privacyNoticeShort')}</div>
    </div>
  )

  if (docked) return mainContent
  return (
    <AppWindow windowId={AI_COPILOT_WINDOW_ID} title={t('ai.title')} minWidth={400} minHeight={360}>
      {mainContent}
    </AppWindow>
  )
}
