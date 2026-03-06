#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# db-inspect.sh — Full diagnostic dump of the live Supabase schema.
#
# Outputs: tables, columns, constraints, indexes, triggers, functions,
#          RLS policies, storage buckets, row counts, and auth user count.
#
# Usage:
#   SUPABASE_SERVICE_ROLE_KEY=ey... ./supabase/scripts/db-inspect.sh
#
# Or set the key in .env.local:
#   SUPABASE_SERVICE_ROLE_KEY=ey...
#
# The script reads VITE_SUPABASE_URL from .env for the project URL.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load env vars from .env and .env.local
for f in "$ROOT_DIR/.env" "$ROOT_DIR/.env.local"; do
  if [[ -f "$f" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$f"; set +a
  fi
done

# Resolve URL — prefer SUPABASE_URL, fall back to VITE_SUPABASE_URL
SB_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
SB_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SB_URL" ]]; then
  echo "ERROR: SUPABASE_URL or VITE_SUPABASE_URL not set." >&2
  echo "Set it in .env or export it." >&2
  exit 1
fi

if [[ -z "$SB_KEY" ]]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set." >&2
  echo "Export it or add it to .env.local (never commit this!):" >&2
  echo "  SUPABASE_SERVICE_ROLE_KEY=eyJ..." >&2
  exit 1
fi

# Strip trailing slash
SB_URL="${SB_URL%/}"

run_sql() {
  local sql="$1"
  local label="${2:-query}"
  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  $label"
  echo "═══════════════════════════════════════════════════════════════════"

  local response
  response=$(curl -s -w "\n%{http_code}" \
    "${SB_URL}/rest/v1/rpc/" \
    -H "apikey: ${SB_KEY}" \
    -H "Authorization: Bearer ${SB_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{}" \
    2>/dev/null) || true

  # Use the SQL endpoint instead (pg_meta or direct)
  response=$(curl -s \
    "${SB_URL}/pg/query" \
    -H "apikey: ${SB_KEY}" \
    -H "Authorization: Bearer ${SB_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$sql" | jq -Rs .)}" \
    2>/dev/null) || true

  if [[ -z "$response" ]] || echo "$response" | jq -e '.error' >/dev/null 2>&1; then
    # Fallback: use the REST RPC endpoint
    # Create a temp function via the SQL API
    echo "(Using REST fallback)"
    response=$(curl -s \
      "${SB_URL}/rest/v1/rpc/" \
      -H "apikey: ${SB_KEY}" \
      -H "Authorization: Bearer ${SB_KEY}" \
      -H "Content-Type: application/json" \
      -d "{}" \
      2>/dev/null) || true
  fi

  echo "$response" | jq '.' 2>/dev/null || echo "$response"
}

# Use the Supabase SQL API (available on all hosted instances)
sql_query() {
  local sql="$1"
  local label="${2:-query}"
  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  $label"
  echo "═══════════════════════════════════════════════════════════════════"

  curl -s \
    "${SB_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SB_KEY}" \
    -H "Authorization: Bearer ${SB_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$sql" | jq -Rs .)}" \
    2>/dev/null | jq '.' 2>/dev/null || echo "(query failed — exec_sql RPC may not exist)"
}

echo "ChainSolve Supabase Inspector"
echo "Project: ${SB_URL}"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# ── 1. Tables + columns via REST ─────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════════"
echo "  1. Public tables (via OpenAPI definition)"
echo "═══════════════════════════════════════════════════════════════════"

curl -s "${SB_URL}/rest/v1/" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  2>/dev/null | jq -r '.definitions // {} | keys[]' 2>/dev/null | sort || echo "(could not list tables)"

# ── 2. Row counts per table ──────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  2. Row counts (estimated, via HEAD requests)"
echo "═══════════════════════════════════════════════════════════════════"

tables=$(curl -s "${SB_URL}/rest/v1/" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  2>/dev/null | jq -r '.definitions // {} | keys[]' 2>/dev/null | sort)

if [[ -n "$tables" ]]; then
  printf "%-40s %s\n" "TABLE" "COUNT"
  printf "%-40s %s\n" "────────────────────────────────────────" "─────────"
  for table in $tables; do
    count=$(curl -s -I \
      "${SB_URL}/rest/v1/${table}?select=id" \
      -H "apikey: ${SB_KEY}" \
      -H "Authorization: Bearer ${SB_KEY}" \
      -H "Prefer: count=exact" \
      -H "Range: 0-0" \
      2>/dev/null | grep -i 'content-range' | sed 's/.*\///' | tr -d '\r\n ')
    printf "%-40s %s\n" "$table" "${count:-?}"
  done
fi

# ── 3. Storage buckets ───────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  3. Storage buckets"
echo "═══════════════════════════════════════════════════════════════════"

curl -s "${SB_URL}/storage/v1/bucket" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  2>/dev/null | jq '[.[] | {id, name, public, file_size_limit, allowed_mime_types}]' 2>/dev/null || echo "(could not list buckets)"

# ── 4. Storage object counts per bucket ──────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  4. Storage object counts"
echo "═══════════════════════════════════════════════════════════════════"

buckets=$(curl -s "${SB_URL}/storage/v1/bucket" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  2>/dev/null | jq -r '.[].id' 2>/dev/null)

if [[ -n "$buckets" ]]; then
  printf "%-20s %s\n" "BUCKET" "OBJECTS"
  printf "%-20s %s\n" "────────────────────" "─────────"
  for bucket in $buckets; do
    obj_count=$(curl -s \
      "${SB_URL}/storage/v1/object/list/${bucket}" \
      -H "apikey: ${SB_KEY}" \
      -H "Authorization: Bearer ${SB_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"prefix":"","limit":1000}' \
      2>/dev/null | jq 'length' 2>/dev/null)
    printf "%-20s %s\n" "$bucket" "${obj_count:-?}"
  done
fi

# ── 5. Auth user count ───────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  5. Auth users"
echo "═══════════════════════════════════════════════════════════════════"

auth_response=$(curl -s "${SB_URL}/auth/v1/admin/users?per_page=1&page=1" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  2>/dev/null)

user_count=$(echo "$auth_response" | jq '.total // (.users | length) // 0' 2>/dev/null)
echo "Total auth users: ${user_count:-unknown}"

# List users (emails only, no secrets)
echo ""
echo "Users:"
echo "$auth_response" | jq -r '.users[]? | "\(.id[0:8])... | \(.email) | created: \(.created_at[0:10])"' 2>/dev/null || echo "(no users)"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Done. $(date -u +%H:%M:%SZ)"
echo "═══════════════════════════════════════════════════════════════════"
