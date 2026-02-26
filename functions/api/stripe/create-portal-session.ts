/**
 * POST /api/stripe/create-portal-session
 *
 * Opens the Stripe Customer Portal for the authenticated user so they can
 * manage their subscription (upgrade, cancel, update payment method).
 * Requires a valid Supabase JWT in the Authorization header (Bearer <token>).
 *
 * Flow:
 *   1. Verify the Supabase JWT and resolve the user's stripe_customer_id.
 *   2. Create a Portal session for that customer.
 *   3. Return { url } — the client redirects the browser to the Portal.
 *
 * Env vars required: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Production URL is hardcoded so it never resolves to the Pages preview domain.
const PORTAL_RETURN_URL = "https://app.chainsolve.co.uk/app";

type Env = {
  STRIPE_SECRET_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;

    if (!STRIPE_SECRET_KEY) {
      console.error(`[portal ${reqId}] Missing STRIPE_SECRET_KEY`);
      return jsonError("Server configuration error", 500);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[portal ${reqId}] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
      return jsonError("Server configuration error", 500);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate caller via Supabase access token
    const authHeader = context.request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Missing Authorization Bearer token", 401);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error(`[portal ${reqId}] Auth failed:`, userErr?.message, userErr?.status);
      return jsonError("Authentication failed", 401);
    }
    const user = userData.user;

    // Load profile and stripe_customer_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id,stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      // Create a Stripe customer so the portal session can be opened
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

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: PORTAL_RETURN_URL,
    });

    return Response.json({ ok: true, url: portalSession.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error(`[portal ${reqId}]`, err);
    return jsonError(msg, 500);
  }
};
