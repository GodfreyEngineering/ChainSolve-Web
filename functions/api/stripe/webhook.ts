/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events and keeps the Supabase `profiles` table
 * in sync with the customer's subscription state.
 *
 * Verified events handled:
 *   - checkout.session.completed       → set plan to 'trialing' or 'pro'
 *   - customer.subscription.updated    → update plan + current_period_end
 *   - customer.subscription.deleted    → set plan to 'canceled'
 *
 * Security:
 *   - HMAC-SHA256 signature verified via Stripe's constructEventAsync()
 *     using SubtleCrypto (Web Crypto API — available in Workers runtime).
 *   - Raw body is read once and passed to signature verification before parsing.
 *   - Events are stored in stripe_events (idempotent: Stripe event ID = PK).
 *
 * Env vars required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *                    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { mapStatusToPlan } from "./_lib";

export const onRequestPost: PagesFunction<{
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}> = async (context) => {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const sig = context.request.headers.get("Stripe-Signature");
  if (!sig) return new Response("Missing Stripe-Signature", { status: 400 });

  // Read the raw body exactly once before any parsing — the HMAC is computed
  // over the exact bytes Stripe sent; any re-reading or re-encoding will break it.
  const rawBody = await context.request.text();

  let event: Stripe.Event;
  try {
    // constructEventAsync + SubtleCrypto is required in the Cloudflare Pages
    // runtime, which does NOT expose Node.js `crypto`. The SubtleCrypto
    // provider uses globalThis.crypto.subtle (Web Crypto API), which IS
    // available in all Cloudflare Workers/Pages environments.
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET,
      undefined,      // default timestamp tolerance (300 s)
      cryptoProvider,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  // Idempotent audit log — event.id (PK) makes duplicate deliveries safe.
  await supabaseAdmin.from("stripe_events").upsert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  // mapStatusToPlan is imported from ./_lib.ts (tested separately).

  // Handle subscription lifecycle events
  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;

    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const plan = mapStatusToPlan(sub.status);

    // In Stripe SDK v20 / API 2025+, current_period_end lives on SubscriptionItem
    const firstItem = sub.items?.data?.[0];
    const firstItemRecord = firstItem as unknown as Record<string, unknown> | undefined;
    const periodEnd = typeof firstItemRecord?.current_period_end === "number"
      ? firstItemRecord.current_period_end
      : undefined;
    const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

    await supabaseAdmin
      .from("profiles")
      .update({
        plan,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        current_period_end: currentPeriodEnd,
      })
      .eq("stripe_customer_id", customerId);
  }

  if (event.type === "checkout.session.completed") {
    // Subscription lifecycle events above are sufficient;
    // nothing additional required here.
  }

  return new Response("ok", { status: 200 });
};
