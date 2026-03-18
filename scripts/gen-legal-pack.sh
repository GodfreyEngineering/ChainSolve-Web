#!/usr/bin/env bash
# scripts/gen-legal-pack.sh — Generate ChainSolve_Legal_Pack.zip for enterprise procurement.
#
# Assembles the following into a zip archive:
#   README.txt                          — index of contents
#   THIRD_PARTY_LICENCES.md             — dependency licence notices
#   legal/dpa-template.md               — data processing addendum template
#   legal/dpa-references.md             — sub-processor DPA references
#   legal/ropa.md                       — GDPR Art.30 record of processing activities
#   legal/dpia-assessment.md            — DPIA screening decision
#   legal/breach-response.md            — breach response procedure
#   legal/export-control-assessment.md  — export control self-classification
#   legal/font-licences.md              — font licence audit
#   legal/asset-licences.md             — icon/asset licence audit
#   legal/sbom/rust-sbom.cdx.json       — Rust SBOM (if generated)
#   legal/sbom/npm-sbom.cdx.json        — npm SBOM (if generated)
#
# Note: PDF versions of ToS, Privacy Policy, and Cookie Policy require
# Puppeteer or Playwright — run `npm run pdf:legal` to generate them first,
# then re-run this script to include them in the pack.
#
# Output: legal/ChainSolve_Legal_Pack.zip
# Run via: npm run legal-pack

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACK_DIR="$REPO_ROOT/legal/pack-staging"
OUT_ZIP="$REPO_ROOT/legal/ChainSolve_Legal_Pack.zip"

echo "[legal-pack] Staging directory: $PACK_DIR"
echo "[legal-pack] Output: $OUT_ZIP"

# Clean and create staging directory
rm -rf "$PACK_DIR"
cmd.exe /c "mkdir \"$(cygpath -w "$PACK_DIR")\"" 2>/dev/null || {
  # On bash/linux style
  command -v mkdir && mkdir -p "$PACK_DIR" || { echo "Cannot create staging dir"; exit 1; }
}

# ── README ───────────────────────────────────────────────────────────────────

cat > "$PACK_DIR/README.txt" <<'EOF'
ChainSolve Enterprise Legal Pack
=================================

This archive contains legal documents for enterprise procurement and compliance
review. Assembled by Godfrey Engineering Ltd for ChainSolve.

Contents:
---------
THIRD_PARTY_LICENCES.md
  Complete list of third-party software licences for all Rust crates and
  npm packages used by ChainSolve. Required by MIT/Apache 2.0 licence terms.

dpa-template.md
  Data Processing Addendum template. Complete and email to
  support@chainsolve.co.uk to execute a signed DPA.

dpa-references.md
  Sub-processor DPA references (Supabase, Stripe, Resend, Cloudflare,
  Sentry, OpenAI) including download URLs and transfer mechanisms.

ropa.md
  Record of Processing Activities (GDPR Art. 30). Documents all personal
  data processing activities.

dpia-assessment.md
  Data Protection Impact Assessment screening decision (GDPR Art. 35).

breach-response.md
  Personal data breach detection, containment, and notification procedure.

export-control-assessment.md
  UK SECL and US EAR export control self-classification.

font-licences.md
  Audit of all fonts used (Montserrat + JetBrains Mono, both OFL 1.1).

asset-licences.md
  Audit of all icons and images used (Lucide React ISC, first-party SVGs).

sbom/rust-sbom.cdx.json
  Software Bill of Materials for Rust/WASM dependencies (CycloneDX 1.6).
  Run `npm run sbom` to regenerate.

sbom/npm-sbom.cdx.json
  Software Bill of Materials for npm dependencies (CycloneDX 1.6).
  Run `npm run sbom` to regenerate.

For live legal documents (Terms of Service, Privacy Policy, Cookie Policy):
  https://chainsolve.co.uk/terms
  https://chainsolve.co.uk/privacy
  https://chainsolve.co.uk/cookies

Contact: support@chainsolve.co.uk
Company: Godfrey Engineering Ltd, registered in England and Wales (No. 16845827)
Generated: GENERATED_DATE
EOF

# Inject generation date
GENERATED_DATE="$(date -u '+%Y-%m-%d %H:%M UTC' 2>/dev/null || echo 'see archive metadata')"
# Use node to do the replacement to avoid sed issues on Windows
node -e "
const fs = require('fs');
const p = '$PACK_DIR/README.txt';
fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('GENERATED_DATE', '$GENERATED_DATE'));
" 2>/dev/null || true

