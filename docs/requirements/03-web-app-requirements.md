# 03 — Web App Requirements

> Revision: 1.0 · Date: 2026-02-26

The web app is the **reference implementation** of ChainSolve. All features
land here first. Mobile and Desktop are derivative.

---

## 1. Technology baseline

| Layer | Technology | Version constraint |
|-------|-----------|-------------------|
| Framework | React | 19.x |
| Build | Vite | 7.x |
| Language | TypeScript | 5.9+ strict (`verbatimModuleSyntax`) |
| State | Zustand | Latest |
| Graph UI | @xyflow/react | 12.x |
| Engine | Rust/WASM (wasm-pack) | Loaded in Web Worker |
| Routing | react-router-dom | 7.x |
| i18n | react-i18next | 5 locales: EN, ES, FR, IT, DE |
| Plots | Vega-Lite | CSP-safe (no inline `<script>`) |
| Hosting | Cloudflare Pages | Static + Pages Functions |
| Backend | Supabase | Auth, Postgres, Storage, RLS |
| Payments | Stripe | Checkout + webhooks |

---

## 2. UI shell

### 2.1 Layout

```
┌──────────────────────────────────────────────┐
│  AppHeader (menus + user avatar + plan badge) │
│──────────────────────────────────────────────│
│  SheetsBar (canvas tabs)                     │
│──────────────────────────────────────────────│
│ BlockLib │         CanvasArea          │ Insp │
│ (left)   │                             │(right)│
│          │                             │      │
│          │       [BottomToolbar]       │      │
│──────────────────────────────────────────────│
│  [DebugConsole] (toggle panel, bottom)       │
└──────────────────────────────────────────────┘
```

### 2.2 Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| UI-1 | The app MUST render a responsive shell that adapts from 360 px (mobile) to 4K (desktop). | MUST |
| UI-2 | The layout MUST support collapsible left panel (Block Library), collapsible right panel (Inspector), and a toggleable bottom panel (Debug Console). | MUST |
| UI-3 | The app MUST provide a professional menu bar with File, Edit, View, Insert, Tools, Help dropdown menus. | MUST |
| UI-4 | On viewports < 900 px, the menu bar MUST collapse to a single overflow button (⋯) that opens the Command Palette. | MUST |
| UI-5 | A Command Palette (Ctrl+K / Cmd+K) MUST flatten all menu actions into a searchable, keyboard-navigable list. | MUST |
| UI-6 | The app MUST support three theme modes: System (default), Light, Dark. Theme MUST be applied before first paint (no FOUC). | MUST |
| UI-7 | All text content MUST be internationalised via `react-i18next`. Hard-coded user-facing strings are forbidden. | MUST |
| UI-8 | The app MUST display a save status indicator (idle / saving / saved / conflict / error) with last-saved timestamp on hover. | MUST |
| UI-9 | The header MUST show the user's plan badge (Free / Pro). | MUST |
| UI-10 | Keyboard shortcuts MUST be documented in a discoverable location (Help menu or Command Palette hint text). | SHOULD |

### 2.3 Acceptance criteria

- [ ] Shell renders correctly at 360 px, 768 px, 1280 px, and 1920 px widths.
- [ ] All three panels can be independently toggled with no layout glitches.
- [ ] Command Palette returns relevant results for partial searches (e.g. "zoo" → "Zoom In").
- [ ] Theme switch takes effect in < 16 ms (single frame).

---

## 3. Canvas UX

### 3.1 Core interactions

