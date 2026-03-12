/**
 * workers/save-alert/index.ts — Daily save failure rate alert (OBS-03).
 *
 * A standalone Cloudflare Worker with a daily cron trigger that calls
 * GET /api/admin/save-alert-check on the main app. When the endpoint
 * returns alert_triggered: true, the response is logged to Workers
 * Logpush and an admin_alert event is recorded in observability_events
 * (handled by the endpoint itself).
 *
 * Deploy via wrangler.toml in this directory:
 *   wrangler deploy
 *
 * Required secrets (set via `wrangler secret put`):
 *   APP_BASE_URL   — e.g. https://app.chainsolve.co.uk
 *   ADMIN_API_KEY  — a service-role-style static token for cron auth
 *                    (configure as Bearer token for a dedicated admin account)
 */

export interface Env {
  APP_BASE_URL: string;
  ADMIN_API_KEY: string;
}

export default {
  /**
   * Scheduled handler — runs once per day at 06:00 UTC.
   * Cron schedule configured in wrangler.toml: "0 6 * * *"
   */
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const baseUrl = env.APP_BASE_URL?.replace(/\/$/, "");
    if (!baseUrl) {
      console.error("[save-alert] APP_BASE_URL not configured");
      return;
    }

    const url = `${baseUrl}/api/admin/save-alert-check`;
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.ADMIN_API_KEY}`,
        },
      });

      if (!resp.ok) {
        console.error(`[save-alert] check endpoint returned HTTP ${resp.status}`);
        return;
      }

      const result = (await resp.json()) as {
        alert_triggered: boolean;
        total_saves: number;
        total_failures: number;
        overall_failure_rate: number;
        alert_windows: unknown[];
      };

      if (result.alert_triggered) {
        // Workers Logpush will capture this as a structured log entry.
        console.error(
          "[save-alert] ALERT: save failure rate exceeded 1% threshold",
          JSON.stringify({
            total_saves: result.total_saves,
            total_failures: result.total_failures,
            overall_failure_rate: result.overall_failure_rate,
            alert_windows: result.alert_windows,
          }),
        );
      } else {
        console.log(
          `[save-alert] OK: ${result.total_saves} saves, ` +
            `${result.total_failures} failures (${(result.overall_failure_rate * 100).toFixed(2)}%)`,
        );
      }
    } catch (err) {
      console.error("[save-alert] fetch error:", String(err));
    }
  },
};
