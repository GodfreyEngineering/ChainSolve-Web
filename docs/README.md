# ChainSolve — Documentation

> For a comprehensive doc index with purpose, audience, and content guide for
> each document, see **[INDEX.md](INDEX.md)**.
>
> For first-time setup see [SETUP.md](SETUP.md).
> For contributor workflow see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Product requirements

> **[requirements/README.md](requirements/README.md)** — full product requirements suite
> covering Web, Mobile, Desktop, platform/backend, and non-functional requirements.

---

## Start here

| Document | Description |
|----------|-------------|
| [INDEX.md](INDEX.md) | Comprehensive index — purpose, audience, and "what's in it" for every doc |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, directory map, data model, engine design, milestone history |
| [REPO_MAP.md](REPO_MAP.md) | "Where do I change X?" — task-oriented file ownership guide |
| [SETUP.md](SETUP.md) | Production deploy guide: Supabase, Stripe, Cloudflare Pages, go-live checklist |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Dev setup, scripts, CI structure, hard invariants |
| [CONVENTIONS.md](CONVENTIONS.md) | Naming rules, error codes, Rust vs TS boundary, adding new block ops |

---

## Security & operations

| Document | Description |
|----------|-------------|
| [SECURITY.md](SECURITY.md) | CORS, CSP (`'wasm-unsafe-eval'`), CSP reporting, security headers, analytics policy |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | WASM init failures, placeholder env, common CI failures + local repro steps |

---

## Architecture decisions

| Document | Decision |
|----------|---------|
| [DECISIONS/ADR-0001](DECISIONS/ADR-0001-rust-wasm-engine.md) | Why Rust/WASM in a Worker (not a TS engine) |
| [DECISIONS/ADR-0002](DECISIONS/ADR-0002-csp-wasm-unsafe-eval.md) | Why `'wasm-unsafe-eval'` and not `'unsafe-eval'` |
| [DECISIONS/ADR-0003](DECISIONS/ADR-0003-ci-deploy-strategy.md) | Two-build CI/CD strategy with placeholder credentials |
| [DECISIONS/ADR-0004](DECISIONS/ADR-0004-supabase-rls.md) | Supabase RLS canonicalization (`(select auth.uid())` pattern) |

---

## Features

| Document | Description |
|----------|-------------|
| [PROJECT_FORMAT.md](PROJECT_FORMAT.md) | `project.json` schema (schemaVersion 3), versioning contract, conflict detection |
| [GROUPS.md](GROUPS.md) | Block groups and templates: usage, collapse/expand, proxy handles, Pro gating |
| [PLOTTING.md](PLOTTING.md) | Plot blocks (Vega-Lite): chart types, export, CSP-safe loading, downsampling |
| [BRANDING.md](BRANDING.md) | Brand asset paths, logo variants, theme selection helper |
| [UX.md](UX.md) | Canvas UX interaction rules and design decisions |

---

## Engine deep-dives

| Document | Description |
|----------|-------------|
| [W9_ENGINE.md](W9_ENGINE.md) | Build, debug, add ops, op semantics reference |
| [W9_2_SCALE.md](W9_2_SCALE.md) | Patch protocol, dirty propagation, incremental evaluation |
| [W9_3_CORRECTNESS.md](W9_3_CORRECTNESS.md) | NaN/Error propagation, `ENGINE_CONTRACT_VERSION` policy, golden tests |
| [W9_4_PERF.md](W9_4_PERF.md) | Performance metrics, `?perf=1` profiling, optimization notes |
| [W9_5_VERIFICATION.md](W9_5_VERIFICATION.md) | Test strategy, golden fixtures, property tests, smoke vs full e2e |

---

## Housekeeping (W9.10)

**AI memory:** Project memory for Claude Code lives in `.claude/projects/…/memory/MEMORY.md` (index) with topic files under `topics/` (engine, blocks, infra). Not checked into git.

**SEO files (public/):**

| File | Purpose |
|------|---------|
| `robots.txt` | Allows `/`, disallows app routes. Links to sitemap. |
| `sitemap.xml` | Static sitemap: `/` and `/login` only. |
| `og.svg` | Open Graph image for social sharing. |

