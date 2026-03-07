/**
 * useWorkspaceAuth — shared auth/profile/plan state for the workspace.
 *
 * Extracts the authentication, profile fetch, and plan resolution logic
 * that was previously duplicated across page components.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../lib/profilesService'
import { resolveEffectivePlan, isDeveloper, type Plan } from '../lib/entitlements'
import { initRememberMe } from '../lib/rememberMe'
import {
  getCurrentSessionId,
  registerSession,
  resetSessionFailures,
  touchSession,
} from '../lib/sessionService'
import { useSessionGuard } from './useSessionGuard'
import { CURRENT_TERMS_VERSION } from '../lib/termsVersion'
import { listMfaFactors } from '../lib/auth'

const PROFILE_COLS =
  'id,email,full_name,plan,stripe_customer_id,current_period_end,is_developer,is_admin,is_student,accepted_terms_version,marketing_opt_in,onboarding_completed_at'

export interface WorkspaceAuthState {
  user: User | null
  profile: Profile | null
  plan: Plan
  loading: boolean
  sessionRevoked: boolean
  /** True if the user needs to pass the auth gate (email verify / ToS). */
  needsGate: boolean
  /** True if the user still needs to complete the signup wizard. */
  needsWizard: boolean
  wizardDismissed: boolean
  mfaPromptDismissed: boolean
  hasMfaFactor: boolean | null
  /** Refetch the profile from the database. */
  refreshProfile: () => Promise<void>
  /** Called when the signup wizard completes. */
  handleWizardComplete: () => Promise<void>
  /** Called when the user dismisses the MFA prompt. */
  dismissMfaPrompt: () => void
  /** Called when the user dismisses the signup wizard without completing. */
  dismissWizard: () => void
  /** Called when terms are accepted via AuthGate. */
  handleTermsAccepted: (version: string) => Promise<void>
}

export function useWorkspaceAuth(): WorkspaceAuthState {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [wizardDismissed, setWizardDismissed] = useState(false)
  const [mfaPromptDismissed, setMfaPromptDismissed] = useState(false)
  const [hasMfaFactor, setHasMfaFactor] = useState<boolean | null>(null)

  // Skip session polling for developer accounts — they should never be locked out
  const { sessionRevoked } = useSessionGuard({ skip: isDeveloper(profile) })

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', user.id)
      .maybeSingle()
    if (data) setProfile(data as Profile)
  }, [user])

  // Initial auth + profile fetch
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login')
        return
      }
      setUser(session.user)
      initRememberMe()
      // Ensure session record exists (handles DB wipe / stale localStorage)
      if (!getCurrentSessionId()) {
        resetSessionFailures()
        void registerSession(session.user.id)
      } else {
        void touchSession()
      }
      // Profile row is created by the handle_new_user() DB trigger, which
      // runs asynchronously. On first signup the row may not exist yet when
      // this query fires. Retry with exponential backoff to avoid the race.
      const RETRY_DELAYS = [200, 400, 800, 1600, 3200]
      async function fetchProfileWithRetry(userId: string) {
        for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
          const { data, error } = await supabase
            .from('profiles')
            .select(PROFILE_COLS)
            .eq('id', userId)
            .maybeSingle()
          if (!error && data) {
            setProfile(data as Profile)
            setLoading(false)
            return
          }
          if (attempt < RETRY_DELAYS.length) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
          }
        }
        // All retries exhausted — profile trigger likely never fired.
        // Call the ensure_profile RPC (SECURITY DEFINER) to create the row.
        try {
          const { error: rpcErr } = await supabase.rpc('ensure_profile')
          if (!rpcErr) {
            // Try twice — connection pooling can delay visibility of the new row
            for (let r = 0; r < 2; r++) {
              const { data } = await supabase
                .from('profiles')
                .select(PROFILE_COLS)
                .eq('id', userId)
                .maybeSingle()
              if (data) {
                setProfile(data as Profile)
                setLoading(false)
                return
              }
              if (r === 0) await new Promise((w) => setTimeout(w, 500))
            }
          }
        } catch {
          // RPC not available or other error — fall through to fallback UI
        }
        setLoading(false)
      }
      void fetchProfileWithRetry(session.user.id)
    })
  }, [navigate])

  const handleTermsAccepted = useCallback(
    async (version: string) => {
      const { acceptTerms } = await import('../lib/profilesService')
      await acceptTerms(version)
      try {
        const { logTermsAcceptance } = await import('../lib/userTermsService')
        await logTermsAcceptance(version)
      } catch {
        // Best-effort audit
      }
      await refreshProfile()
    },
    [refreshProfile],
  )

  const handleWizardComplete = useCallback(async () => {
    setWizardDismissed(true)
    const { markOnboardingComplete } = await import('../lib/profilesService')
    await markOnboardingComplete()
    await refreshProfile()
    try {
      const { factors } = await listMfaFactors()
      const verified = factors.filter((f) => f.status === 'verified')
      setHasMfaFactor(verified.length > 0)
    } catch {
      setHasMfaFactor(true)
    }
  }, [refreshProfile])

  const plan = resolveEffectivePlan(profile)
  const needsGate =
    !!user &&
    !!profile &&
    (!user.email_confirmed_at || profile.accepted_terms_version !== CURRENT_TERMS_VERSION)
  const needsWizard = !loading && !!profile && !profile.onboarding_completed_at && !wizardDismissed

  return {
    user,
    profile,
    plan,
    loading,
    sessionRevoked,
    needsGate,
    needsWizard,
    wizardDismissed,
    mfaPromptDismissed,
    hasMfaFactor,
    refreshProfile,
    handleWizardComplete,
    dismissMfaPrompt: () => setMfaPromptDismissed(true),
    dismissWizard: () => setWizardDismissed(true),
    handleTermsAccepted,
  }
}
