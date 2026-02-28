/**
 * POST /api/stripe/connect-onboarding
 *
 * Starts (or resumes) Stripe Connect Express onboarding for the authenticated user.
 *
 * Flow:
 *   1. Verify the Bearer JWT and resolve the Supabase user.
 *   2. Look up the user's profile for an existing stripe_account_id.
 *   3. If none exists, create a new Stripe Express account and persist its ID.
 *   4. Create a Stripe AccountLink for "account_onboarding".
 *   5. Return { ok: true, url } — the caller redirects to this URL.
 *
 * Env vars required: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const onRequestPost: PagesFunction<{
  STRIPE_SECRET_KEY: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}> = async (context) => {
  const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = context.request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return json({ ok: false, error: 'Unauthorized' }, 401)

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const {
    data: { user },
    error: authErr,
  } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return json({ ok: false, error: 'Unauthorized' }, 401)

  // ── Resolve or create Stripe account ─────────────────────────────────────
  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileRow as { stripe_account_id: string | null } | null
  let accountId = profile?.stripe_account_id ?? null

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'express' })
    accountId = account.id
    await supabaseAdmin.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id)
  }

  // ── Build account link ───────────────────────────────────────────────────
  const origin = context.request.headers.get('Origin') ?? 'https://chainsolve.com'

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/explore/author?connect=refresh`,
    return_url: `${origin}/explore/author?connect=return`,
    type: 'account_onboarding',
  })

  return json({ ok: true, url: accountLink.url })
}