| ID | Requirement | Priority |
|----|-------------|----------|
| CX-1 | Users MUST be able to **pan** the canvas by scroll-wheel, trackpad gesture, or pan-mode (hold Space or toggle button). | MUST |
| CX-2 | Users MUST be able to **zoom** via scroll-wheel, pinch gesture, or toolbar buttons. Zoom range: 8%–400%. | MUST |
| CX-3 | Users MUST be able to **select** nodes by click, marquee selection (drag on empty space), or Ctrl+A (select all). | MUST |
| CX-4 | Users MUST be able to **move** selected nodes by dragging. Multi-selection drag MUST preserve relative positions. | MUST |
| CX-5 | Users MUST be able to **connect** nodes by dragging from an output port to an input port (or vice versa). Invalid connections (e.g. fan-in > 1) MUST be rejected with visual feedback. | MUST |
| CX-6 | Users MUST be able to **delete** selected nodes and edges via Del/Backspace key or context menu. | MUST |
| CX-7 | **Undo** (Ctrl+Z) and **Redo** (Ctrl+Shift+Z / Ctrl+Y) MUST support a bounded history (≥ 50 entries). | MUST |
| CX-8 | **Cut** (Ctrl+X), **Copy** (Ctrl+C), **Paste** (Ctrl+V) MUST work on selected nodes and their internal edges. Pasted nodes MUST receive fresh IDs and be offset from the original positions. | MUST |
| CX-9 | **Find block** (Ctrl+F) MUST open a search dialog that filters nodes by label and block type (case-insensitive). Selecting a result MUST zoom the canvas to that node. | MUST |
| CX-10 | **Auto-layout** MUST arrange nodes using a Dagre-based algorithm. Click = LR direction, Shift+click = TB. MUST support undo. | SHOULD |
| CX-11 | **Snap to grid** MUST be toggleable. When enabled, node positions snap to a configurable grid. | SHOULD |
| CX-12 | **Lock layout** MUST disable node dragging and connecting when active. | SHOULD |
| CX-13 | A **minimap** MUST be toggleable and persist its on/off state to `localStorage`. | MUST |
| CX-14 | **Context menus** (right-click on canvas, node, edge, group) MUST provide relevant actions. | MUST |
| CX-15 | **Quick-add palette**: double-clicking empty canvas space SHOULD open a floating block picker at the cursor position. | SHOULD |

### 3.2 Zoom Level of Detail (LOD)

| ID | Requirement | Priority |
|----|-------------|----------|
| LOD-1 | The canvas MUST implement three LOD tiers: Full (zoom > 0.7), Compact (0.4–0.7), Minimal (< 0.4). | MUST |
| LOD-2 | In Compact mode, node body sections MUST be hidden; only headers visible. | MUST |
| LOD-3 | In Minimal mode, header value text MUST also be hidden; only block type labels visible. | MUST |
| LOD-4 | LOD MUST be toggleable via toolbar, View menu, keyboard (Alt+L), or Command Palette. | MUST |
| LOD-5 | LOD preference MUST persist to `localStorage`. | SHOULD |

### 3.3 Animated edges

| ID | Requirement | Priority |
|----|-------------|----------|
| AE-1 | Edges MUST be color-coded by the source node's value kind: scalar (teal), vector (purple), table (orange), error (red), unknown (grey). | MUST |
| AE-2 | When animated edges are enabled, a flowing dash pattern MUST animate along edges. | SHOULD |
| AE-3 | Animated edges MUST auto-disable when edge count exceeds 400 for performance. | MUST |
| AE-4 | Animated edges MUST respect `prefers-reduced-motion` media query. | MUST |
| AE-5 | The feature MUST be toggleable (Alt+E, toolbar, View menu, Command Palette). | MUST |

### 3.4 Grouping

| ID | Requirement | Priority |
|----|-------------|----------|
| GR-1 | Users MUST be able to create a group from selected nodes (context menu or shortcut). | MUST |
| GR-2 | Groups MUST be collapsible. Collapsed groups hide child nodes and show proxy input/output handles. | MUST |
| GR-3 | Groups MUST support color and notes (editable via Inspector). | SHOULD |
| GR-4 | Users SHOULD be able to save a group as a reusable template. | SHOULD |
| GR-5 | Group operations (create, collapse, expand, color, notes) MUST be undoable. | MUST |
| GR-6 | Groups MUST be gated to Pro plan. Free users see groups as read-only if a shared project contains them. | MUST |

### 3.5 Acceptance criteria

- [ ] A 500-node / 1000-edge graph can be panned and zoomed at ≥ 30 fps.
- [ ] Undo/redo correctly reverses all mutations including drag, connect, delete, paste, layout, group.
- [ ] LOD transitions are smooth (CSS transitions, no layout jumps).
- [ ] Animated edges auto-disable above 400 edges; re-enable when edges drop below 400.

---

## 4. Block Library

| ID | Requirement | Priority |
|----|-------------|----------|
| BL-1 | The Block Library MUST be a left sidebar panel, toggleable via toolbar, View menu, or keyboard shortcut. | MUST |
| BL-2 | Blocks MUST be organized by category (33 categories in canonical `CATEGORY_ORDER`). | MUST |
| BL-3 | A search input at the top MUST filter blocks by name and category (case-insensitive, substring match). | MUST |
| BL-4 | Each block entry MUST show: label, category badge, and a Pro badge if `proOnly`. | MUST |
| BL-5 | Blocks MUST be addable to the canvas by: (a) drag-and-drop, (b) double-click, (c) search + Enter. | MUST |
| BL-6 | Pro-only blocks MUST be visible but disabled for Free users, with a tooltip explaining the plan requirement. | MUST |
| BL-7 | The library SHOULD show "Recently used" and "Favorites" sections at the top. | COULD |
| BL-8 | Category sections MUST be collapsible. Collapse state SHOULD persist to `localStorage`. | SHOULD |

