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

- [x] P030: Scratch mode (optional)
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

- [x] P036: Trace export (opt-in)
  - JSON trace export for audits/debug
  - Redaction guarantee
  - Keep behind debug toggle

- [x] P037: “Explain this value” view
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

- [x] P040: Engine contract mismatch UX
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

- [x] P042: Debug console export redaction verification
  - Ensure export never includes secrets
  - Add regression tests

- [x] P043: Adapter boundary enforcement
  - Add lint rule or CI script that forbids `supabase` imports in UI components
  - Enforce service layer usage

- [x] P044: RLS audit (explicit policies)
  - Confirm all tables have:
    - RLS enabled
    - explicit SELECT/INSERT/UPDATE/DELETE policies
    - canonical `(select auth.uid())` usage
  - Provide migration fixes if needed
  - Document in SECURITY.md / requirements

- [x] P045: Storage ACL audit
  - Ensure buckets enforce `{auth.uid()}/` prefixes
  - Add tests in migration or docs + manual check procedure

- [x] P046: CSP verification automation doc
  - Add “how to validate CSP locally” playbook
  - Ensure report endpoint usage documented

- [x] P047: Input validation sweep
  - Project name validation
  - Variable name validation
  - CSV numeric validation UX
  - Tests: unit tests for validators

- [x] P048: Upload size limits (client + server)
  - Enforce file size caps
  - Friendly messages, no crashes

- [x] P049: Telemetry defaults OFF (confirm)
  - Ensure no analytics loaded by default
  - Opt-in only, documented

- [x] P050: Guardrails on third-party scripts
  - Document and enforce: any new third-party script requires CSP review + opt-in

## A5 — Entitlements + billing correctness (public monetization)
- [x] P051: Entitlement matrix tests
  - Full plan matrix coverage
  - Ensure free/trial/pro/past_due/canceled behave per spec

- [x] P052: past_due/canceled read-only enforcement
  - UI blocks edits
  - Service layer blocks writes

- [x] P053: Upgrade prompts (limits/features)
  - Clear, consistent prompts for:
    - project limits
    - canvas limits
    - pro-only features (plots/tables/groups/exports as applicable)

- [x] P054: Stripe webhook idempotency + event logging
  - Ensure webhook handler is idempotent
  - stripe_events audit trail confirmed

- [x] P055: Customer portal + re-auth window
  - Billing-sensitive ops require re-auth
  - Tests: unit/integration for re-auth logic

- [x] P056: DB-level enforcement tests
  - project limit triggers
  - canvas limit checks (if enforced server-side)

- [x] P057: Usage counters UI (SHOULD)
  - Projects used / allowed
  - Canvases used / allowed
  - Storage usage (optional)

- [x] P058: Trial UX (SHOULD)
  - Banner + expiry warning

- [x] P059: Billing error UX
  - Consistent API error envelope
  - No stack traces in prod

- [x] P060: Billing E2E mocks (SHOULD)
  - CI-safe mocks for upgrade flow

## A6 — Onboarding + docs + discoverability (time-to-first-result)
- [x] P061: First-run onboarding (“10 nodes in 2 minutes”)
  - First-run modal:
    - Start from scratch
    - Create from template
    - Import .chainsolvejson
  - Persist dismissed state per browser
  - Respect plan limits

- [x] P062: Sample templates pack #1
  - Physics 101 (F=ma, conversions)
  - Finance 101 (TVM / loan)
  - Stats 101 (dataset + mean/stddev + plot-ready)
  - Deterministic node IDs + positions
  - Tests: template validation suite (schemaVersion 4, finite numbers, no duplicate IDs)

- [x] P063: In-app docs index (searchable)
  - Search overlay that links to docs topics
  - Keep assets local; no remote fetch required

- [x] P064: Shortcut help auto-generated (SHOULD)
  - Single source of truth from action registry
  - Render in Help menu / modal

- [x] P065: “What’s New” panel (SHOULD)
  - Based on changelog entries

- [x] P066: Empty states (MUST)
  - Projects page empty state
  - Canvas empty state
  - Inspector empty state
  - Block library empty state

- [x] P067: Command palette ranking + synonyms (SHOULD)
- [x] P068: Favorites + recently used blocks (COULD)
- [x] P069: Quick-add palette improvements (SHOULD)
- [x] P070: Docs change process enforcement (MUST)
  - Add reminder/checklist in PR template or CI doc step

## A7 — Accessibility + i18n quality gates
- [x] P071: Focus order audit + fixes
- [x] P072: Menubar ARIA + keyboard nav regression tests
- [x] P073: Modal focus trap + ESC close + aria-live status
- [x] P074: Contrast pass toward WCAG AA
- [x] P075: prefers-reduced-motion reliability
- [x] P076: Screen-reader labels sweep (SHOULD)
- [x] P077: i18n lint rule (no hard-coded strings)
- [x] P078: missing-i18n keys detector + CI hook
- [x] P079: Locale-aware number formatting (display-only) (SHOULD)
- [x] P080: Language selection persists + pre-paint apply (no FOUC)

## A8 — Performance + scale (500–1000 nodes)
- [x] P081: Perf harness (generate/load 500/1000-node graphs)
- [x] P082: ?perf=1 FPS overlay + perf logs (SHOULD)
- [x] P083: Animated edges thresholds + hysteresis + tests
- [x] P084: LOD thresholds tuning
- [x] P085: WASM init timing logged + regression guard
- [x] P086: Bundle splitting audit (ensure lazy libs remain lazy)
- [x] P087: Table limits enforcement + UX
- [x] P088: Worker resilience (crash → respawn → notice)
- [x] P089: Eval scheduling to avoid main-thread stalls (SHOULD)
- [x] P090: Lighthouse/perf budget doc + optional CI check (SHOULD)

## A9 — Test suite completion + release hardening
- [x] P091: Coverage thresholds (src/lib + src/engine)
- [x] P092: Integration tests: WASM worker snapshot → result
- [x] P093: Integration tests: save/load round-trip (SHOULD)
- [x] P094: E2E smoke: create project, add blocks, connect, eval, save
- [x] P095: E2E multi-canvas switching + persistence
- [x] P096: E2E variables + bindings + sliders
- [x] P097: E2E CSV import + validation errors (Pro gating)
- [x] P098: E2E plot render + export (SHOULD)
- [x] P099: E2E export download assertions (PDF/Excel) (SHOULD, if CI supports)
- [x] P100: Go-live doc: release checklist + verification steps

