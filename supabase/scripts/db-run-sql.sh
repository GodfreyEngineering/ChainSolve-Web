#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# db-run-sql.sh — Run arbitrary SQL against the live Supabase instance.
#
# Uses the Supabase pg-meta SQL endpoint (available on all hosted projects).
#
# Usage:
#   # Inline SQL:
#   SUPABASE_SERVICE_ROLE_KEY=ey... ./supabase/scripts/db-run-sql.sh \
#     "SELECT count(*) FROM public.profiles"
#
#   # From a file:
#   SUPABASE_SERVICE_ROLE_KEY=ey... ./supabase/scripts/db-run-sql.sh \
#     --file supabase/migrations/0011_schema_hardening.sql
#
#   # Pipe from stdin:
#   echo "SELECT 1" | SUPABASE_SERVICE_ROLE_KEY=ey... \
#     ./supabase/scripts/db-run-sql.sh --stdin
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

# Parse args
SQL=""
if [[ "${1:-}" == "--file" ]]; then
  if [[ -z "${2:-}" ]]; then
    echo "ERROR: --file requires a path argument" >&2
    exit 1
  fi
  SQL=$(cat "$2")
elif [[ "${1:-}" == "--stdin" ]]; then
  SQL=$(cat)
elif [[ -n "${1:-}" ]]; then
  SQL="$1"
else
  echo "Usage: $0 <sql> | --file <path> | --stdin" >&2
  exit 1
fi

# Extract project ref from URL (e.g., https://abc123.supabase.co -> abc123)
PROJECT_REF=$(echo "$SB_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

# Try the pg-meta SQL endpoint (available on hosted Supabase)
# This endpoint is: POST /pg-meta/default/query
echo "Running SQL against ${SB_URL} ..."
echo ""

response=$(curl -s -w "\n---HTTP_STATUS:%{http_code}" \
  "${SB_URL}/pg/query" \
  -X POST \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | jq -Rs .)}" \
  2>/dev/null)

http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
body=$(echo "$response" | sed '/---HTTP_STATUS:/d')

if [[ "$http_status" == "200" ]] || [[ "$http_status" == "201" ]]; then
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
  echo "pg/query failed (HTTP $http_status), trying Management API..."

  # Fallback: Supabase Management API
  # POST https://api.supabase.com/v1/projects/{ref}/database/query
  response2=$(curl -s -w "\n---HTTP_STATUS:%{http_code}" \
    "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -X POST \
    -H "Authorization: Bearer ${SB_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$SQL" | jq -Rs .)}" \
    2>/dev/null)

  http_status2=$(echo "$response2" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
  body2=$(echo "$response2" | sed '/---HTTP_STATUS:/d')

  if [[ "$http_status2" == "200" ]] || [[ "$http_status2" == "201" ]]; then
    echo "$body2" | jq '.' 2>/dev/null || echo "$body2"
  else
    echo ""
    echo "Both SQL endpoints failed."
    echo "  pg/query:       HTTP $http_status"
    echo "  Management API: HTTP $http_status2"
    echo ""
    echo "For hosted Supabase, run SQL in the Dashboard SQL Editor instead."
    echo "Or use 'supabase db push' with a local Supabase CLI setup."
    echo ""
    echo "Response body:"
    echo "$body2" | jq '.' 2>/dev/null || echo "$body2"
    exit 1
  fi
fi
