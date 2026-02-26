/**
 * GET /api/readyz
 *
 * Readiness check. Verifies that external dependencies (Supabase) are
 * reachable before declaring the service ready.
 *
 * Response:
 *   200  { ok: true,  checks: { supabase: true }  }
 *   503  { ok: false, checks: { supabase: false } }
 *
 * Usage:
 *   curl https://app.chainsolve.co.uk/api/readyz
 */

import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

async function checkSupabase(url: string, key: string): Promise<boolean> {
  try {
    const supabase = createClient(url, key);
    // A lightweight query that returns quickly regardless of data
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();
    // PGRST116 = "no rows" — that's fine; it means DB is up
    if (error && error.code !== "PGRST116") return false;
    return true;
  } catch {
    return false;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { ok: false, checks: { supabase: false }, error: "missing_config" },
      { status: 503 },
    );
  }

  const supabaseOk = await checkSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const ok = supabaseOk;

  return Response.json(
    { ok, checks: { supabase: supabaseOk }, ts: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
};