### Acceptance criteria

- [ ] Searching "force" returns all blocks with "force" in the name (e.g. `eng.mechanics.force_ma`).
- [ ] Drag-and-drop places the block at the canvas drop position (not at origin).
- [ ] Pro badge is visible on all Pro-only blocks.

---

## 5. ValueEditor

The ValueEditor replaces bare `<input type="number">` fields on unconnected input ports.

| ID | Requirement | Priority |
|----|-------------|----------|
| VE-1 | When a port is unconnected (or overridden), the ValueEditor MUST render an inline input for the current binding. | MUST |
| VE-2 | The editor MUST support three binding kinds: **literal** (direct number), **const** (catalog constant), **var** (project variable). | MUST |
| VE-3 | A picker button MUST open a popover with two searchable lists: constants and variables. | MUST |
| VE-4 | When a `const` binding is active, the editor MUST show a purple chip with the constant name and resolved value. | MUST |
| VE-5 | When a `var` binding is active, the editor MUST show a blue chip with the variable name and current value. | MUST |
| VE-6 | Clicking a chip MUST allow switching back to literal mode or to a different constant/variable. | MUST |
| VE-7 | The literal input MUST accept only valid finite numbers. Non-numeric input MUST be rejected with visual feedback. | MUST |
| VE-8 | When a port has an incoming edge, the ValueEditor MUST be hidden or disabled (edge value takes precedence). | MUST |
| VE-9 | The raw text representation of a literal binding SHOULD be preserved in `raw` for display fidelity (e.g. "3.14" not "3.140000000000001"). | SHOULD |

### Acceptance criteria

- [ ] Switching between literal, const, and var modes persists correctly to node data.
- [ ] Deleting a referenced variable gracefully degrades to NaN (with warning) rather than crashing.
- [ ] Typing "abc" into a literal field shows validation error; the invalid value is not saved.

---

## 6. Variables panel

| ID | Requirement | Priority |
|----|-------------|----------|
| VP-1 | A Variables panel MUST be accessible from the UI (toolbar button, View menu, or keyboard shortcut). | MUST |
| VP-2 | The panel MUST display all project variables with name, value, and description. | MUST |
| VP-3 | Users MUST be able to create a new variable with a unique name and initial value. | MUST |
| VP-4 | Users MUST be able to edit a variable's name, value, and description inline. | MUST |
| VP-5 | Users MUST be able to delete a variable. Deletion MUST warn if any nodes reference the variable. | MUST |
| VP-6 | Variable name uniqueness MUST be enforced (case-insensitive). Duplicate names MUST be rejected with feedback. | MUST |
| VP-7 | Changing a variable's value MUST trigger re-evaluation of all graphs that reference it. | MUST |
| VP-8 | The panel SHOULD show a usage count (number of bindings referencing each variable). | COULD |

### Acceptance criteria

- [ ] Creating a variable and binding a port to it immediately reflects the variable's value in engine output.
- [ ] Changing the variable value updates all bound ports across all canvases.
- [ ] Deleting a variable that is referenced by 3 nodes shows a warning listing the affected nodes.

---

## 7. Table editor

| ID | Requirement | Priority |
|----|-------------|----------|
| TE-1 | `tableInput` and `csvImport` nodes MUST provide a table editing interface. | MUST |
| TE-2 | The editor MUST support inline editing of cell values (numeric only). | MUST |
| TE-3 | Users MUST be able to add/remove columns and rows. | MUST |
| TE-4 | Users MUST be able to paste tabular data from clipboard (tab-separated or CSV format). | MUST |
| TE-5 | A "CSV Import" button MUST allow uploading a `.csv` file. The file MUST be parsed asynchronously (Web Worker) to avoid blocking the UI. | MUST |
| TE-6 | CSV parsing MUST validate that all data cells are numeric. Non-numeric cells MUST be flagged with a visible error. | MUST |
| TE-7 | Column headers MUST be editable strings. They are used as axis labels in connected plot blocks. | MUST |
| TE-8 | Table data MUST be limited to a reasonable maximum (SHOULD: 10 000 rows × 100 columns) to prevent memory exhaustion. | SHOULD |
| TE-9 | Table and CSV features MUST be gated to Pro plan. | MUST |

### Acceptance criteria

- [ ] Pasting a 5×3 tab-separated block from Excel populates the table correctly.
- [ ] Uploading a 1 000-row CSV completes in < 2 seconds and does not freeze the UI.
- [ ] A CSV containing "N/A" in a cell shows an inline validation error on that cell.