---

# PHASE B — Growth v1.1 (Marketplace)
> Claude may start this ONLY after Phase A is complete unless explicitly told otherwise.

- [x] P101: Marketplace schema v0 (items, purchases, storage bucket)
- [x] P102: Marketplace RLS (public browse metadata, gated downloads)
- [x] P103: Marketplace shell page
- [x] P104: Browse/search/filter UI
- [x] P105: Item detail pages
- [x] P106: Install flow for project_template (fork into user projects)
- [x] P107: Template packaging + semver rules
- [x] P108: Author dashboard v0
- [x] P109: Verified author gating
- [x] P110: Review gate v0

- [x] P111: Stripe Connect architecture doc + stubs
- [x] P112: Paid purchase flow (record purchase)
- [x] P113: canPublishMarketplace gating UI + server
- [x] P114: Download/install audit events (future enterprise)
- [x] P115: Marketplace analytics (privacy constrained)

- [x] P116: block_pack install mechanism
- [x] P117: theme install mechanism (CSS vars)
- [x] P118: dependency/compat checks (engine contract)
- [x] P119: moderation tools
- [x] P120: Marketplace E2E smoke

---

# PHASE C — Enterprise v1.2 (Org/RBAC + Audit)
- [x] P121: organizations + org_members tables + role enum
- [x] P122: projects.org_id support
- [x] P123: org RLS policies (membership + role)
- [x] P124: Org UI v0 (create org, invite, roles)
- [x] P125: org billing separation doc

- [x] P126: Audit log schema + capture key events
- [x] P127: Audit log viewer (enterprise-only)
- [x] P128: Audit log redaction guarantee (MUST)
- [x] P129: Retention policy doc
- [x] P130: Enterprise policy hooks for Desktop (policy.json future)

---

# PHASE C.2 — Perfection (optional)
- [x] P144: Visual regression testing (Playwright screenshots)
- [x] P145: Axe accessibility automation in E2E
- [x] P146: Chaos testing (Supabase outages, worker crashes)
- [x] P147: Performance regression CI
- [x] P148: RTL language support
- [x] P149: LLM-assisted graph building (future)
- [x] P150: Template editor (user-defined reusable groups)

---

# PHASE D — Market-Ready Product Maturity (Web vNext)
> Objective: By the end of Phase D, ChainSolve Web is **marketing-ready**, cohesive, premium UI/UX, robust persistence, correct entitlements/billing (Free/Pro/Enterprise), and “Explore” ecosystem is usable and safe.

## Phase D global constraints (never regress)
- verify-ci is the gate: `./scripts/verify-ci.sh` MUST PASS for every completed item.
- CSP must not weaken: no `unsafe-eval`, no inline scripts.
- Adapter boundary: UI components MUST NOT import Supabase directly.
- No secrets/PII in logs/exports/reports/tests/templates.
- Pro/Enterprise features visible to Free users but locked (with upgrade prompt).
- Free users must NOT be able to import/export projects (even though features exist).

## Phase D global deliverables
- “First impression” home/landing inside app shell is premium.
- All popups become first-class draggable/resizable windows.
- Panels/docks behave like a professional workstation (nothing hidden behind console).
- Explore replaces Marketplace in UX and naming.
- Enterprise has real seat-aware plans and org-only Explore content.
- Settings/preferences becomes a serious “workbench configuration center” including theme wizard with live preview.

---

## D0 — Environment, plan, and comms wiring (foundation)
- [x] D0-1: Update billing plan model to include Pro Monthly + Pro Annual + Enterprise (10 seats) + Enterprise Unlimited (monthly + annual)
  - Add plan enum mapping and server-side webhook mapping for new Stripe prices.
  - Ensure plan badge supports: Free / Pro / Enterprise.
  - Acceptance: subscriptions reflect correctly in UI badge after webhook update.

- [x] D0-2: Secrets synchronization checklist + documentation
  - Add `docs/ENV_SECRETS.md`:
    - Cloudflare Pages env vars you listed
    - GitHub Secrets equivalents
    - Supabase edge/function secrets if used
    - “source of truth” + how to rotate
  - Acceptance: team can set up from scratch without missing keys.

- [x] D0-3: In-app contact + support wiring
  - Add “Support” links to:
    - `support@chainsolve.co.uk` (support)
    - `info@chainsolve.co.uk` (general enquiries)
  - Put these in Help/About and error screens.
  - Acceptance: no hardcoded personal emails anywhere.

---

## D1 — App landing + routing redesign (first impression)
- [x] D1-1: Make `/app` the post-login default route (always land in the app environment)
  - If no project open: show “Workbench Home” view (not canvas).
  - If project open: go to canvas environment.
  - Acceptance: brand new user always lands inside app shell, not a half-state.

- [x] D1-2: Workbench Home (no project open)
  - Render: header only + premium home panel
  - Show:
    - Create Project CTA
    - Open Project CTA
    - Project directory list (search, sort, recent)
    - Quick guide links (3–5 items)
    - Explore CTA (locked where applicable)
  - Hide: block library, inspector, sheets bar, canvas toolbar until a project is open.
  - Acceptance: app feels intentional, not “empty canvas with random panels”.

- [x] D1-3: “Project Directory” becomes a first-class view
  - Folder-like experience (filters, recent, pinned, search)
  - Consistent empty states and i18n.
  - Acceptance: directory is usable as a product surface.

---

## D2 — Window system (draggable/resizable popups everywhere)
> Replace “random modals” with consistent in-app windows.

- [x] D2-1: Implement a Window Manager (internal framework)
  - Draggable + resizable + z-index stacking
  - Standard window chrome: title, close, minimize, maximize, restore
  - Keyboard: ESC closes topmost, Cmd/Ctrl+W closes active window
  - Persist window geometry optionally per-user.
  - Acceptance: Settings/About/Docs/Inspector all use the same window system.

