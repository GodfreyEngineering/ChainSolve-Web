/**
 * stripeConnectService.ts — P111/P112 Stripe Connect marketplace payments.
 *
 * These functions call ChainSolve edge function endpoints, which in turn call
 * the Stripe API server-side.  The Stripe secret key is NEVER handled here.
 *
 * Architecture: docs/architecture/stripe-connect.md
 */

import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ConnectStatus = 'not_connected' | 'pending' | 'active'

export interface CheckoutResult {
  /** Stripe Checkout hosted URL — redirect the browser here to start payment. */
  url: string
}

// ── Seller onboarding ─────────────────────────────────────────────────────────

/**
 * Start Stripe Connect Express onboarding for the current user.
 * Returns a one-time Stripe-hosted onboarding URL.
 *
 * @stub — edge function endpoint not yet implemented (P113).
 */
export async function startConnectOnboarding(): Promise<string> {
  throw new Error('stripeConnectService.startConnectOnboarding: not yet implemented (P113)')
}

/**
 * Get the Stripe Connect account status for the current user.
 *
 * @stub — edge function endpoint not yet implemented (P113).
 */
export async function getConnectStatus(): Promise<ConnectStatus> {
  throw new Error('stripeConnectService.getConnectStatus: not yet implemented (P113)')
}

// ── Buyer purchase flow ───────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for purchasing a marketplace item.
 * Returns the hosted Checkout URL to redirect the buyer to.
 *
 * Free items (price_cents = 0) bypass Stripe — use recordInstall() instead.
 */
export async function createCheckoutSession(itemId: string): Promise<CheckoutResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in to purchase items')

  const res = await fetch('/api/stripe/marketplace-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ item_id: itemId }),
  })

  const data = (await res.json()) as { ok: boolean; url?: string; error?: string }
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'Checkout failed')
  }
  return { url: data.url! }
}

/**
 * Check whether the current authenticated user has purchased a given item.
 * Returns false when unauthenticated.
 */
export async function hasPurchased(itemId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('marketplace_purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data !== null
}