---

## 8. Output blocks

| ID | Requirement | Priority |
|----|-------------|----------|
| OB-1 | `display` nodes MUST show the computed scalar value with appropriate precision (default: 6 significant digits). | MUST |
| OB-2 | Plot nodes (`xyPlot`, `histogram`, `barChart`, `heatmap`) MUST render charts using Vega-Lite. | MUST |
| OB-3 | Plot nodes MUST support an "expand" action that opens a full-screen modal with the chart. | MUST |
| OB-4 | The expand modal MUST support exporting the chart as PNG or SVG. | MUST |
| OB-5 | Plot rendering MUST be CSP-safe (no inline `<script>` tags). | MUST |
| OB-6 | Plots SHOULD downsample data exceeding `maxPoints` (default: 5 000) to maintain rendering performance. | SHOULD |
| OB-7 | Engine errors MUST be displayed clearly on output blocks — never as `NaN` without explanation. Show the error message from the engine diagnostic. | MUST |
| OB-8 | Plot blocks MUST be gated to Pro plan. | MUST |

### Acceptance criteria

- [ ] A division-by-zero upstream shows "Error: Division by zero" on the display node, not "NaN".
- [ ] A histogram with 50 000 data points renders correctly with downsampling; no browser freeze.
- [ ] PNG export produces a clean image with correct title and axis labels.

---

## 9. Debug Console

A built-in diagnostic panel for inspecting engine evaluation, binding resolution,
variable state, file I/O, network activity, and performance metrics.

