import { useState, Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { isReauthed } from '../../lib/reauth'
import type { Profile } from '../../lib/profilesService'
import { resolveEffectivePlan, type Plan } from '../../lib/entitlements'
import { isUniversityEmail, isValidEmailFormat } from '../../lib/studentVerification'
import { PlanBadge } from '../../components/ui/PlanBadge'
import { PlanComparisonCard } from '../../components/app/PlanComparisonCard'

const LazyReauthModal = lazy(() =>
  import('../../components/ui/ReauthModal').then((m) => ({ default: m.ReauthModal })),
)

interface Props {
  profile: Profile | null
}

export function BillingSettings({ profile }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reauthOpen, setReauthOpen] = useState(false)
  const [pendingEndpoint, setPendingEndpoint] = useState<string | null>(null)

  // Student verification state
  const [studentEmail, setStudentEmail] = useState('')
  const [studentCode, setStudentCode] = useState('')
  const [studentStep, setStudentStep] = useState<'idle' | 'code_sent' | 'verified'>('idle')
  const [studentLoading, setStudentLoading] = useState(false)
  const [studentError, setStudentError] = useState<string | null>(null)
  const [studentSuccess, setStudentSuccess] = useState<string | null>(null)

  const plan = resolveEffectivePlan(profile) as Plan
  const canUpgrade = plan === 'free' || plan === 'canceled'
  const canManage =
    plan === 'trialing' || plan === 'pro' || plan === 'enterprise' || plan === 'past_due'
  const isAlreadyStudent = plan === 'student'
  const showStudentSection = canUpgrade && !isAlreadyStudent

  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const callBillingApi = async (endpoint: string) => {
    setLoading(true)
    setError(null)
    try {
      // Force a token refresh so the access_token is never stale
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshData.session) {
        setError('Session expired — please sign in again')
        setLoading(false)
        return
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshData.session.access_token}` },
      })
      let json: Record<string, unknown>
      try {
        json = (await res.json()) as Record<string, unknown>
      } catch {
        throw new Error(`Server returned a non-JSON response (HTTP ${res.status})`)
      }
      if (!res.ok)
        throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
      if (typeof json.url !== 'string') throw new Error('No redirect URL returned by server')
      window.location.assign(json.url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Billing request failed')
      setLoading(false)
    }
  }

  const handleBillingClick = (endpoint: string) => {
    if (isReauthed()) {
      void callBillingApi(endpoint)
    } else {
      setPendingEndpoint(endpoint)
      setReauthOpen(true)
    }
  }

  const onReauthSuccess = () => {
    setReauthOpen(false)
    if (pendingEndpoint) {
      void callBillingApi(pendingEndpoint)
      setPendingEndpoint(null)
    }
  }

  // ── Student verification handlers ──────────────────────────────────

  const handleStudentRequest = async () => {
    setStudentError(null)
    setStudentSuccess(null)

    if (!isValidEmailFormat(studentEmail)) {
      setStudentError(t('student.errorInvalidEmail'))
      return
    }
    if (!isUniversityEmail(studentEmail)) {
      setStudentError(t('student.errorNotUniversity'))
      return
    }

    setStudentLoading(true)
    try {
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshData.session) {
        setStudentError('Session expired')
        return
      }
      const res = await fetch('/api/student/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshData.session.access_token}`,
        },
        body: JSON.stringify({ universityEmail: studentEmail.trim().toLowerCase() }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Request failed')
      setStudentStep('code_sent')
      setStudentSuccess(t('student.codeSent'))
    } catch (err: unknown) {
      setStudentError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setStudentLoading(false)
    }
  }

  const handleStudentConfirm = async () => {
    setStudentError(null)
    setStudentSuccess(null)

    if (!/^\d{6}$/.test(studentCode.trim())) {
      setStudentError(t('student.errorInvalidCode'))
      return
    }

    setStudentLoading(true)
    try {
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshData.session) {
        setStudentError('Session expired')
        return
      }
      const res = await fetch('/api/student/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshData.session.access_token}`,
        },
        body: JSON.stringify({ code: studentCode.trim() }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Confirmation failed')
      setStudentStep('verified')
      setStudentSuccess(t('student.verified'))
    } catch (err: unknown) {
      setStudentError(err instanceof Error ? err.message : 'Confirmation failed')
    } finally {
      setStudentLoading(false)
    }
  }

  return (
    <>
      {reauthOpen && (
        <Suspense fallback={null}>
          <LazyReauthModal
            open={reauthOpen}
            onClose={() => {
              setReauthOpen(false)
              setPendingEndpoint(null)
            }}
            onSuccess={onReauthSuccess}
          />
        </Suspense>
      )}

      <div>
        <h2 style={headingStyle}>{t('settings.billing')}</h2>

        <div style={cardStyle}>
          {error && <div style={errorBox}>{error}</div>}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={fieldCol}>
                <span style={fieldLabel}>{t('billing.currentPlan')}</span>
                <PlanBadge plan={plan} />
              </div>
              {periodEnd && (
                <div style={fieldCol}>
                  <span style={fieldLabel}>
                    {plan === 'trialing' ? t('billing.trialEnds') : t('billing.renews')}
                  </span>
                  <span style={{ fontWeight: 500 }}>{periodEnd}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {canUpgrade && (
                <Button
                  variant="primary"
                  disabled={loading}
                  onClick={() => handleBillingClick('/api/stripe/create-checkout-session')}
                >
                  {loading ? t('billing.redirecting') : t('billing.upgrade')}
                </Button>
              )}
              {canManage && (
                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => handleBillingClick('/api/stripe/create-portal-session')}
                >
                  {loading ? t('billing.redirecting') : t('billing.manage')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Plan comparison */}
        <div style={{ marginTop: '2rem' }}>
          <h3 style={subHeadingStyle}>{t('billing.comparePlans')}</h3>
          <PlanComparisonCard currentPlan={plan} showCheckout compact />
        </div>

        {/* Student verification section */}
        {showStudentSection && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={subHeadingStyle}>{t('student.title')}</h3>
            <p style={descStyle}>{t('student.description')}</p>

            {studentError && <div style={errorBox}>{studentError}</div>}
            {studentSuccess && <div style={successBox}>{studentSuccess}</div>}

            {studentStep === 'idle' && (
              <div style={studentRow}>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder={t('student.emailPlaceholder')}
                  style={inputStyle}
                  disabled={studentLoading}
                />
                <Button
                  variant="secondary"
                  disabled={studentLoading || !studentEmail}
                  onClick={() => void handleStudentRequest()}
                >
                  {studentLoading ? t('common.loading') : t('student.verify')}
                </Button>
              </div>
            )}

            {studentStep === 'code_sent' && (
              <div style={studentRow}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('student.codePlaceholder')}
                  style={{ ...inputStyle, maxWidth: 160, letterSpacing: '0.2em' }}
                  disabled={studentLoading}
                />
                <Button
                  variant="primary"
                  disabled={studentLoading || studentCode.length !== 6}
                  onClick={() => void handleStudentConfirm()}
                >
                  {studentLoading ? t('common.loading') : t('student.confirm')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={studentLoading}
                  onClick={() => {
                    setStudentStep('idle')
                    setStudentCode('')
                    setStudentError(null)
                    setStudentSuccess(null)
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            )}

            {studentStep === 'verified' && (
              <p style={{ color: '#22c55e', fontWeight: 600 }}>{t('student.verifiedReload')}</p>
            )}
          </div>
        )}

        {isAlreadyStudent && (
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ ...descStyle, color: '#0ea5e9' }}>{t('student.activeLabel')}</p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: '0 0 1.25rem',
  fontSize: '1.15rem',
  fontWeight: 700,
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.5rem',
  background: 'var(--surface-2)',
}

const errorBox: React.CSSProperties = {
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#f87171',
  borderRadius: 8,
  padding: '0.65rem 0.85rem',
  marginBottom: '1rem',
  fontSize: '0.9rem',
}

const fieldCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.8rem',
  opacity: 0.5,
}

const subHeadingStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1rem',
  fontWeight: 600,
}

const descStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '0.875rem',
  opacity: 0.65,
  lineHeight: 1.5,
}

const successBox: React.CSSProperties = {
  background: 'rgba(34,197,94,0.12)',
  border: '1px solid rgba(34,197,94,0.3)',
  color: '#22c55e',
  borderRadius: 8,
  padding: '0.65rem 0.85rem',
  marginBottom: '1rem',
  fontSize: '0.9rem',
}

const studentRow: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'center',
  flexWrap: 'wrap',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg, rgba(255,255,255,0.06))',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.5rem 0.75rem',
  color: 'inherit',
  fontSize: '0.9rem',
  flex: '1 1 240px',
  maxWidth: 360,
}
