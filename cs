#!/usr/bin/env bash
# ── cs — ChainSolve dev CLI ──────────────────────────────────────────────────
# Tiny dispatcher for common dev workflows. No deps. Run: ./cs help
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
R=$'\033[0;31m' G=$'\033[0;32m' Y=$'\033[0;33m' C=$'\033[0;36m' B=$'\033[1m' X=$'\033[0m'

ok()   { echo -e "${G}✔${X} $*"; }
warn() { echo -e "${Y}⚠${X} $*"; }
err()  { echo -e "${R}✖${X} $*" >&2; }
info() { echo -e "${C}→${X} $*"; }
hdr()  { echo -e "\n${B}$*${X}"; }

die() { err "$@"; exit 1; }

# ── Helpers ──────────────────────────────────────────────────────────────────

current_branch() { git rev-parse --abbrev-ref HEAD; }

is_clean() { git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; }

has_script() { node -e "process.exit(require('./package.json').scripts['$1'] ? 0 : 1)" 2>/dev/null; }

run_script() {
  local name="$1" label="${2:-$1}"
  if has_script "$name"; then
    info "Running ${B}$label${X}…"
    if npm run "$name" --silent 2>&1; then
      ok "$label passed"
      return 0
    else
      err "$label failed"
      return 1
    fi
  else
    warn "Script '$name' not found — skipping"
    return 0
  fi
}

require_not_main() {
  local branch
  branch="$(current_branch)"
  if [[ "$branch" == "main" || "$branch" == "master" ]]; then
    if [[ "${1:-}" == "--allow-main" ]]; then
      warn "Operating on ${B}$branch${X} (--allow-main)"
    else
      die "Refusing to operate on ${B}$branch${X}. Use --allow-main to override."
    fi
  fi
}

print_status() {
  local branch
  branch="$(current_branch)"
  info "Branch: ${B}$branch${X}"
  info "Last commit: $(git log -1 --oneline)"
  local tracking
  tracking="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [[ -n "$tracking" ]]; then
    info "Tracking: $tracking"
  fi
}

# ── cs help ──────────────────────────────────────────────────────────────────

cmd_help() {
  cat <<EOF

${B}cs — ChainSolve dev CLI${X}

${C}Usage:${X}  ./cs <command> [args]

${B}Commands:${X}
  ${G}new${X} <branch>         Checkout main, pull, create branch
  ${G}test${X}                 Quick check (typecheck + lint)
  ${G}test${X} --full           Full check (typecheck + lint + unit + build)
  ${G}push${X} "message"        Stage all, commit, push
  ${G}ship${X}                  PR → merge → cleanup → update main
  ${G}hotfix${X} <name>         Start hotfix branch from main
  ${G}help${X}                  Show this help

${B}Safety:${X}
  • ${Y}push${X} and ${Y}ship${X} refuse to operate on main (use --allow-main to override)
  • ${Y}ship${X} uses --auto merge so checks must pass first

${B}Workflow:${X}
  ./cs new w10.3-feature      # start
  # … write code with Claude …
  ./cs test                    # verify
  ./cs push "W10.3: feature"   # commit + push
  ./cs ship                    # merge to main

EOF
}

# ── cs new <branch> ──────────────────────────────────────────────────────────

cmd_new() {
  local name="${1:-}"
  [[ -z "$name" ]] && die "Usage: cs new <branch-name>"

  if ! is_clean; then
    die "Working tree is not clean. Commit or stash first."
  fi

  hdr "Starting fresh branch: $name"
  info "Checking out main…"
  git checkout main
  info "Pulling latest…"
  git pull origin main
  info "Creating branch ${B}$name${X}…"
  git checkout -b "$name"
  echo ""
  print_status
  ok "Ready to work on ${B}$name${X}"
}

# ── cs test [--full] ─────────────────────────────────────────────────────────

cmd_test() {
  local mode="${1:-quick}"
  local failures=0

  if [[ "$mode" == "--full" || "$mode" == "full" ]]; then
    hdr "Full test suite"
    run_script typecheck "TypeScript"    || failures=$((failures + 1))
    run_script lint      "ESLint"        || failures=$((failures + 1))
    run_script test:unit "Unit tests"    || failures=$((failures + 1))
    # Build = tsc + vite (may fail if wasm-pack missing; that's fine)
    run_script build     "Build"         || failures=$((failures + 1))
    # E2E if available and requested
    if has_script test:e2e:smoke; then
      run_script test:e2e:smoke "E2E smoke" || failures=$((failures + 1))
    fi
  else
    hdr "Quick test"
    run_script typecheck "TypeScript"    || failures=$((failures + 1))
    run_script lint      "ESLint"        || failures=$((failures + 1))
  fi

  echo ""
  if [[ "$failures" -eq 0 ]]; then
    ok "All checks passed"
  else
    err "$failures check(s) failed"
    exit 1
  fi
}

