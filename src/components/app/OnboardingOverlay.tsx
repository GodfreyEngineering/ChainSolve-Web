/**
 * OnboardingOverlay — spotlight-driven guided tutorial for new users.
 *
 * Shows a step-by-step spotlight tour that highlights UI elements
 * via data-tour attributes. Each step displays a tooltip with title,
 * description, and navigation buttons.
 *
 * Features:
 *   - Spotlight cutout around target element (via OnboardingSpotlight)
 *   - Falls back to centered tooltip if target not found
 *   - "Skip tutorial" always available
 *   - Progress persisted via onboardingState (localStorage)
 *   - Accessible from Help menu ("Start tour")
 *
 * Modes:
 *   - "overlay" — full spotlight tour (first login or Help menu restart)
 *   - "panel" — compact checklist panel (for embedding in sidebar)
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
import { OnboardingSpotlight } from './OnboardingSpotlight'

/** Map step IDs to the data-tour attribute on the target UI element. */
const STEP_TARGETS: Record<OnboardingStepId, string> = {
  open_projects: 'sidebar-projects',
  create_project: 'btn-new-project',
  add_input: 'block-library',
  add_function: 'block-library',
  add_output: 'block-library',
  connect_chains: 'canvas-area',
  use_inspector: 'inspector-panel',
  save_project: 'btn-save',
  open_reporting: 'menu-file',
  // UX-23: new steps
  table_input: 'block-library',
  problems_panel: 'problems-panel',
  variables_panel: 'variables-panel',
  sheets_tabs: 'sheets-bar',
  ai_copilot: 'ai-assistant',
}

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
    handleComplete(currentStepId)
    dismissOnboarding()
    onClose()
  }, [handleComplete, currentStepId, onClose])

  // ── Panel mode: compact checklist ───────────────────────────────────────

  if (mode === 'panel') {
    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <h2 style={panelTitleStyle}>{t('tour.title')}</h2>
            <p style={panelSubtitleStyle}>
              {t('tour.progress', { done: completedSteps, total: totalSteps })}
            </p>
          </div>
          <button style={closeBtnStyle} onClick={handleDismiss} aria-label={t('tour.dismiss')}>
            ✕
          </button>
        </div>

        <div style={progressTrackStyle}>
          <div style={{ ...progressFillStyle, width: `${(completedSteps / totalSteps) * 100}%` }} />
        </div>

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
                <span style={checkIconStyle}>{done ? '\u2713' : `${idx + 1}`}</span>
                <span style={checklistLabelStyle}>{t(`tour.steps.${id}.short`)}</span>
              </button>
            )
          })}
        </div>

        {!allDone && (
          <div style={panelContentStyle}>
            <div style={stepBadgeStyle}>
              {t('tour.stepLabel', { current: activeStep + 1, total: totalSteps })}
            </div>
            <h3 style={stepTitleStyle}>{t(`tour.steps.${currentStepId}.title`)}</h3>
            <p style={stepDescStyle}>{t(`tour.steps.${currentStepId}.description`)}</p>
          </div>
        )}

        {allDone && (
          <div style={doneContentStyle}>
            <div style={doneIconStyle}>{'\u2713'}</div>
            <h3 style={stepTitleStyle}>{t('tour.allDone')}</h3>
            <p style={stepDescStyle}>{t('tour.allDoneDesc')}</p>
          </div>
        )}

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
  }

  // ── Overlay mode: spotlight tour ────────────────────────────────────────

  if (allDone) {
    return (
      <div style={overlayBackdropStyle} role="dialog" aria-modal="true">
        <div style={completionCardStyle}>
          <div style={doneIconStyle}>{'\u2713'}</div>
          <h2 style={completionTitleStyle}>{t('tour.allDone')}</h2>
          <p style={completionDescStyle}>{t('tour.allDoneDesc')}</p>
          <button style={primaryBtnStyle} onClick={handleFinish}>
            {t('tour.finish')}
          </button>
        </div>
      </div>
    )
  }

  const targetId = STEP_TARGETS[currentStepId]

  return (
    <OnboardingSpotlight targetId={targetId} open onBackdropClick={handleDismiss}>
      {/* Step badge */}
      <div style={spotlightBadgeStyle}>
        {t('tour.stepLabel', { current: activeStep + 1, total: totalSteps })}
      </div>

      {/* Progress dots */}
      <div style={dotsRowStyle}>
        {ONBOARDING_STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              ...dotStyle,
              background:
                i < activeStep
                  ? 'var(--primary, #1cabb0)'
                  : i === activeStep
                    ? 'var(--primary, #1cabb0)'
                    : 'var(--border, #ccc)',
              opacity: i < activeStep ? 0.4 : 1,
            }}
          />
        ))}
      </div>

      <h3 style={spotlightTitleStyle}>{t(`tour.steps.${currentStepId}.title`)}</h3>
      <p style={spotlightDescStyle}>{t(`tour.steps.${currentStepId}.description`)}</p>

      {/* Navigation */}
      <div style={spotlightFooterStyle}>
        <button style={skipBtnStyle} onClick={handleDismiss}>
          {t('tour.dismiss')}
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {activeStep > 0 && (
            <button style={secondaryBtnStyle} onClick={handlePrev}>
              {t('tour.prev')}
            </button>
          )}
          {activeStep < totalSteps - 1 ? (
            <button style={primaryBtnStyle} onClick={handleNext}>
              {t('tour.next')}
            </button>
          ) : (
            <button style={primaryBtnStyle} onClick={handleFinish}>
              {t('tour.finish')}
            </button>
          )}
        </div>
      </div>
    </OnboardingSpotlight>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const overlayBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9000,
  background: 'var(--overlay, rgba(0,0,0,0.5))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'cs-fade-in 0.15s ease',
  padding: '1rem',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
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

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '0.75rem',
}

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.1rem',
  fontWeight: 700,
}

const panelSubtitleStyle: React.CSSProperties = {
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

const checklistStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  marginBottom: '1rem',
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

const checkIconStyle: React.CSSProperties = {
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

const panelContentStyle: React.CSSProperties = {
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

// Spotlight-specific styles

const spotlightBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--primary)',
  marginBottom: '0.25rem',
}

const dotsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.3rem',
  marginBottom: '0.75rem',
}

const dotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  transition: 'background 0.2s',
}

const spotlightTitleStyle: React.CSSProperties = {
  margin: '0 0 0.35rem',
  fontSize: '0.95rem',
  fontWeight: 700,
}

const spotlightDescStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '0.82rem',
  lineHeight: 1.55,
  opacity: 0.75,
}

const spotlightFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const completionCardStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: '2.5rem',
  textAlign: 'center',
  maxWidth: 400,
  animation: 'cs-slide-up 0.2s ease',
}

const completionTitleStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1.25rem',
  fontWeight: 700,
}

const completionDescStyle: React.CSSProperties = {
  margin: '0 0 1.5rem',
  fontSize: '0.88rem',
  lineHeight: 1.6,
  opacity: 0.7,
}
