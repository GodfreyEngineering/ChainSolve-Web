# ChainSolve Web — Execution Roadmap Checklist
Revision: v1.0  
Owner: Chief Engineer (you)  
Executor: Claude Code (implementation)  
Gatekeeper: verify-ci.sh MUST PASS for any item to be marked done.

---

## How Claude should use this file

### Principles
- **Repo-first**: keep the repository clean, predictable, and easy to reason about.
- **One change at a time**: each checklist item becomes at least one atomic commit.
- **Safety first**: no secrets, no CSP regression, no direct Supabase imports in UI.
- **Docs are part of the product**: every shipped MUST/SHOULD change updates relevant `docs/requirements/*` plus changelog entries.

### Definition of DONE (for any item)
- [ ] Implementation complete and integrated (no stubs)
- [ ] `./scripts/verify-ci.sh` PASS (no exceptions)
- [ ] Tests added/updated appropriately (unit/integration/e2e as specified)
- [ ] i18n keys added for all locales when user-facing UI changes
- [ ] Relevant docs updated + changelog entries added

### Batch execution rules (Claude must follow)
- Work in **batches of 2–5 items** per Claude run (depending on size).
- After EACH item:
  - run `./scripts/verify-ci.sh` (PASS)
  - commit with message format: `P0XX: <short imperative>` (or `RH-#: ...`)
  - tick the checkbox for the item in this file
- Stop before response limits and output:
  - completed items
  - git log (last 10 commits)
  - verify-ci summary
  - next 5 suggested items

### Freedom / discretion granted to Claude
Claude MAY:
- reorder items **within the same Phase/section** if dependencies demand it
- add **small missing glue** (helpers, docs, tests) without creating new roadmap IDs
- create new roadmap IDs for “obvious gaps” (label them `EXTRA-###`) but keep them small and justified
Claude MUST:
- keep core constraints (CSP, adapter boundary, privacy) inviolate

---

## Global invariants (never regress)
- **Adapter boundary**: UI components MUST NOT import Supabase directly.
- **CSP**: no `unsafe-eval`; only `wasm-unsafe-eval` where already approved; no inline scripts.
- **Privacy**: no tokens / keys / emails in exports, logs, reports, templates, or test fixtures.
- **Determinism**: stableStringify + sha256 policies preserved; no time-based randomness in core evaluation.
- **verify-ci is the gate**: do not replace with “verify-fast” except for local diagnostics; DONE requires verify-ci.

---

## Completed (archive — do not redo unless regression found)
### Tooling parity
- [x] W0 — Devcontainer toolchain parity so verify-ci runs in Codespaces
  - [x] Git LFS handled in devcontainer, docs exist
  - [x] verify-ci preflight improved
### W14 exports + portability foundation
- [x] P001 — W14a.1 PDF export v1 (active sheet)
- [x] P002 — W14a.2 PDF export v2 (all sheets + TOC)
- [x] P004 — W14a.3 PDF capture hardening (all sheets images, values-only, cancel, progress)
- [x] P005 — PDF unit tests
- [x] P006 — PDF i18n keys
- [x] P011 — W14b.1 Excel export v1 (active sheet)
- [x] P012 — W14b.2 Excel export v2 (all sheets + tables worksheets)
- [x] P017 — W14c.1 Export .chainsolvejson v1
- [x] P018 — W14c.2 Import .chainsolvejson v1 (validate + report + cleanup)
- [x] W14c.3 — project_assets integration into export/import
- [x] P020 — W14c.4 Round-trip golden tests

---

# PHASE 0 — Repo hygiene + governance (MUST do once, then keep tidy)
> Goal: ensure Claude starts from a clean, modern baseline with zero confusing legacy.

- [x] RH-1: Repo map + hygiene report (no behavior change)
  - Produce `docs/REPO_MAP.md`:
    - folder purpose map (src/, crates/, functions/, docs/, scripts/)
    - key architectural boundaries (engine worker, adapters, exports, persistence)
    - “Do not touch casually” list (CSP, verify scripts, engine contract)
  - Identify:
    - unused folders/files
    - dead menu stubs
    - duplicated helpers
    - legacy paths no longer referenced
  - Do NOT delete anything yet; just report.

- [x] RH-2: Remove accidental/tracking noise (guaranteed clean git status)
  - Ensure `.claude/` ignored and not tracked
  - Ensure devcontainer pins required VS Code extensions
  - Ensure Git LFS exists in devcontainer features
  - Ensure no secrets in repo (scan for typical patterns)
  - Acceptance:
    - `git status` clean after normal dev actions
    - `verify-ci` PASS