- [x] D2-2: Replace “About”, “Settings”, “Documentation”, “Variables”, “Profile” into Window Manager windows
  - No new browser windows. Everything in-app.
  - Acceptance: consistent UI/UX across all windows.

- [x] D2-3: Floating Inspector window (remove right sidebar inspector)
  - Inspector opens as a window
  - Supports selection following:
    - optionally pin to selection
    - manual pin/unpin
  - Acceptance: no fixed right inspector panel exists anymore.

---

## D3 — Docking + bottom panels (console/health)
- [x] D3-1: Add close/minimize for console/terminal and graph health panel
  - Ensure panels never hide core canvas toolbar.
  - Acceptance: user can always close/minimize, and core controls remain accessible.

- [x] D3-2: Redesign canvas toolbar placement
  - Option A: move canvas toolbar to right side (recommended)
  - Option B: keep above dock and make dock push layout up
  - Acceptance: toolbar never sits “behind” panels.

- [x] D3-3: Bottom Dock System (for all bottom panels)
  - Panels: Debug Console, Graph Health, (future) Observability, (future) Export Logs
  - Dock supports:
    - resize height
    - tabs
    - close
    - persist open/closed state per project
  - Acceptance: consistent bottom UX like a workstation IDE.

---

## D4 — Canvas interaction fixes (bugs + polish)
- [x] D4-1: Blank canvas instruction fix
  - Replace “double-click to add” with correct guidance:
    - right-click canvas → context menu → insert block
    - or press `/` (quick insert)
    - or open block library search
  - Acceptance: guidance matches behavior; no misleading copy.

- [x] D4-2: Edge “top-left collapse” bug at low zoom (LOD handle bug)
  - Fix by ensuring edge anchor handles still exist logically at low LOD:
    - keep handles mounted but visually hidden
    - or provide stable anchor points independent of UI ears
  - Add regression test / manual test doc steps.
  - Acceptance: edges never jump to origin when zooming out/in.

- [x] D4-3: Right-click context menus everywhere
  - Canvas: insert block, paste, fit view, layout
  - Node: duplicate, group, inspect, delete
  - Edge: delete, inspect connection
  - Sheet tab: rename, delete, duplicate
  - Acceptance: power-user UX is coherent.

- [x] D4-4: Delete edges via Delete key
  - Clicking an edge selects it; Delete removes it.
  - Ensure undo/redo works.
  - Acceptance: quick deletion works and is stable.

---

## D5 — Sheets toolbar overhaul (Excel-grade)
- [x] D5-1: Sheet delete option (non-last)
  - Prevent deleting last sheet.
  - Confirmation modal with warnings if large canvas.
  - Acceptance: delete works, ordering compacted correctly.

- [x] D5-2: Sheet rename, duplicate, reorder (drag-and-drop)
  - Reorder persists to DB position with stable batching.
  - Acceptance: feels like Excel; no weird reorder bugs.

- [x] D5-3: Sheet context menu
  - Rename / Duplicate / Delete
  - Optional: “Export this sheet” shortcuts
  - Acceptance: consistent with Excel mental model.

---

## D6 — Block library redesign (premium discovery + usability)
- [x] D6-1: Block library UI overhaul
  - Goals:
    - faster searching
    - clearer categories
    - better “recent/favorites”
    - fixed light-mode background bug
  - Acceptance: light mode has correct library background.

- [x] D6-2: Locked Pro features visible to Free users
  - Greyed out + lock icon
  - Clicking opens upgrade modal
  - Acceptance: consistent gating across all UI entrypoints.

- [x] D6-3: Remove “Variables block” CRUD concept from library
  - Variables should be managed in Variables window
  - Keep only a *Variable Source node* that selects from saved variables (see D7)
  - Acceptance: library no longer exposes “variable CRUD” as blocks.

- [x] D6-4: Library structure refactor
  - Primary families:
    - Inputs
    - Variable Source
    - Constant Source
    - Material Source
    - Functions (math/eng/fin/stats)
    - Outputs
    - Data (tables/CSV)
    - Plots (Pro)
  - Acceptance: no fragmented “constants blocks” by category.

---

## D7 — Variable + Constant + Material blocks (unification + wizards)
- [x] D7-1: Variables window upgrade (table + units + validation)
  - Variables have:
    - name, value, unit (string), description
  - Enforce unique names (case-insensitive)
  - Acceptance: variables robust and unit-ready.

- [x] D7-2: Variable Source node redesign
  - Single node “Variable”
  - Dropdown of existing project variables
  - Option “Create new variable…” opens Variables window
  - If variable deleted, node shows warning and resolves NaN→error
  - Acceptance: variable flow coherent and robust.

- [x] D7-3: Constant Source node unification
  - Replace multiple constant blocks with one “Constant” block
  - Dropdown/search over full constants catalog
  - Show resolved value + description
  - Acceptance: constants are one block, easy to search.

- [x] D7-4: Material Source node unification
  - Replace scattered material blocks with one “Material” block
  - Dropdown/search over material presets
  - Outputs: comprehensive material properties
  - Pro-only: “Custom material…” opens wizard to build a new material preset
  - Acceptance: materials are coherent and powerful.

- [x] D7-5: Custom material wizard (Pro)
  - Guided creation:
    - base template
    - fill properties table
    - validate numeric fields
    - save to user profile (and optionally to project)
  - Acceptance: custom materials saved + reusable.

---

## D8 — Settings + Preferences + Theme Wizard (major product surface)
- [x] D8-1: Settings window overhaul (massive)
  - Autosave default OFF (per your request)
  - Numeric formatting:
    - decimal places
    - scientific notation thresholds
    - thousands separators
  - Canvas preferences:
    - LOD thresholds
    - edge animation on/off
    - snap-to-grid default
  - Export preferences:
    - default include images, default export format settings
  - Acceptance: settings feels like a pro tool.

- [x] D8-2: Theme wizard (Pro)
  - Full theme editor:
    - colors for every surface (backgrounds, panels, edges, nodes, text)
    - fonts, font sizes
    - animations styles (reduced motion respected)
  - Live preview:
    - left side “preview workbench” with a sample graph rendering
    - updates in real-time as theme is edited
  - Save theme to profile; switch theme instantly.
  - Acceptance: theme wizard works and preview is accurate.

