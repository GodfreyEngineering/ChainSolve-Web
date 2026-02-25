import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Production URLs are hardcoded so they never resolve to the Pages preview domain.
const SUCCESS_URL = "https://app.chainsolve.co.uk/billing/success";
const CANCEL_URL  = "https://app.chainsolve.co.uk/billing/cancel";

type Env = {
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID_PRO_MONTHLY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    const {
      STRIPE_SECRET_KEY,
      STRIPE_PRICE_ID_PRO_MONTHLY,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = context.env;

    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID_PRO_MONTHLY) {
      console.error(`[checkout ${reqId}] Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID_PRO_MONTHLY`);
      return jsonError("Server configuration error", 500);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[checkout ${reqId}] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
      return jsonError("Server configuration error", 500);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-01-27.acacia" as any,
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate caller via Supabase access token
    const authHeader = context.request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Missing Authorization Bearer token", 401);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error(`[checkout ${reqId}] Auth failed:`, userErr?.message, userErr?.status);
      return jsonError("Authentication failed", 401);
    }
    const user = userData.user;

    // Load or create Stripe customer
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id,email,stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: STRIPE_PRICE_ID_PRO_MONTHLY, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { supabase_user_id: user.id },
      },
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      allow_promotion_codes: true,
    });

    return Response.json({ ok: true, url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error(`[checkout ${reqId}]`, err);
    return jsonError(msg, 500);
  }
};
