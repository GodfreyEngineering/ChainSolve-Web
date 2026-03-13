/**
 * POST /api/account/export-data — GDPR data export (7.05).
 *
 * Returns all personal data as JSON:
 *   - profile, preferences, projects (metadata), canvases (metadata),
 *     node_comments, marketplace_items, marketplace_likes, marketplace_comments,
 *     marketplace_purchases, audit_log, user_sessions, user_terms_log,
 *     student_verifications, ai_usage_monthly, ai_request_log,
 *     bug_reports, suggestions.
 *
 * Does NOT include raw canvas graph data (too large for inline JSON) —
 * the canvases section includes storage_path so the user can download
 * each graph separately.
 *
 * Rate limit: 1 export per day (checked via observability_events).
 * Authorization: Bearer JWT in Authorization header.
 */

import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // ── Validate environment ───────────────────────────────────────────────────
  const missingEnv = (
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const
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

  const adminClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const {
    data: { user },
    error: userErr,
  } = await adminClient.auth.getUser(token);
  if (userErr || !user) {
    return json({ ok: false, error: "Invalid or expired token" }, 401);
  }
  const userId = user.id;

  // ── Rate limit: 1 export per day ───────────────────────────────────────────
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentExports } = await adminClient
    .from("observability_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "data_export")
    .gte("ts", oneDayAgo);

  if (recentExports && recentExports > 0) {
    return json(
      {
        ok: false,
        error: "Data export can only be requested once per 24 hours.",
        code: "RATE_LIMITED",
      },
      429
    );
  }

  // ── Fetch all user data in parallel ────────────────────────────────────────
  const [
    profileRes,
    preferencesRes,
    projectsRes,
    canvasesRes,
    commentsRes,
    marketplaceItemsRes,
    marketplaceLikesRes,
    marketplaceCommentsRes,
    marketplacePurchasesRes,
    auditLogRes,
    sessionsRes,
    termsLogRes,
    studentVerifRes,
    aiUsageRes,
    aiRequestLogRes,
    bugReportsRes,
    suggestionsRes,
    orgMembershipsRes,
  ] = await Promise.all([
    adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single(),
    adminClient
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single(),
    adminClient
      .from("projects")
      .select("id, name, description, created_at, updated_at, is_public, storage_path")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("canvases")
      .select("id, project_id, name, sort_order, created_at, updated_at, storage_path")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("node_comments")
      .select("id, project_id, canvas_id, node_id, body, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("marketplace_items")
      .select("id, title, description, category, tags, price_cents, currency, status, created_at, updated_at")
      .eq("author_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("marketplace_likes")
      .select("item_id, created_at")
      .eq("user_id", userId),
    adminClient
      .from("marketplace_comments")
      .select("id, item_id, body, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("marketplace_purchases")
      .select("id, item_id, amount_cents, currency, created_at")
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("audit_log")
      .select("id, action, details, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    adminClient
      .from("user_sessions")
      .select("id, ip_address, user_agent, created_at, last_seen_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("user_terms_log")
      .select("id, version, accepted_at")
      .eq("user_id", userId),
    adminClient
      .from("student_verifications")
      .select("id, email, institution, status, created_at, verified_at")
      .eq("user_id", userId),
    adminClient
      .from("ai_usage_monthly")
      .select("month, input_tokens, output_tokens, request_count")
      .eq("user_id", userId)
      .order("month", { ascending: false }),
    adminClient
      .from("ai_request_log")
      .select("id, task, mode, model, input_tokens, output_tokens, risk_level, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    adminClient
      .from("bug_reports")
      .select("id, title, body, category, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("suggestions")
      .select("id, title, body, category, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("org_members")
      .select("org_id, role, joined_at")
      .eq("user_id", userId),
  ]);

  // ── Build export ───────────────────────────────────────────────────────────
  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    email: user.email,
    profile: profileRes.data ?? null,
    preferences: preferencesRes.data ?? null,
    projects: projectsRes.data ?? [],
    canvases: canvasesRes.data ?? [],
    node_comments: commentsRes.data ?? [],
    marketplace_items: marketplaceItemsRes.data ?? [],
    marketplace_likes: marketplaceLikesRes.data ?? [],
    marketplace_comments: marketplaceCommentsRes.data ?? [],
    marketplace_purchases: marketplacePurchasesRes.data ?? [],
    audit_log: auditLogRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    terms_accepted: termsLogRes.data ?? [],
    student_verifications: studentVerifRes.data ?? [],
    ai_usage: aiUsageRes.data ?? [],
    ai_request_log: aiRequestLogRes.data ?? [],
    bug_reports: bugReportsRes.data ?? [],
    suggestions: suggestionsRes.data ?? [],
    org_memberships: orgMembershipsRes.data ?? [],
    _note:
      "Canvas graph data is not included inline due to size. " +
      "Use the storage_path in each canvas record to download the graph separately.",
  };

  // ── Log the export event (fire-and-forget) ─────────────────────────────────
  adminClient
    .from("observability_events")
    .insert({
      ts: new Date().toISOString(),
      env: "production",
      event_type: "data_export",
      user_id: userId,
      payload: {
        endpoint: "/api/account/export-data",
        tables_exported: Object.keys(exportData).length,
      },
    })
    .then(
      () => {
        /* fire-and-forget */
      },
      () => {
        /* non-fatal */
      }
    );

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="chainsolve-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