- [x] D8-3: Saved themes + upload to Explore (Pro)
  - Theme library window: list saved themes, apply, delete
  - Upload flow gated to Pro:
    - attaches metadata
    - includes preview image
  - Acceptance: themes become shareable artifacts.

---

## D9 — Explore (rename Marketplace → Explore + new rules)
> “Explore” is not a store; it is discovery + sharing. Nothing “for sale” here.

- [x] D9-1: Rename “Marketplace” -> “Explore” in UI, routes, copy, docs
  - Keep DB table names if you want, but user-facing must be Explore.
  - Acceptance: no user-facing “Marketplace” remains.

- [x] D9-2: Explore content types (v1)
  - Project templates
  - Groups
  - Themes
  - Custom blocks (future-ready)
  - Each item shows:
    - metadata, author, created, updated, tags
    - downloads count
    - likes
  - Acceptance: browse feels real and complete.

- [x] D9-3: Explore permissions + plan rules
  - Free:
    - can browse
    - can only install 1 project template IF they have 0 projects (maxProjects=1 rule)
    - cannot install groups/themes/custom blocks
    - cannot upload
  - Pro:
    - install any
    - upload templates/groups/themes
  - Enterprise:
    - can access Explore
    - admin can disable Explore via org policy
    - has org-only content space (see D10)
  - Acceptance: all rules enforced both client-side and server-side.

- [x] D9-4: Comments system (moderated)
  - Commenting best practices:
    - rate limiting
    - report comment
    - delete own comment
    - author/moderator controls
  - No toxic content allowed: basic filters + report flow.
  - Acceptance: safe comment UX with controls.

- [x] D9-5: Explore sort/filter
  - Most downloaded, most liked, newest
  - Tag filter
  - Type filter
  - Acceptance: discovery is strong.

- [x] D9-6: Install event tracking
  - Track installs (count) without collecting project content.
  - Respect privacy defaults (opt-in telemetry).
  - Acceptance: stats work without violating privacy.

---

## D10 — Enterprise org-only Explore + admin controls
- [x] D10-1: Org-only Explore “Company Library”
  - Items visible only to users in org
  - Optionally separate tab “Company”
  - Acceptance: org-only isolation works.

- [x] D10-2: Enterprise policy flags (Web)
  - Policy can enforce:
    - Explore enabled/disabled
    - allow installs yes/no
    - allow comments yes/no
  - Persist policy per org
  - Acceptance: admin control has real effect.

- [x] D10-3: Seat model + org membership enforcement
  - Enterprise 10 seats vs unlimited
  - Ensure invites + membership checks align with plan
  - Acceptance: seats enforced in org admin.

---

## D11 — Billing + entitlements upgrades (Stripe Annual + Enterprise)
- [x] D11-1: Update Stripe Checkout flow to support:
  - Pro Monthly + Pro Annual
  - Enterprise 10 seats (monthly/annual)
  - Enterprise Unlimited (monthly/annual)
  - Acceptance: checkout creates correct subscription.

- [x] D11-2: Update webhook processing
  - Map new Stripe price IDs to plan states
  - Persist:
    - plan
    - period end
    - org seat count if enterprise
  - Acceptance: plan badge updates reliably.

- [x] D11-3: Upgrade modal window
  - Shows Free / Pro / Enterprise with monthly/annual toggle
  - Explains locked features
  - “Contact sales” flow for enterprise (info@chainsolve.co.uk)
  - Acceptance: upgrade UX is premium and persuasive.

- [x] D11-4: Lock import/export for Free
  - Even though export exists, Free must be blocked:
    - export PDF/XLSX/.chainsolvejson
    - import .chainsolvejson
  - Locked UI remains visible; clicking opens upgrade window.
  - Acceptance: Free cannot import/export.

---

## D12 — User profile + identity + safety
- [x] D12-1: Profile window
  - Display name
  - Profile image upload (stored in uploads bucket or dedicated avatars bucket)
  - Account metadata
  - Acceptance: profile edits persist and show in UI.

- [x] D12-2: Avatar moderation hooks
  - Report user avatar
  - Admin/moderator review flow (minimal v1)
  - Acceptance: abuse reporting exists.

---

## D13 — Robustness fixes for “ghost conflict” and saving issues
- [x] D13-1: Fix false “project open in another session” conflict
  - Diagnose root cause:
    - stale updated_at
    - background save race
    - canvas add sheet not updating save state
  - Fix and add regression tests.
  - Acceptance: no false conflicts in normal use.

- [x] D13-2: Ensure sheet add/delete/reorder always saves correctly
  - Confirm DB + storage writes are in sync
  - Add tests for state transitions.
  - Acceptance: changes persist reliably.

---

## D14 — Supabase advisor fixes (security + performance)
> Implement migrations to resolve:
> - function_search_path_mutable warning
> - observability_events RLS policy warning
> - performance advisor multiple permissive policies warnings

- [x] D14-1: Fix function_search_path_mutable for `public.handle_canvases_updated_at`
  - Create/replace function with explicit `SET search_path = ''` (or safe pinned schema)
  - Fully qualify objects inside function
  - Acceptance: advisor warning cleared.
  - Note: Supabase linter recommends pinning search_path explicitly for security. :contentReference[oaicite:0]{index=0}

- [x] D14-2: observability_events RLS enabled no policy
  - Add explicit policies (deny-all or correct access)
  - Acceptance: linter warning cleared.

- [x] D14-3: Consolidate “multiple permissive policies” for performance
  - Merge multiple policies for same role/action into one policy with OR logic where possible
  - Targets mentioned:
    - audit_log SELECT
    - marketplace_install_events SELECT
    - marketplace_items SELECT/UPDATE across multiple roles
  - Acceptance: performance advisor warnings reduced/cleared.

---

## D15 — Premium UI/UX uplift pass (timeless workstation look)
- [x] D15-1: Design tokens pass (CSS variables)
  - Define consistent spacing, radii, shadows, typography scale
  - Apply to: home view, explorer, windows, library, toolbars
  - Acceptance: cohesive premium feel.