# ── Copy files ───────────────────────────────────────────────────────────────

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [ -f "$src" ]; then
    cp "$src" "$dest"
    echo "[legal-pack]   ✓ $(basename "$dest")"
  else
    echo "[legal-pack]   ✗ $(basename "$dest") — NOT FOUND (skipped)"
  fi
}

copy_if_exists "$REPO_ROOT/THIRD_PARTY_LICENCES.md"             "$PACK_DIR/THIRD_PARTY_LICENCES.md"
copy_if_exists "$REPO_ROOT/legal/dpa-template.md"               "$PACK_DIR/dpa-template.md"
copy_if_exists "$REPO_ROOT/legal/dpa-references.md"             "$PACK_DIR/dpa-references.md"
copy_if_exists "$REPO_ROOT/legal/ropa.md"                       "$PACK_DIR/ropa.md"
copy_if_exists "$REPO_ROOT/legal/dpia-assessment.md"            "$PACK_DIR/dpia-assessment.md"
copy_if_exists "$REPO_ROOT/legal/breach-response.md"            "$PACK_DIR/breach-response.md"
copy_if_exists "$REPO_ROOT/legal/export-control-assessment.md"  "$PACK_DIR/export-control-assessment.md"
copy_if_exists "$REPO_ROOT/legal/font-licences.md"              "$PACK_DIR/font-licences.md"
copy_if_exists "$REPO_ROOT/legal/asset-licences.md"             "$PACK_DIR/asset-licences.md"

# SBOM files
if [ -d "$REPO_ROOT/legal/sbom" ]; then
  cmd.exe /c "mkdir \"$(cygpath -w "$PACK_DIR/sbom")\"" 2>/dev/null || mkdir -p "$PACK_DIR/sbom" 2>/dev/null || true
  copy_if_exists "$REPO_ROOT/legal/sbom/rust-sbom.cdx.json" "$PACK_DIR/sbom/rust-sbom.cdx.json"
  copy_if_exists "$REPO_ROOT/legal/sbom/npm-sbom.cdx.json"  "$PACK_DIR/sbom/npm-sbom.cdx.json"
fi

# PDF files (optional — generated separately)
for pdf in tos privacy cookies security; do
  copy_if_exists "$REPO_ROOT/legal/${pdf}.pdf" "$PACK_DIR/${pdf}.pdf"
done

# ── Zip ──────────────────────────────────────────────────────────────────────

echo "[legal-pack] Creating zip archive..."
rm -f "$OUT_ZIP"

if command -v zip &>/dev/null; then
  cd "$PACK_DIR" && zip -r "$OUT_ZIP" . && cd "$REPO_ROOT"
elif node -e "require('archiver')" 2>/dev/null; then
  node -e "
  const archiver = require('archiver');
  const fs = require('fs');
  const output = fs.createWriteStream('$OUT_ZIP');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  archive.directory('$PACK_DIR/', false);
  archive.finalize();
  output.on('close', () => console.log('[legal-pack] Archive created via archiver'));
  "
else
  # PowerShell fallback (Windows)
  powershell -Command "Compress-Archive -Path '$PACK_DIR\\*' -DestinationPath '$OUT_ZIP' -Force" 2>/dev/null || {
    echo "[legal-pack] ERROR: No zip tool available. Install zip, or run on Windows with PowerShell."
    echo "[legal-pack] Files staged at: $PACK_DIR"
    exit 1
  }
fi

# ── Cleanup ──────────────────────────────────────────────────────────────────

rm -rf "$PACK_DIR"

echo ""
echo "[legal-pack] Done!"
echo "[legal-pack] Archive: $OUT_ZIP"
if [ -f "$OUT_ZIP" ]; then
  echo "[legal-pack] Size:    $(node -e "console.log((require('fs').statSync('$OUT_ZIP').size/1024).toFixed(1)+'KB')" 2>/dev/null || echo '(size unknown)')"
fi
echo ""
echo "[legal-pack] Next steps:"
echo "[legal-pack]   1. Run 'npm run sbom' to regenerate SBOM files before packing"
echo "[legal-pack]   2. Add PDF versions of ToS/Privacy/Cookies to legal/*.pdf"
echo "[legal-pack]   3. Upload ChainSolve_Legal_Pack.zip to the /legal-pack route"
