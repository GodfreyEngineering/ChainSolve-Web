#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# db-schema.sh — Dump full schema details (columns, types, constraints)
#                for every public table via the Supabase OpenAPI definition.
#
# This uses only the REST API (no direct SQL needed), so it works with
# just the service role key.
#
# Usage:
#   SUPABASE_SERVICE_ROLE_KEY=ey... ./supabase/scripts/db-schema.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

for f in "$ROOT_DIR/.env" "$ROOT_DIR/.env.local"; do
  if [[ -f "$f" ]]; then
    set -a; source "$f"; set +a
  fi
done

SB_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
SB_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SB_URL" || -z "$SB_KEY" ]]; then
  echo "ERROR: Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" >&2
  exit 1
fi

SB_URL="${SB_URL%/}"

echo "ChainSolve Schema Dump"
echo "Project: ${SB_URL}"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Fetch the OpenAPI spec (includes all table definitions with columns + types)
SPEC=$(curl -s "${SB_URL}/rest/v1/" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  2>/dev/null)

# Extract definitions (table schemas)
echo "$SPEC" | jq -r '
  .definitions // {} | to_entries[] |
  "═══════════════════════════════════════════════════════════════════\n  TABLE: \(.key)\n═══════════════════════════════════════════════════════════════════",
  (.value.properties // {} | to_entries[] |
    "  \(.key)  (\(.value.type // .value.format // "unknown"))\(.value.description // "" | if . != "" then "  -- " + . else "" end)"
  ),
  (.value.required // [] | if length > 0 then "  [required: \(join(", "))]" else empty end),
  ""
' 2>/dev/null || echo "(could not parse OpenAPI spec)"
