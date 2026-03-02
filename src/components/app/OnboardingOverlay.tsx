/**
 * OnboardingOverlay — guided walkthrough for new users.
 *
 * Shows a step-by-step panel that walks users through the core workflow:
 * creating a project, adding blocks, connecting chains, inspecting values,
 * saving, and using reporting features.
 *
 * The overlay includes a persistent checklist that tracks progress across
 * sessions. Users can dismiss it and reopen from the Help menu.
 *
 * This component can be rendered in two modes:
 *   1. "overlay" — full-screen backdrop + centered panel (first login)
 *   2. "panel" — just the panel, for embedding (Help menu "Start tour")
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ONBOARDING_STEPS,
  type OnboardingStepId,
  getOnboardingState,
  completeStep,
  dismissOnboarding,
} from '../../lib/onboardingState'

export interface OnboardingOverlayProps {
  /** Whether to show the full overlay backdrop or just the panel. */
  mode: 'overlay' | 'panel'
  /** Called when user closes the overlay. */
  onClose: () => void
}

export function OnboardingOverlay({ mode, onClose }: OnboardingOverlayProps) {
  const { t } = useTranslation()
  const [state, setState] = useState(getOnboardingState)
  const [activeStep, setActiveStep] = useState<number>(() => {
    // Start at the first uncompleted step
    const idx = ONBOARDING_STEPS.findIndex((id) => !state.completed[id])
    return idx >= 0 ? idx : 0
  })

  const totalSteps = ONBOARDING_STEPS.length
  const completedSteps = useMemo(
    () => ONBOARDING_STEPS.filter((id) => state.completed[id]).length,
    [state],
  )
  const allDone = completedSteps === totalSteps
  const currentStepId = ONBOARDING_STEPS[activeStep]

  const handleComplete = useCallback((stepId: OnboardingStepId) => {
    const updated = completeStep(stepId)
    setState(updated)
  }, [])

  const handleNext = useCallback(() => {
    // Mark current step completed and advance
    handleComplete(currentStepId)
    if (activeStep < totalSteps - 1) {
      setActiveStep(activeStep + 1)
    }
  }, [handleComplete, currentStepId, activeStep, totalSteps])

  const handlePrev = useCallback(() => {
    if (activeStep > 0) setActiveStep(activeStep - 1)
  }, [activeStep])

  const handleDismiss = useCallback(() => {
    dismissOnboarding()
    onClose()
  }, [onClose])

  const handleFinish = useCallback(() => {
    // Mark last step and close
    handleComplete(currentStepId)
    dismissOnboarding()
    onClose()
  }, [handleComplete, currentStepId, onClose])

  const stepTitle = t(`tour.steps.${currentStepId}.title`)
  const stepDesc = t(`tour.steps.${currentStepId}.description`)

  const panel = (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>{t('tour.title')}</h2>
          <p style={subtitleStyle}>
            {t('tour.progress', { done: completedSteps, total: totalSteps })}
          </p>
        </div>
        <button style={closeBtnStyle} onClick={handleDismiss} aria-label={t('tour.dismiss')}>
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div style={progressTrackStyle}>
        <div
          style={{
            ...progressFillStyle,
            width: `${(completedSteps / totalSteps) * 100}%`,
          }}
        />
      </div>

      {/* Checklist sidebar + active step content */}
      <div style={bodyStyle}>
        {/* Checklist (left) */}
        <div style={checklistStyle}>
          {ONBOARDING_STEPS.map((id, idx) => {
            const done = !!state.completed[id]
            const active = idx === activeStep
            return (
              <button
                key={id}
                style={{
                  ...checklistItemStyle,
                  ...(active ? checklistItemActiveStyle : {}),
                  ...(done ? checklistItemDoneStyle : {}),
                }}
                onClick={() => setActiveStep(idx)}
                aria-current={active ? 'step' : undefined}
              >
                <span style={checkboxStyle}>{done ? '\u2713' : `${idx + 1}`}</span>
                <span style={checklistLabelStyle}>{t(`tour.steps.${id}.short`)}</span>
              </button>
            )
          })}
        </div>

        {/* Step content (right) */}
        <div style={stepContentStyle}>
          {allDone ? (
            <div style={doneContentStyle}>
              <div style={doneIconStyle}>{'\u2713'}</div>
              <h3 style={stepTitleStyle}>{t('tour.allDone')}</h3>
              <p style={stepDescStyle}>{t('tour.allDoneDesc')}</p>
            </div>
          ) : (
            <>
              <div style={stepBadgeStyle}>
                {t('tour.stepLabel', { current: activeStep + 1, total: totalSteps })}
              </div>
              <h3 style={stepTitleStyle}>{stepTitle}</h3>
              <p style={stepDescStyle}>{stepDesc}</p>
            </>
          )}
        </div>
      </div>

      {/* Footer buttons */}
      <div style={footerStyle}>
        <button style={skipBtnStyle} onClick={handleDismiss}>
          {t('tour.dismiss')}
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {activeStep > 0 && !allDone && (
            <button style={secondaryBtnStyle} onClick={handlePrev}>
              {t('tour.prev')}
            </button>
          )}
          {allDone ? (
            <button style={primaryBtnStyle} onClick={handleFinish}>
              {t('tour.finish')}
            </button>
          ) : activeStep < totalSteps - 1 ? (
            <button style={primaryBtnStyle} onClick={handleNext}>
              {state.completed[currentStepId] ? t('tour.next') : t('tour.markDone')}
            </button>
          ) : (
            <button style={primaryBtnStyle} onClick={handleFinish}>
              {t('tour.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (mode === 'panel') return panel

  // Overlay mode — full backdrop
  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={t('tour.title')}>
      {panel}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9000,
  background: 'var(--overlay)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'cs-fade-in 0.15s ease',
  padding: '1rem',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: '1.5rem',
  boxShadow: 'var(--shadow-lg)',
  width: 680,
  maxWidth: '100%',
  maxHeight: '85vh',
  overflowY: 'auto',
  animation: 'cs-slide-up 0.2s ease',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '0.75rem',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.1rem',
  fontWeight: 700,
}

const subtitleStyle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '0.8rem',
  opacity: 0.55,
}

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '1.1rem',
  padding: '0.2rem 0.5rem',
  borderRadius: 'var(--radius-md)',
  lineHeight: 1,
  fontFamily: 'inherit',
}

const progressTrackStyle: React.CSSProperties = {
  height: 3,
  background: 'var(--border)',
  borderRadius: 2,
  marginBottom: '1rem',
  overflow: 'hidden',
}

const progressFillStyle: React.CSSProperties = {
  height: '100%',
  background: 'var(--primary)',
  borderRadius: 2,
  transition: 'width 0.3s ease',
}

const bodyStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.25rem',
  minHeight: 200,
}

const checklistStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  width: 200,
  flexShrink: 0,
}

const checklistItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.4rem 0.6rem',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.78rem',
  color: 'var(--text)',
  textAlign: 'left',
  transition: 'background 0.1s',
}