- [x] D15-2: Light mode polish
  - Fix library background bug (dark in light mode)
  - Ensure contrast meets standards
  - Acceptance: light mode feels intentional.

- [x] D15-3: Remove “top toolbar” and replace with project/user artifact entrypoints
  - Replace old top toolbar (blocks/fit/snap/inspector) with:
    - Variables
    - Groups
    - Themes
    - Materials
    - Custom blocks (future)
  - Acceptance: toolbar matches your product vision.

---

## D16 — Explore/Sharing quality (marketing-ready)
- [x] D16-1: Explore listing cards look premium
  - thumbnail, tags, author badge, plan badge
  - download/like count
  - Acceptance: visually strong for marketing.

- [x] D16-2: Explore item detail page v2
  - Show:
    - what’s included
    - compatibility (engine contract version)
    - changelog per item version
  - Acceptance: user trusts the ecosystem.

- [x] D16-3: Abuse/moderation controls (minimal)
  - report item
  - report comment
  - block user (client-side ignore)
  - Acceptance: safe baseline.

---

## D17 — Release readiness round (polish + go-live)
- [x] D17-1: Ensure nothing says “coming soon”
  - Remove/finish any placeholders
  - Acceptance: app feels complete.

- [x] D17-2: Quick guide content inside app
  - “10 nodes in 2 minutes”
  - “Variables + constants”
  - “Exports (Pro)”
  - “Explore installs”
  - Acceptance: new users can self-serve.

- [x] D17-3: Marketing QA checklist doc
  - screenshots checklist
  - supported browsers
  - common error states and copy
  - Acceptance: ready for public marketing push.

- [x] D17-4: End-to-end tests for:
  - landing -> create project -> add blocks -> save
  - explore browse -> install template (pro)
  - export gating (free blocked, pro allowed)
  - enterprise org-only explore access
  - Acceptance: core flows protected.

---

---

# PHASE E — “Market-ready perfection” (UI overhaul, Auth v2, Admin tooling, Catalog expansion, Reporting)
> Objective: By end of Phase E, ChainSolve feels like a premium workstation app: flawless UX, enterprise-safe auth, robust permissions, complete block catalog strategy, scientific reporting features, and a clean release pipeline.

## Phase E rules (non-negotiable)
- Every item is DONE only when:
  - `./scripts/verify-ci.sh` PASS
  - tests updated/added (as required)
  - i18n keys for EN/DE/FR/ES/IT when UI changes
  - docs + changelog updated
- CSP must not weaken: no `unsafe-eval`, no inline scripts.
- Adapter boundary: UI components must not import Supabase directly.
- Privacy: no prompt storage, no secrets in logs, no PII in exports/tests.
- Free users: can use all “premade function blocks”, but Pro/Enterprise gate heavy features (imports/exports, plots, tables/CSV, groups, themes, Explore uploads, AI, etc.) per current product direction.

---

## E0 — Stop-the-bleeding fixes (must do first, tight diffs)
- [x] E0-1: Fix Settings/Preferences crash: `useNavigate()` outside `<Router>`
  - Root cause: Settings modal/window rendered outside router context or uses navigation hooks in detached subtree.
  - Fix: move Settings window rendering inside router provider OR refactor to pass navigate callback in from routed component.
  - Acceptance:
    - Settings opens with no error in console.
    - Preferences navigation works.
    - No regressions to window manager.

- [x] E0-2: Resolve CSP errors for Cloudflare Insights beacon
  - Current: script load blocked at `https://static.cloudflareinsights.com/beacon.min.js`
  - Decide and implement ONE of:
    A) Disable Cloudflare Insights injection for app domain (preferred for strict CSP + privacy), OR
    B) Allowlist only what’s needed under CSP without reintroducing unsafe-eval (only if it works), OR
    C) Use Cloudflare Zaraz CSP support (nonce) if analytics is required, but still keep telemetry opt-in.
  - Acceptance:
    - No CSP console spam on app load.
    - CSP remains strict and documented.
  - Docs:
    - docs/CSP_PLAYBOOK.md updated with decision and reasoning.

- [x] E0-3: i18next deprecation warning cleanup
  - Fix initialization to non-deprecated signature and ensure no warnings on boot.
  - Acceptance: no i18next deprecation warnings.

- [x] E0-4: Registry/catalog mismatches and missing TS defaults
  - Fix warnings:
    - “Catalog op … has no TS default — UI may not render it”
    - “TS block X not in Rust catalog — engine won’t evaluate it”
  - Target outcome:
    - UI renders catalog-driven blocks generically even without bespoke TS defaults.
    - TS-only blocks either:
      - become pure UI nodes that resolve to engine-supported ops, OR
      - are removed, OR
      - are added to Rust catalog properly.
  - Acceptance:
    - No registry mismatch warnings on boot.
    - Constant/material/probe alignment clarified (documented).

- [x] E0-5: Remove React Flow attribution link (license-aware)
  - Use official `proOptions.hideAttribution` if permitted.
  - Add docs note: if used commercially, consider supporting/keeping attribution. :contentReference[oaicite:3]{index=3}
  - Acceptance: no attribution overlay visible.

---

## E1 — Design system + full UI overhaul (the “premium workstation” foundation)
> Goal: every pixel feels intentional. No mismatched panels, no inconsistent modals, consistent spacing/typography/colors, and everything is dockable/resizable.

- [x] E1-1: Define “Design Tokens v1” (CSS variables + TS constants)
  - Typography scale, spacing scale, radius, shadows, z-index layers, focus rings.
  - Light/dark token completeness.
  - Acceptance: single source of truth; no hard-coded colors in components.

- [x] E1-2: Component primitives upgrade
  - Buttons, Inputs, Select, Tabs, Menus, Tooltips, Popovers, Dialogs, Toasts.
  - Keyboard/focus visible for all.
  - Acceptance: UI primitives replace one-off styling.

