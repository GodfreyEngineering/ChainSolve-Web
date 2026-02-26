/**
 * GET /api/healthz
 *
 * Lightweight liveness check. No external dependencies.
 * Returns app_version and env so monitors can detect stale deployments.
 *
 * Response:
 *   200 { ok: true, app_version: string, env: string, ts: string }
 *
 * Usage:
 *   curl https://app.chainsolve.co.uk/api/healthz
 */

type Env = Record<string, string>;

export const onRequestGet: PagesFunction<Env> = (context) => {
  const appVersion = context.env["CF_PAGES_COMMIT_SHA"] ?? "unknown";
  const env = context.env["CF_PAGES_ENV"] ?? "unknown";

  return Response.json({
    ok: true,
    app_version: appVersion.slice(0, 40),
    env,
    ts: new Date().toISOString(),
  });
};