# ── cs push "message" ────────────────────────────────────────────────────────

cmd_push() {
  local allow_main=""
  local msg=""

  # Parse args
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --allow-main) allow_main="--allow-main"; shift ;;
      *) msg="$1"; shift ;;
    esac
  done

  require_not_main "$allow_main"

  [[ -z "$msg" ]] && die "Usage: cs push \"commit message\" [--allow-main]"

  hdr "Push: $msg"

  git add -A
  if git diff --cached --quiet; then
    warn "Nothing staged to commit"
    # Still push in case there are unpushed commits
  else
    info "Committing…"
    git commit -m "$msg"
  fi

  local branch
  branch="$(current_branch)"
  local tracking
  tracking="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"

  if [[ -z "$tracking" ]]; then
    info "Setting upstream and pushing…"
    git push -u origin "$branch"
  else
    info "Pushing…"
    git push
  fi

  echo ""
  print_status

  # PR suggestion
  if command -v gh &>/dev/null; then
    local pr_url
    pr_url="$(gh pr view --json url -q .url 2>/dev/null || true)"
    if [[ -n "$pr_url" ]]; then
      info "PR: $pr_url"
    else
      echo ""
      info "Create PR: ${C}gh pr create --title \"$msg\"${X}"
    fi
  fi

  ok "Pushed"
}

# ── cs ship ──────────────────────────────────────────────────────────────────

cmd_ship() {
  local branch
  branch="$(current_branch)"

  require_not_main

  if ! is_clean; then
    die "Working tree not clean. Run ${B}cs push${X} first."
  fi

  hdr "Shipping $branch → main"

  # Ensure branch is pushed
  local tracking
  tracking="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [[ -z "$tracking" ]]; then
    info "Pushing branch…"
    git push -u origin "$branch"
  else
    info "Pushing latest commits…"
    git push
  fi

  if ! command -v gh &>/dev/null; then
    die "gh CLI required for cs ship. Install: https://cli.github.com"
  fi

  # Create or reuse PR
  local pr_url
  pr_url="$(gh pr view --json url -q .url 2>/dev/null || true)"
  if [[ -z "$pr_url" ]]; then
    info "Creating PR…"
    pr_url="$(gh pr create --fill --head "$branch" --base main 2>&1 | tail -1)"
    ok "PR created: $pr_url"
  else
    ok "Using existing PR: $pr_url"
  fi

  # Merge (--auto waits for checks if required)
  info "Merging (squash, auto-merge if checks pending)…"
  if gh pr merge --squash --delete-branch --auto; then
    ok "Merge initiated"
  else
    # If --auto not supported, try direct merge
    warn "--auto not available, trying direct merge…"
    gh pr merge --squash --delete-branch || die "Merge failed. Check PR status."
    ok "Merged"
  fi

  # Update local
  info "Switching to main…"
  git checkout main
  info "Pulling…"
  git pull origin main

  # Clean up local branch (ignore error if already gone)
  git branch -d "$branch" 2>/dev/null || true

  echo ""
  print_status
  ok "Merged and updated local main. Cloudflare Pages will deploy from main."
}

# ── cs hotfix <name> ─────────────────────────────────────────────────────────

cmd_hotfix() {
  local name="${1:-}"
  [[ -z "$name" ]] && die "Usage: cs hotfix <name>"

  # Sanitize: lowercase, replace spaces/special chars with hyphens
  local safe
  safe="$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')"
  local date_suffix
  date_suffix="$(date +%Y%m%d)"
  local branch="hotfix/${safe}-${date_suffix}"

  if ! is_clean; then
    die "Working tree not clean. Commit or stash first."
  fi

  hdr "Starting hotfix: $branch"
  info "Checking out main…"
  git checkout main
  info "Pulling latest…"
  git pull origin main
  info "Creating branch ${B}$branch${X}…"
  git checkout -b "$branch"

  echo ""
  print_status
  warn "Hotfix reminders:"
  echo "  • Keep the diff minimal"
  echo "  • Run: ./cs test --full"
  echo "  • Then: ./cs push \"Hotfix: $name\""
  echo "  • Then: ./cs ship"
  ok "Ready"
}

# ── Dispatcher ───────────────────────────────────────────────────────────────

cmd="${1:-help}"
shift 2>/dev/null || true

case "$cmd" in
  help|-h|--help)  cmd_help ;;
  new)             cmd_new "$@" ;;
  test)            cmd_test "$@" ;;
  push)            cmd_push "$@" ;;
  ship)            cmd_ship ;;
  hotfix)          cmd_hotfix "$@" ;;
  *)               err "Unknown command: $cmd"; cmd_help; exit 1 ;;
esac
