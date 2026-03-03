# Phase M Plan

> What will be deleted, moved, or consolidated, plus validation steps.
> Based on [PHASE_M_INVENTORY.md](./PHASE_M_INVENTORY.md).
> Generated 2026-03-03.

---

## M1-1: Remove custom `./CS` scripts + unused CI/helper scripts

### Deletions

| Target | Reason |
|---|---|
| `./cs` (root CLI) | Custom dev workflow CLI; replaced by npm scripts and `verify-ci.sh` |

### Validation

1. `rg -l './cs'` and `rg -l '"cs "' package.json` return zero hits after removal.
2. `grep -r 'cs ' .github/` returns zero workflow references.
3. `./scripts/verify-ci.sh` PASS.

---

## M1-2: Consolidate scripts

### Actions

- Document `./scripts/verify-ci.sh` as the single CI gate in `docs/DEV/`.
- Document optional helpers (`verify-fast.sh`, `optimize-wasm.mjs`, `generate-licenses.mjs`) in a scripts README.
- No scripts need deletion (all 13 are actively wired into the CI pipeline).

### Validation

1. `./scripts/verify-ci.sh` PASS.
2. `ls scripts/` documented in `scripts/README.md`.

---

## M2-1: Create baseline migration

### Actions

1. Create `supabase/migrations/0001_baseline_schema.sql` — single file containing all tables, indexes, triggers, functions, RLS policies, and storage buckets needed for a blank project.
2. Source material: merge logic from migrations `0001`-`0054`, deduplicating where later migrations ALTER tables created in earlier ones.
3. Create `docs/DEV/SUPABASE_BOOTSTRAP.md` with bootstrap instructions.

### Validation

1. New file is syntactically valid SQL (`psql --dry-run` or Supabase local `supabase db reset`).
2. `./scripts/verify-ci.sh` PASS (no runtime dependency on migrations).

---

## M2-2: Archive old iterative migrations

### Actions

1. Move `supabase/migrations/0001_init.sql` through `0054_project_folders.sql` into `supabase/migrations_archive/`.
2. Keep the new baseline as the sole active migration.
3. Add a `supabase/migrations_archive/README.md` explaining the archive purpose.

### Validation

1. `supabase/migrations/` contains only the baseline file.
2. `supabase/migrations_archive/` contains 54 historical files.
3. `./scripts/verify-ci.sh` PASS.

---

## M3-1: Rewrite root README + docs hub

### Actions

1. Rewrite `README.md` with: project overview, quick start, architecture sketch, link to `docs/INDEX.md`.
2. Update `docs/INDEX.md` to reflect current doc structure.
3. Remove or redirect stale cross-references.

### Validation

1. All links in `README.md` and `docs/INDEX.md` resolve.
2. `./scripts/verify-ci.sh` PASS.

---

## M3-2: Add standard repo docs

### Actions

Add or update:
- `CONTRIBUTING.md` (already exists, review for accuracy)
- `docs/DEV/SETUP.md` (consolidate from `docs/SETUP.md` and `docs/DEVCONTAINER.md`)
- `docs/DEV/ARCHITECTURE_OVERVIEW.md` (high-level for new contributors)

### Validation

1. No broken links.
2. `./scripts/verify-ci.sh` PASS.

---

## M4-1: Enforce adapter boundary via lint

### Actions

1. Add ESLint rule or custom lint script to detect Supabase client imports inside `src/components/`.
2. `check-adapter-boundary.sh` already exists and is in CI; evaluate whether to migrate to ESLint for better IDE integration.

### Validation

1. Intentional violation triggers lint error.
2. `./scripts/verify-ci.sh` PASS.

---

## M4-2: Centralize env validation

### Actions

1. Migrate all local `type Env` definitions in `functions/api/**/*.ts` to use `CfEnv` from `_env.ts`.
2. Ensure `requireEnv()` is used consistently instead of raw `context.env.*` access.

### Validation

1. `rg 'type Env' functions/` returns only `_env.ts`.
2. `./scripts/verify-ci.sh` PASS.

---

## Dead Code Deletions (cross-cutting, done alongside relevant M-steps)

### Safe deletes (no production consumers)

| File | Checkpoint | Reason |
|---|---|---|
| `src/components/BugReportModal.tsx` | M1-1 | Replaced by `FeedbackModal.tsx` |
| `src/components/SuggestionModal.tsx` | M1-1 | Replaced by `FeedbackModal.tsx` |
| `functions/api/security/csp-report.ts` | M1-1 | Legacy endpoint, CSP routes to `/api/report/csp` |

### Verify-then-delete (may be future-facing stubs)

| File | Exports | Decision criteria |
|---|---|---|
| `src/lib/tokens.ts` | `Z`, `FONT_WEIGHT` | Delete if no plan to wire up; inline values used everywhere |
| `src/lib/wcagContrast.ts` | `contrastRatio`, `meetsAA` | Delete unless a11y validation pass is planned |
| `src/lib/platform.ts` | `IS_WEB`, `IS_DESKTOP` | Keep if Tauri/Capacitor is on roadmap; delete otherwise |
| `src/lib/offlineQueue.ts` | `OfflineQueue` singleton | Delete unless offline-first mode is planned |
| `src/lib/orgPolicyEnforcement.ts` | `applyOrgPolicyOverrides` | Delete unless org policy integration is imminent |

### Stub packages

| Path | Action |
|---|---|
| `packages/desktop/` | Remove (only README.md) unless Tauri on roadmap |
| `packages/mobile/` | Remove (only README.md) unless Capacitor on roadmap |
| `packages/shared/` | Remove (only README.md) |

---

## Duplicated Helper Consolidation

### Test helper: `readLocale()` (M1-2)

Extract to `src/i18n/testHelpers.ts`, update 4 test files to import from it.

### Functions: `sha256()` + `str()` (M4-2)

Extract to `functions/api/_crypto.ts` and `functions/api/_utils.ts`.

### Docs: `perf-budget.md` overlap (M3-1)

Merge `docs/perf-budget.md` into `docs/performance/budgets.md`, delete the flat file.

---

## Validation Checklist (every M-step)

- [ ] `./scripts/verify-ci.sh` PASS
- [ ] `rg` / `find` evidence that removed items have no remaining references
- [ ] All doc links resolve
- [ ] No new Supabase imports in `src/components/`
- [ ] No secrets in committed files
