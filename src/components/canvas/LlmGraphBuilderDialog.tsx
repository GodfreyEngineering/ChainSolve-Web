/**
 * LlmGraphBuilderDialog — 6.03: AI-powered graph generation dialog.
 *
 * Uses the AI Copilot service (sendCopilotRequest) to generate graphs
 * from natural language prompts. Supports large graphs (100+ blocks)
 * with risk scoring and "Apply to Canvas" functionality.
 */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { sendCopilotRequest } from '../../lib/aiCopilot/aiService'
import { assessRisk, requiresConfirmation } from '../../lib/aiCopilot/riskScoring'
import type { AiPatchOp, RiskAssessment } from '../../lib/aiCopilot/types'

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
  },
  dialog: {
    background: 'var(--surface-2)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: '1.5rem',
    width: 580,
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100vh - 4rem)',
    overflowY: 'auto' as const,
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    color: 'var(--fg, #F4F4F3)',
    fontFamily: 'system-ui, sans-serif',
  },
  title: { margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 700 },
  subtitle: { margin: '0 0 1.25rem', opacity: 0.55, fontSize: '0.85rem' },
  label: {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
    opacity: 0.8,
  },
  textarea: {
    width: '100%',
    minHeight: 110,
    padding: '0.65rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--fg, #F4F4F3)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.88rem',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.6rem',
    marginTop: '1rem',
  },
  primaryBtn: {
    padding: '0.5rem 1.2rem',
    borderRadius: 8,
    border: 'none',
    background: 'var(--primary)',
    color: 'var(--color-on-primary)',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  ghostBtn: {
    padding: '0.5rem 1rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(244,244,243,0.7)',
    fontSize: '0.88rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  infoBox: (variant: 'info' | 'success' | 'error' | 'warning'): React.CSSProperties => ({
    borderRadius: 8,
    padding: '0.75rem',
    marginTop: '0.9rem',
    fontSize: '0.82rem',
    background:
      variant === 'info'
        ? 'rgba(28,171,176,0.1)'
        : variant === 'success'
          ? 'rgba(34,197,94,0.1)'
          : variant === 'warning'
            ? 'rgba(234,179,8,0.1)'
            : 'rgba(239,68,68,0.1)',
    border: `1px solid ${
      variant === 'info'
        ? 'rgba(28,171,176,0.3)'
        : variant === 'success'
          ? 'rgba(34,197,94,0.3)'
          : variant === 'warning'
            ? 'rgba(234,179,8,0.3)'
            : 'rgba(239,68,68,0.3)'
    }`,
    color:
      variant === 'info'
        ? 'var(--primary)'
        : variant === 'success'
          ? 'var(--success)'
          : variant === 'warning'
            ? 'var(--warning-text, #eab308)'
            : 'var(--danger)',
  }),
  planSummary: {
    borderRadius: 8,
    padding: '0.75rem',
    marginTop: '0.9rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: '0.84rem',
    lineHeight: 1.55,
  } satisfies React.CSSProperties,
  planMeta: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.5rem',
    opacity: 0.6,
    fontSize: '0.78rem',
  } satisfies React.CSSProperties,
  riskBadge: (level: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 600,
    background:
      level === 'high'
        ? 'rgba(239,68,68,0.2)'
        : level === 'medium'
          ? 'rgba(234,179,8,0.2)'
          : 'rgba(34,197,94,0.2)',
    color:
      level === 'high'
        ? 'var(--danger)'
        : level === 'medium'
          ? 'var(--warning-text, #eab308)'
          : 'var(--success)',
  }),
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LlmGraphBuilderDialogProps {
  open: boolean
  onClose: () => void
  projectId: string | undefined
  canvasId: string | undefined
  onApplyPatch: (ops: AiPatchOp[], summary: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LlmGraphBuilderDialog({
  open,
  onClose,
  projectId,
  canvasId,
  onApplyPatch,
}: LlmGraphBuilderDialogProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [assumptions, setAssumptions] = useState<string[]>([])
  const [ops, setOps] = useState<AiPatchOp[]>([])
  const [risk, setRisk] = useState<RiskAssessment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  if (!open) return null

  const nodeCount = ops.filter((o) => o.op === 'addNode').length
  const edgeCount = ops.filter((o) => o.op === 'addEdge').length
  const groupCount = ops.filter((o) => o.op === 'createGroup').length
  const needsConfirm = risk ? requiresConfirmation(risk.level, 'edit', false) : false

  async function handleGenerate() {
    if (!projectId || !canvasId) {
      setError('No active project or canvas.')
      return
    }
    setLoading(true)
    setMessage(null)
    setAssumptions([])
    setOps([])
    setRisk(null)
    setError(null)
    setApplied(false)
    try {
      const response = await sendCopilotRequest({
        mode: 'edit',
        task: 'chat',
        scope: 'active_canvas',
        userMessage: prompt,
        projectId,
        canvasId,
        selectedNodeIds: [],
      })
      setMessage(response.message)
      setAssumptions(response.assumptions ?? [])
      const patchOps = response.patchOps ?? []
      setOps(patchOps)
      setRisk(assessRisk(patchOps))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (ops.length === 0) return
    onApplyPatch(ops, message ?? 'AI-generated graph')
    setApplied(true)
  }

  function handleClose() {
    setPrompt('')
    setMessage(null)
    setAssumptions([])
    setOps([])
    setRisk(null)
    setError(null)
    setApplied(false)
    onClose()
  }

  return (
    <div style={s.overlay} onClick={handleClose}>
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.title}>{t('llmBuilder.title', 'Build Graph from Prompt')}</h2>
        <p style={s.subtitle}>
          {t(
            'llmBuilder.subtitle',
            'Describe the calculation you want and AI will generate the blocks and connections.',
          )}
        </p>

        <label style={s.label} htmlFor="llm-prompt">
          {t('llmBuilder.promptLabel', 'What do you want to calculate?')}
        </label>
        <textarea
          id="llm-prompt"
          ref={textareaRef}
          style={s.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t(
            'llmBuilder.promptPlaceholder',
            'e.g. "Build a beam deflection calculator with inputs for force, length, E and I"',
          )}
          disabled={loading}
          maxLength={4000}
        />

        {error && <div style={s.infoBox('error')}>{error}</div>}

        {message && !applied && (
          <div>
            <div style={s.infoBox('success')}>
              {t('llmBuilder.planReady', 'Graph plan generated!')}
            </div>
            <div style={s.planSummary}>
              <strong>{t('llmBuilder.planSummaryLabel', 'Plan')}</strong>
              <br />
              {message}

              {assumptions.length > 0 && (
                <div style={{ marginTop: '0.5rem', opacity: 0.7, fontSize: '0.8rem' }}>
                  <strong>{t('llmBuilder.assumptions', 'Assumptions')}:</strong>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem' }}>
                    {assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={s.planMeta}>
                <span>
                  {t('llmBuilder.nodeCount', {
                    count: nodeCount,
                    defaultValue: '{{count}} blocks',
                  })}
                </span>
                <span>
                  {t('llmBuilder.edgeCount', {
                    count: edgeCount,
                    defaultValue: '{{count}} connections',
                  })}
                </span>
                {groupCount > 0 && (
                  <span>
                    {t('llmBuilder.groupCount', {
                      count: groupCount,
                      defaultValue: '{{count}} groups',
                    })}
                  </span>
                )}
                {risk && <span style={s.riskBadge(risk.level)}>{risk.level} risk</span>}
              </div>
            </div>

            {needsConfirm && risk && risk.reasons.length > 0 && (
              <div style={s.infoBox('warning')}>
                <strong>{t('llmBuilder.confirmWarning', 'Review before applying')}:</strong>
                <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem', fontSize: '0.8rem' }}>
                  {risk.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {applied && (
          <div style={s.infoBox('success')}>
            {t('llmBuilder.applied', 'Graph applied to canvas!')}
          </div>
        )}

        <div style={s.actions}>
          <button style={s.ghostBtn} onClick={handleClose} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </button>
          {ops.length > 0 && !applied && (
            <button
              style={{ ...s.primaryBtn, background: 'var(--success, #22c55e)' }}
              onClick={handleApply}
            >
              {t('llmBuilder.apply', 'Apply to Canvas')}
            </button>
          )}
          <button
            style={{ ...s.primaryBtn, opacity: loading || !prompt.trim() ? 0.5 : 1 }}
            onClick={() => void handleGenerate()}
            disabled={loading || !prompt.trim()}
          >
            {loading
              ? t('llmBuilder.generating', 'Generating...')
              : ops.length > 0
                ? t('llmBuilder.regenerate', 'Regenerate')
                : t('llmBuilder.generate', 'Generate')}
          </button>
        </div>
      </div>
    </div>
  )
}
