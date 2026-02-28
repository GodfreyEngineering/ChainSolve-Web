/**
 * POST /api/stripe/marketplace-checkout
 *
 * Creates a Stripe Connect Checkout session so a buyer can purchase
 * a paid marketplace item.  Revenue is transferred to the author's
 * connected Stripe Express account, less a platform fee.
 *
 * Request body (JSON): { item_id: string }
 * Response (JSON):     { ok: true, url: string }   — hosted Checkout URL
 *                      { ok: false, error: string } — 4xx / 5xx
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   MARKETPLACE_PLATFORM_FEE_RATE — decimal 0–1, default 0.15 (15 %)
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { jsonError } from "./_lib";

// Production origin used for redirect URLs.
const APP_ORIGIN = "https://app.chainsolve.co.uk";

/** Fraction of each sale retained as platform revenue. */
export const DEFAULT_PLATFORM_FEE_RATE = 0.15;

/**
 * Compute the application-fee amount in the smallest currency unit (pence/cents).
 * Exported so it can be unit-tested independently of the Worker runtime.
 */
export function computeApplicationFee(priceCents: number, feeRate: number): number {
  return Math.round(priceCents * feeRate);
}

type Env = {
  STRIPE_SECRET_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MARKETPLACE_PLATFORM_FEE_RATE?: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MARKETPLACE_PLATFORM_FEE_RATE } =
      context.env;

    if (!STRIPE_SECRET_KEY) {
      console.error(`[mkt-checkout ${reqId}] Missing STRIPE_SECRET_KEY`);
      return jsonError("Server configuration error", 500);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[mkt-checkout ${reqId}] Missing Supabase env vars`);
      return jsonError("Server configuration error", 500);
    }

    const feeRate = MARKETPLACE_PLATFORM_FEE_RATE
      ? parseFloat(MARKETPLACE_PLATFORM_FEE_RATE)
      : DEFAULT_PLATFORM_FEE_RATE;

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Authenticate the buyer ─────────────────────────────────────────────
    const authHeader = context.request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Missing Authorization Bearer token", 401);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error(`[mkt-checkout ${reqId}] Auth failed:`, userErr?.message);
      return jsonError("Authentication failed", 401);
    }
    const buyer = userData.user;

    // ── 2. Parse and validate body ───────────────────────────────────────────
    let body: { item_id?: string };
    try {
      body = (await context.request.json()) as { item_id?: string };
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const itemId = body.item_id;
    if (!itemId || typeof itemId !== "string") {
      return jsonError("item_id is required", 400);
    }

    // ── 3. Fetch item ────────────────────────────────────────────────────────
    const { data: item, error: itemErr } = await supabaseAdmin
      .from("marketplace_items")
      .select("id, name, price_cents, author_id, is_published, review_status")
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr) {
      console.error(`[mkt-checkout ${reqId}] item fetch error:`, itemErr.message);
      return jsonError("Failed to load item", 500);
    }
    if (!item) return jsonError("Item not found", 404);
    if (!item.is_published || item.review_status !== "approved") {
      return jsonError("Item is not available for purchase", 400);
    }
    if ((item.price_cents as number) <= 0) {
      return jsonError("Item is free — use the install endpoint instead", 400);
    }

    // Prevent self-purchase
    if (item.author_id === buyer.id) {
      return jsonError("Authors cannot purchase their own items", 400);
    }

    // ── 4. Fetch author's Stripe account ─────────────────────────────────────
    const { data: authorProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id, stripe_onboarded")
      .eq("id", item.author_id)
      .maybeSingle();

    if (profileErr) {
      console.error(`[mkt-checkout ${reqId}] profile fetch error:`, profileErr.message);
      return jsonError("Failed to load author profile", 500);
    }
    if (!authorProfile?.stripe_onboarded || !authorProfile?.stripe_account_id) {
      return jsonError("Author has not connected a Stripe account", 402);
    }

    // ── 5. Create Checkout session ───────────────────────────────────────────
    const priceCents = item.price_cents as number;
    const appFee = computeApplicationFee(priceCents, feeRate);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: priceCents,
            product_data: { name: item.name as string },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: appFee,
        transfer_data: { destination: authorProfile.stripe_account_id },
        metadata: {
          item_id: itemId,
          buyer_id: buyer.id,
        },
      },
      success_url: `${APP_ORIGIN}/marketplace/items/${itemId}?purchase=success`,
      cancel_url:  `${APP_ORIGIN}/marketplace/items/${itemId}`,
    });

    return Response.json({ ok: true, url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error(`[mkt-checkout ${reqId}]`, err);
    return jsonError(msg, 500);
  }
};