**Theme:**
- Modes: `system` (default), `light`, `dark`
- Persisted to `localStorage` key `chainsolve.theme`
- Applied via `data-theme` attribute on `<html>` + CSS variable overrides in `src/index.css`
- Early-applied in `src/boot.ts` (before React) to prevent FOUC
- Context: `src/contexts/ThemeContext.ts` · Provider: `src/components/ThemeProvider.tsx`
- Settings UI: `src/pages/settings/PreferencesSettings.tsx`

**Settings modal (W10.2a):**
- Settings are a centred modal overlay, not a full-page route
- `/settings` and `/settings?tab=billing` deep-links open the modal then redirect to `/app`
- Gear icon (⚙) in AppShell and CanvasPage header opens the modal
- Billing tab requires password re-authentication (10-minute window, OAuth fallback message)
- Context: `src/contexts/SettingsModalContext.ts` · Provider: `src/components/SettingsModalProvider.tsx`
- Core: `src/components/SettingsModal.tsx` · `src/components/BillingAuthGate.tsx`

**App header with dropdown menus (W10.2b):**
- Professional app bar replaces the old CanvasPage top bar
- Component: `src/components/app/AppHeader.tsx`
- Dropdown menus: File, Edit, View, Insert, Tools, Help
- Reusable dropdown primitive: `src/components/ui/DropdownMenu.tsx`
- Accessible: `role="menubar"` / `role="menu"`, arrow-key navigation, ESC closes
- View menu wires to canvas operations via expanded `CanvasAreaHandle` (fitView, toggleLibrary, toggleInspector, toggleSnap)
- Insert menu shows block categories; opens block library
- Help > Bug report opens existing `BugReportModal`; About shows version info
- Stub items toast "Coming soon" — search for `stub` in AppHeader to wire up later
- Right section: user avatar (initials), plan badge, notifications (stub), settings gear
- i18n: `menu.*` namespace in all 5 locale files

**Bottom canvas toolbar (W10.2c):**

- Professional floating toolbar at bottom of canvas, replacing React Flow's default `<Controls />`
- Component: `src/components/canvas/BottomToolbar.tsx`
- 13 controls: pan mode, zoom out/in/%, fit, lock layout, snap to grid, auto-organise (stub), minimap, pause/resume eval, refresh, toggle library, toggle inspector
- Zoom display: click to edit inline, Enter applies (8–400%), Escape cancels
- Pan mode: enables drag-to-pan on all mouse buttons, disables node dragging
- Lock layout: disables node dragging and connecting
- MiniMap: `@xyflow/react` `<MiniMap>`, toggled via toolbar
- Pause evaluation: gates `onGraphChange` callback to parent
- Refresh: increments `refreshKey` param on `useGraphEngine` to force full re-evaluation
- i18n: `toolbar.*` namespace in all 5 locale files

**Canvas tooling polish (W10.3):**

- Auto-organise layout: dagre-based (`src/lib/autoLayout.ts`) — click for LR, Shift+click for TB
  - Applies to selected nodes (≥2) or all non-group nodes
  - One-level Ctrl+Z undo for layout changes (`layoutUndoRef`)
  - `CanvasAreaHandle.autoOrganise(direction?)` exposed for menu wiring
- Minimap persistence: on/off state saved to `localStorage` (`chainsolve.minimap`)
  - Theme-aware styling: `nodeColor` uses `--primary` for groups, `--text-muted` for others
- Pause/resume correctness fix:
  - `onGraphChange` always fires (autosave works while paused)
  - `useGraphEngine` accepts `paused` param — skips evaluation when true
  - On unpause: forces full snapshot re-evaluation of accumulated changes
  - Non-intrusive "Evaluation paused" banner shown when paused
- Menu wiring: View → Zoom In/Out/Minimap, Tools → Auto Organise now call real canvas handlers
- i18n: `toolbar.pausedBanner` key added to all 5 locale files

**Editing power pack (W10.4):**

- Undo/redo: bounded 50-entry history stack (`src/hooks/useGraphHistory.ts`)
  - Explicit save points before every mutation (17 call sites in CanvasArea)
  - Drag undo via `onNodeDragStart` — saves snapshot once per drag
  - Two-stack pattern: `useRef` stacks (no re-render), `useState` for `canUndo`/`canRedo`
  - Replaces single-level `layoutUndoRef` with general undo system
