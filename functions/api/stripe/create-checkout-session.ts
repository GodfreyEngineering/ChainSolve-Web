import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const onRequestPost: PagesFunction<{
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID_PRO_MONTHLY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}> = async (context) => {
  const {
    STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID_PRO_MONTHLY,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = context.env;

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Expect Supabase access token from browser
  const authHeader = context.request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return new Response("Missing Authorization Bearer token", { status: 401 });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return new Response("Invalid token", { status: 401 });
  const user = userData.user;

  // Load/create profile
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

  const origin = new URL(context.request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID_PRO_MONTHLY, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7, // Stripe supports trial_period_days via Checkout subscription_data :contentReference[oaicite:19]{index=19}
      metadata: { supabase_user_id: user.id },
    },
    success_url: `${origin}/billing/success`,
    cancel_url: `${origin}/billing/cancel`,
    allow_promotion_codes: true,
  });

  return Response.json({ url: session.url });
};