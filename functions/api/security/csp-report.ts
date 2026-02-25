/**
 * CSP violation report receiver.
 *
 * Browsers POST here when Content-Security-Policy or
 * Content-Security-Policy-Report-Only is violated.
 *
 * - Accepts application/csp-report (legacy) and application/json (Reporting API v1).
 * - Deduplicates via SHA-256 of (violated_directive + blocked_uri + document_uri + minute).
 * - Uses service_role to bypass RLS (browser requests carry no auth token).
 * - Limits body to 16 KB to prevent abuse.
 */

import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

const MAX_BODY_BYTES = 16_384; // 16 KB

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server config error", { status: 500 });
  }

  // ── Validate Content-Type ───────────────────────────────────────────────
  const ct = (context.request.headers.get("Content-Type") ?? "").toLowerCase();
  const validTypes = [
    "application/csp-report",
    "application/json",
    "application/reports+json",
  ];
  if (!validTypes.some((t) => ct.includes(t))) {
    return new Response("Unsupported Content-Type", { status: 415 });
  }

  // ── Read body with size limit ───────────────────────────────────────────
  const raw = await context.request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Parse report ────────────────────────────────────────────────────────
  // Legacy format wraps in {"csp-report": {...}}, Reporting API sends directly.
  const report = (body["csp-report"] ?? body) as Record<string, unknown>;

  const violatedDirective = str(report["violated-directive"]);
  const blockedUri = str(report["blocked-uri"]);
  const documentUri = str(report["document-uri"]);
  const effectiveDirective = str(report["effective-directive"]);
  const originalPolicy = str(report["original-policy"]);
  const referrer = str(report["referrer"]);
  const disposition = str(report["disposition"]);
  const userAgent = context.request.headers.get("User-Agent") ?? "";
  const page = context.request.headers.get("Referer") ?? documentUri;

  // ── Dedup key: SHA-256(key fields + minute bucket) ──────────────────────
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const dedupInput = `${violatedDirective}|${blockedUri}|${documentUri}|${minuteBucket}`;
  const dedupKey = await sha256(dedupInput);

  // ── Insert (skip duplicates via UNIQUE constraint) ──────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("csp_reports").upsert(
    {
      page: trunc(page, 2000),
      document_uri: trunc(documentUri, 2000),
      referrer: trunc(referrer, 2000),
      violated_directive: trunc(violatedDirective, 500),
      effective_directive: trunc(effectiveDirective, 500),
      original_policy: trunc(originalPolicy, 4000),
      blocked_uri: trunc(blockedUri, 2000),
      disposition: trunc(disposition, 100),
      user_agent: trunc(userAgent, 500),
      raw: body,
      dedup_key: dedupKey,
    },
    { onConflict: "dedup_key", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[csp-report] Insert error:", error.message);
    return new Response("Error", { status: 500 });
  }

  return new Response(null, { status: 204 });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