- Cut/copy/paste: in-memory clipboard (`src/lib/clipboard.ts`)
  - `copyToClipboard` stores selected nodes + internal edges, best-effort `navigator.clipboard` write
  - `pasteFromClipboard` generates fresh IDs via `nextNodeId()`, +30px offset, remaps edges/parentId
  - Cut = copy + delete (single undo point)
- Find block: Ctrl+F floating dialog (`src/components/canvas/FindBlockDialog.tsx`)
  - Filters by node label and block type (case-insensitive), max 10 results
  - Arrow keys navigate, Enter zooms to node via `fitView`, Escape closes
  - Theme-aware styling with CSS variables
- Select all (Ctrl+A), delete selected (Del/Backspace) exposed via keyboard + menu
- Keyboard shortcuts: input target check skips shortcuts when typing in INPUT/TEXTAREA
- AppHeader Edit menu: all 9 stubs replaced with real `canvasRef` handlers
- Shortcuts: Ctrl+Z undo, Ctrl+Shift+Z/Y redo, Ctrl+X/C/V cut/copy/paste, Ctrl+A select all, Ctrl+F find, Del delete
- i18n: `canvas.findPlaceholder`, `canvas.noMatches`, `canvas.findHint` added to all 5 locales

**Project management + real save status (W10.5):**

- Save status badge: tooltip shows "Last saved: HH:MM:SS", error badge clickable to show details
- File → New Project: entitlement check via `canCreateProject(plan, count)`, creates via `createProject()`, navigates
- File → Open: project picker modal (`OpenProjectDialog`) with search, keyboard navigation, relative timestamps
- File → Save As: duplicate dialog (`SaveAsDialog`), works from both project and scratch canvas
  - Project mode: `duplicateProject(sourceId, newName)` + navigate
  - Scratch mode: `createProject(name)` + `saveProject()` with current graph + navigate
- File → Recent Projects: localStorage MRU list (`chainsolve.recentProjects`, max 10)
  - Updated on every project load, shown as submenu in File menu
- Unsaved changes safety: `ConfirmDialog` with Save & continue / Discard & continue / Cancel
  - Shown before New Project and Open when `isDirty && projectId`
- `onSave` prop changed to `() => Promise<void>` so AppHeader can await before navigating
- i18n: 15 `project.*` keys added to all 5 locales

**Command palette + responsive header (W10.6):**

- Command Palette (Ctrl+K / Cmd+K): search-first overlay for fast action access
  - Flattens all 6 menu definitions (File, Edit, View, Insert, Tools, Help) into searchable `PaletteAction[]`
  - Utility: `src/lib/actions.ts` — `flattenMenusToActions()`, `filterActions()`
  - Component: `src/components/app/CommandPalette.tsx`
  - Case-insensitive substring match on label, group, and shortcut
  - Keyboard navigation: ↑↓ navigate, Enter execute, ESC close
  - Accessible: `role="dialog"`, `aria-modal`, focus trap via `useFocusTrap`
  - z-index 9500/9501 (above Modal at 9000)
- Responsive header: desktop shows 6 dropdown menus, mobile (<900px) shows ⋯ overflow button
  - ⋯ button opens the same CommandPalette — one component serves both use cases
  - Shared hook: `src/hooks/useIsMobile.ts` (extracted from CanvasArea)
  - Breakpoint: 900px (matches existing CanvasArea mobile breakpoint)
- Theme-safe: all palette styling uses CSS variables (`--card-bg`, `--border`, `--text`, `--primary-dim`)
- i18n: `commandPalette.*` namespace (title, placeholder, noResults, hint) in all 5 locales

**Dev CLI (`cs`):**
- Single executable: `./cs <command>` — no installation needed
- Commands: `new`, `test`, `push`, `ship`, `hotfix`, `help`
- Workflow: `./cs test` → `./cs push "W10.x: description"` → `./cs ship`
- Safety: refuses to commit/push to main without `--allow-main`
- `cs test` runs typecheck + lint (quick); `cs test --full` adds unit tests + build
- `cs push` stages all, commits, pushes, suggests PR creation
- `cs ship` creates/reuses PR, squash-merges, deletes branch, updates local main
- `cs hotfix <name>` creates `hotfix/<name>-YYYYMMDD` branch from main