const checklistItemActiveStyle: React.CSSProperties = {
  background: 'rgba(28, 171, 176, 0.1)',
  fontWeight: 600,
}

const checklistItemDoneStyle: React.CSSProperties = {
  opacity: 0.55,
}

const checkboxStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: '1.5px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.65rem',
  fontWeight: 700,
  flexShrink: 0,
  color: 'var(--primary)',
}

const checklistLabelStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const stepContentStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '0.5rem 0',
}

const stepBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--primary)',
  marginBottom: '0.5rem',
}

const stepTitleStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1rem',
  fontWeight: 700,
}

const stepDescStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  lineHeight: 1.6,
  opacity: 0.75,
}

const doneContentStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '1rem 0',
}

const doneIconStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  background: 'rgba(28, 171, 176, 0.15)',
  color: 'var(--primary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.5rem',
  fontWeight: 700,
  marginBottom: '0.75rem',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '1.25rem',
  paddingTop: '1rem',
  borderTop: '1px solid var(--border)',
}

const skipBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  padding: '0.4rem 0.75rem',
  borderRadius: 'var(--radius-md)',
}

const secondaryBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  padding: '0.45rem 1rem',
  borderRadius: 'var(--radius-md)',
  fontWeight: 500,
}

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--primary)',
  border: 'none',
  color: 'var(--color-on-primary)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  padding: '0.45rem 1rem',
  borderRadius: 'var(--radius-md)',
  fontWeight: 600,
}
