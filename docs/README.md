# ChainSolve — Documentation

> For a comprehensive doc index with purpose, audience, and content guide for
> each document, see **[INDEX.md](INDEX.md)**.
>
> For first-time setup see [SETUP.md](SETUP.md).
> For contributor workflow see [CONTRIBUTING.md](../CONTRIBUTING.md).

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

**Dev CLI (`cs`):**
- Single executable: `./cs <command>` — no installation needed
- Commands: `new`, `test`, `push`, `ship`, `hotfix`, `help`
- Workflow: `./cs test` → `./cs push "W10.x: description"` → `./cs ship`
- Safety: refuses to commit/push to main without `--allow-main`
- `cs test` runs typecheck + lint (quick); `cs test --full` adds unit tests + build
- `cs push` stages all, commits, pushes, suggests PR creation
- `cs ship` creates/reuses PR, squash-merges, deletes branch, updates local main
- `cs hotfix <name>` creates `hotfix/<name>-YYYYMMDD` branch from main
