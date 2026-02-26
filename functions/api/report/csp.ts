/**
 * POST /api/report/csp
 *
 * Receives Content-Security-Policy violation reports.
 *
 * Accepts both:
 *   - application/reports+json  (Reporting API v1 — array of report objects)
 *   - application/csp-report    (legacy CSP Level 2 — single object)
 *   - application/json          (fallback)
 *
 * Sanitization:
 *   - Drop "sample" field entirely (may contain code snippets).
 *   - Truncate blockedUrl to origin+path only (no query).
 *   - Truncate documentUrl to path only.
 *   - Hard-limit array to 10 reports per request.
 *   - Store as event_type='csp_violation' in observability_events.
 *
 * No Origin check required: CSP reports are browser-initiated fire-and-forget
 * requests that may not include an Origin header.
 *
 * NOTE: This endpoint replaces /api/security/csp-report as the active target
 * for the Reporting-Endpoints header. The old endpoint remains in place but
 * receives no new traffic after _headers is updated.
 */

import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

const MAX_BODY_BYTES = 32_768;
const MAX_REPORTS_PER_REQUEST = 10;

// ── Helpers ────────────────────────────────────────────────────────────────────

function str(v: unknown, max = 2000): string {
  if (typeof v !== "string") return "";
  return v.length > max ? v.slice(0, max) : v;
}

/** Strip querystring + fragment from a URL, keeping only origin+path. */
function sanitizeUrl(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`.slice(0, 2000);
  } catch {
    const q = raw.indexOf("?");
    const h = raw.indexOf("#");
    const cut = Math.min(q >= 0 ? q : raw.length, h >= 0 ? h : raw.length);
    return raw.slice(0, cut).slice(0, 2000);
  }
}

/** Return only the pathname from a URL. */
function pathOnly(raw: string): string {
  if (!raw) return "";
  try {
    return new URL(raw).pathname.slice(0, 512);
  } catch {
    return sanitizeUrl(raw);
  }
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface CspReport {
  effectiveDirective: string;
  blockedUrl: string;
  documentUrl: string;
  disposition: string;
  statusCode?: number;
}

function parseReportingApiReport(raw: unknown): CspReport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  // Reporting API v1: { type, url, body: { effectiveDirective, blockedURL, ... } }
  const body = (r["body"] ?? r) as Record<string, unknown>;
  const effectiveDirective = str(body["effectiveDirective"] ?? body["effective-directive"]);
  if (!effectiveDirective) return null;
  return {
    effectiveDirective: effectiveDirective.slice(0, 200),
    blockedUrl: sanitizeUrl(str(body["blockedURL"] ?? body["blocked-uri"])),
    documentUrl: pathOnly(str(body["documentURL"] ?? body["document-uri"])),
    disposition: str(body["disposition"]).slice(0, 50) || "enforce",
    statusCode: typeof body["statusCode"] === "number" ? body["statusCode"] : undefined,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server config error", { status: 500 });
  }

  // ── Content-Type ───────────────────────────────────────────────────────────
  const ct = (context.request.headers.get("Content-Type") ?? "").toLowerCase();
  const validTypes = ["application/csp-report", "application/json", "application/reports+json"];
  if (!validTypes.some((t) => ct.includes(t))) {
    return new Response("Unsupported Content-Type", { status: 415 });
  }

  // ── Body ───────────────────────────────────────────────────────────────────
  const raw = await context.request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Normalize to array of reports ──────────────────────────────────────────
  let rawReports: unknown[];
  if (Array.isArray(body)) {
    rawReports = body.slice(0, MAX_REPORTS_PER_REQUEST);
  } else {
    // Legacy format or single object
    const obj = body as Record<string, unknown>;
    const unwrapped = obj["csp-report"] ?? obj;
    rawReports = [unwrapped];
  }

  const cf = {
    country: context.request.headers.get("CF-IPCountry") ?? undefined,
    colo: context.request.headers.get("CF-Ray")?.split("-")[1] ?? undefined,
  };
  const ua = (context.request.headers.get("User-Agent") ?? "").slice(0, 500);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Process each report ────────────────────────────────────────────────────
  for (const rawReport of rawReports) {
    const report = parseReportingApiReport(rawReport);
    if (!report) continue;

    // Minute-bucket dedup (same as old endpoint)
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const fingerprint = await sha256(
      `${report.effectiveDirective}|${report.blockedUrl}|${report.documentUrl}|${minuteBucket}`,
    );

    const { error } = await supabase.from("observability_events").insert({
      ts: new Date().toISOString(),
      env: "production", // CSP reports always come from live pages
      app_version: "",   // unknown in this context
      event_type: "csp_violation",
      user_id: null,     // CSP reports carry no auth token
      session_id: null,
      route_path: report.documentUrl,
      fingerprint,
      payload: {
        effectiveDirective: report.effectiveDirective,
        blockedUrl: report.blockedUrl,
        documentUrl: report.documentUrl,
        disposition: report.disposition,
        statusCode: report.statusCode,
        ua,
      },
      tags: {},
      cf,
    });

    if (error && error.code !== "23505") {
      // 23505 = unique_violation (fingerprint dedup); expected and harmless
      console.error("[obs/csp] insert error:", error.message);
    }
  }

  return new Response(null, { status: 204 });
};