- [x] RH-3: Delete or quarantine true dead code paths (surgical)
  - Remove stale stubs / unused legacy folders (only what RH-1 proves unused)
  - If unsure, move to `src/_legacy_quarantine/` with README explaining why
  - Acceptance:
    - No imports reference removed paths
    - verify-ci PASS
    - docs updated (REPO_MAP updated)

- [x] RH-4: Standardize “export infrastructure”  <!-- completed 2026-02-27 -->
  - Ensure exports live in:
    - `src/lib/pdf/*`
    - `src/lib/xlsx/*`
    - `src/lib/chainsolvejson/*`
  - Ensure all exports share:
    - stableStringify + sha256 helpers (single canonical impl)
    - redaction/secret scanning helper (single canonical impl)
  - Acceptance: no duplicate implementations, tests cover helpers

---

# PHASE A — Public Release v1 (Web)
> Goal: ship a stable, secure, auditable, fast web app with excellent first-run UX.

## A2 — Data integrity + reliability (core saving correctness)
- [x] P021: Offline detection + retry queue UX <!-- completed 2026-02-27 -->
  - Add connection state indicator (online/offline)
  - Queue save attempts when offline; auto-retry with backoff
  - Toast + “retry now” action
  - Tests:
    - unit tests for queue state machine
    - integration test for save retry path (mock adapter)
  - Docs: requirements §Project mgmt / reliability

- [x] P022: Autosave contract (≤5s loss) + crash-safe tests <!-- completed 2026-02-27 -->
  - Debounced autosave schedule
  - Ensure crash loses ≤5s (best effort)
  - Ensure autosave doesn’t thrash large graphs
  - Tests: unit tests + simulated timers
  - Docs: requirements §Reliability

- [x] P023: Conflict UX (reload / keep mine / explain)
  - Detect conflict by updated_at mismatch
  - Modal with:
    - “Reload server”
    - “Keep mine (overwrite)” (only if allowed)
    - Explain what changed (at minimum timestamps and affected canvases)
  - Tests: conflict handling logic unit tests

- [x] P024: Canvas JSON validator (pre-save + on-load)
  - Validate schemaVersion 4 shape
  - Block NaN/Infinity persistence
  - If invalid load: preserve original file and show error report (no crash)
  - Tests: validator suite, migration compatibility tests

- [x] P025: Storage path traversal rejection + encoding bypass tests <!-- completed 2026-02-27 -->
  - Normalize and reject `..`, encoded traversal, invalid prefix
  - Tests: path sanitizer unit tests

- [x] P026: Variables JSON shape validator (client + service layer)
  - Enforce `ProjectVariable` shape, finite values, unique names (case-insensitive)
  - Tests: unit tests

- [x] P027: Save status indicator polish
  - States: idle/saving/saved/conflict/error/offline-queued
  - Tooltip includes last save timestamp + target (canvas/project)
  - Tests: UI smoke tests where feasible

- [x] P028: Save As duplicates full project (all canvases + vars + assets)
  - Duplicate project row
  - Copy canvases rows + storage JSON
  - Copy assets metadata + bytes references
  - Tests: mock adapter duplication tests
  - Docs: requirements

- [x] P029: Recent projects resilience
  - Handle missing/deleted projects gracefully
  - Cross-device continuity improvements (optional)
  - Tests: MRU logic tests

- [ ] P030: Scratch mode (optional)
  - Allow exploring without auth
  - Export/import prompts login only for cloud save
  - Keep simple; do not balloon scope

## A3 — Engine determinism + correctness hardening
- [x] P031: Expand engine golden fixtures (eng/fin/stats/const)
  - Add more fixtures for edge cases (domain errors, arity mismatch, type mismatch)
  - Ensure stable outputs across platforms
  - Tests: Rust golden fixtures + TS integration tests where relevant

- [x] P032: Property tests for random DAGs (SHOULD)
  - Ensure no panics
  - Determinism across repeated evals
  - Keep runtime bounded (CI friendly)

- [x] P033: NaN eradication audit (UI never shows NaN)
  - Central formatting layer guarantees: NaN -> explicit error
  - Add tests for formatting + display nodes

- [x] P034: Domain error consistency
  - Standardize error codes/messages for common failures
  - Tests in Rust + TS boundary

- [x] P035: Watchdog behavior test
  - Ensure partial results are surfaced clearly
  - Worker respawn + recovery path
  - Tests: worker timeout simulation

- [ ] P036: Trace export (opt-in)
  - JSON trace export for audits/debug
  - Redaction guarantee
  - Keep behind debug toggle

- [ ] P037: “Explain this value” view
  - Selected node shows:
    - input bindings resolved
    - upstream sources
    - trace timing (if available)
  - Keep UX minimal, powerful

