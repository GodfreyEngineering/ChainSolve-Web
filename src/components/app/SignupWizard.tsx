/**
 * SignupWizard.tsx — Full-page post-signup profile completion wizard.
 *
 * A multi-step full-page flow that collects display name, avatar, locale,
 * region, plan selection, and marketing preference. Blocks app access until
 * completed (onboarding_completed_at is set in profiles).
 *
 * Steps:
 *   1. Display name + avatar upload
 *   2. Locale + region
 *   3. Plan selection (placeholder — expanded in Phase 3)
 *   4. Confirmation + marketing opt-in
 */

import { useState, useCallback, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { validateDisplayName } from '../../lib/validateDisplayName'
import { updateDisplayName, uploadAvatar } from '../../lib/profilesService'
import { acceptTerms, updateMarketingOptIn } from '../../lib/profilesService'
import { updateUserPreferences } from '../../lib/userPreferencesService'
import { logTermsAcceptance } from '../../lib/userTermsService'
import { CURRENT_TERMS_VERSION } from '../../lib/termsVersion'

// ── Constants ────────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Fran\u00e7ais' },
  { code: 'es', label: 'Espa\u00f1ol' },
  { code: 'it', label: 'Italiano' },
  { code: 'he', label: '\u05E2\u05D1\u05E8\u05D9\u05EA' },
] as const

const PLAN_OPTIONS = [
  { id: 'free', labelKey: 'signupWizard.planFree', descKey: 'signupWizard.planFreeDesc' },
  { id: 'pro', labelKey: 'signupWizard.planPro', descKey: 'signupWizard.planProDesc' },
  { id: 'student', labelKey: 'signupWizard.planStudent', descKey: 'signupWizard.planStudentDesc' },
] as const

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'profile' | 'preferences' | 'plan' | 'confirm'
const STEPS: Step[] = ['profile', 'preferences', 'plan', 'confirm']

