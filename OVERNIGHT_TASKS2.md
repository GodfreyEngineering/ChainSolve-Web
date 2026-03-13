# Overnight Run

Status: Not started | Model: Claude Opus 4.6
> Live task list. Check off items as completed. Mark blockers as [BLOCKED: reason].

---

## Phase 1 — Foundation & Infrastructure

> DB, auth, RLS, security fundamentals. Everything else depends on these.

- [x] **1.01 Fix Dependabot / CI workflow failures** — Review `.github/workflows/*.yml` for failing Dependabot PRs. Pin compatible Node 22 / Rust stable versions, ensure `VITE_IS_CI_BUILD=true` is set for PR jobs (per invariant #3 in CLAUDE.md). Fix any stale lockfile or secret-access issues. Verify: open a Dependabot PR and confirm all CI jobs pass green.

- [x] **1.02 Database FK cascade hardening** — Create `supabase/migrations/0012_fk_cascade_and_indexes.sql`. Add `ON DELETE CASCADE` to `canvases.project_id_fkey`, `project_assets.project_id_fkey`, `project_snapshots.project_id_fkey`, `node_comments.project_id_fkey`, `simulation_runs.project_id_fkey`, `fs_items.project_id_fkey`. Add `ON DELETE CASCADE` to `marketplace_install_events.item_id` FK. Add missing indexes on all unindexed FKs. Verify: delete a project via SQL, confirm all child rows cascade-delete with no FK errors.

- [x] **1.03 RLS policy audit & hardening** — Create `supabase/migrations/0013_rls_hardening.sql`. Audit all 29 tables for RLS coverage. Ensure `simulation_runs`, `project_snapshots`, `node_comments`, `fs_items`, `group_templates` all have SELECT/INSERT/UPDATE/DELETE policies scoped to `auth.uid()`. Add missing policies. Verify: `src/supabaseMigrations.test.ts` passes; attempt cross-user access via Supabase SQL editor — denied.

- [x] **1.04 Org seat enforcement at DB level** — Add a trigger or CHECK constraint on `org_members` INSERT that validates `count(org_members where org_id) < organizations.max_seats`. Currently enforcement is application-only. Add to migration 0013. Verify: attempt to add member beyond max_seats — INSERT fails.

- [x] **1.05 Input validation: shared `validateUserString()` utility** — Create `src/lib/validateUserString.ts`. Rules: 3–50 chars, alphanumeric + underscore + dash only (no spaces), case-insensitive offensive word filter (expand `FORBIDDEN_PATTERNS` from current `validateDisplayName.ts`). Apply to: display names, project names, material names, group names, theme names, all filenames. Update `validateDisplayName.ts` and `validateProjectName.ts` to delegate. Verify: unit tests cover no-spaces, offensive words blocked, edge cases. `npm run test:unit` passes.

- [x] **1.06 2FA email gate for billing & account changes** — Wire `BillingAuthGate.tsx` (already exists) into actual billing flows. Require email OTP challenge before: changing password, changing email, updating billing method, deleting account. Use Supabase MFA API (TOTP already implemented in `MfaChallengeScreen.tsx`). Verify: attempt billing change → OTP challenge appears. Existing tests `MfaChallengeScreen.test.ts` pass.

- [x] **1.07 Session security tightening** — Audit `src/lib/sessionService.ts`. Ensure: (a) session token rotation on privilege escalation, (b) `SESSION_CHECK_INTERVAL_MS` (60s) actually revokes stale sessions server-side via `cleanup_stale_sessions(days)` RPC, (c) single-session policy enforced for enterprise orgs via `policy_single_session`. Verify: login on two devices with enterprise org — first session revoked.

- [x] **1.08 Rate limiting on all public Cloudflare Functions** — Add per-IP + per-user rate limiting middleware to `functions/_middleware.ts`. Limits: auth endpoints (5/min), stripe webhooks (exempt — Stripe retries), AI endpoint (10/min free, 30/min pro), student verification (3/hr), account deletion (1/day — already in DB). Use Cloudflare `request.cf` for IP. Verify: exceed rate limit → 429 response with `Retry-After` header.

- [x] **1.09 Scheduled Supabase backups** — Create `.github/workflows/backup.yml` with daily cron (`0 3 * * *`). Call Supabase Management API `POST /v1/projects/{ref}/database/backups`. Log to `audit_log` table. Create `docs/BACKUP_RUNBOOK.md` with restore procedures. Verify: trigger manually, confirm backup in Supabase dashboard.

- [x] **1.10 Storage cleanup policy** — Add a scheduled function or GitHub Action that: (a) removes orphaned files in `projects` bucket not referenced by any `canvases.storage_path` or `project_assets.storage_path`, (b) removes orphaned files in `uploads` bucket not referenced by `profiles.avatar_url`. Run weekly. Verify: create orphaned file, run cleanup, file removed.

- [x] **1.11 Student verification brute-force protection** — In `functions/api/student/confirm.ts`, add rate limiting: max 5 attempts per email per hour. After 5 failures, lock the verification for 1 hour. Hash comparison should use constant-time comparison. Verify: attempt 6 wrong codes → locked response.

- [x] **1.12 Stripe webhook idempotency audit** — Verify `stripe_events` table dedup works: INSERT ON CONFLICT DO NOTHING on `id` (Stripe event ID). Check all webhook handlers check for existing event before processing. Verify: replay same webhook event — no duplicate processing.

- [x] **1.13 Auth session missing warning fix** — The console warning `[auth] session invalid — signing out: Auth session missing!` appears on fresh load. In `src/lib/supabase.ts` and `src/hooks/useSessionGuard.ts`, suppress this warning for initial unauthenticated state (not logged in = expected, not an error). Only warn when a previously-valid session becomes invalid. Verify: open app not logged in — no console warning.

---

## Phase 2 — Critical Bug Fixes

> Fix the 7+ bugs the user reported plus related data integrity issues.

- [x] **2.01 Tab switching wipes canvases — save-before-switch** — In `src/pages/CanvasPage.tsx` `handleSwitchCanvas()` (~line 917): ensure `doSave()` completes (await it) BEFORE calling `setActiveCanvasId()`. Add a loading gate: set a `canvasSwitching` flag that prevents CanvasArea from rendering with stale/empty nodes. Only render CanvasArea once `initNodes` is populated from the loaded canvas. Use a `key={canvasId + loadCounter}` prop on CanvasArea to force clean remount. Files: `src/pages/CanvasPage.tsx`, `src/stores/canvasesStore.ts`. Verify: open project with 3 sheets, add blocks to each, switch tabs rapidly 10 times — blocks persist on every tab. Write e2e test.

- [x] **2.02 Tab switching wipes canvases — load-after-switch** — In the canvas load path (`loadCanvasGraph` in `src/lib/canvases.ts`), add retry with exponential backoff if storage download fails. If canvas has no stored graph yet (new canvas), initialize with empty arrays, not undefined. Add `canvasCache.ts` write-through: cache the last-saved graph per canvasId so loads can use cache as fallback. Files: `src/lib/canvases.ts`, `src/lib/canvasCache.ts`, `src/lib/canvasStorage.ts`. Verify: disconnect network during tab switch — canvas loads from cache.

- [x] **2.03 Deleting open project guard** — In `src/components/app/sidebar/ProjectsPanel.tsx` `handleDelete()` (~line 223): check if `useProjectStore.getState().projectId === proj.id`. If so, first navigate to `/app` (scratch), call `resetProject()`, `resetCanvases()`, clear engine state, THEN delete. Also add confirmation dialog: "This project is currently open. Close it and delete?" Files: `src/components/app/sidebar/ProjectsPanel.tsx`, `src/lib/projects.ts`, `src/stores/projectStore.ts`. Verify: open project → delete from sidebar → app redirects to scratch, no console errors, reload shows no orphaned data.

- [x] **2.04 Constant block "Unknown block type"** — In `src/engine/bridge.ts` (~line 71–78): when `blockType === 'constant'` and `selectedConstantId` is set but NOT found in `CONSTANT_VALUES` map, fall back to `blockType = 'number'` with `value = 0` and add a warning to the node's data. Do NOT fall through to `blockType = constId` which produces unknown Rust ops like `constantoutput`. Also handle `selectedConstantId === undefined/null` → default to `'number'` with value 0. Files: `src/engine/bridge.ts`, `src/blocks/constantsCatalog.ts`. Verify: add constant block with no selection → shows 0, no error. Add constant block with valid selection (Pi) → shows 3.14159... Unit test in `bridge.test.ts`.

- [x] **2.05 Publish/Subscribe blocks always show 0** — Root cause: when Canvas A evaluates and publishes values via `publishedOutputsStore.updateFromCanvas()`, Canvas B's engine worker is never notified. Fix: in `src/pages/CanvasPage.tsx`, subscribe to `usePublishedOutputsStore` changes. When published values change AND the change came from a different canvas, trigger a re-evaluation of the current canvas by sending the updated published values into the engine snapshot (via `bridge.ts` line 97–106 where subscribe values are injected). Files: `src/pages/CanvasPage.tsx`, `src/engine/useGraphEngine.ts`, `src/stores/publishedOutputsStore.ts`, `src/engine/bridge.ts`. Verify: Sheet 1: Number(42) → Publish("ch1"). Sheet 2: Subscribe("ch1") → Display. Display shows 42. Change to 99, Display updates.

- [x] **2.06 Table input double-typing** — In `src/components/canvas/editors/TableEditor.tsx`, the `handleCellKeyDown` handler starts edit mode on keypress AND the character propagates into the now-focused input. Fix: when transitioning from display→edit on a printable key, call `e.preventDefault()`, set `editValue` to the pressed key character, then focus the input. This prevents the key from being typed twice. Also check `src/components/canvas/nodes/SourceNode.tsx` for similar issue with number inputs. Files: `src/components/canvas/editors/TableEditor.tsx`, `src/components/canvas/nodes/SourceNode.tsx`. Verify: type "6" into table cell → shows "6" not "66". Type "123" rapidly → shows "123".

- [x] **2.07 AI panel "upgrade to pro" for developer plan** — In `src/components/app/AiCopilotWindow.tsx` (~line 260): replace manual plan checking (`plan === 'pro' || plan === 'trialing' || plan === 'enterprise'`) with `getEntitlements(effectivePlan).canUseAi`. Import `getEntitlements` from `src/lib/entitlements.ts`. This automatically covers developer, student, and future plans. Search entire codebase for other manual plan checks and replace with entitlements. Files: `src/components/app/AiCopilotWindow.tsx`, grep for `plan === 'pro'` across all files. Verify: log in as developer → AI panel works. Unit test checking all plan types.

- [x] **2.08 Project save/open robustness** — Audit the full save pipeline: `AutosaveScheduler` → `doSave()` → `saveCanvasGraph()` → Supabase storage upload. Add: (a) exponential backoff with jitter for retries (extend existing `OFFLINE_RETRY_DELAYS`), (b) `recoverStuckSave()` watchdog on 10-second timeout, (c) verify `completeSave` timestamp sync after each successful save, (d) write-through canvas cache so loads never show empty canvas during network hiccups, (e) conflict detection via `save_project_metadata` RPC's compare-and-swap. Files: `src/pages/CanvasPage.tsx`, `src/lib/canvases.ts`, `src/lib/canvasCache.ts`, `src/lib/canvasStorage.ts`. Verify: throttle to 3G → edits save eventually. Kill network → offline status. Restore → save completes.

- [x] **2.09 Number input weird behaviour on all blocks** — Audit all block node components (`SourceNode.tsx`, `OperationNode.tsx`, `DataNode.tsx`) for controlled input handling. Ensure: (a) `onChange` updates state, (b) `onKeyDown` doesn't duplicate characters, (c) `onBlur` commits final value, (d) React controlled value is always in sync. Common pattern: use `useRef` for the editing value and only commit to node data on blur/enter. Files: `src/components/canvas/nodes/SourceNode.tsx`, `src/components/canvas/nodes/OperationNode.tsx`, `src/components/canvas/nodes/DataNode.tsx`. Verify: type numbers into every block type → correct value every time.

- [x] **2.10 Canvas data corruption prevention** — Add a `canvasSchema.ts` validation step on every save: before uploading to storage, validate the graph JSON against the schema. Reject saves with invalid data (log error, keep last known good). Add a `repairCanvas()` function that strips invalid nodes/edges and logs what was removed. Files: `src/lib/canvasSchema.ts`, `src/lib/canvases.ts`. Verify: corrupt a canvas JSON manually → repair function fixes it, save succeeds with clean data.

- [x] **2.11 i18next console warning cleanup** — The `i18next is maintained with support from Locize` message is a startup banner. Suppress it by setting `i18next.init({ ... })` option `logLevel: 'warn'` or filtering the specific message in `src/i18n/config.ts`. Files: `src/i18n/config.ts`. Verify: open app → no i18next marketing banner in console.

---

## Phase 3 — UX Polish

> Visual, interaction, and terminology improvements. No new features, just making existing things better.

- [x] **3.01 Share button positioning** — Move share button to LEFT of plan badge with 8px gap. Only render when `projectStore.projectId` is truthy AND project is shareable (not scratch). Files: `src/components/app/WorkspaceToolbar.tsx` (or `AppHeader.tsx`). Verify: visual inspection — share button left of badge, hidden when no project.

- [x] **3.02 Status bar: "nodes" → "blocks", "edges" → "chains"** — In `src/components/app/StatusBar.tsx` lines 54/58, change i18n keys from `statusBar.nodes`/`statusBar.edges` to `statusBar.blocks`/`statusBar.chains`. Update all 6 locale files (`en.json`, `es.json`, `fr.json`, `it.json`, `de.json`, `he.json`). Also rename internal variable names `nodeCount`/`edgeCount` to `blockCount`/`chainCount` for consistency. Files: `src/components/app/StatusBar.tsx`, `src/i18n/locales/*.json`. Verify: status bar shows "X blocks · Y chains".

- [x] **3.03 Rename "nodes"/"edges" terminology app-wide** — Grep entire codebase for user-facing strings containing "node" or "edge" (in UI text, tooltips, labels, error messages — NOT code variable names). Replace with "block"/"chain" respectively. Update all locale files. Files: all locale JSONs, any component with hardcoded user-facing text. Verify: search app UI — no mention of "nodes" or "edges" anywhere user-visible.

- [x] **3.04 Inspector panel default closed on project load** — Find where inspector opens on first project load. In `src/contexts/WindowManagerContext.tsx` or `src/components/canvas/CanvasArea.tsx`, ensure inspector window is NOT in the initial open windows set. Only block library should be expanded by default. Files: `src/contexts/WindowManagerContext.tsx`, `src/contexts/PanelLayoutContext.tsx`, `src/components/canvas/CanvasArea.tsx`. Verify: open a project fresh — inspector is closed, block library is open.

- [x] **3.05 Remove inspector side panel — keep only floating inspector** — If there's a docked right-side inspector panel separate from the floating inspector, remove it. Inspector should ONLY appear as a floating window on double-click or via context menu "Inspect". Files: `src/components/canvas/FloatingInspector.tsx`, `src/components/app/RightSidebar.tsx` (if exists). Verify: open project — no right sidebar inspector panel. Double-click block → floating inspector appears.

- [x] **3.06 All panels collapsed by default except block library** — Set default state in `PanelLayoutContext.tsx` or wherever panel defaults are stored: Block Library = expanded, Bottom Dock = collapsed, AI Panel = collapsed, Inspector = closed, Variables Panel = collapsed, Problems Panel = collapsed. Files: `src/contexts/PanelLayoutContext.tsx`, `src/components/app/AiDockPanel.tsx`. Verify: fresh project open — only block library visible.

- [x] **3.07 Dropdown overflow outside block area** — Block node `<select>` elements are clipped by the node container. Fix: use React Portal to render dropdowns at `document.body` level, or change node container CSS from `overflow: hidden` to `overflow: visible` with proper z-indexing. For React Flow nodes, use `nodesConnectable` and ensure `zIndex` on dropdowns is above the ReactFlow viewport. Files: `src/components/canvas/nodes/SourceNode.tsx`, `src/components/canvas/nodes/OperationNode.tsx`, `src/components/canvas/nodes/nodeStyles.ts`, `src/index.css`. Verify: add Constant block → dropdown extends beyond block boundary, fully readable.

- [x] **3.08 Context menus screen-boundary aware** — Create `src/hooks/useMenuPosition.ts`: given `(x, y, menuRef)`, measure menu size after render, flip left/right and up/down if menu would overflow viewport. Apply to: `ContextMenu.tsx`, `SheetsBar.tsx` context menu, any other popover/dropdown. Files: new `src/hooks/useMenuPosition.ts`, `src/components/canvas/ContextMenu.tsx`, `src/components/app/SheetsBar.tsx`. Verify: right-click near bottom-right corner → menu flips to stay on screen.

- [x] **3.09 Remove "Learn More" buttons** — Remove `HelpLink` usage from: (a) canvas toolbar, (b) block library window, (c) bottom panel, (d) AI panel. Keep HelpLink only in Inspector where it's useful. Files: `src/components/canvas/CanvasToolbar.tsx`, `src/components/canvas/BlockLibrary.tsx`, `src/components/canvas/BottomDock.tsx`, `src/components/app/AiDockPanel.tsx`. Verify: grep `HelpLink` — only Inspector usage remains.

- [x] **3.10 Remove array/vector input block** — Verify `vectorInput` block is not registered in `src/blocks/registry.ts` or `data-blocks.ts`. Remove any remaining references in `blockSearchMetadata.ts`, locale files, documentation. Ensure Block Library search for "array" or "vector" shows no input block (vector operation blocks like "vectorSum" are fine). Files: `src/blocks/data-blocks.ts`, `src/blocks/blockSearchMetadata.ts`, `src/blocks/registry.ts`. Verify: search "array" in block library → no result. `blockManifest.test.ts` passes.

- [x] **3.11 Material block — confirm single block in library** — Investigation shows this is intentional design (BUG-12): TS key `'material'` maps to Rust op `'material_full'`. Verify Block Library shows exactly ONE "Material" block. If two appear, remove the duplicate registration. If only one appears, mark this done. Files: `src/blocks/registry.ts`. Verify: block library shows one Material block.

- [x] **3.12 Chain (edge) colors: white default, yellow warnings, red errors** — Modify edge rendering in `src/components/canvas/edges/AnimatedEdge.tsx`. Default stroke: `var(--text)` (white in dark mode). If ANY downstream node has a warning (division by zero, unit mismatch), stroke turns `var(--warning)` (yellow). If ANY node in the error propagation path has an error value, stroke turns `var(--danger)` (red). Errors propagate upstream to root cause — color the entire path from error source to the node that caused it. Use `ComputedContext` values to determine error/warning state. Files: `src/components/canvas/edges/AnimatedEdge.tsx`, `src/engine/value.ts` (add `isWarning` helper), `src/components/canvas/CanvasArea.tsx` (pass computed values to edges). Verify: Number → Divide(by 0) → Display: edge from Divide→Display is red. Add warning condition → yellow edge.

- [x] **3.13 Fancy collapse/expand panel buttons with animations** — Replace all panel collapse chevrons with bold, visible buttons. Add CSS `transform: rotate(180deg)` transition (0.3s ease) on toggle. Add hover scale effect (1.1x). Apply to: Block Library, Bottom Dock, AI Panel, left sidebar, any collapsible section. Files: `src/components/canvas/BlockLibrary.tsx`, `src/components/canvas/BottomDock.tsx`, `src/components/app/AiDockPanel.tsx`, `src/components/app/LeftSidebar.tsx`, `src/index.css` (animation classes). Verify: click any collapse/expand button → smooth chevron flip with hover glow.

- [x] **3.14 Left-click drag to multi-select** — Enable ReactFlow's built-in selection on drag. Set `selectionOnDrag={true}` and `panOnDrag={[1, 2]}` (middle/right click to pan) on the `<ReactFlow>` component in `CanvasArea.tsx`. Configure `selectionMode` for intersection or enclosure. Files: `src/components/canvas/CanvasArea.tsx`. Verify: left-click drag on empty canvas → blue selection rectangle. Release → enclosed blocks selected.

- [x] **3.15 Right-click canvas background context menu** — Expand the canvas background context menu in `ContextMenu.tsx` `kind: 'canvas'` section. Add: "Add Block Here" (opens block picker at click position), "Paste" (if clipboard has blocks), "Select All", "Fit View", "Auto Layout", "Toggle Grid", "Toggle Minimap", "Insert Annotation →" (submenu: Text, Callout, Arrow, Shape, Sticky Note), "Insert from AI Prompt". Files: `src/components/canvas/ContextMenu.tsx`, `src/components/canvas/CanvasArea.tsx`. Verify: right-click empty canvas → full context menu with all items functional.

- [x] **3.16 Annotations overhaul — wire toolbar button** — The annotation system exists (`annotationRegistry.ts` has 10+ types) but the canvas toolbar "Insert Annotation" button may not be properly connected. Wire the toolbar button to open a dropdown of annotation types. On selection, insert the annotation at viewport center or last click position. Files: `src/components/canvas/CanvasToolbar.tsx`, `src/annotations/annotationRegistry.ts`, `src/components/canvas/CanvasArea.tsx`. Verify: click annotation toolbar button → dropdown appears → select "Text" → text annotation appears on canvas.

- [x] **3.17 Annotations — full PowerPoint-like suite** — Enhance annotation system: (a) text boxes with position/resize/format (bold, italic, font size, color, alignment), (b) arrows that snap to blocks with configurable start/end markers, (c) shapes (rectangle, ellipse, diamond) with fill/stroke, (d) sticky notes, (e) callout boxes with accent bars, (f) bullet list support in text annotations, (g) inline LaTeX rendering (KaTeX already integrated), (h) z-order controls (bring front/send back). Files: `src/components/canvas/nodes/AnnotationNode.tsx`, `src/components/canvas/AnnotationToolbar.tsx`, `src/annotations/annotationRegistry.ts`. Verify: add each annotation type, edit inline, resize, change color, save/reload — all persist.

- [x] **3.18 Canvas notes (per-sheet, like PowerPoint slide notes)** — Add a "Notes" tab to `BottomDock.tsx`. Each canvas gets a `notes: string` field in the canvas JSON schema (`canvasSchema.ts`). Rich text editor (basic: bold, italic, bullet lists). Notes persist per-sheet and are included in project export/PDF. Files: `src/components/canvas/BottomDock.tsx`, new `src/components/canvas/CanvasNotes.tsx`, `src/lib/canvasSchema.ts`, `src/lib/canvases.ts`. Verify: type notes on Sheet 1, switch to Sheet 2 (different notes), switch back — Sheet 1 notes preserved. Export includes notes.

- [x] **3.19 Onboarding flow — opt-in/opt-out** — Current onboarding (`OnboardingOverlay.tsx`) is a spotlight tour. Enhance: (a) after signup wizard, show a "Would you like a quick tour?" modal with "Yes, show me around" / "No thanks, I'll explore on my own", (b) if opted in, run the 14-step tour, (c) if opted out, skip but show a "?" help button that can restart the tour anytime, (d) track onboarding status in `profiles.onboarding_completed_at`. Files: `src/components/app/OnboardingOverlay.tsx`, `src/components/app/FirstRunModal.tsx`, `src/lib/onboardingState.ts`. Verify: new account signup → tour prompt appears → both paths work correctly.

- [x] **3.20 Password/email/display name change protection** — Wrap all sensitive account changes with re-authentication. Currently `src/lib/reauth.ts` exists with `reauthenticate(password)`. Ensure it's called before: email change, password change, display name change, account deletion, billing changes. Show `ReauthModal.tsx` (already exists) to collect current password. Files: `src/lib/reauth.ts`, `src/components/ui/ReauthModal.tsx`, `src/pages/settings/SecuritySettings.tsx`, `src/pages/settings/ProfileSettings.tsx`, `src/pages/settings/DangerZoneSettings.tsx`. Verify: attempt to change email → re-auth modal appears → must enter current password.

---

## Phase 4 — Feature Enhancements

> Level up existing features to professional quality.

- [x] **4.01 Constants to 9,999+ decimal places** — Replace 100-digit strings in `src/lib/highPrecisionConstants.ts` with lazy-loaded JSON files containing 10,000+ digits. Create `src/lib/precisionDigits/pi.json`, `e.json`, `phi.json`, `sqrt2.json`, `ln2.json`, `ln10.json` (well-known digit expansions). Add physics constants from CODATA 2022 with maximum known precision (stored as strings). The Rust engine still uses f64 (~15 sig figs) for computation — this is display-only precision for when users inspect constant values. Add a "Copy full precision" button in Inspector for constant blocks. Files: `src/lib/highPrecisionConstants.ts`, new `src/lib/precisionDigits/*.json`, `src/blocks/constantsCatalog.ts`, `src/components/canvas/Inspector.tsx`. Verify: add Pi constant block → inspect → see 10,000 digits. Copy full precision → clipboard has 10,000 digits.

- [x] **4.02 Decimal places display toggle** — Add `displayDecimalPlaces: number` (default 3) to `preferencesStore.ts`. Add per-block override `displayDp?: number` to `NodeData` in `src/blocks/types.ts`. Update `useFormatValue.ts` and `valueFormat.ts` to respect: (a) per-block override if set, (b) global preference otherwise. Full internal precision always used for computation. Display shows formatted value with "..." truncation indicator. Hover/click shows full value. Files: `src/stores/preferencesStore.ts`, `src/blocks/types.ts`, `src/hooks/useFormatValue.ts`, `src/engine/valueFormat.ts`, `src/pages/settings/FormattingSettings.tsx`, `src/components/canvas/Inspector.tsx`. Verify: set global to 5dp → all values show 5dp. Override one block to 10dp via inspector → that block shows 10dp.

- [x] **4.03 Decimal places — prevent number clipping in blocks** — When displayed decimal places make the number wider than the block, ensure: (a) text uses `text-overflow: ellipsis` with `overflow: hidden`, (b) full value shown on hover tooltip, (c) block width auto-expands up to a max (400px), then ellipsis kicks in. Files: `src/components/canvas/nodes/DisplayNode.tsx`, `src/components/canvas/nodes/SourceNode.tsx`, `src/components/canvas/nodes/nodeStyles.ts`. Verify: set 15dp on a block with value 3.141592653589793 → number truncated with "..." and tooltip shows full value.

- [x] **4.04 Units overhaul — elegant display & editing** — Redesign `UnitPicker.tsx` as a searchable dropdown with categories (Length, Mass, Time, Temperature, etc.). Show unit symbol prominently on block output handles. Auto-suggest compatible units based on connected inputs. Files: `src/components/canvas/editors/UnitPicker.tsx`, `src/units/unitCatalog.ts`, `src/units/unitSymbols.ts`. Verify: assign "meter" to input → connected blocks show "m" badge.

- [x] **4.05 Units — propagation through chains** — Create `src/units/unitPropagation.ts`. When blocks compute, infer output units from operation + input units (e.g., meter × meter = m², meter / second = m/s). Display inferred units on output. Warn on incompatible unit operations (adding meters + seconds). This is display-only — engine computes raw numbers. Files: new `src/units/unitPropagation.ts`, `src/engine/bridge.ts`, `src/components/canvas/edges/AnimatedEdge.tsx` (unit mismatch → yellow warning). Verify: Number(10, m) → Multiply(by Number(5, s⁻¹)) → Display shows "50 m/s".

- [x] **4.06 Units — conversion warnings on edges** — When an edge connects two blocks with incompatible units, show a yellow warning badge on the edge with "Unit mismatch: m → kg". Add context menu option "Insert Conversion" that auto-inserts a unit conversion block. Files: `src/components/canvas/edges/AnimatedEdge.tsx`, `src/components/canvas/ContextMenu.tsx`, `src/units/unitCompat.ts`. Verify: connect meter output to kilogram input → yellow edge badge. Right-click → "Insert Conversion".

- [x] **4.07 Table input block — mini spreadsheet overhaul** — Massively improve `TableEditor.tsx`: (a) column resize by dragging headers, (b) row/column add/delete via right-click header menu, (c) cell formula support (`=A1+A2`), (d) column type toggle (number/text), (e) freeze row/column headers on scroll, (f) cell copy/paste (Ctrl+C/V), (g) undo/redo (Ctrl+Z/Y), (h) CSV import button, (i) multi-cell selection with blue highlight. Files: `src/components/canvas/editors/TableEditor.tsx`, `src/lib/tableConstants.ts`. Verify: create 10x10 table, resize columns, add formula, copy/paste range — all work smoothly.

- [x] **4.08 Table input block — flexible output selection** — Currently tables only propagate single columns. Add output modes: (a) "Entire Table" — passes full `{ columns, rows }` value, (b) "Single Column" — select which column, (c) "Single Row" — select which row, (d) "Cell Range" — select A1:C3 style range, (e) "Multiple Columns" — multi-select columns. Add an output mode selector in the block's Inspector section. Each mode creates the appropriate output port(s). Files: `src/blocks/table-blocks.ts`, `src/components/canvas/nodes/ListTableNode.tsx`, `src/engine/bridge.ts`, `crates/engine-core/src/ops.rs` (table slicing ops). Verify: table with 3 columns → output "Column B" → downstream gets vector. Output "Entire Table" → downstream gets table.

- [x] **4.09 Inspector — comprehensive editing** — Expand `Inspector.tsx` to show and edit ALL properties: (a) Block label (inline edit), (b) Block type info + description, (c) All input ports with value/binding/source info, (d) Output value with unit + precision, (e) Per-port unit assignment, (f) Display format (dp, scientific notation, sig figs), (g) Block accent color picker, (h) Notes/comments field, (i) Lock/unlock toggle, (j) Conditional formatting rules (e.g., "turn red if > 100"), (k) Expression editor with syntax highlighting for function blocks, (l) "What-If" slider for connected scalar inputs (already exists — ensure it works), (m) Downstream chain visualization ("feeds into: [list]"). Files: `src/components/canvas/Inspector.tsx`, new `src/components/canvas/InspectorSections/` (modular sections). Verify: select any block → every property visible and editable.

- [x] **4.10 Theme editor — live preview & dynamic shading** — Enhance `ThemeWizard.tsx`: (a) live canvas preview as you edit colors, (b) auto-generate hover/active/dim variants from base colors using HSL math, (c) preserve error (red) and warning (yellow) colors as theme-invariant — never overridden by custom themes, (d) animation speed control, (e) export/import theme JSON, (f) preset theme gallery (Midnight, Ocean, Forest, Sunset, etc.). Files: `src/components/ThemeWizard.tsx`, `src/components/ThemeProvider.tsx`, `src/contexts/ThemeContext.ts`, `src/index.css`. Verify: create custom theme → error blocks still red, warnings yellow. Export → import on different browser → identical appearance.

- [x] **4.11 Explore area — cohesive ecosystem** — Enhance `ExplorePage.tsx`: (a) unified search across published projects, block packs, materials, groups, and themes, (b) filter by type (project/block/material/theme), category, author, popularity, (c) "Install" button for block packs adds blocks to user's library, (d) "Fork" button for projects creates a copy in user's workspace, (e) "Apply" button for themes installs to user's theme library, (f) ratings and reviews, (g) featured/curated collections. Files: `src/pages/ExplorePage.tsx`, `src/pages/ExploreItemPage.tsx`, `src/components/explore/ExploreCard.tsx`, `src/components/explore/ExploreFilters.tsx`, `src/lib/marketplaceService.ts`. Verify: search "beam" → see relevant projects. Install a block pack → appears in Block Library. Fork a project → appears in My Projects.

- [x] **4.12 Settings expansion** — Add new settings sections: (a) **Canvas Defaults**: grid size (10/20/40px), snap strength, background style (dots/lines/none), default zoom, (b) **Auto-layout**: direction (LR/TB/RL/BT), node spacing, algorithm (dagre/elk), (c) **Notifications**: email digest (daily/weekly/never), in-app alerts toggle, (d) **Privacy**: analytics opt-in/out, crash reporting opt-in/out, (e) **Accessibility**: high contrast mode, reduced motion, font size scale (80%–150%), (f) **Data Management**: export all data, clear cache, storage usage display. Files: `src/pages/settings/PreferencesSettings.tsx`, `src/pages/settings/EditorSettings.tsx`, new `src/pages/settings/AccessibilitySettings.tsx`, new `src/pages/settings/NotificationSettings.tsx`, `src/stores/preferencesStore.ts`, `src/lib/userPreferencesService.ts`. Verify: each setting persists across sessions.

- [x] **4.13 Publish/Subscribe — full cross-canvas data flow** — Beyond the bug fix (2.05), enhance: (a) show all active channels in a "Channels" panel (new tab in BottomDock), (b) auto-complete channel names in Subscribe blocks based on published channels, (c) show channel value preview in the channels panel, (d) support typed channels (scalar, vector, table). Files: `src/stores/publishedOutputsStore.ts`, new `src/components/canvas/ChannelsPanel.tsx`, `src/components/canvas/nodes/SubscribeNode.tsx`. Verify: publish 3 channels → Channels panel shows all 3 with live values.

- [x] **4.14 Formula bar / expression editor enhancement** — Improve `ExpressionPanel.tsx` and `FormulaBar.tsx`: (a) syntax highlighting for math expressions, (b) autocomplete for function names (sin, cos, sqrt, etc.), (c) autocomplete for variable names and constant names, (d) inline error highlighting (red underline on invalid syntax), (e) function reference tooltip on hover. Files: `src/components/canvas/ExpressionPanel.tsx`, `src/components/canvas/FormulaBar.tsx`. Verify: type "sin(" → autocomplete shows "sin(x)" with description. Type invalid → red underline.

- [x] **4.15 Undo/redo robustness** — Audit `useGraphHistory.ts` for edge cases: (a) undo after delete restores block with connections, (b) undo after paste removes pasted blocks, (c) undo stack survives tab switch, (d) redo after undo restores exact state. Ensure history is per-canvas, not global. Files: `src/hooks/useGraphHistory.ts`, `src/components/canvas/CanvasArea.tsx`. Verify: add block → connect → delete → undo → block restored with connection. Switch tab → switch back → undo still works.

- [x] **4.16 Clipboard — cut/copy/paste blocks with connections** — Enhance `src/lib/clipboard.ts`: (a) copy selected blocks + internal edges to clipboard as JSON, (b) paste at cursor position with new IDs, (c) preserve internal connections between pasted blocks, (d) cut = copy + delete, (e) cross-canvas paste (copy from Sheet 1, paste in Sheet 2). Files: `src/lib/clipboard.ts`, `src/components/canvas/CanvasArea.tsx`. Verify: select 3 connected blocks → Ctrl+C → switch tab → Ctrl+V → 3 blocks appear with connections intact.

- [x] **4.17 Plot block enhancement** — Improve plot blocks: (a) more chart types (bar, scatter, histogram, pie, heatmap), (b) axis labels and title editing, (c) interactive zoom/pan on plot, (d) export plot as PNG/SVG, (e) legend toggle, (f) multiple series on one plot. Files: `src/components/canvas/nodes/PlotNode.tsx`, `src/lib/plot-spec.ts`, `src/lib/plot-export.ts`. Verify: create scatter plot with 2 series, add title, export as PNG.

- [x] **4.18 Auto-layout algorithm improvement** — Current auto-layout uses dagre. Add: (a) layout direction selector (LR/TB/RL/BT) in toolbar, (b) preserve user-positioned nodes (only layout un-positioned), (c) respect group boundaries, (d) minimize edge crossings. Files: `src/lib/autoLayout.ts`, `src/components/canvas/CanvasToolbar.tsx`. Verify: click auto-layout → graph reorganizes with minimal crossings, groups stay intact.

---

## Phase 5 — Major New Features

> Optimization, ML, and neural networks. Substantial engineering effort.

- [x] **5.01 Optimization — block category & registry** — Create `src/blocks/optim-blocks.ts`. Register blocks: `objectiveFunction` (wraps subgraph as f(x)), `designVariable` (range + step + initial), `optimizerGradient` (gradient descent), `optimizerGenetic` (genetic algorithm), `optimizerSimplex` (Nelder-Mead), `convergencePlot` (objective vs iteration), `optimResultsTable` (final optimal values). Add category `optimization` to `BlockCategory` enum. Files: `src/blocks/optim-blocks.ts`, `src/blocks/types.ts`, `src/blocks/registry.ts`. Verify: optimization blocks appear in Block Library under new category.

- [BLOCKED: requires Rust engine development] **5.02 Optimization — Rust engine module** — Create `crates/engine-core/src/optim/` with: `mod.rs`, `gradient.rs` (gradient descent with configurable learning rate + momentum), `genetic.rs` (population-based GA), `simplex.rs` (Nelder-Mead). Each optimizer takes an objective function (graph subgraph) and design variables, runs N iterations, returns optimal values + convergence history. Bump ENGINE_CONTRACT_VERSION to 4. Files: `crates/engine-core/src/optim/`, `crates/engine-core/src/catalog.rs`, `src/engine/index.ts` (update expected version). Verify: `cargo test` passes. Optimize f(x) = x² - 4x + 3 → converges to x=2.

- [BLOCKED: depends on 5.02 Rust engine] **5.03 Optimization — UI/UX for 10-year-olds** — Create intuitive optimizer node components: (a) `OptimizerNode.tsx` with friendly icons and clear labels ("Find the best answer"), (b) drag design variables onto optimizer to connect, (c) live convergence chart showing progress, (d) "Start" / "Stop" / "Reset" buttons on the optimizer block, (e) results displayed inline with "Best value found: X". Files: new `src/components/canvas/nodes/OptimizerNode.tsx`, `src/components/canvas/nodes/ConvergencePlotNode.tsx`. Verify: build optimization from scratch with drag-and-drop. Click Start → watch convergence → see optimal result.

- [BLOCKED: requires Rust engine development] **5.04 Optimization — parametric sweep block** — Block that runs a graph N times with linearly spaced input values. Outputs a table of input→output pairs. Useful for sensitivity analysis. Files: `src/blocks/optim-blocks.ts`, `crates/engine-core/src/optim/sweep.rs`. Verify: sweep x from 0 to 10 in 100 steps for f(x) = sin(x) → table with 100 rows.

- [BLOCKED: requires Rust engine development] **5.05 Optimization — Monte Carlo simulation block** — Block that runs graph N times with random inputs drawn from specified distributions (uniform, normal, etc.). Outputs statistical summary (mean, std, percentiles) and histogram. Files: `src/blocks/optim-blocks.ts`, `crates/engine-core/src/optim/montecarlo.rs`. Verify: Monte Carlo with 1000 samples → histogram + stats.

- [x] **5.06 Machine Learning — block category & registry** — Create `src/blocks/ml-blocks.ts`. Register blocks: `datasetInput` (from table), `trainTestSplit` (ratio slider), `linearRegression`, `polynomialRegression` (degree selector), `knnClassifier` (k selector), `decisionTree` (max depth), `metricsMSE`, `metricsR2`, `metricsConfusionMatrix`, `mlPredict` (apply trained model to new data). Add category `machineLearning`. Files: `src/blocks/ml-blocks.ts`, `src/blocks/types.ts`, `src/blocks/registry.ts`. Verify: ML blocks appear in Block Library.

- [BLOCKED: requires Rust engine development] **5.07 Machine Learning — Rust engine module** — Create `crates/engine-core/src/ml/` with: `linreg.rs` (OLS), `polyreg.rs`, `knn.rs`, `decision_tree.rs`, `metrics.rs`. Each takes training data (table value) and returns model + predictions. Use efficient implementations (no external crate dependencies if possible for WASM size). Files: `crates/engine-core/src/ml/`, `crates/engine-core/src/catalog.rs`. Verify: `cargo test`. Train linear regression on y=2x+1 data → R² > 0.99.

- [BLOCKED: depends on 5.07 Rust engine] **5.08 Machine Learning — intuitive pipeline UX** — Create visual ML pipeline: (a) data flows left-to-right from Dataset → Split → Model → Metrics, (b) model blocks show training status (idle/training/trained), (c) metrics blocks show live results (R², MSE, confusion matrix as colored grid), (d) "Train" button on model blocks, (e) template: "Quick ML Pipeline" that pre-builds Dataset → Split → Linear Regression → R² + MSE. Files: new `src/components/canvas/nodes/MLModelNode.tsx`, `src/components/canvas/nodes/MetricsNode.tsx`. Verify: build pipeline from template → load CSV data → click Train → see R² score.

- [x] **5.09 Neural Network — block category & registry** — Create `src/blocks/nn-blocks.ts`. Register blocks: `nnInput` (shape definition), `nnDense` (units + activation: relu/sigmoid/tanh/softmax), `nnConv1D` (filters, kernel size), `nnDropout` (rate), `nnActivation` (function selector), `nnSequential` (chains layers), `nnTrainer` (epochs, batch size, learning rate, loss function), `nnPredict`, `nnExport` (ONNX format). Add category `neuralNetworks`. Web limit: max 1M parameters. Files: `src/blocks/nn-blocks.ts`, `src/blocks/types.ts`, `src/blocks/registry.ts`. Verify: NN blocks in Block Library.

- [BLOCKED: requires Rust engine development] **5.10 Neural Network — Rust WASM engine** — Create `crates/engine-core/src/nn/` with: `layer.rs` (Dense, Conv1D, Dropout), `activation.rs` (ReLU, Sigmoid, Tanh, Softmax), `model.rs` (Sequential forward pass), `train.rs` (backpropagation, SGD optimizer, cross-entropy + MSE loss), `export.rs` (ONNX serialization). Enforce 1M parameter limit in WASM. Training runs in Web Worker to not block UI. Files: `crates/engine-core/src/nn/`, `crates/engine-wasm/src/lib.rs` (expose training API). Verify: `cargo test`. Train XOR network (2→4→1) for 5000 epochs → loss < 0.01.

- [BLOCKED: depends on 5.10 Rust engine] **5.11 Neural Network — visual builder UX** — Create `NeuralNetNode.tsx`: (a) architecture diagram showing layers as colored rectangles with dimensions, (b) drag layers to reorder, (c) live training visualization (loss curve, accuracy curve), (d) epoch counter + ETA, (e) weight heatmaps on trained layers, (f) "Train" / "Stop" / "Reset" buttons, (g) progress bar during training, (h) model summary panel (total params, trainable params, layer shapes). Files: new `src/components/canvas/nodes/NeuralNetNode.tsx`, new `src/components/canvas/nodes/NNTrainingViz.tsx`. Verify: build 3-layer NN → click Train → watch loss decrease → see architecture diagram update.

- [BLOCKED: depends on 5.10 Rust engine] **5.12 Neural Network — export/import models** — Export trained NN as ONNX file for use in other tools. Import pre-trained ONNX models for inference in ChainSolve. Add "Export Model" and "Import Model" buttons on NN blocks. Files: `crates/engine-core/src/nn/export.rs`, `src/components/canvas/nodes/NeuralNetNode.tsx`. Verify: train model → export ONNX → import in separate project → predictions match.

- [x] **5.13 Neural Network — size limits & upgrade prompts** — Enforce web limits: max 1M parameters, max 100 epochs per training run for free plan, max 10,000 for pro. Show friendly message: "Your model has X parameters. Web version supports up to 1M. Desktop version (coming soon) supports unlimited." Files: `src/lib/entitlements.ts`, `src/blocks/nn-blocks.ts`, `src/components/canvas/nodes/NeuralNetNode.tsx`. Verify: attempt to build model with >1M params → friendly warning shown.

- [BLOCKED: requires Rust engine development] **5.14 Sensitivity analysis block** — Block that varies one input at a time while holding others constant, producing a tornado chart of parameter sensitivity. Files: `src/blocks/optim-blocks.ts`, `crates/engine-core/src/optim/sensitivity.rs`. Verify: 5 inputs → tornado chart showing most/least sensitive parameters.

- [BLOCKED: requires Rust engine development] **5.15 DOE (Design of Experiments) block** — Generates experiment matrices: full factorial, Latin hypercube, Sobol sequence. Outputs table of experiment configurations. Files: `src/blocks/optim-blocks.ts`, `crates/engine-core/src/optim/doe.rs`. Verify: 3 variables, 3 levels each → 27-row full factorial table.

---

## Phase 6 — AI Integration Enhancement

> Make AI omniscient about ChainSolve and capable of building complex models.

- [x] **6.01 AI context injection — full block catalog** — When AI generates a response, inject the complete block catalog (all block types, their inputs, outputs, categories, descriptions) into the system prompt. Include the unit system, available constants, and available materials. Files: `src/lib/aiCopilot/`, `functions/api/ai.ts`. Verify: ask AI "what blocks can I use for structural analysis?" → lists all engineering blocks accurately.

- [x] **6.02 AI context injection — current graph state** — Send the current canvas graph (nodes, edges, computed values, errors) as context to the AI. This allows "explain this calculation", "find errors", "suggest improvements". Use context minimization (`src/lib/aiCopilot/contextMin.ts`) to stay within token limits. Files: `src/lib/aiCopilot/contextMin.ts`, `functions/api/ai.ts`. Verify: ask "why is this block showing an error?" → AI correctly identifies the issue.

- [x] **6.03 AI graph generation — 100+ blocks** — Enhance `LlmGraphBuilderDialog.tsx` to handle large graph generation. AI response should include: (a) all nodes with types, positions, and initial values, (b) all edges with source/target port IDs, (c) group organization for logical sections. Use streaming to show blocks appearing as they're generated. Apply risk scoring to prevent dangerous operations. Files: `src/components/canvas/LlmGraphBuilderDialog.tsx`, `src/lib/aiCopilot/patchExec.ts`. Verify: prompt "Build a full vehicle dynamics model" → AI generates 50+ blocks with correct connections.

- [x] **6.04 AI tasks — optimize, explain, find errors, suggest** — Add preset AI tasks accessible via toolbar or context menu: (a) "Optimize this graph" → AI suggests simplifications, (b) "Explain this calculation" → AI traces computation chain in plain English, (c) "Find errors" → AI identifies issues and suggests fixes, (d) "Suggest improvements" → AI recommends additional blocks or better approaches. Files: `src/components/app/AiCopilotWindow.tsx`, `src/lib/aiCopilot/tasks.ts`. Verify: each task produces useful, actionable output.

- [x] **6.05 AI streaming responses** — Switch from batch to streaming AI responses. Show tokens appearing in real-time in the AI panel. For graph generation, show blocks appearing on canvas as they're described. Files: `src/components/app/AiCopilotWindow.tsx`, `functions/api/ai.ts`. Verify: prompt → see response streaming word by word.

- [ ] **6.06 AI formula autocomplete** — In expression/formula inputs, offer AI-powered autocomplete. As user types, suggest completions based on context (available variables, upstream values, common patterns). Files: `src/components/canvas/ExpressionPanel.tsx`, `src/components/canvas/FormulaBar.tsx`. Verify: type "sin(" → AI suggests "sin(angle_rad)" based on upstream variable.

- [ ] **6.07 AI rate limiting by plan tier** — Enforce limits: free=0 AI requests, student=10/day, pro=100/day, enterprise=1000/day, developer=unlimited. Track in `ai_usage_monthly` table. Show remaining quota in AI panel header. Files: `functions/api/ai.ts`, `src/lib/entitlements.ts`, `src/components/app/AiCopilotWindow.tsx`. Verify: free user → "Upgrade to use AI". Pro user → "95 requests remaining today".

- [ ] **6.08 AI privacy compliance** — Ensure: (a) user data never sent to AI without consent, (b) opt-out toggle in Privacy settings, (c) AI requests logged in `ai_request_log` for compliance, (d) enterprise orgs can disable AI via `policy_ai_enabled`, (e) `docs/AI_PRIVACY.md` updated. Files: `src/pages/settings/PreferencesSettings.tsx`, `functions/api/ai.ts`, `docs/AI_PRIVACY.md`. Verify: opt out of AI → panel disabled. Enterprise with AI disabled → panel hidden.

---

## Phase 7 — Security Hardening & Compliance

> Production security for 100k+ users.

- [ ] **7.01 Cloudflare Functions input validation audit** — Review all 23 functions in `functions/api/`. Ensure every endpoint: (a) validates JWT (except public health checks), (b) validates and sanitises all input parameters, (c) returns generic error messages (no stack traces — already checked by CI `scripts/check-billing-stack.mjs`), (d) sets appropriate CORS headers, (e) handles malformed JSON gracefully. Files: `functions/api/**/*.ts`. Verify: send malformed JSON to each endpoint → 400 response, no stack trace.

- [ ] **7.02 CSP headers verification** — Audit `public/_headers`. Ensure: (a) `script-src` includes `'wasm-unsafe-eval'` and `'self'` only, (b) `style-src` allows inline styles (React), (c) `img-src` allows Supabase storage + Stripe, (d) `connect-src` allows Supabase + Stripe + Sentry + Cloudflare, (e) `frame-ancestors 'none'` (prevent clickjacking), (f) report-uri points to `/api/report/csp`. Files: `public/_headers`. Verify: no CSP violations in browser console on normal usage. `csp_reports` table empty after normal session.

- [ ] **7.03 XSS vector audit** — Audit all user-generated content rendering: (a) display names, (b) project names, (c) canvas notes, (d) node comments, (e) marketplace descriptions, (f) annotation text. Ensure all use React's built-in escaping (no `dangerouslySetInnerHTML` on user content). For KaTeX rendering, ensure input is sanitised before LaTeX parsing. Files: grep for `dangerouslySetInnerHTML`, `innerHTML`, `v-html` across entire `src/`. Verify: enter `<script>alert(1)</script>` as display name → rendered as text, not executed.

- [ ] **7.04 CSRF prevention verification** — Supabase auth uses JWT in Authorization header (not cookies), which is inherently CSRF-safe. Verify: (a) no auth cookies are set, (b) all API calls use Authorization header, (c) Stripe webhook uses HMAC signature (already verified). Files: `src/lib/supabase.ts`, `functions/_middleware.ts`. Verify: forge a cross-origin POST to `/api/stripe/create-checkout-session` without JWT → 401.

- [ ] **7.05 GDPR data export endpoint** — Create `functions/api/account/export-data.ts`. Exports all user data as JSON: profile, preferences, projects (metadata), canvases (metadata), comments, marketplace items, audit log entries, sessions. Does NOT include raw canvas graph data (too large) — provides download links instead. Rate limit: 1 export/day. Files: new `functions/api/account/export-data.ts`, `src/pages/settings/DangerZoneSettings.tsx`. Verify: request export → receive JSON with all personal data.

- [ ] **7.06 GDPR account deletion — complete purge** — Audit existing `functions/api/account/delete.ts` and `delete_my_account()` RPC. Ensure: (a) Stripe subscription cancelled, (b) all storage files removed (projects + uploads buckets), (c) all DB rows deleted (profile cascades), (d) auth.users row deleted, (e) audit log entry preserved for 30 days (legal requirement), (f) confirmation email sent. Files: `functions/api/account/delete.ts`, `supabase/migrations/` (verify cascade). Verify: delete account → no traces remain in DB except audit log.

- [ ] **7.07 Cookie consent banner** — Create `src/components/CookieConsent.tsx`. Show on first visit: "We use essential cookies for authentication and localStorage for preferences. No tracking cookies." Accept/Decline buttons. If declined, disable analytics and Sentry (but auth still works). Persist choice in localStorage. Files: new `src/components/CookieConsent.tsx`, `src/App.tsx`, `src/observability/sentry.ts`. Verify: first visit → banner appears. Decline → Sentry disabled. Accept → banner doesn't reappear.

- [ ] **7.08 Customer support admin tools** — Enhance admin panel (`src/pages/MetricsPage.tsx` and `src/pages/AuditLogPage.tsx`): (a) search users by email/display name, (b) view user's plan + billing status, (c) override plan (set to pro/student/developer for customer support), (d) view user's projects (metadata only, not content), (e) trigger password reset email, (f) disable/enable user account. All actions logged to `audit_log`. Files: `src/pages/MetricsPage.tsx`, `src/lib/adminService.ts`, new `functions/api/admin/manage-user.ts`. Verify: admin searches user → can override plan → audit log records the action.

- [ ] **7.09 Developer admin — easy dev account management** — Document in `docs/ADMIN_GUIDE.md`: how to add new developers (set `is_developer=true` in profiles table via Supabase dashboard or SQL), how to override user plans, how to manage billing issues. Add ben.godfrey@chainsolve.co.uk to `DEVELOPER_EMAILS` in `src/lib/entitlements.ts` (already done). Ensure any admin can grant developer access via the admin panel (7.08). Files: new `docs/ADMIN_GUIDE.md`, `src/lib/entitlements.ts`. Verify: doc exists and is clear. New dev email added → full access.

- [ ] **7.10 SECURITY.md incident response** — Expand existing `SECURITY.md` with: (a) security contact email, (b) vulnerability disclosure policy, (c) incident response checklist (detect → contain → eradicate → recover → lessons learned), (d) severity classification (P1–P4), (e) escalation procedures. Files: `SECURITY.md`. Verify: document is comprehensive and professional.

- [ ] **7.11 Penetration testing checklist** — Create `docs/PENTEST_CHECKLIST.md` covering: SQL injection (all Supabase queries use parameterised RPC), XSS (React escaping), CSRF (JWT-based), auth bypass (RLS + JWT), privilege escalation (RLS policies), file upload validation (mime type + size), rate limiting, session management. Mark each as tested/untested. Files: new `docs/PENTEST_CHECKLIST.md`. Verify: checklist exists with all items.

- [ ] **7.12 Data retention policy** — Document and enforce: (a) audit logs retained 90 days (enterprise: configurable via `policy_data_retention_days`), (b) observability events retained 30 days, (c) deleted account data purged immediately except audit log (30 days), (d) stale sessions cleaned up after 30 days. Add a scheduled cleanup in migration or cron. Files: `supabase/migrations/0014_data_retention.sql`, `docs/DATA_RETENTION.md`. Verify: old audit logs auto-deleted after retention period.

---

## Phase 8 — Mobile, Performance & Repo Cleanup

> Polish for production deployment.

- [ ] **8.01 Mobile touch — block placement** — Enable long-press to add blocks on mobile (use `useLongPress.ts` hook, already exists). On long-press on empty canvas, show block picker. On tap block in library, place at viewport center. Files: `src/hooks/useLongPress.ts`, `src/components/canvas/CanvasArea.tsx`, `src/components/canvas/BlockLibrary.tsx`. Verify: on mobile device — long-press canvas → block picker. Tap block → placed on canvas.

- [ ] **8.02 Mobile touch — pinch-to-zoom** — ReactFlow supports pinch-to-zoom natively. Ensure `zoomOnPinch={true}` is set in CanvasArea. Test on iOS Safari and Chrome Android. Files: `src/components/canvas/CanvasArea.tsx`. Verify: pinch gesture on mobile → smooth zoom.

- [ ] **8.03 Mobile — responsive panels** — Ensure all panels (block library, inspector, bottom dock, AI panel) use `BottomSheet` variant on mobile (< 768px). Use `useIsMobile()` hook. Panels should be full-width sheets that slide up from bottom. Files: `src/hooks/useIsMobile.ts`, `src/components/canvas/BlockLibrary.tsx`, `src/components/canvas/FloatingInspector.tsx`, `src/components/canvas/BottomDock.tsx`. Verify: on mobile — panels appear as bottom sheets, not floating windows.

- [ ] **8.04 Mobile — toolbar adaptation** — Reduce toolbar to essential buttons on mobile. Use hamburger/overflow menu for less-used tools. Ensure all touch targets are ≥44px (WCAG). Files: `src/components/canvas/CanvasToolbar.tsx`, `src/components/app/WorkspaceToolbar.tsx`. Verify: on mobile — all buttons tappable, no overlapping.

- [ ] **8.05 Bundle size audit** — Run `npm run perf:bundle`. Check against budgets: initial JS (gzip) < 400KB, WASM (gzip) < 250KB. If over, identify largest chunks and code-split or lazy-load. Check that heavy dependencies (KaTeX, Vega-Lite, ml.js) are lazy-loaded. Files: `vite.config.ts`, `src/App.tsx` (lazy imports). Verify: `npm run build` → bundle report within budget.

- [ ] **8.06 React.memo on all node components** — Wrap all node components (`SourceNode`, `OperationNode`, `DisplayNode`, `DataNode`, `PlotNode`, `ListTableNode`, `GroupNode`, `PublishNode`, `SubscribeNode`, `AnnotationNode`, `MaterialNode`) with `React.memo()` if not already. Use shallow comparison. Files: `src/components/canvas/nodes/*.tsx`. Verify: React DevTools profiler shows no unnecessary re-renders on unrelated state changes.

- [ ] **8.07 Zustand selector optimization** — Audit all Zustand store usages. Replace `useStore()` (selects entire store) with `useStore(s => s.specificField)` to prevent re-renders when unrelated fields change. Files: grep for `useProjectStore()`, `usePreferencesStore()`, etc. across all components. Verify: React DevTools — changing a preference doesn't re-render canvas nodes.

- [ ] **8.08 Worker pool leak prevention** — In `src/engine/workerPool.ts`, ensure workers are terminated when: (a) canvas is closed, (b) project is closed, (c) tab is closed. Add a `dispose()` method that terminates all workers. Call it in cleanup effects. Files: `src/engine/workerPool.ts`, `src/pages/CanvasPage.tsx`. Verify: open 5 canvases → close all → DevTools shows 0 Web Workers.

- [ ] **8.09 Lighthouse performance score** — Run Lighthouse on production build. Target: Performance > 90, Accessibility > 90, Best Practices > 95, SEO > 80. Fix any flagged issues. Files: various based on Lighthouse report. Verify: Lighthouse scores meet targets.

- [ ] **8.10 Repo housekeeping — remove AI-generated comments** — Grep for patterns like `// This is a`, `// This function`, `// TODO: implement`, `// HACK`, `// FIXME` without issue numbers. Remove unhelpful comments. Keep comments that explain WHY, not WHAT. Files: entire `src/`. Verify: no gratuitous comments remain. `npm run lint` passes.

- [ ] **8.11 Repo housekeeping — file organization** — Ensure: (a) no stale/unused files (grep for unused exports), (b) test files co-located with source (✓ already done), (c) docs in `docs/` directory, (d) scripts in `scripts/`, (e) no files in wrong directories. Run `npm run lint` and fix all warnings. Files: various. Verify: clean `npm run lint`, no unused exports.

- [ ] **8.12 Repo housekeeping — professional appearance** — Ensure: (a) `README.md` has professional description, setup instructions, architecture overview, screenshots, (b) `CONTRIBUTING.md` has clear contribution guidelines, (c) `CHANGELOG.md` is up to date, (d) `LICENSE` file exists, (e) no hardcoded developer emails or test data in committed code (except `DEVELOPER_EMAILS` which is intentional), (f) `.env.example` with all required env vars documented. Files: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.env.example`. Verify: a new developer can clone, read README, and have the app running in < 15 minutes.

- [ ] **8.13 Documentation update** — Review and update all docs in `docs/`: (a) Architecture Decision Records (ADRs) reflect current state, (b) `AI_COPILOT.md`, `AI_PRIVACY.md`, `AI_WORKFLOWS.md` updated for enhanced AI, (c) `BACKUP_RUNBOOK.md` created (1.09), (d) `ADMIN_GUIDE.md` created (7.09), (e) `PENTEST_CHECKLIST.md` created (7.11), (f) `DATA_RETENTION.md` created (7.12). Files: `docs/**/*.md`. Verify: all docs accurate and consistent.

- [ ] **8.14 Full CI pipeline verification** — After all changes, run `npm run verify:ci` locally. Ensure: (a) Prettier passes, (b) ESLint passes, (c) TypeScript compiles, (d) all unit tests pass, (e) WASM builds, (f) Vite builds, (g) bundle within budget, (h) e2e smoke tests pass. Fix any regressions. Files: none (verification only). Verify: `npm run verify:ci` exits 0.

---

## Summary

| Phase | Tasks | Focus |
| ----- | ----- | ----- |
| 1. Foundation | 13 | DB, auth, RLS, security basics |
| 2. Bug Fixes | 11 | Critical user-reported bugs |
| 3. UX Polish | 20 | Visual, interaction, terminology |
| 4. Features | 18 | Level up existing features |
| 5. New Features | 15 | Optimization, ML, neural networks |
| 6. AI Enhancement | 8 | Best-in-class AI integration |
| 7. Security | 12 | Production hardening, GDPR |
| 8. Cleanup | 14 | Mobile, performance, repo quality |
| **Total** | **111** | |

## Top 5 Priorities

1. **2.01–2.02 Tab switching wiping canvases** — Active data loss bug
2. **2.03 Deleting open project** — Data corruption risk
3. **2.04 Constant block unknown type** — Core functionality broken
4. **2.07 AI panel developer access** — Owner's own account blocked
5. **2.08 Project save/open robustness** — Foundational reliability

## Red Flags

- **Constants 9,999+ dp**: f64 computation limited to ~15 sig figs. Display can show arbitrary precision but computation stays f64. True arbitrary-precision math would require BigDecimal library in Rust — much larger scope.
- **Neural networks in browser**: WASM backprop feasible for small models (≤1M params) but training is slow vs native. ~2–3k lines of Rust. Desktop version future will lift limits.
- **ENGINE_CONTRACT_VERSION bump**: Optimization/ML/NN features require bumping from 3→4. This is a one-way migration — old engine versions won't read new snapshots.