- [x] P038: Cross-canvas isolation proof
  - Tests that canvas A evaluation cannot read canvas B state
  - Documented invariants

- [x] P039: Incremental patch correctness tests (SHOULD)
  - Patch protocol correctness: patch-eval equals full-eval

- [ ] P040: Engine contract mismatch UX
  - Fatal error screen with actionable steps
  - Diagnostic log entry + copy-to-clipboard

## A4 — Security + privacy hardening (pre-public gates)
- [x] P041: Central redaction utility + tests
  - One canonical redaction function used by:
    - debug console export
    - PDF/Excel/JSON export
    - import reports
  - Test suite includes:
    - token patterns
    - emails
    - supabase keys
    - authorization headers

- [ ] P042: Debug console export redaction verification
  - Ensure export never includes secrets
  - Add regression tests

- [x] P043: Adapter boundary enforcement
  - Add lint rule or CI script that forbids `supabase` imports in UI components
  - Enforce service layer usage

- [ ] P044: RLS audit (explicit policies)
  - Confirm all tables have:
    - RLS enabled
    - explicit SELECT/INSERT/UPDATE/DELETE policies
    - canonical `(select auth.uid())` usage
  - Provide migration fixes if needed
  - Document in SECURITY.md / requirements

- [ ] P045: Storage ACL audit
  - Ensure buckets enforce `{auth.uid()}/` prefixes
  - Add tests in migration or docs + manual check procedure

- [ ] P046: CSP verification automation doc
  - Add “how to validate CSP locally” playbook
  - Ensure report endpoint usage documented

- [x] P047: Input validation sweep
  - Project name validation
  - Variable name validation
  - CSV numeric validation UX
  - Tests: unit tests for validators

- [ ] P048: Upload size limits (client + server)
  - Enforce file size caps
  - Friendly messages, no crashes

- [ ] P049: Telemetry defaults OFF (confirm)
  - Ensure no analytics loaded by default
  - Opt-in only, documented

- [ ] P050: Guardrails on third-party scripts
  - Document and enforce: any new third-party script requires CSP review + opt-in

## A5 — Entitlements + billing correctness (public monetization)
- [ ] P051: Entitlement matrix tests
  - Full plan matrix coverage
  - Ensure free/trial/pro/past_due/canceled behave per spec

- [ ] P052: past_due/canceled read-only enforcement
  - UI blocks edits
  - Service layer blocks writes

- [ ] P053: Upgrade prompts (limits/features)
  - Clear, consistent prompts for:
    - project limits
    - canvas limits
    - pro-only features (plots/tables/groups/exports as applicable)

- [ ] P054: Stripe webhook idempotency + event logging
  - Ensure webhook handler is idempotent
  - stripe_events audit trail confirmed

- [ ] P055: Customer portal + re-auth window
  - Billing-sensitive ops require re-auth
  - Tests: unit/integration for re-auth logic

- [ ] P056: DB-level enforcement tests
  - project limit triggers
  - canvas limit checks (if enforced server-side)

- [ ] P057: Usage counters UI (SHOULD)
  - Projects used / allowed
  - Canvases used / allowed
  - Storage usage (optional)

- [ ] P058: Trial UX (SHOULD)
  - Banner + expiry warning

- [ ] P059: Billing error UX
  - Consistent API error envelope
  - No stack traces in prod

- [ ] P060: Billing E2E mocks (SHOULD)
  - CI-safe mocks for upgrade flow

## A6 — Onboarding + docs + discoverability (time-to-first-result)
- [ ] P061: First-run onboarding (“10 nodes in 2 minutes”)
  - First-run modal:
    - Start from scratch
    - Create from template
    - Import .chainsolvejson
  - Persist dismissed state per browser
  - Respect plan limits

- [ ] P062: Sample templates pack #1
  - Physics 101 (F=ma, conversions)
  - Finance 101 (TVM / loan)
  - Stats 101 (dataset + mean/stddev + plot-ready)
  - Deterministic node IDs + positions
  - Tests: template validation suite (schemaVersion 4, finite numbers, no duplicate IDs)

- [ ] P063: In-app docs index (searchable)
  - Search overlay that links to docs topics
  - Keep assets local; no remote fetch required

- [ ] P064: Shortcut help auto-generated (SHOULD)
  - Single source of truth from action registry
  - Render in Help menu / modal

- [ ] P065: “What’s New” panel (SHOULD)
  - Based on changelog entries

- [ ] P066: Empty states (MUST)
  - Projects page empty state
  - Canvas empty state
  - Inspector empty state
  - Block library empty state