- [x] E1-3: Layout refactor: App Shell “workbench” states
  - States:
    - No project open (Workbench Home)
    - Project open (Canvas workspace)
  - Panels:
    - Left dock: Block Library (dockable, resizable, hideable)
    - Right: ALWAYS visible vertical canvas toolbar (pan/zoom/fit/grid)
    - Bottom dock: Terminal + Graph Health (minimize/close/tab)
    - Top: Sheets bar + Project toolbar (project-level windows: variables, groups, imports, themes, materials, custom blocks)
  - Acceptance:
    - no panel overlaps
    - nothing hidden behind terminal
    - consistent docking UX

- [x] E1-4: Window Manager v2 polish (if already exists, harden)
  - Windows:
    - draggable/resizable
    - snap to edges
    - z-order management
    - minimize/maximize/restore
    - remembers position per user (optional)
  - Convert: Settings, Profile, Docs, Variables, Explore item detail, Upgrade plan window.
  - Acceptance: no “browser popup windows” anywhere.

- [x] E1-5: Header + account area overhaul
  - Top-right avatar opens Account window:
    - profile (display name, avatar)
    - plan badge
    - billing/manage plan
    - security (2FA, devices)
  - Settings gear becomes “Preferences” window (no crash).
  - Notifications placeholder removed or implemented.
  - Acceptance: header is clean and “SaaS premium”.

---

## E2 — Auth & account system v2 (signup/login enterprise-grade)
> Goal: proper web-app auth: ToS, marketing prefs, captcha, email verification, 2FA, device sessions, re-login rules.

- [x] E2-1: New Auth UI (login/signup/reset) as first-class routes
  - Signup fields:
    - email, password, confirm password
    - accept Terms & Conditions checkbox
    - marketing email preference (opt-in)
  - Login:
    - remember device checkbox
    - secure error messaging
  - Reset password:
    - robust flow
  - Acceptance: polished UI, no basic/stub forms.

- [x] E2-2: CAPTCHA integration (Turnstile preferred)
  - Supabase Auth supports captcha providers including Turnstile/hCaptcha via auth config. :contentReference[oaicite:4]{index=4}
  - Implement frontend token acquisition + passing `captcha_token` where needed.
  - Acceptance: bots blocked, humans not annoyed, UX clean.

- [x] E2-3: Email verification + ToS versioning
  - Store:
    - accepted_terms_version, accepted_terms_at
    - marketing_opt_in, marketing_opt_in_at
  - Block access to app until email verified and ToS accepted.
  - Acceptance: compliance-ready.

- [x] E2-4: 2FA / MFA (TOTP) in Account Security
  - Supabase MFA enroll/challenge/verify exists in supabase-js. :contentReference[oaicite:5]{index=5}
  - Add:
    - enroll TOTP (QR code)
    - verify challenge
    - disable factor
  - Acceptance: user can enable 2FA, re-login requires it.

- [x] E2-5: Device sessions + remember-me rules
  - Show active sessions list (device name, last active, revoke).
  - “Remember me” affects session persistence policy client-side.
  - Acceptance: user can revoke sessions and sees clear device list.

- [x] E2-6: Developer/admin role bootstrap
  - Add profile role flags:
    - free/pro/enterprise + developer/admin overrides
  - Developer account (ben.godfrey@chainsolve.co.uk) gets:
    - all features unlocked
    - admin tools (danger zone)
    - environment diagnostics
  - Acceptance: dev role works and is server-side enforced.

---

## E3 — Data reset + test personas (safe and controlled)
> You want to wipe test users and create 3 accounts (free/pro/enterprise) + developer account. Do this safely.

- [x] E3-1: Admin “Danger Zone” window (developer/admin only)
  - Tools:
    - delete ALL user-owned data for a specific userId
    - delete a project by id
    - reset local caches (MRU, preferences)
  - Must require typed confirmation (“DELETE”) + re-auth
  - Must never expose service role key to client.
  - Acceptance: safe admin tooling without foot-guns.

- [x] E3-2: Test persona bootstrap script (docs + optional SQL)
  - Provide documented steps to create:
    - free test user
    - pro test user
    - enterprise test user (org membership)
    - developer account
  - Acceptance: reproducible testing setup.

---

## E4 — Block Library + Insert UX (massive upgrade)
> Goal: users find blocks instantly; categories make sense; insert menu matches library.

- [x] E4-1: Block Library IA redesign
  - Top: search + filters (category/type)
  - Sections:
    - Inputs (number, slider, table/list)
    - Variable (source)
    - Constant (source)
    - Material (source)
    - Functions (categorized)
    - Outputs
    - Data/Plots (Pro)
  - Favorites + Recently used
  - Acceptance: dramatically improved discoverability.

- [x] E4-2: Insert dropdown redesign (mirrors library)
  - Top categories then drill-down:
    - Inputs → subcategories
    - Functions → subcategories
    - Outputs → subcategories
  - Right-click canvas context menu uses same insert system.
  - Acceptance: consistent insert everywhere.

- [x] E4-3: Fix: light mode library background is dark
  - Acceptance: light mode visually correct.

---

## E5 — Block Catalog Expansion Program (Excel + engineering calculators)
> Goal: ChainSolve becomes the “one stop shop” for numerical functions. Strategy matters more than brute force.

- [x] E5-1: Catalog governance + generator pipeline
  - Create `docs/BLOCK_CATALOG_GOVERNANCE.md`:
    - naming conventions
    - categories taxonomy
    - how to add blocks (Rust + tests + i18n)
    - versioning + contract changes
  - Create a structured manifest file (YAML/JSON) listing blocks to implement and metadata.
  - Acceptance: future block additions are systematic.

- [x] E5-2: Excel numeric functions coverage v1 (core set)
  - Implement a prioritized set first (common + high ROI):
    - rounding, abs, min/max, trig, log/exp, stats basics, combinatorics, financial basics
  - All these premade functions must be Free.
  - Acceptance: strong baseline, documented list.

- [x] E5-3: Engineering toolbox coverage v1
  - Mechanics, fluids, thermo, electrical, materials basics
  - Acceptance: meaningful engineering set.

- [x] E5-4: Advanced function packs v2–v4 (staged)
  - Create staged milestones:
    - v2: stats distributions, regression, filters
    - v3: matrix/vector ops
    - v4: unit conversion expansions, dimensional analysis helpers
  - Acceptance: ongoing scalable program.

