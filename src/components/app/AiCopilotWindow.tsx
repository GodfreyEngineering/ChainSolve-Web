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
import type {
  AiMode,
  AiScope,
  AiTask,
  AiPatchOp,
  AiExplanation,
  RiskAssessment,
} from '../../lib/aiCopilot/types'
import { assessRisk, requiresConfirmation } from '../../lib/aiCopilot/riskScoring'
import { sendCopilotRequest } from '../../lib/aiCopilot/aiService'
import type { Plan } from '../../lib/entitlements'
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
  tabBar: {
    display: 'flex',
    gap: 2,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    padding: 2,
  },
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '0.3rem 0.4rem',
    borderRadius: 5,
    border: 'none',
    background: active ? 'rgba(28,171,176,0.2)' : 'transparent',
    color: active ? '#1CABB0' : 'rgba(244,244,243,0.5)',
    fontSize: '0.72rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center' as const,
  }),
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
    background: '#1CABB0',
    color: '#fff',
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
    color: level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#22c55e',
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
  explanationBox: {
    padding: '0.4rem 0.6rem',
    borderRadius: 6,
    background: 'rgba(28,171,176,0.08)',
    border: '1px solid rgba(28,171,176,0.2)',
    fontSize: '0.78rem',
    lineHeight: 1.5,
  },
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  patchOps?: AiPatchOp[]
  risk?: RiskAssessment
  assumptions?: string[]
  explanation?: AiExplanation
  task?: AiTask
}

interface ActionHistoryEntry {
  task: AiTask
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
  /** AI-3: Prefill a task when opened from a quick action. */
  initialTask?: AiTask
  /** AI-3: Prefill the user message. */
  initialMessage?: string
  /** AI-3: Diagnostics from Graph Health for fix_graph task. */
  diagnostics?: { level: string; code: string; message: string; nodeIds?: string[] }[]
  /** G8-1: When true, render content directly without AppWindow wrapper (for docked mode). */
  docked?: boolean
}

// ── Component ───────────────────────────────────────────────────────────────

