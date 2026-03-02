/**
 * ProjectWizard — step-by-step guide to building a first project.
 *
 * Accessible from Help > "Start a Project Wizard".
 * Walks the user through picking input blocks, function blocks,
 * output blocks, connecting them, and exporting.
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface ProjectWizardProps {
  onClose: () => void
}

const WIZARD_STEPS = [
  'welcome',
  'pick_inputs',
  'pick_functions',
  'pick_outputs',
  'connect',
  'validate',
  'report',
] as const

type WizardStep = (typeof WIZARD_STEPS)[number]

export function ProjectWizard({ onClose }: ProjectWizardProps) {
  const { t } = useTranslation()
  const [activeStep, setActiveStep] = useState(0)
  const totalSteps = WIZARD_STEPS.length
  const currentStep: WizardStep = WIZARD_STEPS[activeStep]
  const isFirst = activeStep === 0
  const isLast = activeStep === totalSteps - 1

  const handleNext = useCallback(() => {
    if (!isLast) setActiveStep((s) => s + 1)
  }, [isLast])

  const handlePrev = useCallback(() => {
    if (!isFirst) setActiveStep((s) => s - 1)
  }, [isFirst])

  const stepIndicators = useMemo(
    () =>
      WIZARD_STEPS.map((step, idx) => (
        <button
          key={step}
          style={{
            ...indicatorStyle,
            ...(idx === activeStep ? indicatorActiveStyle : {}),
            ...(idx < activeStep ? indicatorDoneStyle : {}),
          }}
          onClick={() => setActiveStep(idx)}
          aria-label={t(`wizard.steps.${step}.title`)}
          aria-current={idx === activeStep ? 'step' : undefined}
        >
          {idx < activeStep ? '\u2713' : idx + 1}
        </button>
      )),
    [activeStep, t],
  )

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={t('wizard.title')}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t('wizard.title')}</h2>
          <button style={closeBtnStyle} onClick={onClose} aria-label={t('wizard.close')}>
            ✕
          </button>
        </div>

        {/* Step indicators */}
        <div style={indicatorRowStyle}>{stepIndicators}</div>

        {/* Step content */}
        <div style={contentStyle}>
          <div style={stepBadgeStyle}>
            {t('wizard.stepLabel', { current: activeStep + 1, total: totalSteps })}
          </div>
          <h3 style={stepTitleStyle}>{t(`wizard.steps.${currentStep}.title`)}</h3>
          <p style={stepDescStyle}>{t(`wizard.steps.${currentStep}.description`)}</p>
          {currentStep !== 'welcome' && currentStep !== 'report' && (
            <div style={tipBoxStyle}>
              <strong style={tipLabelStyle}>{t('wizard.tip')}</strong>
              <span>{t(`wizard.steps.${currentStep}.tip`)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <button style={skipBtnStyle} onClick={onClose}>
            {t('wizard.close')}
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isFirst && (
              <button style={secondaryBtnStyle} onClick={handlePrev}>
                {t('wizard.prev')}
              </button>
            )}
            {isLast ? (
              <button style={primaryBtnStyle} onClick={onClose}>
                {t('wizard.finish')}
              </button>
            ) : (
              <button style={primaryBtnStyle} onClick={handleNext}>
                {t('wizard.next')}
              </button>
            )}
          </div>
        </div>
      </div>
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
  width: 560,
  maxWidth: '100%',
  maxHeight: '85vh',
  overflowY: 'auto',
  animation: 'cs-slide-up 0.2s ease',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.1rem',
  fontWeight: 700,
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

const indicatorRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'center',
  marginBottom: '1.25rem',
}

const indicatorStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '1.5px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.7rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
}

const indicatorActiveStyle: React.CSSProperties = {
  background: 'var(--primary)',
  borderColor: 'var(--primary)',
  color: 'var(--color-on-primary)',
}

const indicatorDoneStyle: React.CSSProperties = {
  borderColor: 'var(--primary)',
  color: 'var(--primary)',
}

const contentStyle: React.CSSProperties = {
  minHeight: 180,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
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
  margin: '0 0 1rem',
  fontSize: '0.85rem',
  lineHeight: 1.6,
  opacity: 0.75,
}

const tipBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  background: 'rgba(28, 171, 176, 0.08)',
  border: '1px solid rgba(28, 171, 176, 0.2)',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.8rem',
  lineHeight: 1.5,
}

const tipLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--primary)',
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