---

## Multi-canvas "Sheets" (W10.7)

Each project supports multiple canvases (sheets). Metadata lives in the DB; graph JSON is stored per-canvas in Supabase Storage.

**DB schema:**

- **`canvases`** — `id` (uuid PK), `project_id` (FK), `owner_id` (FK), `name`, `position` (int, unique per project), `storage_path`, `created_at`, `updated_at`
- **`projects`** — added `active_canvas_id` (uuid, no FK — avoids circular dep; enforced at app level)

**Storage path convention:**

```text
projects bucket:
  └── {userId}/{projectId}/canvases/{canvasId}.json   ← per-canvas graph (V4)
  └── {userId}/{projectId}/project.json                ← legacy V3 (preserved)
```

**Per-canvas JSON format (schemaVersion 4):**

```jsonc
{
  "schemaVersion": 4,
  "canvasId": "...",
  "projectId": "...",
  "nodes": [...],
  "edges": [...],
  "datasetRefs": []
}
```

**Migration behavior (V3 → multi-canvas):**

- On first open of a legacy project (no `canvases` rows in DB):
  1. Creates a default canvas row "Sheet 1" with position 0
  2. Uploads the migrated graph JSON to `canvases/{canvasId}.json`
  3. Sets `projects.active_canvas_id`
  4. Does NOT delete the legacy `project.json` (left in place for backward compat)
- Safe to re-run: if canvases already exist, migration is a no-op.

**Active canvas persistence:**

- `projects.active_canvas_id` is stored in the DB for cross-device state.
- On load, if the stored active ID doesn't exist in the canvases list, falls back to position 0.

**Entitlements:**

- Free/past\_due/canceled: max 2 canvases per project
- Trialing/Pro: unlimited canvases

**UI (desktop):** Horizontal tab bar below the header, above the canvas.

- Click tab to switch, double-click to rename, right-click for context menu (Rename, Duplicate, Delete).
- `+` button to add a new sheet (entitlement gated).

**UI (mobile):** Dropdown selector with `+` button.

**Key files:**

- Migration SQL: `supabase/migrations/0014_multi_canvas.sql`
- Storage helpers: `src/lib/canvasStorage.ts`
- Schema V4 + migration: `src/lib/canvasSchema.ts`
- CRUD operations: `src/lib/canvases.ts`
- Canvases store: `src/stores/canvasesStore.ts`
- Sheets tab bar: `src/components/app/SheetsBar.tsx`
- i18n: `sheets.*` namespace in all 5 locale files

**Known limitations:**

- Drag-and-drop reorder of tabs is deferred (position model in place, UI deferred).
- Save As duplicates only the active canvas's legacy project.json (full multi-canvas duplication is a follow-up).
- Background canvas autosave (dirty canvases other than active) is active-only for now.

---

## Canvas visual polish (W12.1)

### Animated edges

Custom edge component colours connections by the source node's value kind:

- Scalar: teal (`#14b8a6`)
- Vector: purple (`#a78bfa`)
- Table: orange (`#f59e0b`)
- Error: red (`#ef4444`)
- Unknown/disconnected: grey (`var(--text-muted)`)

When enabled, edges animate a flowing dash pattern via CSS `stroke-dashoffset`.
Auto-disables when edge count exceeds 400 for performance.
Respects `prefers-reduced-motion` media query at init time.

### Zoom LOD (Level of Detail)

Three zoom tiers control node rendering density:

- **Full** (zoom > 0.7): all node content visible
- **Compact** (0.4 <= zoom <= 0.7): node body sections hidden
- **Minimal** (zoom < 0.4): body + header value text hidden

Driven by a `data-lod` attribute on the canvas wrapper with CSS rules
targeting `.cs-node-body` and `.cs-node-header-value` classes.

### Controls

- **BottomToolbar**: animated-edges button (`\u2248`) and LOD button (`\u25e7`)
- **View menu**: "Toggle animated edges" and "Toggle zoom LOD"
- **Keyboard**: `Alt+E` (animated edges), `Alt+L` (LOD)
- **Command Palette**: auto-registered via menu flattening

