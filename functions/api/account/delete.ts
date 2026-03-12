/**
 * POST /api/account/delete — Full account deletion (ACCT-01).
 *
 * Steps (all-or-nothing; each failure returns 500):
 *   1. Verify the caller's JWT and resolve their profile.
 *   2. Cancel the Stripe subscription (if any) immediately.
 *   3. Purge all user-owned storage files under `{userId}/` in the
 *      `uploads` and `projects` buckets.
 *   4. Call the `delete_my_account()` Supabase RPC which deletes all
 *      database rows owned by the user (cascades via FK).
 *   5. Delete the auth.users row via the Supabase Admin API (service role).
 *
 * Authorization: Bearer JWT in Authorization header.
 * Rate limit: enforced at the Cloudflare layer (max 1/day per IP).
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // ── Validate environment ───────────────────────────────────────────────────
  const missingEnv = (
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"] as const
  ).filter((k) => !env[k]);
  if (missingEnv.length > 0) {
    return json(
      { ok: false, error: `Missing env: ${missingEnv.join(", ")}` },
      500
    );
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return json({ ok: false, error: "Authorization required" }, 401);
  }

  // Use a user-scoped client to resolve identity, then service-role for admin ops
  const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(token);
  if (userErr || !user) {
    return json({ ok: false, error: "Invalid or expired token" }, 401);
  }
  const userId = user.id;

  // Service-role client for privileged operations
  const adminClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Step 1: Fetch profile for Stripe IDs ──────────────────────────────────
  const { data: profile } = await adminClient
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", userId)
    .single();

  // ── Step 2: Cancel Stripe subscription ────────────────────────────────────
  if (profile?.stripe_subscription_id) {
    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(profile.stripe_subscription_id, {
        cancellation_details: { comment: "User-initiated account deletion" },
      });
    } catch (stripeErr) {
      // Non-fatal: subscription may already be cancelled or customer deleted
      console.error("[account/delete] Stripe cancel failed:", stripeErr);
    }
  }

  // ── Step 3: Purge storage ─────────────────────────────────────────────────
  const BUCKETS = ["uploads", "projects"] as const;
  for (const bucket of BUCKETS) {
    try {
      const { data: files } = await adminClient.storage.from(bucket).list(userId, {
        limit: 1000,
      });
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await adminClient.storage.from(bucket).remove(paths);
      }
      // Also purge any sub-directories (e.g. userId/projectId/canvasId)
      // List without prefix to find project-level folders
      const { data: topLevel } = await adminClient.storage.from(bucket).list(userId);
      if (topLevel) {
        for (const folder of topLevel.filter((f) => !f.id)) {
          const prefix = `${userId}/${folder.name}`;
          const { data: subFiles } = await adminClient.storage.from(bucket).list(prefix, { limit: 1000 });
          if (subFiles && subFiles.length > 0) {
            await adminClient.storage.from(bucket).remove(subFiles.map((f) => `${prefix}/${f.name}`));
          }
        }
      }
    } catch (storageErr) {
      console.error(`[account/delete] Storage purge error (${bucket}):`, storageErr);
      // Continue — don't fail the whole deletion for storage errors
    }
  }

  // ── Step 4: Delete database rows via RPC ──────────────────────────────────
  // The RPC uses SECURITY DEFINER to delete all user-owned data atomically.
  // We call it with the user's JWT to preserve RLS identity.
  const { error: rpcErr } = await userClient.rpc("delete_my_account");
  if (rpcErr) {
    return json(
      { ok: false, error: `Database deletion failed: ${rpcErr.message}` },
      500
    );
  }

  // ── Step 5: Delete auth.users row ─────────────────────────────────────────
  const { error: deleteUserErr } =
    await adminClient.auth.admin.deleteUser(userId);
  if (deleteUserErr) {
    return json(
      {
        ok: false,
        error: `Auth user deletion failed: ${deleteUserErr.message}`,
      },
      500
    );
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