interface Props {
  open: boolean
  onComplete: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function SignupWizard({ open, onComplete }: Props) {
  const { t, i18n } = useTranslation()

  const [step, setStep] = useState<Step>('profile')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1: profile
  const [displayName, setDisplayName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Step 2: preferences
  const [locale, setLocale] = useState(i18n.language?.split('-')[0] ?? 'en')
  const [region, setRegion] = useState('')

  // Step 3: plan
  const [selectedPlan, setSelectedPlan] = useState<string>('free')

  // Step 4: confirm
  const [marketingOptIn, setMarketingOptIn] = useState(false)

  // ── Avatar file handler ─────────────────────────────────────────────────

  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setError(t('signupWizard.errorAvatarType'))
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        setError(t('signupWizard.errorAvatarSize'))
        return
      }
      setAvatarFile(file)
      setError('')
      const reader = new FileReader()
      reader.onload = () => setAvatarPreview(reader.result as string)
      reader.readAsDataURL(file)
    },
    [t],
  )

  // ── Step navigation ─────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    setError('')
    if (step === 'profile') {
      const result = validateDisplayName(displayName)
      if (!result.ok) {
        setError(t(`signupWizard.${result.error}`))
        return
      }
    }
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }, [step, displayName, t])

  const goBack = useCallback(() => {
    setError('')
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }, [step])

  // ── Final submit ────────────────────────────────────────────────────────

  const handleFinish = useCallback(async () => {
    setSubmitting(true)
    setError('')
    try {
      // 1. Save display name
      await updateDisplayName(displayName.trim())

      // 2. Upload avatar (optional)
      if (avatarFile) {
        await uploadAvatar(avatarFile)
      }

      // 3. Save preferences (locale, region)
      await updateUserPreferences({
        locale,
        region: region.trim() || null,
      })

      // 4. Change i18n language if different
      if (locale !== i18n.language?.split('-')[0]) {
        await i18n.changeLanguage(locale)
      }

      // 5. Accept terms + log in audit table
      await acceptTerms(CURRENT_TERMS_VERSION)
      try {
        await logTermsAcceptance(CURRENT_TERMS_VERSION)
      } catch {
        // Best-effort audit log; don't block signup completion.
      }

      // 6. Marketing opt-in
      await updateMarketingOptIn(marketingOptIn)

      // 7. Plan choice is informational for now (Stripe checkout in Phase 3)

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signupWizard.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }, [displayName, avatarFile, locale, region, marketingOptIn, i18n, t, onComplete])

  if (!open) return null

  const stepIndex = STEPS.indexOf(step)
  const stepNumber = stepIndex + 1

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>{t('signupWizard.title')}</h1>
        <p style={subStyle}>{t('signupWizard.subtitle')}</p>

        {/* Step indicator */}
        <div style={stepBarStyle}>
          {STEPS.map((s, i) => (
            <div key={s} style={stepItemStyle}>
              <div
                style={{
                  ...stepDotStyle,
                  background:
                    i < stepIndex
                      ? 'var(--primary, #1cab b0)'
                      : i === stepIndex
                        ? 'var(--primary, #1cabb0)'
                        : 'var(--border, #ccc)',
                  opacity: i < stepIndex ? 0.5 : 1,
                }}
              />
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    ...stepLineStyle,
                    background: i < stepIndex ? 'var(--primary, #1cabb0)' : 'var(--border, #ccc)',
                    opacity: i < stepIndex ? 0.5 : 0.3,
                  }}
                />
              )}
            </div>
          ))}
          <span style={stepLabelStyle}>
            {t('signupWizard.stepOf', { current: stepNumber, total: STEPS.length })}
          </span>
        </div>

        {/* Error display */}
        {error && <p style={errorBoxStyle}>{error}</p>}

        {/* ── Step 1: Profile ─────────────────────────────────────── */}
        {step === 'profile' && (
          <div>
            <p style={descStyle}>{t('signupWizard.profileDesc')}</p>

            <label style={labelStyle}>{t('signupWizard.displayNameLabel')}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setError('')
              }}
              placeholder={t('signupWizard.displayNamePlaceholder')}
              maxLength={100}
              style={inputStyle}
              autoFocus
            />

            <label style={{ ...labelStyle, marginTop: '1.25rem' }}>
              {t('signupWizard.avatarLabel')}
            </label>
            <div style={avatarRowStyle}>
              {avatarPreview && <img src={avatarPreview} alt="" style={avatarImgStyle} />}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={fileInputStyle}
              />
            </div>

            <div style={btnRowStyle}>
              <span />
              <button onClick={goNext} style={primaryBtnStyle}>
                {t('signupWizard.next')}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preferences ─────────────────────────────────── */}
        {step === 'preferences' && (
          <div>
            <p style={descStyle}>{t('signupWizard.preferencesDesc')}</p>

            <label style={labelStyle}>{t('signupWizard.localeLabel')}</label>
            <select value={locale} onChange={(e) => setLocale(e.target.value)} style={inputStyle}>
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>

            <label style={{ ...labelStyle, marginTop: '1.25rem' }}>
              {t('signupWizard.regionLabel')}
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder={t('signupWizard.regionPlaceholder')}
              maxLength={50}
              style={inputStyle}
            />

            <div style={btnRowStyle}>
              <button onClick={goBack} style={secondaryBtnStyle}>
                {t('signupWizard.back')}
              </button>
              <button onClick={goNext} style={primaryBtnStyle}>
                {t('signupWizard.next')}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Plan selection ──────────────────────────────── */}
        {step === 'plan' && (
          <div>
            <p style={descStyle}>{t('signupWizard.planDesc')}</p>

            <div style={planGridStyle}>
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  style={{
                    ...planCardStyle,
                    borderColor:
                      selectedPlan === p.id ? 'var(--primary, #1cabb0)' : 'var(--border, #e5e7eb)',
                    background:
                      selectedPlan === p.id ? 'rgba(28,171,176,0.06)' : 'var(--surface-2, #f9fafb)',
                  }}
                >
                  <span style={planNameStyle}>{t(p.labelKey)}</span>
                  <span style={planDescStyle}>{t(p.descKey)}</span>
                </button>
              ))}
            </div>

            <p style={planNoteStyle}>{t('signupWizard.planNote')}</p>

            <div style={btnRowStyle}>
              <button onClick={goBack} style={secondaryBtnStyle}>
                {t('signupWizard.back')}
              </button>
              <button onClick={goNext} style={primaryBtnStyle}>
                {t('signupWizard.next')}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm ─────────────────────────────────────── */}
        {step === 'confirm' && (
          <div>
            <p style={descStyle}>{t('signupWizard.confirmDesc')}</p>

            <div style={summaryStyle}>
              <div style={summaryRowStyle}>
                <span style={summaryLabelStyle}>{t('signupWizard.displayNameLabel')}</span>
                <span>{displayName.trim()}</span>
              </div>
              <div style={summaryRowStyle}>
                <span style={summaryLabelStyle}>{t('signupWizard.localeLabel')}</span>
                <span>{SUPPORTED_LOCALES.find((l) => l.code === locale)?.label ?? locale}</span>
              </div>
              {region.trim() && (
                <div style={summaryRowStyle}>
                  <span style={summaryLabelStyle}>{t('signupWizard.regionLabel')}</span>
                  <span>{region.trim()}</span>
                </div>
              )}
              <div style={summaryRowStyle}>
                <span style={summaryLabelStyle}>{t('signupWizard.planLabel')}</span>
                <span>
                  {t(
                    PLAN_OPTIONS.find((p) => p.id === selectedPlan)?.labelKey ??
                      'signupWizard.planFree',
                  )}
                </span>
              </div>
            </div>

            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                style={checkboxStyle}
              />
              {t('signupWizard.marketingOptIn')}
            </label>

            <div style={btnRowStyle}>
              <button onClick={goBack} style={secondaryBtnStyle} disabled={submitting}>
                {t('signupWizard.back')}
              </button>
              <button onClick={handleFinish} style={primaryBtnStyle} disabled={submitting}>
                {submitting ? t('signupWizard.saving') : t('signupWizard.finish')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  background: 'var(--surface-1, #fff)',
}

const cardStyle: CSSProperties = {
  background: 'var(--surface-2, #f9fafb)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 'var(--radius-xl, 16px)',
  padding: '2.5rem',
  width: '100%',
  maxWidth: '520px',
  animation: 'cs-fade-in 0.4s ease',
}

const headingStyle: CSSProperties = {
  margin: '0 0 0.25rem',
  fontSize: '1.5rem',
  fontWeight: 700,
  textAlign: 'center',
}

const subStyle: CSSProperties = {
  margin: '0 0 1.5rem',
  opacity: 0.6,
  fontSize: '0.9rem',
  textAlign: 'center',
}

const stepBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  marginBottom: '1.5rem',
  justifyContent: 'center',
}

const stepItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
}

const stepDotStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  transition: 'background 0.2s',
  flexShrink: 0,
}

const stepLineStyle: CSSProperties = {
  width: 40,
  height: 2,
  transition: 'background 0.2s',
}

const stepLabelStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-muted, #888)',
  marginLeft: '0.75rem',
  whiteSpace: 'nowrap',
}

const descStyle: CSSProperties = {
  margin: '0 0 1.25rem 0',
  fontSize: '0.9rem',
  color: 'var(--text-secondary, #555)',
  lineHeight: 1.5,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.35rem',
  color: 'var(--text-primary, #333)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  fontSize: '0.9rem',
  border: '1px solid var(--border, #ccc)',
  borderRadius: 'var(--radius-lg, 8px)',
  boxSizing: 'border-box',
  background: 'var(--surface-1, #fff)',
  color: 'inherit',
  fontFamily: 'inherit',
}

const avatarRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
}

const avatarImgStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '2px solid var(--border, #ddd)',
}

const fileInputStyle: CSSProperties = {
  fontSize: '0.85rem',
}

const btnRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  marginTop: '2rem',
}

const primaryBtnStyle: CSSProperties = {
  padding: '0.65rem 1.5rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  background: 'var(--primary, #1cabb0)',
  color: 'var(--color-on-primary, #fff)',
  border: 'none',
  borderRadius: 'var(--radius-lg, 8px)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.02em',
}

const secondaryBtnStyle: CSSProperties = {
  padding: '0.65rem 1.5rem',
  fontSize: '0.95rem',
  fontWeight: 500,
  background: 'transparent',
  color: 'var(--text-secondary, #555)',
  border: '1px solid var(--border, #ccc)',
  borderRadius: 'var(--radius-lg, 8px)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const errorBoxStyle: CSSProperties = {
  padding: '0.6rem 0.85rem',
  margin: '0 0 1rem 0',
  fontSize: '0.85rem',
  color: 'var(--danger-text, #b91c1c)',
  background: 'var(--danger-dim, #fef2f2)',
  border: '1px solid rgba(239,68,68,0.35)',
  borderRadius: 'var(--radius-lg, 8px)',
}

const planGridStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginBottom: '0.75rem',
}

const planCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: '1rem 1.25rem',
  borderRadius: 'var(--radius-lg, 8px)',
  border: '2px solid var(--border, #e5e7eb)',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  textAlign: 'left',
  fontFamily: 'inherit',
}

const planNameStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '1rem',
  marginBottom: '0.2rem',
}

const planDescStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary, #666)',
  lineHeight: 1.4,
}

const planNoteStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-muted, #888)',
  fontStyle: 'italic',
  marginBottom: '0',
}

const summaryStyle: CSSProperties = {
  background: 'var(--surface-1, #f9fafb)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 'var(--radius-lg, 8px)',
  padding: '0.75rem 1rem',
  marginBottom: '1.25rem',
}

const summaryRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.3rem 0',
  fontSize: '0.9rem',
}

const summaryLabelStyle: CSSProperties = {
  fontWeight: 600,
  color: 'var(--text-secondary, #555)',
}

const checkboxLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  marginBottom: '0.5rem',
}

const checkboxStyle: CSSProperties = {
  accentColor: 'var(--primary, #1cabb0)',
  width: 16,
  height: 16,
  cursor: 'pointer',
  flexShrink: 0,
}