export function AiCopilotWindow({
  plan,
  projectId,
  canvasId,
  selectedNodeIds,
  onApplyPatch,
  onUpgrade,
  initialTask,
  initialMessage,
  diagnostics,
  docked = false,
}: AiCopilotWindowProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<AiMode>('edit')
  const [scope, setScope] = useState<AiScope>(
    selectedNodeIds.length > 0 ? 'selection' : 'active_canvas',
  )
  const [task, setTask] = useState<AiTask>(initialTask ?? 'chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState(initialMessage ?? '')
  const [loading, setLoading] = useState(false)
  const [pendingOps, setPendingOps] = useState<AiPatchOp[] | null>(null)
  const [pendingRisk, setPendingRisk] = useState<RiskAssessment | null>(null)
  const [pendingSummary, setPendingSummary] = useState('')
  const [tokensRemaining, setTokensRemaining] = useState<number | null>(null)
  const [history, setHistory] = useState<ActionHistoryEntry[]>([])
  const transcriptRef = useRef<HTMLDivElement>(null)

  const canUse = plan === 'pro' || plan === 'trialing' || plan === 'enterprise'
  const isEnterprise = plan === 'enterprise'

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (transcriptRef.current) {
        transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
      }
    }, 50)
  }, [])

  // Determine effective mode per task
  const effectiveMode = task === 'explain_node' || task === 'generate_template' ? 'plan' : mode

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || loading || !projectId || !canvasId) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, task }])
    setLoading(true)
    setPendingOps(null)
    setPendingRisk(null)
    scrollToBottom()

    try {
      const response = await sendCopilotRequest({
        mode: effectiveMode,
        scope,
        task,
        userMessage: trimmed,
        projectId,
        canvasId,
        selectedNodeIds,
        diagnostics,
      })

      const ops = response.patchOps ?? []
      const risk = assessRisk(ops)

      if (response.tokensRemaining != null) {
        setTokensRemaining(response.tokensRemaining)
      }

      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: response.message,
        patchOps: ops,
        risk,
        assumptions: response.assumptions,
        explanation: response.explanation,
        task,
      }
      setMessages((prev) => [...prev, aiMsg])

      // Track in history
      setHistory((prev) => [
        {
          task,
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('ai.errorGeneric')
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }, [
    input,
    loading,
    projectId,
    canvasId,
    effectiveMode,
    scope,
    task,
    selectedNodeIds,
    diagnostics,
    isEnterprise,
    onApplyPatch,
    scrollToBottom,
    t,
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

  // ── Locked state for Free users ──────────────────────────────────────────
  if (!canUse) {
    const lockedContent = (
      <div style={s.lockedOverlay}>
        <div style={{ fontSize: '2rem', opacity: 0.4 }}>&#x1F512;</div>
        <strong>{t('ai.upgradeTitle')}</strong>
        <p style={{ fontSize: '0.84rem', opacity: 0.7, margin: 0 }}>{t('ai.upgradeBody')}</p>
        <button style={s.sendBtn} onClick={onUpgrade}>
          {t('ai.upgradeTitle')}
        </button>
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
      {/* Task tabs */}
      <div style={s.tabBar}>
        <button style={s.tab(task === 'chat')} onClick={() => setTask('chat')}>
          {t('ai.quickActions', 'Chat')}
        </button>
        <button style={s.tab(task === 'fix_graph')} onClick={() => setTask('fix_graph')}>
          {t('ai.fixGraph', 'Fix')}
        </button>
        <button style={s.tab(task === 'explain_node')} onClick={() => setTask('explain_node')}>
          {t('ai.explainNode', 'Explain')}
        </button>
        <button
          style={s.tab(task === 'generate_template')}
          onClick={() => setTask('generate_template')}
        >
          {t('ai.generateTemplate', 'Template')}
        </button>
        <button style={s.tab(task === 'generate_theme')} onClick={() => setTask('generate_theme')}>
          {t('ai.generateTheme', 'Theme')}
        </button>
      </div>

      {/* Mode + Scope selectors */}
      <div style={s.row}>
        <span style={s.label}>Mode</span>
        <select
          style={s.select}
          value={effectiveMode}
          onChange={(e) => setMode(e.target.value as AiMode)}
          disabled={task === 'explain_node' || task === 'generate_template'}
        >
          <option value="plan">{t('ai.modePlan')}</option>
          <option value="edit">{t('ai.modeEdit')}</option>
          {isEnterprise && <option value="bypass">{t('ai.modeBypass')}</option>}
        </select>
        <span style={s.label}>Scope</span>
        <select
          style={s.select}
          value={scope}
          onChange={(e) => setScope(e.target.value as AiScope)}
        >
          <option value="active_canvas">{t('ai.scopeActive')}</option>
          <option value="selection">{t('ai.scopeSelection')}</option>
        </select>
      </div>

      {/* Token budget */}
      {tokensRemaining != null && (
        <div style={s.tokenBudget}>
          <span>{t('ai.tokensRemaining', 'Tokens left')}:</span>
          <div style={s.tokenBar}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (tokensRemaining / 200000) * 100)}%`,
                background: tokensRemaining < 20000 ? '#ef4444' : '#1CABB0',
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
            {task === 'fix_graph'
              ? t('ai.fixGraphHint', 'Describe the issues to fix or click Send to auto-fix.')
              : task === 'explain_node'
                ? t('ai.explainHint', 'Select a node and click Send to explain it.')
                : t('ai.promptPlaceholder')}
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
            {/* Explanation display (AI-3) */}
            {msg.explanation && (
              <div style={{ ...s.explanationBox, marginTop: '0.4rem' }}>
                {msg.explanation.block && (
                  <div>
                    <strong>{msg.explanation.block.type}</strong>:{' '}
                    {msg.explanation.block.whatItDoes}
                  </div>
                )}
                {msg.explanation.bindings && msg.explanation.bindings.length > 0 && (
                  <div style={{ marginTop: '0.3rem' }}>
                    <strong>Inputs:</strong>{' '}
                    {msg.explanation.bindings
                      .map((b) => `${b.portId}=${b.value ?? b.source}`)
                      .join(', ')}
                  </div>
                )}
                {msg.explanation.upstream && msg.explanation.upstream.length > 0 && (
                  <div style={{ marginTop: '0.2rem', opacity: 0.7 }}>
                    Upstream:{' '}
                    {msg.explanation.upstream.map((u) => u.label || u.blockType).join(' → ')}
                  </div>
                )}
                {msg.explanation.diagnostics && msg.explanation.diagnostics.length > 0 && (
                  <div style={{ marginTop: '0.2rem', color: '#f59e0b' }}>
                    {msg.explanation.diagnostics.map((d, j) => (
                      <div key={j}>
                        [{d.level}] {d.message}
                      </div>
                    ))}
                  </div>
                )}
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
                {op.op === 'addEdge' && `+ edge ${op.edge.source} \u2192 ${op.edge.target}`}
                {op.op === 'updateNodeData' && `~ update ${op.nodeId}`}
                {op.op === 'removeNode' && `- remove node ${op.nodeId}`}
                {op.op === 'removeEdge' && `- remove edge ${op.edgeId}`}
                {op.op === 'setInputBinding' && `~ bind ${op.nodeId}:${op.portId}`}
                {op.op === 'createVariable' && `+ var "${op.variable.name}"`}
                {op.op === 'updateVariable' && `~ var ${op.varId}`}
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
          placeholder={
            task === 'fix_graph'
              ? t('ai.fixGraphPlaceholder', 'Fix issues in my graph…')
              : task === 'explain_node'
                ? t('ai.explainPlaceholder', 'Explain this node…')
                : task === 'generate_theme'
                  ? t('ai.themePlaceholder', 'Describe your theme…')
                  : t('ai.promptPlaceholder')
          }
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
                [{h.task}] {h.summary}
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
