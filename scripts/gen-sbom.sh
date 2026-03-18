#!/usr/bin/env bash
# scripts/gen-sbom.sh — Generate Software Bill of Materials (SBOM) in CycloneDX JSON format.
#
# Outputs to legal/sbom/:
#   rust-sbom.cdx.json     — Rust/WASM dependency SBOM (CycloneDX 1.6)
#   npm-sbom.cdx.json      — npm/JS dependency SBOM (CycloneDX 1.6)
#
# Prerequisites:
#   cargo install cargo-sbom          (Rust SBOM)
#   npm install -g @cyclonedx/cyclonedx-npm  (JS SBOM)
#
# Run via:   npm run sbom
# In CI:     npm run sbom && git add legal/sbom/ && git diff --cached --quiet || echo "SBOM updated"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SBOM_DIR="$REPO_ROOT/legal/sbom"

echo "[sbom] Output directory: $SBOM_DIR"

# ── Rust SBOM (cargo-sbom) ───────────────────────────────────────────────────

RUST_SBOM_OUT="$SBOM_DIR/rust-sbom.cdx.json"

if command -v cargo-sbom &>/dev/null; then
  echo "[sbom] Generating Rust SBOM with cargo-sbom..."
  cargo sbom \
    --output-format cyclone_dx_json_1_6 \
    --project-directory "$REPO_ROOT" \
    > "$RUST_SBOM_OUT"
  echo "[sbom] Rust SBOM written to $RUST_SBOM_OUT"
else
  echo "[sbom] WARNING: cargo-sbom not found. Install with: cargo install cargo-sbom"
  echo "[sbom]          Skipping Rust SBOM generation."
  echo "[sbom]          To install: cargo install cargo-sbom"
  # Write a stub SBOM explaining the situation
  cat > "$RUST_SBOM_OUT" <<'JSON'
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.6",
  "version": 1,
  "metadata": {
    "component": {
      "type": "application",
      "name": "chainsolve-engine",
      "description": "SBOM not generated — cargo-sbom not installed. Run: cargo install cargo-sbom"
    }
  },
  "components": []
}
JSON
  echo "[sbom] Stub Rust SBOM written (install cargo-sbom to generate real data)"
fi

# ── npm SBOM (@cyclonedx/cyclonedx-npm) ─────────────────────────────────────

NPM_SBOM_OUT="$SBOM_DIR/npm-sbom.cdx.json"

if command -v cyclonedx-npm &>/dev/null || npx --yes @cyclonedx/cyclonedx-npm --version &>/dev/null 2>&1; then
  echo "[sbom] Generating npm SBOM with @cyclonedx/cyclonedx-npm..."
  cd "$REPO_ROOT"
  npx --yes @cyclonedx/cyclonedx-npm \
    --spec-version 1.6 \
    --output-format JSON \
    --output-file "$NPM_SBOM_OUT" \
    --package-lock-only \
    --flatten-components \
    2>/dev/null || {
      echo "[sbom] WARNING: cyclonedx-npm failed. Trying with prod-only flag..."
      npx --yes @cyclonedx/cyclonedx-npm \
        --spec-version 1.6 \
        --output-format JSON \
        --output-file "$NPM_SBOM_OUT" \
        --omit dev \
        --package-lock-only
    }
  echo "[sbom] npm SBOM written to $NPM_SBOM_OUT"
else
  echo "[sbom] WARNING: @cyclonedx/cyclonedx-npm not available."
  echo "[sbom]          Install with: npm install -g @cyclonedx/cyclonedx-npm"
  cat > "$NPM_SBOM_OUT" <<'JSON'
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.6",
  "version": 1,
  "metadata": {
    "component": {
      "type": "application",
      "name": "chainsolve-web",
      "description": "SBOM not generated — @cyclonedx/cyclonedx-npm not installed. Run: npm install -g @cyclonedx/cyclonedx-npm"
    }
  },
  "components": []
}
JSON
  echo "[sbom] Stub npm SBOM written."
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "[sbom] Done."
echo "[sbom]   Rust: $RUST_SBOM_OUT"
echo "[sbom]   npm:  $NPM_SBOM_OUT"
echo ""
echo "[sbom] To view SBOM component counts:"
echo "[sbom]   Rust: $(node -e "try{const f=require('fs').readFileSync('$RUST_SBOM_OUT','utf8');const b=JSON.parse(f);console.log(b.components?.length??0,'components')}catch(e){console.log('(parse error)')}" 2>/dev/null || echo '(node parse skipped)')"
echo "[sbom]   npm:  $(node -e "try{const f=require('fs').readFileSync('$NPM_SBOM_OUT','utf8');const b=JSON.parse(f);console.log(b.components?.length??0,'components')}catch(e){console.log('(parse error)')}" 2>/dev/null || echo '(node parse skipped)')"
