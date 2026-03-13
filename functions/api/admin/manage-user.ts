/**
 * POST /api/admin/manage-user — Admin user management (7.08).
 *
 * Actions:
 *   - search:          Search users by email or display name
 *   - get_user:        Fetch user profile + billing status + projects
 *   - override_plan:   Set a user's plan (pro/student/developer)
 *   - reset_password:  Trigger a password reset email via Supabase
 *   - toggle_disabled: Enable or disable a user account
 *
 * Authorization: Bearer JWT, requires is_admin = true on caller's profile.
 * All actions are logged to audit_log.
 */

import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type Action =
  | "search"
  | "get_user"
  | "override_plan"
  | "reset_password"
  | "toggle_disabled";

interface RequestBody {
  action: Action;
  query?: string;
  user_id?: string;
  plan?: string;
  disabled?: boolean;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // ── Validate environment ───────────────────────────────────────────────────
  const missingEnv = (
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const
  ).filter((k) => !env[k]);
  if (missingEnv.length > 0) {
    return json({ ok: false, error: `Missing env: ${missingEnv.join(", ")}` }, 500);
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return json({ ok: false, error: "Authorization required" }, 401);
  }

  const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const {
    data: { user: caller },
    error: callerErr,
  } = await adminClient.auth.getUser(token);
  if (callerErr || !caller) {
    return json({ ok: false, error: "Invalid or expired token" }, 401);
  }

  // Verify is_admin
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("is_admin, is_developer")
    .eq("id", caller.id)
    .maybeSingle();

  if (!callerProfile?.is_admin && !callerProfile?.is_developer) {
    return json({ ok: false, error: "Admin role required" }, 403);
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const { action } = body;
  if (!action) {
    return json({ ok: false, error: "Missing action field" }, 400);
  }

  // ── Helper: log audit entry ────────────────────────────────────────────────
  function logAudit(
    eventType: string,
    objectId: string,
    metadata: Record<string, unknown>
  ) {
    adminClient
      .from("audit_log")
      .insert({
        user_id: caller!.id,
        event_type: eventType,
        object_type: "admin_action",
        object_id: objectId,
        metadata,
      })
      .then(() => {}, () => {});
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  if (action === "search") {
    const query = body.query?.trim();
    if (!query || query.length < 2) {
      return json({ ok: false, error: "Query must be at least 2 characters" }, 400);
    }

    // Search profiles by display_name (ilike) and also try to find by email
    // via auth admin API
    const { data: profileResults } = await adminClient
      .from("profiles")
      .select("id, display_name, plan, is_admin, is_developer, is_student, created_at")
      .or(`display_name.ilike.%${query}%`)
      .limit(20);

    // Also search auth.users by email
    const { data: authData } = await adminClient.auth.admin.listUsers({
      perPage: 20,
    });

    const emailMatches = authData?.users
      ?.filter((u) => u.email?.toLowerCase().includes(query.toLowerCase()))
      .map((u) => u.id) ?? [];

    // Merge: get profiles for email-matched users not already in results
    const existingIds = new Set((profileResults ?? []).map((p) => p.id));
    const additionalIds = emailMatches.filter((id) => !existingIds.has(id));

    let additionalProfiles: typeof profileResults = [];
    if (additionalIds.length > 0) {
      const { data } = await adminClient
        .from("profiles")
        .select("id, display_name, plan, is_admin, is_developer, is_student, created_at")
        .in("id", additionalIds);
      additionalProfiles = data ?? [];
    }

    // Attach emails from auth data
    const emailMap = new Map(
      authData?.users?.map((u) => [u.id, u.email]) ?? []
    );

    const results = [...(profileResults ?? []), ...additionalProfiles].map(
      (p) => ({
        ...p,
        email: emailMap.get(p.id) ?? null,
      })
    );

    logAudit("admin_user_search", query, { result_count: results.length });

    return json({ ok: true, users: results }, 200);
  }

  if (action === "get_user") {
    const targetId = body.user_id;
    if (!targetId) {
      return json({ ok: false, error: "Missing user_id" }, 400);
    }

    const [profileRes, projectsRes, authUserRes] = await Promise.all([
      adminClient
        .from("profiles")
        .select("*")
        .eq("id", targetId)
        .single(),
      adminClient
        .from("projects")
        .select("id, name, created_at, updated_at, is_public")
        .eq("owner_id", targetId)
        .order("created_at", { ascending: false })
        .limit(50),
      adminClient.auth.admin.getUserById(targetId),
    ]);

    if (!profileRes.data) {
      return json({ ok: false, error: "User not found" }, 404);
    }

    return json({
      ok: true,
      profile: profileRes.data,
      email: authUserRes.data?.user?.email ?? null,
      email_confirmed: authUserRes.data?.user?.email_confirmed_at != null,
      last_sign_in: authUserRes.data?.user?.last_sign_in_at ?? null,
      projects: projectsRes.data ?? [],
    }, 200);
  }

  if (action === "override_plan") {
    const targetId = body.user_id;
    const plan = body.plan;
    if (!targetId || !plan) {
      return json({ ok: false, error: "Missing user_id or plan" }, 400);
    }

    const validPlans = ["free", "trialing", "pro", "student", "enterprise", "developer"];
    if (!validPlans.includes(plan)) {
      return json({ ok: false, error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` }, 400);
    }

    const updateData: Record<string, unknown> = { plan };
    if (plan === "developer") {
      updateData.is_developer = true;
    }
    if (plan === "student") {
      updateData.is_student = true;
    }

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", targetId);

    if (updateErr) {
      return json({ ok: false, error: `Update failed: ${updateErr.message}` }, 500);
    }

    logAudit("admin_override_plan", targetId, {
      new_plan: plan,
      admin_id: caller.id,
    });

    return json({ ok: true, plan }, 200);
  }

  if (action === "reset_password") {
    const targetId = body.user_id;
    if (!targetId) {
      return json({ ok: false, error: "Missing user_id" }, 400);
    }

    // Get user's email first
    const { data: authUser } = await adminClient.auth.admin.getUserById(targetId);
    if (!authUser?.user?.email) {
      return json({ ok: false, error: "User email not found" }, 404);
    }

    // Supabase will send the password reset email
    const { error: resetErr } = await adminClient.auth.resetPasswordForEmail(
      authUser.user.email,
      { redirectTo: "https://app.chainsolve.co.uk/reset-password" }
    );

    if (resetErr) {
      return json({ ok: false, error: `Reset failed: ${resetErr.message}` }, 500);
    }

    logAudit("admin_reset_password", targetId, {
      email: authUser.user.email,
      admin_id: caller.id,
    });

    return json({ ok: true }, 200);
  }

  if (action === "toggle_disabled") {
    const targetId = body.user_id;
    const disabled = body.disabled;
    if (!targetId || disabled === undefined) {
      return json({ ok: false, error: "Missing user_id or disabled" }, 400);
    }

    if (targetId === caller.id) {
      return json({ ok: false, error: "Cannot disable your own account" }, 400);
    }

    // Use Supabase admin API to ban/unban
    const { error: banErr } = disabled
      ? await adminClient.auth.admin.updateUserById(targetId, { ban_duration: "876000h" })
      : await adminClient.auth.admin.updateUserById(targetId, { ban_duration: "none" });

    if (banErr) {
      return json({ ok: false, error: `Toggle failed: ${banErr.message}` }, 500);
    }

    logAudit("admin_toggle_disabled", targetId, {
      disabled,
      admin_id: caller.id,
    });

    return json({ ok: true, disabled }, 200);
  }

  return json({ ok: false, error: `Unknown action: ${action}` }, 400);
};