- [x] E5-5: Category + search quality
  - Synonyms, tags, search ranking
  - Acceptance: “I can find anything fast.”

---

## E6 — Scientific reporting: equation/notation view (graph → math)
> Goal: users can select a chain and get proper scientific notation output, with substituted values.

- [x] E6-1: Expression extraction v1
  - For a selected output node:
    - trace upstream DAG
    - build expression tree (symbolic-ish)
    - support scalar, vector, table forms
  - Acceptance: stable expression build for common ops.

- [x] E6-2: Pretty math rendering + substitution
  - Display:
    - symbolic form: `a + b = c`
    - substituted: `1 + 2 = 3`
  - Copy as:
    - plain text
    - LaTeX-like string
  - Acceptance: usable in reports immediately.

- [x] E6-3: PDF integration
  - Option: include equation blocks in audit PDF (Pro)
  - Acceptance: audit PDFs can include notation sections.

---

## E7 — Annotations & presentation tools
> Goal: users can “dress up” graphs for sharing/reporting.

- [x] E7-1: Annotation layer v1 (non-evaluating)
  - Add annotation node kinds:
    - text label
    - arrow connector
    - callout box
    - highlight region
  - Persist in canvas JSON.
  - Acceptance: annotations don’t affect evaluation; export renders them.

- [x] E7-2: Canvas styling tools
  - Color themes per group/region
  - Snap-to-grid and alignment helpers
  - Acceptance: presentation-grade visuals.

---

## E8 — Reliability fixes (ghost conflicts, save robustness)
- [x] E8-1: Eliminate false “open in another session” warnings
  - Root-cause + fix
  - Add regression tests
  - Acceptance: no false conflicts and saves always apply.

- [x] E8-2: Save pipeline robustness audit
  - Ensure sheet add/reorder never silently fails.
  - Ensure conflict handling never leaves app in “can’t save” state.
  - Acceptance: reliable saving under stress.

---

## E9 — CSP + analytics + privacy finalization
- [x] E9-1: Decide analytics strategy for app domain
  - If enabled:
    - must be opt-in
    - must be CSP compatible (nonce approach if needed)
  - If disabled:
    - remove injection sources
  - Acceptance: no CSP noise, privacy aligned.

- [x] E9-2: Central redaction + privacy scanner coverage expansion
  - Ensure any new feature (AI, Explore, comments) uses same redaction rules.
  - Acceptance: no leaks in exports/logs.

---

## E10 — Explore ecosystem finishing (community-safe)
- [x] E10-1: Comments moderation v1
  - rate limit, report, delete own
  - abuse workflow minimal
  - Acceptance: safe commenting.

- [x] E10-2: Explore metrics
  - downloads, likes, installs
  - privacy-safe (no project content)
  - Acceptance: trustworthy stats.

- [x] E10-3: Enterprise “company-only Explore” hardening
  - org-only visibility
  - admin policy restricts access
  - Acceptance: enterprise safe.

---

## E11 — Release candidate hardening
- [x] E11-1: E2E suite expansion to cover new UX
  - login/signup, ToS, captcha, 2FA (mock)
  - workbench home
  - window manager
  - insert menu
  - export gating
  - Acceptance: major flows protected by CI.

- [x] E11-2: Go-live docs v2
  - deployment checklist
  - CSP checklist
  - Stripe checklist (annual + enterprise)
  - Test persona checklist
  - Acceptance: “anyone can release”.

- [x] E11-3: Performance + polish pass
  - remove jank, improve LOD, confirm edge stability
  - Acceptance: feels fast and smooth.

---

---

# PHASE F — Full Repo Audit + Professional Housekeeping + Harmony Pass (Final Web App Readiness)
> Objective: Claude performs a deep, file-by-file audit, then cleans, refactors, and hardens the repo so the web app is cohesive, maintainable, secure, and production-ready.

## Phase F rules (non-negotiable)
- Every item DONE requires:
  - `./scripts/verify-ci.sh` PASS
  - relevant tests updated/added
  - docs updated + changelog entry where behavior changes
- CSP must not weaken.
- Adapter boundary enforced: UI components MUST NOT import Supabase directly.
- No secrets/PII in logs/exports/tests/templates.
- Prefer quarantine over deletion when uncertain.

## Phase F philosophy (Claude has authority, but must be disciplined)
Claude MAY:
- restructure folders, rename modules, and consolidate duplicated utilities
- delete dead code *only if proven unused*
- add missing guardrails, docs, and test harnesses
Claude MUST:
- keep commits atomic (1 item = 1 commit)
- avoid “big bang” refactors without checkpoints
- keep the app behavior correct and consistent with requirements

---

