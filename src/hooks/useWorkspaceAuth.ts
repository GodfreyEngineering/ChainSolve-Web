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

  /**
   * Fetch profile via the get_my_profile RPC (SECURITY DEFINER — bypasses RLS).
   * Creates the profile row if it doesn't exist yet.
   * Returns the profile or null if the RPC is not available.
   */
  const fetchProfileViaRpc = useCallback(async (): Promise<Profile | null> => {
    const { data, error } = await supabase.rpc('get_my_profile')
    if (error) {
      console.error('[auth] get_my_profile RPC failed:', error.message, error)
      return null
    }
    if (data && typeof data === 'object') return data as Profile
    return null
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    // Try direct SELECT first (fast path when RLS is working)
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', user.id)
      .maybeSingle()
    if (data) {
      setProfile(data as Profile)
      return
    }
    // Fall back to RPC (bypasses RLS)
    const rpcProfile = await fetchProfileViaRpc()
    if (rpcProfile) setProfile(rpcProfile)
  }, [user, fetchProfileViaRpc])

  // Initial auth + profile fetch
  useEffect(() => {
    async function init() {
      // 1. Get cached session
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
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
        console.warn('[auth] session invalid — signing out:', userErr?.message)
        await supabase.auth.signOut()
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

      // 3. Fetch profile — try direct SELECT first, then RPC fallback
      await fetchProfile(validatedUser.id)
    }

    async function fetchProfile(userId: string) {
      // Fast path: direct SELECT (works when RLS SELECT policy is correct)
      const { data: directData } = await supabase
        .from('profiles')
        .select(PROFILE_COLS)
        .eq('id', userId)
        .maybeSingle()
      if (directData) {
        setProfile(directData as Profile)
        setLoading(false)
        return
      }

      // Direct SELECT failed (RLS blocking or profile not created yet).
      // Wait briefly for the trigger, then try again.
      await new Promise((r) => setTimeout(r, 500))
      const { data: retryData } = await supabase
        .from('profiles')
        .select(PROFILE_COLS)
        .eq('id', userId)
        .maybeSingle()
      if (retryData) {
        setProfile(retryData as Profile)
        setLoading(false)
        return
      }

      // Fall back to get_my_profile RPC — SECURITY DEFINER, bypasses RLS,
      // and creates the profile if missing.
      console.warn('[auth] direct SELECT failed, falling back to get_my_profile RPC')
      const rpcProfile = await fetchProfileViaRpc()
      if (rpcProfile) {
        setProfile(rpcProfile)
        setLoading(false)
        return
      }

      // RPC also failed — set error for display
      setProfileError(
        'Could not load profile. Run migration 0007 (get_my_profile RPC) in Supabase SQL Editor.',
      )
      setLoading(false)
    }

    void init()
  }, [navigate, fetchProfileViaRpc])

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
