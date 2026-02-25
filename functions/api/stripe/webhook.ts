import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const onRequestPost: PagesFunction<{
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}> = async (context) => {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });
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
  } catch (err: any) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  // Idempotent audit log — event.id (PK) makes duplicate deliveries safe.
  await supabaseAdmin.from("stripe_events").upsert({
    id: event.id,
    type: event.type,
    payload: event as any,
  });

  // Helper: map Stripe subscription status → plan enum
  const mapStatusToPlan = (status: string): "free" | "trialing" | "pro" | "past_due" | "canceled" => {
    if (status === "trialing") return "trialing";
    if (status === "active") return "pro";
    if (status === "past_due" || status === "unpaid") return "past_due";
    if (status === "canceled" || status === "incomplete_expired") return "canceled";
    return "free";
  };

  // Handle subscription lifecycle events
  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;

    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const plan = mapStatusToPlan(sub.status);

    // In Stripe SDK v20 / API 2025+, current_period_end lives on SubscriptionItem
    const firstItem = sub.items?.data?.[0];
    const periodEnd: number | undefined = (firstItem as any)?.current_period_end;
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
