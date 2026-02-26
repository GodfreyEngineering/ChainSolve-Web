/**
 * POST /api/report/client
 *
 * Ingests client-side observability events (errors, rejections, React
 * boundary crashes, engine diagnostics, doctor results).
 *
 * Security model:
 *   - Same-origin check: rejects requests from unknown Origins in production.
 *   - Body size cap: 32 KB.
 *   - Event type allowlist: rejects unknown event_type values.
 *   - JWT verification: if Authorization header present, verifies Supabase
 *     JWT and fills user_id. Otherwise user_id = null.
 *   - Cloudflare metadata (country, colo) filled server-side from CF headers.
 *   - Fingerprint: SHA-256(event_type | message | route_path) for dedup.
 *   - Service role writes to observability_events — never exposed to client.
 *
 * Response: 204 No Content on success; error codes on failure.
 */

import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

const MAX_BODY_BYTES = 32_768; // 32 KB

const ALLOWED_ORIGINS: readonly string[] = [
  "https://app.chainsolve.co.uk",
  "http://localhost:5173",
  "http://localhost:4173",
];

const ALLOWED_EVENT_TYPES = new Set([
  "client_error",
  "client_unhandledrejection",
  "react_errorboundary",
  "engine_diagnostics",
  "doctor_result",
]);

// ── Helpers ────────────────────────────────────────────────────────────────────

function str(v: unknown, max = 2048): string {
  if (typeof v !== "string") return "";
  return v.length > max ? v.slice(0, max) : v;
}

function safeStringRecord(v: unknown): Record<string, string> {
  if (typeof v !== "object" || v === null) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val.slice(0, 128);
  }
  return out;
}

function safeCf(v: unknown): { country?: string; colo?: string; asn?: number } {
  if (typeof v !== "object" || v === null) return {};
  const o = v as Record<string, unknown>;
  return {
    country: typeof o["country"] === "string" ? o["country"].slice(0, 8) : undefined,
    colo: typeof o["colo"] === "string" ? o["colo"].slice(0, 8) : undefined,
    asn: typeof o["asn"] === "number" ? o["asn"] : undefined,
  };
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verify a Supabase JWT and return the user's UUID, or null if invalid. */
async function resolveUserId(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const client = createClient(supabaseUrl, anonKey);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server config error", { status: 500 });
  }

  // ── Origin check (browser requests always send Origin) ─────────────────────
  const origin = context.request.headers.get("Origin");
  // CF_PAGES_ENV is set by Cloudflare Pages to "production" in prod deployments.
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

  // ── Validate event_type ────────────────────────────────────────────────────
  const eventType = str(body["event_type"]);
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return new Response("Unknown event_type", { status: 400 });
  }

  // ── Extract + sanitize fields ──────────────────────────────────────────────
  const ts = str(body["ts"]) || new Date().toISOString();
  const env = str(body["env"]).slice(0, 32) || "unknown";
  const appVersion = str(body["app_version"]).slice(0, 64);
  const routePath = str(body["route_path"]).slice(0, 512);
  const sessionId = str(body["session_id"]).slice(0, 64);
  const ua = str(body["ua"]).slice(0, 500);

  // payload: accept as-is (already redacted client-side); store as jsonb
  const payload = typeof body["payload"] === "object" ? body["payload"] : {};
  const tags = safeStringRecord(body["tags"]);
  const _clientCf = safeCf(body["cf"]);

  // ── Enrich CF data server-side (overrides client-submitted cf) ─────────────
  const cf = {
    country: context.request.headers.get("CF-IPCountry") ?? undefined,
    colo: context.request.headers.get("CF-Ray")?.split("-")[1] ?? undefined,
  };

  // ── User resolution via JWT ────────────────────────────────────────────────
  const authHeader = context.request.headers.get("Authorization");
  // Use anon key for JWT verification (reads public JWT claim, no service-role needed)
  const anonKey = (context.env as unknown as Record<string, string>)["SUPABASE_ANON_KEY"] ?? "";
  const userId = await resolveUserId(authHeader, SUPABASE_URL, anonKey);

  // ── Fingerprint (for dedup in DB) ──────────────────────────────────────────
  const payloadMsg = typeof payload === "object" && payload !== null
    ? str((payload as Record<string, unknown>)["message"])
    : "";
  const fingerprint = await sha256(`${eventType}|${payloadMsg.slice(0, 200)}|${routePath}`);

  // ── Insert ─────────────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("observability_events").insert({
    ts,
    env,
    app_version: appVersion,
    event_type: eventType,
    user_id: userId,
    session_id: sessionId || null,
    route_path: routePath,
    fingerprint,
    payload: payload ?? {},
    tags,
    cf,
  });

  if (error) {
    console.error("[obs/client] insert error:", error.message);
    return new Response("Error", { status: 500 });
  }

  return new Response(null, { status: 204 });
};
