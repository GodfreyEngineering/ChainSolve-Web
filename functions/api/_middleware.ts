/**
 * CORS middleware for all /api/* routes.
 *
 * Allowed origins are hardcoded to production + local dev.
 * Stripe webhook requests (server-to-server, no Origin header) pass through
 * without CORS headers — this is correct because CORS is a browser mechanism.
 *
 * To add staging: append to ALLOWED_ORIGINS or read from env.
 */

const ALLOWED_ORIGINS: readonly string[] = [
  "https://app.chainsolve.co.uk",
  // TODO: add staging when available
  // "https://staging.app.chainsolve.co.uk",
  "http://localhost:5173", // Vite dev server
];

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export const onRequest: PagesFunction = async (context) => {
  const origin = context.request.headers.get("Origin");
  const isAllowed = origin !== null && ALLOWED_ORIGINS.includes(origin);

  // ── Preflight ─────────────────────────────────────────────────────────────
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(isAllowed ? corsHeaders(origin) : {}),
        Vary: "Origin",
      },
    });
  }

  // ── Normal request ────────────────────────────────────────────────────────
  const response = await context.next();

  // Clone to get mutable headers (response from next() may be immutable)
  const res = new Response(response.body, response);
  res.headers.set("Vary", "Origin");

  if (isAllowed) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      res.headers.set(k, v);
    }
  }

  return res;
};