### Persistence

- `localStorage` keys: `chainsolve.edgesAnimated`, `chainsolve.lod`
- Defaults: both enabled (edges off if `prefers-reduced-motion`)

### Key files

- Custom edge: `src/components/canvas/edges/AnimatedEdge.tsx`
- Settings context: `src/contexts/CanvasSettingsContext.ts`
- LOD CSS rules: `src/index.css` (search `cs-edge-flow`, `data-lod`)
- Node LOD classes: `className="cs-node-body"` / `"cs-node-header-value"` in node components

## Engineering & Physics block pack (W11a)

60 deterministic engineering blocks across 8 categories, powered by Rust/WASM ops.

### Categories (60 blocks)

| Category | Count | Examples |
|----------|-------|---------|
| Mechanics | 17 | F=ma, KE=½mv², P=W/t, centripetal force |
| Materials | 7 | σ=F/A, ε=ΔL/L, E=σ/ε, Hooke's law |
| Sections | 7 | Area circle/annulus, I rect/circle, bending stress |
| Inertia | 5 | Solid/hollow cylinder, sphere, rod |
| Fluids | 7 | Q=Av, Reynolds, Hagen-Poiseuille, Darcy-Weisbach |
| Thermo | 5 | Ideal gas PV=nRT, Q=mcΔT, conduction, convection |
| Electrical | 4 | V=IR, P=VI, P=I²R, P=V²/R |
| Conversions | 8 | deg↔rad, mm↔m, bar↔Pa, L/min↔m³/s |

### Architecture

- **Op IDs**: Stable namespaced IDs — `eng.<category>.<formula>` (e.g. `eng.mechanics.force_ma`)
- **Rust ops**: Match arms in `crates/engine-core/src/ops.rs`, catalog entries in `catalog.rs`
- **TS blocks**: `src/blocks/eng-blocks.ts` exports `registerEngBlocks()`, called from `registry.ts`
- **Error handling**: Division-by-zero and invalid-sqrt return `Value::error("message")`, not NaN
- **Defaults**: g=9.80665 m/s², R=8.314462618 J/mol·K via `manualValues` in defaultData

### Adding a new engineering block

1. Add match arm in `crates/engine-core/src/ops.rs` (before `_ =>` fallthrough)
2. Add `CatalogEntry` in `crates/engine-core/src/catalog.rs` (update test count)
3. Add `register({...})` call in `src/blocks/eng-blocks.ts`
4. Run `cargo test` + `npm run typecheck` + `npm run build`

## Finance & Statistics block pack (W11b)

40 finance, statistics, and probability blocks across 8 categories, powered by Rust/WASM ops.

### Categories (40 blocks)

| Category | Count | Examples |
|----------|-------|---------|
| TVM | 10 | Simple/compound interest, annuity PV/FV/PMT, NPV, Rule of 72 |
| Returns & Risk | 6 | % return, log return, CAGR, Sharpe, weighted avg, portfolio variance |
| Depreciation | 2 | Straight-line, declining balance |
| Descriptive Stats | 9 | Mean, median, mode, range, variance, stddev, sum, geo mean, z-score |
| Relationships | 4 | Covariance, correlation, linear regression slope & intercept |
| Combinatorics | 2 | Factorial (n!), permutation P(n,k) |
| Distributions | 5 | Binomial PMF, Poisson PMF, exponential PDF/CDF, normal PDF |
| Utilities | 2 | Round to DP, % → decimal |

### Architecture

- **Op IDs**: Stable namespaced IDs — `fin.*`, `stats.*`, `prob.*`, `util.*`
- **Rust ops**: Match arms in `crates/engine-core/src/ops.rs`, catalog entries in `catalog.rs`
- **TS blocks**: `src/blocks/fin-stats-blocks.ts` exports `registerFinStatsBlocks()`, called from `registry.ts`
- **Fixed-port stats**: Descriptive & relationship blocks use 6 fixed data slots (X1–X6, Y1–Y6) with a count parameter
- **Error handling**: Division-by-zero, invalid inputs return `Value::error("message")`
- **All Pro-only**: All 40 blocks require Pro entitlement

