# ChainSolve Canvas — UX Interaction Rules

This document defines canonical interaction rules for the canvas editor.
Future feature work **must** stay consistent with these rules.

---

## 1. Layout — Dockable Panels

The canvas is surrounded by two resizable side panels and a top toolbar.

```
┌──────────┬──────────────────────────────┬─────────────┐
│ Library  │        Toolbar               │  Inspector  │
│  (left)  ├──────────────────────────────┤   (right)   │
│          │                              │             │
│  200 px  │        ReactFlow canvas      │   260 px    │
│  default │                              │  (hidden    │
│          │                              │  by default)│
└──────────┴──────────────────────────────┴─────────────┘
```

### Panel visibility
| Button | Action |
|--------|--------|
| **Blocks** (toolbar left) | Toggle BlockLibrary left panel |
| **Inspector** (toolbar right) | Toggle Inspector right panel |

### Panel resizing
- Each panel has a **resize handle** — a 6 px drag strip on its inner edge.
- Drag left/right to resize between **160 px** (min) and **420 px** (max).
- Width is held in component state; resets to default on page reload.

---

## 2. Inspector Interaction Rules

### Opening
- Inspector opens **only on a deliberate node body click** (`onNodeClick`).
- It does **not** open on drag, on edge connection, or on selection-box changes.
- Opening the inspector automatically makes the right panel visible (`inspVisible = true`).

### Closing
| Trigger | Effect |
|---------|--------|
| Press **Esc** | Close inspector (hide right panel, clear `inspectedId`) |
| Click **✕** in inspector header | Same as Esc |
| Click **Inspector** toolbar button | Toggle visibility (hides panel without losing `inspectedId`) |
| Click blank canvas (`onPaneClick`) | Clears `inspectedId`; panel remains open if toolbar toggle is on |

### What the inspector shows
- **Source nodes** (number / slider / constant): current value read-only.
- **Operation nodes**: label, one row per input port (see §5 below).
- **Display nodes**: computed result read-only.

---

## 3. Context Menus

Context menus appear on right-click and are dismissed by clicking anywhere outside.

### Right-click on a node
| Item | Action |
|------|--------|
| Inspect | Open inspector for this node |
| Duplicate | Copy node at +24 px / +24 px offset |
| Delete node | Remove node and all its connected edges |

### Right-click on an edge
| Item | Action |
|------|--------|
| Delete connection | Remove the edge |

### Right-click on the canvas (empty area)
| Item | Action |
|------|--------|
| Fit view | Fit all nodes into the viewport |

### Dismissal
A transparent full-screen overlay (`position: fixed; inset: 0; z-index: 999`) sits
behind the menu (`z-index: 1000`). Any click — inside or outside the menu — hits the
overlay first, which calls `setContextMenu(null)`. A menu item click is registered
**before** the overlay fires (event order), so the action always executes.

---

## 4. Connection Rules

### One edge per input handle
- Each input port on an **OperationNode** accepts **at most one incoming edge**.
- A second connection attempt to an already-occupied port is silently blocked by
  `isValidConnection` on both the `<ReactFlow>` component and each `<Handle>`.
- Source and display nodes follow the same rule via the global `isValidConnection` callback.

### Output handles
- Output handles are **unlimited** — one output can fan out to many inputs.

### Valid connection types
- Any output can connect to any input (no type-checking at the connection level).
- Type mismatches (e.g. boolean vs number) produce `NaN` at runtime.

---

## 5. Manual vs Connected Input Values

Each input port on an OperationNode can operate in two modes:

| Mode | Condition | Value used in evaluation |
|------|-----------|--------------------------|
| **Connected** | Edge present AND override OFF | Upstream computed value |
| **Manual** | No edge present | `manualValues[portId]` (default `0`) |
| **Override** | Edge present AND override ON | `manualValues[portId]` |

### UI per port
- **Disconnected port**: shows an inline number `<input>` with the manual value.
- **Connected port (no override)**: shows `▶ connected` indicator + `✎` override button.
- **Connected port (override active)**: shows inline number `<input>` + `↩` revert button.

### Storage
- `manualValues: Record<portId, number>` — stored in `NodeData`.
- `portOverrides: Record<portId, boolean>` — stored in `NodeData`.
- Both fields are persisted with the node in the React Flow graph state.

---

## 6. Block Library

### Search
- **`/` key** focuses the search input from anywhere on the canvas (unless focus is
  already inside an `<input>` or `<textarea>`).
- Search filters across block label and category.
- Category filter pills narrow the list to one category; **All** resets the filter.

### Recently Used section
- Tracks the last **8** distinct block types dragged onto the canvas.
- Stored in `localStorage` under the key `cs:recent`.
- Updated on `dragStart` (before the block is dropped).

### Favourites section
- Star icon appears on hover next to each block item.
- Toggle star → add/remove from favourites (`localStorage` key `cs:favs`).
- Favourites section appears at the top when at least one block is starred.

### Adding a block to the canvas
- Drag a block item from the library; on `drop` inside the canvas, a new node is
  created at the drop coordinates (adjusted for ReactFlow viewport transform).
- Data transfer key: `application/chainsolve-block`, value: the block type string.

---

## 7. Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `/` | Canvas focused | Focus block library search |
| `Esc` | Inspector open | Close inspector |
| `Delete` / `Backspace` | Node or edge selected | Delete selected element |
| `Space` (drag) | Canvas | Pan the viewport (React Flow default) |

---

## 8. Delete Behaviour

- `deleteKeyCode={null}` is set on `<ReactFlow>` — **React Flow's built-in delete is
  disabled**.
- A `useEffect` on `window` keydown checks for `Delete` or `Backspace` keys.
- It reads the current selection from `useNodes()` / `useEdges()`, deletes selected
  nodes (plus their attached edges) and selected edges.
- This gives the app full control over undo/history in future milestones.

---

## 9. Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#1CABB0` | Accent, handles, active states |
| `--primary-dim` | `rgba(28,171,176,0.15)` | Node header backgrounds |
| `--primary-glow` | `rgba(28,171,176,0.35)` | Focus rings, borders on active |
| `--bg` | `#1a1a1a` | Page / canvas background |
| `--card-bg` | `#383838` | Node card surfaces |
| `--surface2` | `#2c2c2c` | Toolbar, panel backgrounds |
| `--border` | `rgba(255,255,255,0.1)` | All borders |
| `--input-bg` | `#252525` | Form inputs |
| `--text` | `#F4F4F3` | Primary text |
| `--text-muted` | `rgba(244,244,243,0.5)` | Labels, secondary text |
| `--success` | `#22c55e` | Positive states |
| `--danger` | `#ef4444` | Destructive actions |

Body font: **Montserrat** (400, 500, 600, 700)
Number / mono font: **JetBrains Mono** (400, 600)