## F0 — Repo-wide audit (read every file, produce a report, no code changes)
- [x] F0-1: Full file-by-file audit + map
  - Claude must scan:
    - src/**, crates/**, functions/**, supabase/**, scripts/**, docs/**
  - Produce `docs/AUDIT/REPO_AUDIT_REPORT.md` including:
    - directory map and purpose
    - architectural boundaries (UI, services, adapters, engine worker, exports)
    - list of “hot zones” (security/CSP, auth, billing, persistence, exports, AI)
    - list of dead code candidates (with evidence: not imported, not referenced)
    - list of duplicated logic candidates (hashing, redaction, env parsing, path sanitization)
    - dependency risk summary (packages with heavy footprint or sensitive supply chain)
  - Acceptance: report is detailed enough to guide cleanup without guesswork.

- [x] F0-2: “Repo Hygiene Plan” doc (what will be changed)
  - Create `docs/AUDIT/REPO_HYGIENE_PLAN.md`:
    - enumerates cleanup tasks
    - defines which files will be removed/quarantined
    - explains any renames/moves
  - Acceptance: clear plan before edits begin.

---

## F1 — Housekeeping cleanup (safe, mechanical, reduces confusion)
- [x] F1-1: Remove/ignore local-only noise and enforce git cleanliness
  - Ensure `.claude/`, `.dev.vars*`, `.env*` ignored and not tracked. :contentReference[oaicite:3]{index=3}
  - Ensure git hooks and devcontainer features are consistent (Git LFS present in container).
  - Acceptance: “fresh container → clean git status” after normal dev actions.

- [x] F1-2: Normalize docs structure + index
  - Add/refresh `docs/README.md` as the hub:
    - links to requirements suite, architecture, security, exports, AI, devcontainer
  - Move scattered docs into a predictable taxonomy:
    - docs/AUDIT/
    - docs/EXPORTS/
    - docs/SECURITY/
    - docs/DEV/
    - docs/PRODUCT/
  - Acceptance: docs are discoverable and consistently named.

- [x] F1-3: Scripts sanity and consistency
  - Ensure `scripts/verify-ci.sh` is the single authoritative gate.
  - Any “verify-fast” remains optional and clearly described.
  - Acceptance: no duplicate “CI” scripts drifting apart.

---

## F2 — Architecture hardening and boundary enforcement (prevent regressions)
- [x] F2-1: Enforce adapter boundary via lint rules
  - Add ESLint rules to forbid importing Supabase client directly from UI folders:
    - use `no-restricted-imports` for patterns like `src/components/**` importing `supabase` modules. :contentReference[oaicite:4]{index=4}
  - Add allowlist exceptions only in adapter/service layer.
  - Acceptance: CI fails if UI imports Supabase directly.

- [x] F2-2: Centralize environment config validation
  - Implement `src/lib/env.ts` that validates required env vars at startup:
    - client-safe vars (VITE_*)
    - server-only vars (Cloudflare context.env)
  - Document `.dev.vars` usage for local Pages functions. :contentReference[oaicite:5]{index=5}
  - Acceptance: missing env causes an actionable error (not silent failure).

- [x] F2-3: Canonical privacy + redaction library
  - Ensure one canonical redaction utility is used everywhere:
    - debug export, PDF/Excel/.chainsolvejson, AI usage logs, import reports
  - Add regression tests: tokens/keys/emails never leak.
  - Acceptance: no duplicate redaction implementations remain.

---

## F3 — Dependency + bundle + performance hygiene
- [x] F3-1: Dependency audit + pruning
  - Remove unused deps.
  - Ensure lazy-loaded heavy deps remain lazy (PDF/XLSX/Vega/AI).
  - Acceptance: build output shows chunks correctly split and no bundle regressions.

- [x] F3-2: Add “dependency policy” doc
  - Create `docs/DEV/DEPENDENCIES.md`:
    - what is allowed, what is discouraged
    - how to add a new dependency
    - supply chain checks expectations
  - Acceptance: future devs can follow policy.

- [x] F3-3: Performance budget and regression hooks
  - Ensure bundle-size checks are meaningful and stable.
  - Add optional perf note: how to run a perf harness and confirm LOD/edges stability.
  - Acceptance: perf regressions are catchable.

---

## F4 — Security hardening sweep (repo and DB migrations)
- [ ] F4-1: Supabase migration hygiene pass
  - Ensure all migrations are idempotent and safe to re-run. :contentReference[oaicite:6]{index=6}
  - Avoid touching restricted schemas (`auth`, `storage`, `realtime`) beyond supported operations. :contentReference[oaicite:7]{index=7}
  - Acceptance: clean migration set and documented conventions.

- [ ] F4-2: RLS & policy consolidation pass
  - Reduce “multiple permissive policies” where possible (merge OR logic).
  - Ensure tables with RLS enabled have explicit policies (or explicit deny-all).
  - Acceptance: Supabase advisor warnings reduced/cleared and policies are clear.

- [ ] F4-3: CSP policy + enforcement cleanup
  - Ensure CSP is:
    - consistent in headers and documented
    - no third-party script injections without explicit allowlist decision
  - Acceptance: no CSP console spam; CSP doc is current.

---

## F5 — UI/UX cohesion pass (harmonize everything end-to-end)
- [ ] F5-1: UI consistency audit
  - Identify and fix:
    - inconsistent window chrome
    - inconsistent button styles
    - inconsistent spacing/typography
    - inconsistent empty states
  - Acceptance: “one design language” everywhere.

- [ ] F5-2: Navigation + router correctness audit
  - Ensure every window/dialog that uses navigation hooks is inside Router context.
  - Acceptance: no `useNavigate()` errors anywhere.

- [ ] F5-3: Panel/dock/window interaction audit
  - Ensure:
    - right-side toolbar always visible
    - bottom dock never hides tools
    - inspector/profile/settings/docs all behave like proper windows
  - Acceptance: workstation UX feels complete.

---

## F6 — Catalog/engine registry integrity (zero mismatch)
- [ ] F6-1: Single source of truth for catalog registration
  - Fix any mismatches:
    - TS blocks not in Rust catalog
    - Rust ops missing TS defaults (UI should still render generically)
  - Add a CI test that fails on mismatch between TS registry and Rust catalog list.
  - Acceptance: no “engine won’t evaluate” registry warnings.

- [ ] F6-2: Full block catalog sanity tests
  - Ensure every block renders, can be instantiated, and evaluates if expected.
  - Acceptance: smoke tests for block creation + evaluation.

---

## F7 — Release readiness hardening (final polish and “it just works”)
- [ ] F7-1: Full release dry-run script
  - Add `docs/DEV/RELEASE_DRY_RUN.md`:
    - how to run verify-ci, build, deploy preview checks
    - how to validate CSP, auth flows, exports gating, AI quotas
  - Acceptance: any team member can do release rehearsal.

- [ ] F7-2: “No unfinished UX” sweep
  - Remove any “coming soon,” broken buttons, dead menu items.
  - Acceptance: product feels finished.

- [ ] F7-3: Final repo re-org (optional if needed)
  - If audit reveals major structural confusion, do a final “libraries” separation:
    - src/lib (pure logic)
    - src/services (adapter-facing)
    - src/ui (components/windows)
    - src/engine (worker/bridge)
  - Acceptance: repo is intuitive and scales.

- [ ] F7-4: final checks
  - Provide a detailed and thorough idiot-proof list for me to make sure supabase, openai, cloudflare, resend and any other auth or other services are completely setup and all api keys/secrets setup so the repo works flawlessly and professionally.

---