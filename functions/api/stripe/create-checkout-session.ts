/**
 * POST /api/stripe/create-checkout-session
 *
 * Creates a Stripe Checkout session for Pro or Enterprise subscriptions.
 * Requires a valid Supabase JWT in the Authorization header (Bearer <token>).
 *
 * Request body (JSON):
 *   { "plan_key": "pro_monthly" | "pro_annual" | "ent_10_monthly" | "ent_10_annual" | "ent_unlimited_monthly" | "ent_unlimited_annual" }
 *
 * Flow:
 *   1. Verify the Supabase JWT and resolve the user's profile.
 *   2. Look up or create a Stripe Customer for this user.
 *   3. Resolve the price ID from the plan_key and create a Checkout session.
 *   4. Return { url } — the client redirects the browser to Stripe Checkout.
 *
 * Env vars required: STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PRO_MONTHLY,
 *   STRIPE_PRICE_ID_PRO_ANNUAL, STRIPE_PRICE_ID_ENT_10_MONTHLY,
 *   STRIPE_PRICE_ID_ENT_10_ANNUAL, STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY,
 *   STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { jsonError } from './_lib'

// Production URLs are hardcoded so they never resolve to the Pages preview domain.
const SUCCESS_URL = 'https://app.chainsolve.co.uk/billing/success'
const CANCEL_URL = 'https://app.chainsolve.co.uk/billing/cancel'

type Env = {
  STRIPE_SECRET_KEY: string
  STRIPE_PRICE_ID_PRO_MONTHLY: string
  STRIPE_PRICE_ID_PRO_ANNUAL?: string
  STRIPE_PRICE_ID_ENT_10_MONTHLY?: string
  STRIPE_PRICE_ID_ENT_10_ANNUAL?: string
  STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY?: string
  STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL?: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export type PlanKey =
  | 'pro_monthly'
  | 'pro_annual'
  | 'ent_10_monthly'
  | 'ent_10_annual'
  | 'ent_unlimited_monthly'
  | 'ent_unlimited_annual'

interface PlanConfig {
  envKey: keyof Env
  planTier: 'pro' | 'enterprise'
  quantity: number
  trialDays: number
}

const PLAN_CONFIGS: Record<PlanKey, PlanConfig> = {
  pro_monthly: {
    envKey: 'STRIPE_PRICE_ID_PRO_MONTHLY',
    planTier: 'pro',
    quantity: 1,
    trialDays: 7,
  },
  pro_annual: { envKey: 'STRIPE_PRICE_ID_PRO_ANNUAL', planTier: 'pro', quantity: 1, trialDays: 7 },
  ent_10_monthly: {
    envKey: 'STRIPE_PRICE_ID_ENT_10_MONTHLY',
    planTier: 'enterprise',
    quantity: 10,
    trialDays: 0,
  },
  ent_10_annual: {
    envKey: 'STRIPE_PRICE_ID_ENT_10_ANNUAL',
    planTier: 'enterprise',
    quantity: 10,
    trialDays: 0,
  },
  ent_unlimited_monthly: {
    envKey: 'STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY',
    planTier: 'enterprise',
    quantity: 1,
    trialDays: 0,
  },
  ent_unlimited_annual: {
    envKey: 'STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL',
    planTier: 'enterprise',
    quantity: 1,
    trialDays: 0,
  },
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const reqId = crypto.randomUUID().slice(0, 8)
  try {
    const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env

    if (!STRIPE_SECRET_KEY) {
      console.error(`[checkout ${reqId}] Missing STRIPE_SECRET_KEY`)
      return jsonError('Server configuration error', 500)
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[checkout ${reqId}] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`)
      return jsonError('Server configuration error', 500)
    }

    // Parse request body for plan_key (default to pro_monthly for backwards compat)
    let planKey: PlanKey = 'pro_monthly'
    try {
      const body = (await context.request.json()) as Record<string, unknown>
      if (body.plan_key && typeof body.plan_key === 'string') {
        if (!(body.plan_key in PLAN_CONFIGS)) {
          return jsonError(`Invalid plan_key: ${body.plan_key}`, 400)
        }
        planKey = body.plan_key as PlanKey
      }
    } catch {
      // Empty body or non-JSON — use default (pro_monthly)
    }

    const config = PLAN_CONFIGS[planKey]
    const priceId = context.env[config.envKey] as string | undefined

    if (!priceId) {
      console.error(`[checkout ${reqId}] Missing env var ${config.envKey} for plan_key=${planKey}`)
      return jsonError('Server configuration error', 500)
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Authenticate caller via Supabase access token
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return jsonError('Missing Authorization Bearer token', 401)

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      console.error(`[checkout ${reqId}] Auth failed:`, userErr?.message, userErr?.status)
      return jsonError('Authentication failed', 401)
    }
    const user = userData.user

    // Load or create Stripe customer
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id,email,stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    let customerId = profile?.stripe_customer_id ?? null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const subscriptionData: Stripe.Checkout.SessionCreateParams['subscription_data'] = {
      metadata: {
        supabase_user_id: user.id,
        plan_tier: config.planTier,
        plan_key: planKey,
      },
    }

    if (config.trialDays > 0) {
      subscriptionData.trial_period_days = config.trialDays
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: config.quantity }],
      subscription_data: subscriptionData,
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      allow_promotion_codes: true,
    })

    return Response.json({ ok: true, url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error(`[checkout ${reqId}]`, err)
    return jsonError(msg, 500)
  }
}