## Constants & Presets block pack (W11c)

44 constant / preset source blocks across 7 categories, powered by Rust/WASM ops. All blocks are **FREE** (not Pro-gated).

### Categories (44 blocks)

| Category | Count | Examples |
|----------|-------|---------|
| Math Constants | 3 | √2, ln 2, ln 10 (pi/e/τ/φ already in core "constants" category) |
| Physics | 15 | g₀, R, c, h, ℏ, kB, Nₐ, qₑ, F, mₑ, mₚ, G, μ₀, ε₀, σ_SB |
| Atmospheric | 7 | p₀, T₀, ρ_air, γ_air, R_air, μ_air, a_air |
| Thermodynamic | 4 | cp_air, cv_air, k_air, k_water |
| Electrical | 2 | ρ_copper, ρ_aluminium |
| Material Presets | 9 | Steel/Aluminium/Titanium ρ, E, ν |
| Fluid Presets | 4 | Water ρ/μ, gasoline ρ, diesel ρ |

### Architecture

- **Op IDs**: Stable namespaced IDs — `const.<domain>.<name>` and `preset.<domain>.<name>`
- **Rust ops**: Match arms in `crates/engine-core/src/ops.rs`, catalog entries in `catalog.rs`
- **TS blocks**: `src/blocks/constants-blocks.ts` exports `registerConstantsBlocks()`, called from `registry.ts`
- **Source blocks**: All are `csSource` with zero inputs and one scalar output
- **Free tier**: None of these categories are in `PRO_CATEGORIES`

## Value Bindings + Variables + Table Inputs (W12.2)

### Binding model

Each unconnected input port can hold a **binding** instead of a bare number:

| Kind | Data | Meaning |
|------|------|---------|
| `literal` | `{ kind: 'literal', value: number, raw?: string }` | Direct numeric value (equivalent to legacy `manualValues`) |
| `const` | `{ kind: 'const', constOpId: string }` | Reference to a catalog constant (full precision from Rust) |
| `var` | `{ kind: 'var', varId: string }` | Reference to a project-level variable |

Bindings are stored in `node.data.inputBindings: Record<portId, InputBinding>`.

### Resolution architecture (V1)

Bindings are resolved to `manualValues` in the TS bridge layer (`src/engine/resolveBindings.ts`) **before** the snapshot reaches Rust. This means no changes to the Rust evaluation loop — `eval.rs` and `graph.rs` continue reading `manualValues` exactly as today.

The single resolution point is `src/engine/bridge.ts` → `toEngineSnapshot()`.

### Project variables

Project-level scalar variables are stored as JSONB on the `projects` table (`variables` column). They are shared across all canvases in a project.

- **Store**: `src/stores/variablesStore.ts` (Zustand)
- **Service**: `src/lib/variablesService.ts`
- **Migration**: `supabase/migrations/0015_project_variables.sql`
- **Types**: `src/lib/variables.ts`

### ValueEditor

Replaces bare `<input type="number">` on unconnected/overridden ports. Shows:
- Literal mode: number input + picker button
- Const binding: purple chip with name + value
- Var binding: blue chip with name + value
- Popover with searchable constant + variable lists

### New blocks

- **variableSource**: Source block bound to a project variable (two-way sync)
- **Table CSV import**: "CSV" button on TableEditor for importing `.csv` files

### Key files

| File | Purpose |
|------|---------|
| `src/blocks/types.ts` | `InputBinding` type, `NodeData.inputBindings`, `NodeData.varId` |
| `src/engine/resolveBindings.ts` | Single resolution point for all bindings |
| `src/engine/bridge.ts` | Injects resolved values into snapshot |
| `src/engine/useGraphEngine.ts` | Threads constants+variables to bridge |
| `src/contexts/BindingContext.ts` | Provides constants+catalog to ValueEditor |
| `src/components/canvas/editors/ValueEditor.tsx` | Rich editor replacing bare inputs |
| `src/stores/variablesStore.ts` | Variables state management |
| `src/components/canvas/VariablesPanel.tsx` | Variables UI panel |
| `crates/engine-core/src/catalog.rs` | `constant_values()` function |
