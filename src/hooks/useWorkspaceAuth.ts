/**
 * useWorkspaceAuth — shared auth/profile/plan state for the workspace.
 *
 * V6: All profile operations use SECURITY DEFINER RPCs (migration 0008)
 * to bypass RLS entirely. No direct table SELECT in the auth-critical path.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
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
  /** Error message if profile creation/fetch failed. */
  profileError: string | null
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
  const [profileError, setProfileError] = useState<string | null>(null)
  const [wizardDismissed, setWizardDismissed] = useState(false)
  const [mfaPromptDismissed, setMfaPromptDismissed] = useState(false)
  const [hasMfaFactor, setHasMfaFactor] = useState<boolean | null>(null)

  // Skip session polling for developer accounts — they should never be locked out
  const { sessionRevoked } = useSessionGuard({ skip: isDeveloper(profile) })

  const refreshProfile = useCallback(async () => {
    if (!user) return
    try {
      const { getOrCreateProfile } = await import('../lib/profilesService')
      const p = await getOrCreateProfile()
      setProfile(p)
    } catch {
      // Silent fail on refresh — profile was already loaded
    }
  }, [user])

  // Initial auth + profile fetch
  useEffect(() => {
    async function init() {
      // 1. Get cached session
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        try {
          Sentry.setUser(null)
          posthog.reset()
        } catch {
          // best-effort
        }
        navigate('/login')
        return
      }

      // 2. Validate session server-side. getSession() returns a cached JWT
      //    that may be stale (e.g. user was deleted and recreated). getUser()
      //    makes a real API call to verify the token.
      const {
        data: { user: validatedUser },
        error: userErr,
      } = await supabase.auth.getUser()
      if (userErr || !validatedUser) {
        // "Auth session missing" is expected when a stale cached session
        // exists but the user is not actually logged in — suppress the
        // warning for this normal case to avoid noisy console output.
        const msg = userErr?.message ?? ''
        if (!msg.toLowerCase().includes('session missing')) {
          console.warn('[auth] session invalid — signing out:', msg)
        }
        await supabase.auth.signOut()
        // Clear analytics identity on signout
        try {
          Sentry.setUser(null)
          posthog.reset()
        } catch {
          // Analytics reset must never block signout
        }
        navigate('/login')
        return
      }

      setUser(validatedUser)
      initRememberMe()

      // Ensure session record exists (handles DB wipe / stale localStorage)
      if (!getCurrentSessionId()) {
        resetSessionFailures()
        void registerSession(validatedUser.id)
      } else {
        void touchSession()
      }

      // 3. Fetch profile via RPC — one call, no retries, bypasses RLS
      try {
        const { getOrCreateProfile } = await import('../lib/profilesService')
        const p = await getOrCreateProfile()
        setProfile(p)

        // Identity stitching: tell Sentry + PostHog who this user is
        try {
          Sentry.setUser({ id: validatedUser.id, email: validatedUser.email })
          const effectivePlan = resolveEffectivePlan(p)
          posthog.identify(validatedUser.id, {
            email: validatedUser.email,
            tier: effectivePlan,
            locale: p?.locale ?? 'en',
            created_at: validatedUser.created_at,
          })
        } catch {
          // Analytics identity must never block auth
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[auth] getOrCreateProfile failed:', msg)
        setProfileError(
          `Could not load profile: ${msg}. ` +
            'Ensure migration 0008 has been run in Supabase SQL Editor.',
        )
      }
      setLoading(false)
    }

    void init()
  }, [navigate])

  const handleTermsAccepted = useCallback(
    async (version: string) => {
      const { acceptTermsViaRpc } = await import('../lib/profilesService')
      await acceptTermsViaRpc(version)
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
    const { markOnboardingCompleteViaRpc } = await import('../lib/profilesService')
    await markOnboardingCompleteViaRpc()
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
    profileError,
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
