/**
 * POST /api/observability/vitals
 *
 * Ingests Core Web Vitals (LCP, CLS, INP) from the client.
 * Stores each metric as an observability_events row with
 * event_type = 'web_vitals'.
 *
 * Security:
 *   - Same-origin check in production.
 *   - Body size cap: 4 KB (vitals payloads are tiny).
 *   - Metric name allowlist.
 *   - JWT verification for user_id (best-effort).
 */

import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY?: string;
};

const MAX_BODY_BYTES = 4_096;

const ALLOWED_ORIGINS: readonly string[] = [
  "https://app.chainsolve.co.uk",
  "http://localhost:5173",
  "http://localhost:4173",
];

const ALLOWED_METRICS = new Set(["LCP", "CLS", "INP"]);
const ALLOWED_RATINGS = new Set(["good", "needs-improvement", "poor"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown, max = 256): string {
  if (typeof v !== "string") return "";
  return v.length > max ? v.slice(0, max) : v;
}

async function resolveUserId(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const client = createClient(supabaseUrl, anonKey);
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server config error", { status: 500 });
  }

  // ── Origin check ───────────────────────────────────────────────────────────
  const origin = context.request.headers.get("Origin");
  const cfEnv = (context.env as unknown as Record<string, string>)["CF_PAGES_ENV"];
  const isProd = cfEnv === "production";
  if (isProd && (origin === null || !ALLOWED_ORIGINS.includes(origin))) {
    return new Response("Forbidden", { status: 403 });
  }

  // ── Body size ──────────────────────────────────────────────────────────────
  const raw = await context.request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  // ── Parse ──────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Extract payload ────────────────────────────────────────────────────────
  const payload =
    typeof body["payload"] === "object" && body["payload"] !== null
      ? (body["payload"] as Record<string, unknown>)
      : {};

  const metricName = str(payload["metric_name"]);
  if (!ALLOWED_METRICS.has(metricName)) {
    return new Response("Unknown metric", { status: 400 });
  }

  const value = typeof payload["value"] === "number" ? payload["value"] : null;
  if (value === null || !Number.isFinite(value)) {
    return new Response("Invalid value", { status: 400 });
  }

  const rating = str(payload["rating"]);
  const safeRating = ALLOWED_RATINGS.has(rating) ? rating : "unknown";
  const navigationType = str(payload["navigation_type"]).slice(0, 64);

  const ts = str(body["ts"]) || new Date().toISOString();
  const env = str(body["env"]).slice(0, 32) || "unknown";
  const appVersion = str(body["app_version"]).slice(0, 64);
  const routePath = str(body["route_path"]).slice(0, 512);
  const sessionId = str(body["session_id"]).slice(0, 64);

  // ── CF metadata ────────────────────────────────────────────────────────────
  const cf = {
    country: context.request.headers.get("CF-IPCountry") ?? undefined,
    colo: context.request.headers.get("CF-Ray")?.split("-")[1] ?? undefined,
  };

  // ── User resolution ────────────────────────────────────────────────────────
  const authHeader = context.request.headers.get("Authorization");
  const anonKey = (context.env as unknown as Record<string, string>)["SUPABASE_ANON_KEY"] ?? "";
  const userId = await resolveUserId(authHeader, SUPABASE_URL, anonKey);

  // ── Insert ─────────────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("observability_events").insert({
    ts,
    env,
    app_version: appVersion,
    event_type: "web_vitals",
    user_id: userId,
    session_id: sessionId || null,
    route_path: routePath,
    fingerprint: null, // vitals are not deduplicated
    payload: {
      metric_name: metricName,
      value,
      rating: safeRating,
      navigation_type: navigationType,
    },
    tags: {},
    cf,
  });

  if (error) {
    console.error("[obs/vitals] insert error:", error.message);
    return new Response("Error", { status: 500 });
  }

  return new Response(null, { status: 204 });
};