### 9.1 Core requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DC-1 | The Debug Console MUST be a toggleable bottom panel in the main layout. | MUST |
| DC-2 | The console MUST be togglable via: keyboard shortcut (Ctrl+`), View menu, Command Palette, or a toolbar button. | MUST |
| DC-3 | The console MUST NOT be visible by default. Users opt in. | MUST |
| DC-4 | The console MUST support **verbosity levels**: `error`, `warn`, `info`, `debug`, `trace`. Higher levels include all lower levels. | MUST |
| DC-5 | The default verbosity MUST be `warn`. | MUST |
| DC-6 | The verbosity level MUST be adjustable via a dropdown in the console header. | MUST |

### 9.2 Log categories (filters)

| ID | Requirement | Priority |
|----|-------------|----------|
| DC-7 | The console MUST categorize log entries and support **filtering** by category. | MUST |
| DC-8 | Required categories: `engine` (evaluation results and diagnostics), `bindings` (binding resolution), `variables` (variable CRUD and value changes), `file` (project save/load/export), `network` (API calls, Supabase operations), `perf` (timing, node counts, memory). | MUST |
| DC-9 | Multiple category filters MUST be combinable (AND logic: show entries matching any selected category). | MUST |
| DC-10 | A "Clear" button MUST remove all current log entries. | MUST |

### 9.3 Log entry format

| ID | Requirement | Priority |
|----|-------------|----------|
| DC-11 | Each log entry MUST display: timestamp (HH:MM:SS.mmm), verbosity level badge, category badge, and message text. | MUST |
| DC-12 | `engine` entries at `info` level MUST include: evaluation duration (µs), nodes evaluated, total nodes, and whether incremental. | MUST |
| DC-13 | `engine` entries at `debug` level SHOULD include per-node trace data (node ID, block type, duration µs). | SHOULD |
| DC-14 | `bindings` entries at `debug` level SHOULD log each resolved binding (port → value, source kind). | SHOULD |
| DC-15 | `perf` entries SHOULD include memory estimates (approximate heap usage) when available. | COULD |
| DC-16 | Error-level entries MUST visually stand out (red background or icon). | MUST |

### 9.4 Export

| ID | Requirement | Priority |
|----|-------------|----------|
| DC-17 | The console MUST provide an "Export" button that downloads all current log entries. | MUST |
| DC-18 | Export formats: `.txt` (human-readable, one line per entry) and `.json` (structured array). | MUST |
| DC-19 | Exported logs MUST NOT include auth tokens, API keys, or user credentials. Sensitive fields MUST be redacted. | MUST |

### 9.5 Performance and safety

| ID | Requirement | Priority |
|----|-------------|----------|
| DC-20 | The console MUST use a bounded ring buffer (≤ 10 000 entries). Oldest entries are evicted when the buffer is full. | MUST |
| DC-21 | At `trace` level, the console MUST NOT degrade canvas frame rate below 30 fps on a mid-range device. If logging overhead is detected, the console SHOULD auto-throttle to `debug`. | SHOULD |
| DC-22 | The console MUST NOT ship logs to any external service by default. All logging is local to the browser session. | MUST |
| DC-23 | Enterprise deployments MAY configure an internal log endpoint (see §9.6). This MUST be opt-in and MUST NOT be enabled in the public web app. | COULD |

### 9.6 Preferences

| ID | Requirement | Priority |
|----|-------------|----------|
| DC-24 | Console visibility and verbosity level SHOULD persist per-project (stored in `localStorage` keyed by `chainsolve.debug.<projectId>`). | SHOULD |
| DC-25 | A global default verbosity SHOULD be configurable in user preferences (future: `user_preferences` table). | SHOULD |
| DC-26 | Enterprise builds SHOULD support a policy flag to set minimum verbosity and mandatory log export location. | COULD |

### 9.7 Acceptance criteria

- [ ] Toggling the console does not cause canvas re-render or layout shift.
- [ ] Setting verbosity to `trace` and running a 200-node evaluation shows per-node timing in the console.
- [ ] Exporting to JSON produces valid JSON with all displayed entries.
- [ ] No auth tokens appear in exported logs.
- [ ] With 10 001 entries, the oldest entry is evicted (ring buffer behavior).

---

## 10. Multi-canvas (Sheets)

| ID | Requirement | Priority |
|----|-------------|----------|
| MC-1 | Each project MUST support multiple canvases (sheets). | MUST |
| MC-2 | A horizontal tab bar (desktop) or dropdown (mobile) MUST allow switching between canvases. | MUST |
| MC-3 | Users MUST be able to: add a new canvas, rename a canvas (double-click tab), delete a canvas (context menu). | MUST |
| MC-4 | Deleting the last canvas MUST be prevented. | MUST |
| MC-5 | Canvas ordering MUST be preserved (0-based position). Drag-to-reorder tabs is COULD for now. | SHOULD |
| MC-6 | The active canvas MUST be persisted to `projects.active_canvas_id` for cross-device continuity. | MUST |
| MC-7 | Canvas count MUST be gated by plan (Free: 2, Pro: unlimited). | MUST |
| MC-8 | Each canvas MUST be stored as an independent JSON file in Supabase Storage. | MUST |

### Acceptance criteria

- [ ] A project with 5 canvases loads correctly; switching tabs loads the correct graph.
- [ ] Free user attempting to create a 3rd canvas sees an entitlement upgrade prompt.
- [ ] Closing and reopening a project restores the last-active canvas.

---

## 11. Project management

| ID | Requirement | Priority |
|----|-------------|----------|
| PM-1 | File → New Project: create a new project (entitlement-gated) and navigate to it. | MUST |
| PM-2 | File → Open: show a project picker with search, keyboard navigation, and relative timestamps. | MUST |
| PM-3 | File → Save: persist the current canvas to Supabase Storage. Auto-save SHOULD run on a debounced interval. | MUST |
| PM-4 | File → Save As: duplicate the current project with a new name. | MUST |
| PM-5 | File → Recent Projects: show the 10 most recently opened projects (stored in `localStorage`). | MUST |
| PM-6 | Unsaved changes MUST trigger a confirmation dialog when navigating away (New, Open, Close). | MUST |
| PM-7 | Conflict detection: if the server version is newer than the loaded version, the save MUST fail and offer "Keep mine" / "Reload" options. | MUST |

### Acceptance criteria

- [ ] Creating a new project while one is open and dirty shows the unsaved-changes dialog.
- [ ] Concurrent edit scenario: two tabs editing the same project → second save shows conflict dialog.
- [ ] Save As from a scratch canvas correctly creates a persistent project.

---

## 12. Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| AU-1 | The app MUST support email/password authentication via Supabase Auth. | MUST |
| AU-2 | Protected routes (`/app`, `/canvas/:id`) MUST redirect unauthenticated users to `/login`. | MUST |
| AU-3 | Session MUST be managed via Supabase's JWT-based auth. Tokens MUST be refreshed automatically. | MUST |
| AU-4 | OAuth providers (Google, GitHub) SHOULD be supported as login options. | SHOULD |
| AU-5 | Billing settings MUST require password re-authentication (10-minute window). | MUST |

---

## 13. Performance targets

| ID | Metric | Target | Priority |
|----|--------|--------|----------|
| PF-1 | Initial load (LCP) | < 3 seconds on 4G | MUST |
| PF-2 | WASM init | < 1 second | MUST |
| PF-3 | Full evaluation (500 nodes) | < 100 ms | MUST |
| PF-4 | Incremental evaluation (single slider change, 500 nodes) | < 20 ms | SHOULD |
| PF-5 | Canvas frame rate (500 nodes, zoom/pan) | ≥ 30 fps | MUST |
| PF-6 | Canvas frame rate (1 000 nodes, zoom/pan) | ≥ 20 fps | SHOULD |
| PF-7 | Memory usage (1 000-node project) | < 200 MB heap | SHOULD |
| PF-8 | Save latency (500-node canvas) | < 2 seconds | MUST |
| PF-9 | CSV parse (10 000 rows × 10 columns) | < 3 seconds, non-blocking | MUST |

### Large graph usability (1 000 nodes / 2 000 edges)

- The canvas MUST remain interactive (pan, zoom, select) at this scale.
- LOD MUST kick in to reduce rendering cost at low zoom levels.
- Animated edges MUST auto-disable above 400 edges.
- The engine MUST complete evaluation within the watchdog timeout (5 000 ms).
- If evaluation times out, partial results MUST be displayed with a diagnostic.

### Acceptance criteria

- [ ] A 500-node stress test project evaluates in < 100 ms (measured via debug console perf entries).
- [ ] A 1 000-node project is navigable at ≥ 20 fps with LOD enabled.
- [ ] WASM init completes in < 1 second on a 2020 mid-range laptop.

---

## 14. Error UX

| ID | Requirement | Priority |
|----|-------------|----------|
| ER-1 | Engine errors MUST be surfaced directly on the affected node (red border + error message tooltip). | MUST |
| ER-2 | Engine diagnostics MUST be listed in the Inspector panel when an errored node is selected. | MUST |
| ER-3 | `NaN` MUST never appear as a user-visible value. If a computation produces `NaN`, it MUST be replaced with an error diagnostic that explains the cause. | MUST |
| ER-4 | WASM init failure MUST show a full-screen error with actionable guidance (CSP check, browser version, retry). | MUST |
| ER-5 | Network errors (save failure, load failure) MUST show a toast notification with a retry action. | MUST |
| ER-6 | Cycle detection MUST highlight the involved nodes with a visual indicator (e.g. pulsing red border). | SHOULD |
| ER-7 | Errors in the debug console MUST be auto-scrolled into view when they occur. | SHOULD |

### Acceptance criteria

- [ ] A node with `DIVISION_BY_ZERO` shows "Error: Division by zero" (not NaN) with a red border.
- [ ] A cycle in the graph highlights all cycle nodes and shows a "Cycle detected" message.
- [ ] A save failure shows a toast with "Save failed — Retry" button.

---

## 15. Accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| A11Y-1 | All interactive elements MUST be keyboard-navigable (Tab, Enter, Space, Arrow keys). | MUST |
| A11Y-2 | The menu bar MUST use `role="menubar"` / `role="menu"` with proper ARIA attributes. | MUST |
| A11Y-3 | The Command Palette MUST use `role="dialog"` with `aria-modal` and a focus trap. | MUST |
| A11Y-4 | Color MUST NOT be the sole indicator of state. Combine with icons, text, or patterns. | MUST |
| A11Y-5 | Animated edges MUST respect `prefers-reduced-motion`. | MUST |
| A11Y-6 | Focus indicators MUST be visible on all interactive elements. | MUST |
| A11Y-7 | All images and icons MUST have appropriate `alt` text or `aria-label`. | SHOULD |
| A11Y-8 | The app SHOULD target WCAG 2.1 AA compliance for core workflows. | SHOULD |

---

## 16. Sheets bar UX

| ID | Requirement | Priority |
|----|-------------|----------|
| SB-1 | Desktop: horizontal tab bar below the header. Each tab shows canvas name. | MUST |
| SB-2 | Mobile: dropdown selector with canvas name + "+" button. | MUST |
| SB-3 | Double-click tab to rename (inline edit). | MUST |
| SB-4 | Right-click tab for context menu: Rename, Duplicate, Delete. | MUST |
| SB-5 | "+" button to add new canvas (entitlement-gated). | MUST |
| SB-6 | Active tab MUST be visually distinct (underline or background). | MUST |

---

## 17. Export

### 17.1 PDF export (W14a.1 — active sheet)

| ID | Requirement | Priority |
|----|-------------|----------|
| EX-1 | File > Export PDF downloads an audit-ready PDF for the active canvas. | MUST |
| EX-2 | PDF includes: cover/meta, snapshot SHA-256 hash, graph health, engine evaluation summary, diagnostics table, node value table, and graph image. | MUST |
| EX-3 | Snapshot hash is computed from a stable-stringified `{ nodes, edges, variables }` object (sorted keys, preserved array order). | MUST |
| EX-4 | PDF is deterministic for the same graph + inputs (only the export timestamp may vary). | MUST |
| EX-5 | No secrets leak into the PDF (no auth tokens, Supabase keys, or emails). | MUST |
| EX-6 | pdf-lib and html-to-image are lazy-loaded; initial bundle size is unchanged. | MUST |
| EX-7 | CSP integrity is preserved (no unsafe-eval, no inline scripts). | MUST |
| EX-8 | If graph image capture fails, PDF is still generated with a "Graph image unavailable" notice. | MUST |

### 17.2 PDF export (W14a.2 — all sheets)

| ID | Requirement | Priority |
|----|-------------|----------|
| EX-9  | File > Export PDF submenu offers "Active sheet" and "All sheets" options. | MUST |
| EX-10 | "All sheets" export produces a single PDF with a Table of Contents and per-canvas sections. | MUST |
| EX-11 | Each canvas section includes: header, snapshot hash, health summary, eval summary, diagnostics, node values, and graph image. | MUST |
| EX-12 | A project-level SHA-256 hash is computed from the ordered per-canvas hashes. | MUST |
| EX-13 | TOC lists all canvases with page numbers and dot leaders. | MUST |
| EX-14 | "All sheets" is disabled for scratch (unsaved) projects. | MUST |
| EX-15 | Graph images are captured for the active canvas; non-active canvases show "Graph image unavailable" notice. | MUST |
| EX-16 | Non-active canvas data is loaded from Supabase Storage without switching the active canvas in the UI. | MUST |

### 17.3 PDF export hardening (W14a.3)

| ID    | Requirement                                                                                                                 | Priority |
|-------|-----------------------------------------------------------------------------------------------------------------------------|----------|
| EX-17 | All-sheets export captures graph images for **every** canvas by programmatically switching canvases (CanvasPage orchestrator). | MUST |
| EX-18 | Image capture uses `toBlob` (not `toPng`) to avoid base64 memory overhead. Bytes passed directly to `embedPng`. | MUST |
| EX-19 | A fallback ladder (PR=2 → PR=1 → PR=1-downscale → skip) prevents Chrome canvas crashes on large graphs. | MUST |
| EX-20 | `MAX_CAPTURE_PIXELS` (16 MP) cap enforced via the pure `computeSafePixelRatio` function. | MUST |
| EX-21 | "Images: skip (values only)" toggle in the Export PDF submenu, persisted in localStorage. | MUST |
| EX-22 | Export progress shown as per-canvas toasts ("Sheet N/M"). | SHOULD |
| EX-23 | Export cancellable via AbortController; cancel button appears in menu during export. | SHOULD |
| EX-24 | Autosave suppressed during export canvas switching. Original canvas restored in `finally`. | MUST |

### 17.4 Excel export — active sheet (W14b.1)

| ID    | Requirement                                                                                  | Priority |
|-------|----------------------------------------------------------------------------------------------|----------|
| EX-25 | "File > Export Excel" generates an `.xlsx` for the active canvas sheet.                       | MUST     |
| EX-26 | Workbook contains 5 worksheets: Summary, Variables, Node Values, Diagnostics, Graph Health.   | MUST     |
| EX-27 | `write-excel-file/browser` lazy-loaded via cached singleton (no initial bundle impact).       | MUST     |
| EX-28 | Reuses `buildAuditModel()` as single source of truth (same data as PDF export).               | MUST     |
| EX-29 | Header rows use bold teal styling; row 1 frozen across all sheets.                            | SHOULD   |
| EX-30 | No secrets, PII, or auth tokens included in exported file.                                    | MUST     |
| EX-31 | CSP intact — no `unsafe-eval`; `write-excel-file` uses `fflate` (pure JS).                   | MUST     |
| EX-32 | i18n toast messages for generating/success/failed in all 5 locales.                           | MUST     |
| EX-33 | File named `{projectName}_{timestamp}_audit.xlsx` with sanitised project name.                | SHOULD   |
| EX-34 | `xlsxModel.ts` pure functions fully unit-tested.                                              | MUST     |

### 17.5 Excel export — all sheets + tables (W14b.2)

| ID    | Requirement                                                                                    | Priority |
|-------|------------------------------------------------------------------------------------------------|----------|
| EX-35 | File > Export Excel submenu offers Active sheet and All sheets options.                        | MUST     |
| EX-36 | All sheets exports all canvases into a single workbook with combined data sheets.              | MUST     |
| EX-37 | Workbook includes TOC sheet (Canvases) listing position, name, ID, counts, hash.               | MUST     |
| EX-38 | Combined Node Values, Diagnostics, Graph Health sheets include Canvas prefix.                  | MUST     |
| EX-39 | Engine table values exported as dedicated worksheets (one per table node).                     | SHOULD   |
| EX-40 | Tables included/skip toggle persisted in localStorage.                                         | SHOULD   |
| EX-41 | Sheet names sanitized (max 31 chars, forbidden chars removed) and deduplicated.                | MUST     |
| EX-42 | Tables exceeding 200,000 rows truncated with note row; no crash on large data.                 | MUST     |
| EX-43 | Cell text exceeding 32,767 chars truncated silently.                                           | MUST     |
| EX-44 | No DOM switching needed; canvas data loaded from storage, evaluated without remount.           | MUST     |

### 17.6 Project export - .chainsolvejson (W14c.1)

| ID    | Requirement                                                                                     | Priority |
|-------|-------------------------------------------------------------------------------------------------|----------|
| EX-45 | File - Export Project (.chainsolvejson) downloads a single JSON file with all project data.     | MUST     |
| EX-46 | Export includes project metadata, variables, all canvases (schemaVersion 4), and assets.        | MUST     |
| EX-47 | Output is deterministic for identical project state (except exportedAt timestamp).              | MUST     |
| EX-48 | Per-canvas hash = sha256(stableStringify({ nodes, edges, variables })).                         | MUST     |
| EX-49 | Project hash = sha256(stableStringify({ project, canvases, assetsManifest })).                  | MUST     |
| EX-50 | Assets under 10 MB base64-embedded; larger assets referenced by storagePath.                    | SHOULD   |
| EX-51 | Asset ordering stable: sorted by (name, storagePath).                                           | MUST     |
| EX-52 | Canvas ordering stable: sorted by position ascending.                                           | MUST     |
| EX-53 | Export validates no secrets/PII (auth tokens, Supabase keys, emails) in output.                 | MUST     |
| EX-54 | Export validates all numeric values are finite (no NaN/Infinity).                               | SHOULD   |
| EX-55 | Menu item disabled if no project (scratch mode).                                                | MUST     |
| EX-56 | Export uses AbortController for cancellation; progress toasts shown.                            | SHOULD   |
| EX-57 | Filename pattern: safeName_timestamp.chainsolvejson.                                            | MUST     |
| EX-58 | No bundle size impact; export code lazy-loaded on first use.                                    | MUST     |
| EX-59 | CSP intact (no unsafe-eval, no inline scripts).                                                 | MUST     |

---

## 18. Out of scope (for now)

- Real-time collaboration (concurrent editing of the same canvas).
- Offline mode for the web app (Service Worker / PWA shell).
- Custom block editor (user-defined blocks).
- Simulation / time-stepping mode.
- Plugin / extension system.
- Drag-to-reorder canvas tabs (position model exists; UI deferred).

---

## 19. Future extensions

1. **Offline PWA shell**: Service Worker caches app shell + recent projects for read-only offline access.
2. **Custom block editor**: Structured visual editor for user-defined blocks with typed I/O.
3. **Collaborative canvas**: CRDT-based real-time sync for shared editing sessions.
4. **Multi-sheet PDF export**: ~~Extend PDF export to include all canvases in a single document.~~ Implemented in W14a.2.
5. **Plugin API**: Allow third-party block packs to be loaded at runtime.
6. **Theming SDK**: Allow users to create and share custom themes.
7. **Embedded mode**: Render a read-only graph in an iframe for documentation / sharing.

---

## Change Log

| Date       | Author | Change                                                                                            |
|------------|--------|---------------------------------------------------------------------------------------------------|
| 2026-02-27 | -      | W14c.1: Added 17.6 (Project export .chainsolvejson EX-45 to EX-59). Deterministic JSON archive.   |
| 2026-02-27 | -      | W14b.2: Added 17.5 (Excel all sheets + tables EX-35 to EX-44). TOC, table sheets, truncation.     |
| 2026-02-27 | -      | W14b.1: Added 17.4 (Excel active sheet EX-25 to EX-34). Lazy write-excel-file, 5-sheet wb.        |
| 2026-02-27 | -      | W14a.3: Added 17.3 (PDF hardening EX-17 to EX-24). Per-canvas capture, fallback, values-only.     |
| 2026-02-27 | -      | W14a.2: Added 17.2 (all-sheets PDF EX-9 to EX-16). Struck multi-sheet from Future extensions.     |
| 2026-02-27 | -      | W14a.1: Added 17 Export (PDF export requirements). Moved PDF out of Out-of-scope. Renum 18.       |
| 2026-02-26 | -      | Initial version (v1.0).                                                                           |
