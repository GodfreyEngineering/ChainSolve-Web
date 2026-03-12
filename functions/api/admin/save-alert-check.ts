/**
 * GET /api/admin/save-alert-check
 *
 * OBS-03: Admin-only endpoint that queries the last 24 hours of
 * save / save_failure events and identifies any 5-minute window
 * where the failure rate exceeded 1%.
 *
 * When a high-failure window is found, records an admin_alert event
 * in observability_events so it surfaces in monitoring dashboards.
 * Also returns the alert data in the JSON response.
 *
 * Designed to be called by a daily Cloudflare Worker cron trigger
 * (see workers/save-alert/wrangler.toml) or manually by an admin.
 *
 * Authorization: requires a valid Supabase JWT where the user's
 * profile has is_admin = true.
 */

import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY?: string;
};

const ALLOWED_ORIGINS: readonly string[] = [
  "https://app.chainsolve.co.uk",
  "http://localhost:5173",
  "http://localhost:4173",
];

/** 5-minute bucket width in milliseconds. */
const BUCKET_MS = 5 * 60 * 1000;

/** Failure rate threshold that triggers an alert. */
const ALERT_THRESHOLD = 0.01; // 1%

/** Minimum saves in a window to consider the failure rate meaningful. */
const MIN_SAVES_FOR_ALERT = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaveWindow {
  bucket: string; // ISO timestamp of window start
  saves: number;
  failures: number;
  failure_rate: number;
}

interface AlertResult {
  checked_at: string;
  since: string;
  total_saves: number;
  total_failures: number;
  overall_failure_rate: number;
  windows_checked: number;
  alert_windows: SaveWindow[];
  alert_triggered: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveAdminUser(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const anonClient = createClient(supabaseUrl, anonKey);
    const {
      data: { user },
      error,
    } = await anonClient.auth.getUser(token);
    if (error || !user) return null;

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) return null;
    return user.id;
  } catch {
    return null;
  }
}

function floorToBucket(ts: string): number {
  return Math.floor(new Date(ts).getTime() / BUCKET_MS) * BUCKET_MS;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server config error", { status: 500 });
  }

  // ── CORS ───────────────────────────────────────────────────────────────────
  const origin = context.request.headers.get("Origin");
  const cfEnv = (context.env as unknown as Record<string, string>)["CF_PAGES_ENV"];
  const isProd = cfEnv === "production";
  if (isProd && (origin === null || !ALLOWED_ORIGINS.includes(origin))) {
    return new Response("Forbidden", { status: 403 });
  }

  // ── Auth: require is_admin ─────────────────────────────────────────────────
  const anonKey = (context.env as unknown as Record<string, string>)["SUPABASE_ANON_KEY"] ?? "";
  const adminId = await resolveAdminUser(
    context.request.headers.get("Authorization"),
    SUPABASE_URL,
    anonKey,
    SUPABASE_SERVICE_ROLE_KEY,
  );
  if (!adminId) {
    return new Response("Forbidden", { status: 403 });
  }

  // ── Query last 24h of save and save_failure events ────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: rows, error: queryError } = await serviceClient
    .from("observability_events")
    .select("ts, payload")
    .eq("event_type", "rum_timing")
    .in("payload->>event_name", ["save", "save_failure"])
    .gte("ts", since)
    .order("ts", { ascending: true });

  if (queryError) {
    console.error("[admin/save-alert-check] query error:", queryError.message);
    return new Response("Query error", { status: 500 });
  }

  // ── Aggregate into 5-minute buckets ───────────────────────────────────────
  const buckets = new Map<number, { saves: number; failures: number }>();

  let totalSaves = 0;
  let totalFailures = 0;

  for (const row of rows ?? []) {
    const p = row.payload as Record<string, unknown> | null;
    if (!p) continue;
    const eventName = p["event_name"];
    const bucket = floorToBucket(row.ts as string);
    if (!buckets.has(bucket)) buckets.set(bucket, { saves: 0, failures: 0 });
    const b = buckets.get(bucket)!;
    if (eventName === "save") {
      b.saves++;
      totalSaves++;
    } else if (eventName === "save_failure") {
      b.failures++;
      b.saves++; // failure counts as an attempted save for rate calculation
      totalSaves++;
      totalFailures++;
    }
  }

  // ── Find windows exceeding alert threshold ────────────────────────────────
  const alertWindows: SaveWindow[] = [];
  for (const [bucketMs, { saves, failures }] of buckets) {
    if (saves < MIN_SAVES_FOR_ALERT) continue;
    const rate = failures / saves;
    if (rate > ALERT_THRESHOLD) {
      alertWindows.push({
        bucket: new Date(bucketMs).toISOString(),
        saves,
        failures,
        failure_rate: Math.round(rate * 10000) / 10000,
      });
    }
  }

  const overallRate = totalSaves > 0 ? totalFailures / totalSaves : 0;
  const alertTriggered = alertWindows.length > 0;

  const result: AlertResult = {
    checked_at: new Date().toISOString(),
    since,
    total_saves: totalSaves,
    total_failures: totalFailures,
    overall_failure_rate: Math.round(overallRate * 10000) / 10000,
    windows_checked: buckets.size,
    alert_windows: alertWindows,
    alert_triggered: alertTriggered,
  };

  // ── Record alert in observability_events when triggered ───────────────────
  if (alertTriggered) {
    console.error(
      `[admin/save-alert-check] ALERT: ${alertWindows.length} window(s) exceeded 1% save failure rate`,
      JSON.stringify(alertWindows),
    );
    await serviceClient.from("observability_events").insert({
      ts: result.checked_at,
      env: "production",
      app_version: "cron",
      event_type: "admin_alert",
      user_id: null,
      session_id: null,
      route_path: "/api/admin/save-alert-check",
      fingerprint: null,
      payload: {
        alert_type: "save_failure_rate",
        alert_windows: alertWindows,
        total_saves: totalSaves,
        total_failures: totalFailures,
        overall_failure_rate: result.overall_failure_rate,
      },
      tags: { triggered_by: "cron" },
      cf: {},
    });
  }

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
  };
  if (origin) responseHeaders["Access-Control-Allow-Origin"] = origin;

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: responseHeaders,
  });
};
