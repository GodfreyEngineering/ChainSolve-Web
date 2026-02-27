#!/usr/bin/env bash
# check-adapter-boundary.sh — Enforce adapter boundary invariant.
#
# Verifies that no file under src/components/ imports the Supabase client
# directly. UI components must use service-layer functions from src/lib/.
#
# Exit codes: 0 = pass, 1 = violations found.

set -euo pipefail

violations=$(grep -rn "from '.*lib/supabase'" src/components/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [[ -n "$violations" ]]; then
  echo "FAIL: Adapter boundary violation — supabase client imported directly in src/components/:"
  echo "$violations"
  echo ""
  echo "Use service-layer functions: src/lib/auth.ts, src/lib/profilesService.ts, etc."
  exit 1
fi

echo "PASS: No adapter boundary violations in src/components/."
