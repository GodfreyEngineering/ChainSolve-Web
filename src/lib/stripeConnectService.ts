/**
 * stripeConnectService.ts — P111 stubs for Stripe Connect marketplace payments.
 *
 * These functions call ChainSolve edge function endpoints, which in turn call
 * the Stripe API server-side.  The Stripe secret key is NEVER handled here.
 *
 * Full implementation: P112 (purchase flow), P113 (gating UI).
 *
 * Architecture: docs/architecture/stripe-connect.md
 */

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
 * @stub — edge function endpoint not yet implemented.
 */
export async function startConnectOnboarding(): Promise<string> {
  throw new Error('stripeConnectService.startConnectOnboarding: not yet implemented (P112)')
}

/**
 * Get the Stripe Connect account status for the current user.
 *
 * @stub — edge function endpoint not yet implemented.
 */
export async function getConnectStatus(): Promise<ConnectStatus> {
  throw new Error('stripeConnectService.getConnectStatus: not yet implemented (P112)')
}

// ── Buyer purchase flow ───────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for purchasing a marketplace item.
 * Returns the hosted Checkout URL to redirect the buyer to.
 *
 * Free items (price_cents = 0) bypass Stripe — use recordInstall() instead.
 *
 * @stub — edge function endpoint not yet implemented.
 */
export async function createCheckoutSession(itemId: string): Promise<CheckoutResult> {
  void itemId
  throw new Error('stripeConnectService.createCheckoutSession: not yet implemented (P112)')
}

/**
 * Check whether the current authenticated user has purchased a given item.
 * Returns false when unauthenticated.
 *
 * @stub — not yet implemented.
 */
export async function hasPurchased(itemId: string): Promise<boolean> {
  void itemId
  throw new Error('stripeConnectService.hasPurchased: not yet implemented (P112)')
}
