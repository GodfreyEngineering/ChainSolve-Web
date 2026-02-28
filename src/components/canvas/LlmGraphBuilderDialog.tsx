/**
 * LlmGraphBuilderDialog — P149: LLM-assisted graph building dialog.
 *
 * Shows a text-area where the user describes the graph they want to build.
 * Submits to llmGraphBuilderService.buildGraphFromPrompt().
 *
 * When VITE_LLM_API_KEY is not configured, the dialog shows setup
 * instructions.  When the service returns a plan, a summary is shown
 * (future: auto-apply to canvas).
 */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { buildGraphFromPrompt } from '../../lib/llmGraphBuilderService'
import type { LlmGraphPlan } from '../../lib/llmGraphBuilderService'

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
    background: 'var(--card-bg, #252525)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: '1.5rem',
    width: 540,
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
    background: '#1CABB0',
    color: '#fff',
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
  infoBox: (variant: 'info' | 'success' | 'error'): React.CSSProperties => ({
    borderRadius: 8,
    padding: '0.75rem',
    marginTop: '0.9rem',
    fontSize: '0.82rem',
    background:
      variant === 'info'
        ? 'rgba(28,171,176,0.1)'
        : variant === 'success'
          ? 'rgba(34,197,94,0.1)'
          : 'rgba(239,68,68,0.1)',
    border: `1px solid ${variant === 'info' ? 'rgba(28,171,176,0.3)' : variant === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
    color: variant === 'info' ? '#1CABB0' : variant === 'success' ? '#22c55e' : '#ef4444',
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
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LlmGraphBuilderDialogProps {
  open: boolean
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LlmGraphBuilderDialog({ open, onClose }: LlmGraphBuilderDialogProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<LlmGraphPlan | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  if (!open) return null

  async function handleGenerate() {
    setLoading(true)
    setPlan(null)
    setNotConfigured(false)
    setError(null)
    try {
      const result = await buildGraphFromPrompt(prompt)
      if (result.status === 'ok') {
        setPlan(result.plan)
      } else if (result.status === 'not_configured') {
        setNotConfigured(true)
      } else {
        setError(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setPrompt('')
    setPlan(null)
    setNotConfigured(false)
    setError(null)
    onClose()
  }

  return (
    <div style={s.overlay} onClick={handleClose}>
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.title}>{t('llmBuilder.title')}</h2>
        <p style={s.subtitle}>{t('llmBuilder.subtitle')}</p>

        <label style={s.label} htmlFor="llm-prompt">
          {t('llmBuilder.promptLabel')}
        </label>
        <textarea
          id="llm-prompt"
          ref={textareaRef}
          style={s.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('llmBuilder.promptPlaceholder')}
          disabled={loading}
          maxLength={2000}
        />

        {notConfigured && (
          <div style={s.infoBox('info')}>
            <strong>{t('llmBuilder.notConfiguredTitle')}</strong>
            <br />
            {t('llmBuilder.notConfiguredBody')}
          </div>
        )}

        {error && <div style={s.infoBox('error')}>{error}</div>}

        {plan && (
          <div>
            <div style={s.infoBox('success')}>{t('llmBuilder.planReady')}</div>
            <div style={s.planSummary}>
              <strong>{t('llmBuilder.planSummaryLabel')}</strong>
              <br />
              {plan.summary}
              <div style={s.planMeta}>
                <span>{t('llmBuilder.nodeCount', { count: plan.nodes.length })}</span>
                <span>{t('llmBuilder.edgeCount', { count: plan.edges.length })}</span>
              </div>
            </div>
          </div>
        )}

        <div style={s.actions}>
          <button style={s.ghostBtn} onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button
            style={{ ...s.primaryBtn, opacity: loading || !prompt.trim() ? 0.5 : 1 }}
            onClick={() => void handleGenerate()}
            disabled={loading || !prompt.trim()}
          >
            {loading ? t('llmBuilder.generating') : t('llmBuilder.generate')}
          </button>
        </div>
      </div>
    </div>
  )
}
