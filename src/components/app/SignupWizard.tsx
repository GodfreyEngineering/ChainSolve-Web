/**
 * SignupWizard.tsx — Post-signup profile completion wizard (J1-1).
 *
 * A multi-step modal that collects display name, avatar, locale,
 * region, and marketing preference. Shown once after signup when the
 * user's profile has no full_name set.
 */

import { useState, useCallback, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { validateDisplayName } from '../../lib/validateDisplayName'
import { updateDisplayName, uploadAvatar } from '../../lib/profilesService'
import { acceptTerms, updateMarketingOptIn } from '../../lib/profilesService'
import { updateUserPreferences } from '../../lib/userPreferencesService'
import { logTermsAcceptance } from '../../lib/userTermsService'

// ── Constants ────────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Fran\u00e7ais' },
  { code: 'es', label: 'Espa\u00f1ol' },
  { code: 'it', label: 'Italiano' },
  { code: 'he', label: '\u05E2\u05D1\u05E8\u05D9\u05EA' },
] as const

const TERMS_VERSION = '1.0'

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'profile' | 'preferences' | 'confirm'

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

  // Step 3: confirm
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

  const goToPreferences = useCallback(() => {
    setError('')
    const result = validateDisplayName(displayName)
    if (!result.ok) {
      setError(t(`signupWizard.${result.error}`))
      return
    }
    setStep('preferences')
  }, [displayName, t])

  const goToConfirm = useCallback(() => {
    setError('')
    setStep('confirm')
  }, [])

  const goBackToProfile = useCallback(() => {
    setError('')
    setStep('profile')
  }, [])

  const goBackToPreferences = useCallback(() => {
    setError('')
    setStep('preferences')
  }, [])

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
      await acceptTerms(TERMS_VERSION)
      try {
        await logTermsAcceptance(TERMS_VERSION)
      } catch {
        // Best-effort audit log; don't block signup completion.
      }

      // 6. Marketing opt-in
      await updateMarketingOptIn(marketingOptIn)

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signupWizard.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }, [displayName, avatarFile, locale, region, marketingOptIn, i18n, t, onComplete])

  // ── Step indicator ──────────────────────────────────────────────────────

  const stepNumber = step === 'profile' ? 1 : step === 'preferences' ? 2 : 3

  return (
    <Modal open={open} onClose={() => {}} title={t('signupWizard.title')} width={480}>
      {/* Step indicator */}
      <div style={stepIndicatorStyle}>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              ...stepDotStyle,
              background: n <= stepNumber ? 'var(--color-primary, #2563eb)' : '#ccc',
            }}
          />
        ))}
        <span style={stepLabelStyle}>
          {t('signupWizard.stepOf', { current: stepNumber, total: 3 })}
        </span>
      </div>

      {/* Error display */}
      {error && <p style={errorStyle}>{error}</p>}

      {/* ── Step 1: Profile ─────────────────────────────────────────────── */}
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

          <label style={{ ...labelStyle, marginTop: '1rem' }}>
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
            <button onClick={goToPreferences} style={primaryBtnStyle}>
              {t('signupWizard.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preferences ─────────────────────────────────────────── */}
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

          <label style={{ ...labelStyle, marginTop: '1rem' }}>
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
            <button onClick={goBackToProfile} style={secondaryBtnStyle}>
              {t('signupWizard.back')}
            </button>
            <button onClick={goToConfirm} style={primaryBtnStyle}>
              {t('signupWizard.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm ─────────────────────────────────────────────── */}
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
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
            />
            {t('signupWizard.marketingOptIn')}
          </label>

          <div style={btnRowStyle}>
            <button onClick={goBackToPreferences} style={secondaryBtnStyle} disabled={submitting}>
              {t('signupWizard.back')}
            </button>
            <button onClick={handleFinish} style={primaryBtnStyle} disabled={submitting}>
              {submitting ? t('signupWizard.saving') : t('signupWizard.finish')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const stepIndicatorStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '1rem',
}

const stepDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  transition: 'background 0.2s',
}

const stepLabelStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#888',
  marginLeft: '0.5rem',
}

const descStyle: CSSProperties = {
  margin: '0 0 1rem 0',
  fontSize: '0.9rem',
  color: '#555',
  lineHeight: 1.5,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.35rem',
  color: '#333',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: '0.9rem',
  border: '1px solid #ccc',
  borderRadius: 6,
  boxSizing: 'border-box',
}

const avatarRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
}

const avatarImgStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '1px solid #ddd',
}

const fileInputStyle: CSSProperties = {
  fontSize: '0.85rem',
}

const btnRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1.5rem',
}

const primaryBtnStyle: CSSProperties = {
  padding: '0.5rem 1.25rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  background: 'var(--color-primary, #2563eb)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
}

const secondaryBtnStyle: CSSProperties = {
  padding: '0.5rem 1.25rem',
  fontSize: '0.9rem',
  fontWeight: 500,
  background: 'transparent',
  color: '#555',
  border: '1px solid #ccc',
  borderRadius: 6,
  cursor: 'pointer',
}

const errorStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  margin: '0 0 1rem 0',
  fontSize: '0.85rem',
  color: '#b91c1c',
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: 6,
}

const summaryStyle: CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
}

const summaryRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.25rem 0',
  fontSize: '0.9rem',
}

const summaryLabelStyle: CSSProperties = {
  fontWeight: 600,
  color: '#555',
}

const checkboxLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  marginBottom: '0.5rem',
}