- [ ] P067: Command palette ranking + synonyms (SHOULD)
- [ ] P068: Favorites + recently used blocks (COULD)
- [ ] P069: Quick-add palette improvements (SHOULD)
- [ ] P070: Docs change process enforcement (MUST)
  - Add reminder/checklist in PR template or CI doc step

## A7 — Accessibility + i18n quality gates
- [ ] P071: Focus order audit + fixes
- [ ] P072: Menubar ARIA + keyboard nav regression tests
- [ ] P073: Modal focus trap + ESC close + aria-live status
- [ ] P074: Contrast pass toward WCAG AA
- [ ] P075: prefers-reduced-motion reliability
- [ ] P076: Screen-reader labels sweep (SHOULD)
- [ ] P077: i18n lint rule (no hard-coded strings)
- [ ] P078: missing-i18n keys detector + CI hook
- [ ] P079: Locale-aware number formatting (display-only) (SHOULD)
- [ ] P080: Language selection persists + pre-paint apply (no FOUC)

## A8 — Performance + scale (500–1000 nodes)
- [ ] P081: Perf harness (generate/load 500/1000-node graphs)
- [ ] P082: ?perf=1 FPS overlay + perf logs (SHOULD)
- [ ] P083: Animated edges thresholds + hysteresis + tests
- [ ] P084: LOD thresholds tuning
- [ ] P085: WASM init timing logged + regression guard
- [ ] P086: Bundle splitting audit (ensure lazy libs remain lazy)
- [ ] P087: Table limits enforcement + UX
- [ ] P088: Worker resilience (crash → respawn → notice)
- [ ] P089: Eval scheduling to avoid main-thread stalls (SHOULD)
- [ ] P090: Lighthouse/perf budget doc + optional CI check (SHOULD)

## A9 — Test suite completion + release hardening
- [ ] P091: Coverage thresholds (src/lib + src/engine)
- [ ] P092: Integration tests: WASM worker snapshot → result
- [ ] P093: Integration tests: save/load round-trip (SHOULD)
- [ ] P094: E2E smoke: create project, add blocks, connect, eval, save
- [ ] P095: E2E multi-canvas switching + persistence
- [ ] P096: E2E variables + bindings + sliders
- [ ] P097: E2E CSV import + validation errors (Pro gating)
- [ ] P098: E2E plot render + export (SHOULD)
- [ ] P099: E2E export download assertions (PDF/Excel) (SHOULD, if CI supports)
- [ ] P100: Go-live doc: release checklist + verification steps

---

# PHASE B — Growth v1.1 (Marketplace)
> Claude may start this ONLY after Phase A is complete unless explicitly told otherwise.

- [ ] P101: Marketplace schema v0 (items, purchases, storage bucket)
- [ ] P102: Marketplace RLS (public browse metadata, gated downloads)
- [ ] P103: Marketplace shell page
- [ ] P104: Browse/search/filter UI
- [ ] P105: Item detail pages
- [ ] P106: Install flow for project_template (fork into user projects)
- [ ] P107: Template packaging + semver rules
- [ ] P108: Author dashboard v0
- [ ] P109: Verified author gating
- [ ] P110: Review gate v0

- [ ] P111: Stripe Connect architecture doc + stubs
- [ ] P112: Paid purchase flow (record purchase)
- [ ] P113: canPublishMarketplace gating UI + server
- [ ] P114: Download/install audit events (future enterprise)
- [ ] P115: Marketplace analytics (privacy constrained)

- [ ] P116: block_pack install mechanism
- [ ] P117: theme install mechanism (CSS vars)
- [ ] P118: dependency/compat checks (engine contract)
- [ ] P119: moderation tools
- [ ] P120: Marketplace E2E smoke

---

# PHASE C — Enterprise v1.2 (Org/RBAC + Audit)
- [ ] P121: organizations + org_members tables + role enum
- [ ] P122: projects.org_id support
- [ ] P123: org RLS policies (membership + role)
- [ ] P124: Org UI v0 (create org, invite, roles)
- [ ] P125: org billing separation doc

- [ ] P126: Audit log schema + capture key events
- [ ] P127: Audit log viewer (enterprise-only)
- [ ] P128: Audit log redaction guarantee (MUST)
- [ ] P129: Retention policy doc
- [ ] P130: Enterprise policy hooks for Desktop (policy.json future)

---

# PHASE D — Perfection (optional)
- [ ] P144: Visual regression testing (Playwright screenshots)
- [ ] P145: Axe accessibility automation in E2E
- [ ] P146: Chaos testing (Supabase outages, worker crashes)
- [ ] P147: Performance regression CI
- [ ] P148: RTL language support
- [ ] P149: LLM-assisted graph building (future)
- [ ] P150: Template editor (user-defined reusable groups)