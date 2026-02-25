# ChainSolve Project Format

`project.json` is the canonical serialisation of a ChainSolve graph.
It lives at `projects/{userId}/{projectId}/project.json` in Supabase Storage.

---

## JSON Schema (schemaVersion 3)

```jsonc
{
  // ── Versioning ──────────────────────────────────────────────────────────
  "schemaVersion": 3,         // integer — ONLY bumped for breaking changes (W5: 1→2, W7: 2→3)
  "formatVersion": 7,         // integer — monotonically increasing per-save

  // ── Timestamps ──────────────────────────────────────────────────────────
  "createdAt":  "2026-02-25T10:00:00.000Z",   // ISO-8601, set at project creation
  "updatedAt":  "2026-02-25T11:34:12.000Z",   // ISO-8601, refreshed on every save

  // ── Project identity ─────────────────────────────────────────────────────
  "project": {
    "id":   "550e8400-e29b-41d4-a716-446655440000",   // Supabase UUID (projects.id)
    "name": "My Analysis"
  },

  // ── Graph ────────────────────────────────────────────────────────────────
  "graph": {
    "nodes": [ /* React Flow Node objects (see §Nodes) */ ],
    "edges": [ /* React Flow Edge objects (see §Edges) */ ]
  },

  // ── Block version manifest ────────────────────────────────────────────────
  // blockType → semver string; empty in schemaVersion 1 (populated from W8).
  "blockVersions": {}
}
```

---

## Versioning contract

### `schemaVersion`

- Increments only when the overall JSON envelope is incompatible with an
  older reader (e.g. a field is removed or semantics change fundamentally).
- Current readers accept `schemaVersion` 1, 2, or 3 (migrations are transparent).
- Saving always writes `schemaVersion: 3`.
- **V1 → V2 changes (W5):** added support for `csData` node type, `vectorData`,
  `tableData`, and `csvStoragePath` fields on NodeData. V1 files contain only
  scalar nodes and load without any structural migration.
- **V2 → V3 changes (W7):** added `csGroup` node type and `parentId` field on
  child nodes. Positions with `parentId` are **relative** to the parent node.
  A V2 reader would position grouped nodes incorrectly. V1/V2 files have no
  groups and load unchanged.

### `formatVersion`

- Starts at `1` when a project is first created.
- Incremented by `+1` on every successful save (including duplicates and
  imports, which reset from the source's `formatVersion`).
- Readers should treat a missing or zero `formatVersion` as `0`.
- **Not** used for compatibility decisions; intended for debugging and
  deterministic replay (W8+).

### Backwards compatibility rule

> **Once a field is defined in schemaVersion 1, it must remain readable
> by all future parsers forever.** Removing or renaming a field requires
> a `schemaVersion` bump (currently not planned).

---

## Nodes

Each element of `graph.nodes` is a React Flow `Node` with `data` typed as
`NodeData` from `src/blocks/registry.ts`:

```jsonc
{
  "id":       "node_101",
  "type":     "csSource",          // "csSource" | "csOperation" | "csDisplay" | "csData" | "csPlot" | "csGroup"
  "position": { "x": 80, "y": 120 },
  "data": {
    "blockType": "number",         // must exist in BLOCK_REGISTRY
    "label":     "Number",
    "value":     3,                // source nodes only
    "manualValues":   { "a": 5 }, // operation nodes — inline overrides
    "portOverrides":  { "a": true },

    // W5 data-node fields (csData kind only):
    "vectorData":     [1, 2, 3],          // vectorInput — array of numbers
    "tableData": {                         // tableInput / csvImport
      "columns": ["A", "B"],
      "rows": [[1, 2], [3, 4]]
    },
    "csvStoragePath": "uploads/…/file.csv", // csvImport — storage reference

    // W7 group-node fields (csGroup kind only):
    "groupColor":     "#1CABB0",         // hex color for the group container
    "groupNotes":     "Analysis step 1", // optional user annotations
    "groupCollapsed": false              // true = collapsed with proxy handles
  },
  // Optional React Flow fields preserved verbatim:
  "selected":  false,
  "draggable": false,             // false = locked position (🔒)
  "parentId":  "group_123",       // W7: member nodes reference their group
  "style":     { "width": 400, "height": 300 }  // W7: csGroup nodes set explicit size
}
```

### Node types

| `type`        | Blocks                                         | Inputs | Output |
|---------------|-------------------------------------------------|--------|--------|
| `csSource`    | `number`, `slider`, `pi`, `e`, …                | 0      | 1      |
| `csOperation` | `add`, `multiply`, `sin`, `if`, vector/table ops | 1–N    | 1      |
| `csDisplay`   | `display`                                        | 1      | 0      |
| `csData`      | `vectorInput`, `tableInput`, `csvImport` (W5)    | 0      | 1      |
| `csPlot`      | `xyPlot`, `histogram`, `barChart`, `heatmap` (W6) | 1      | 0      |
| `csGroup`     | `__group__` (visual container, W7)                 | 0      | 0      |

---

## Edges

Each element of `graph.edges` is a React Flow `Edge`:

```jsonc
{
  "id":           "e1",
  "source":       "node_101",
  "sourceHandle": "out",
  "target":       "node_103",
  "targetHandle": "a",
  "animated":     true
}
```

- One edge per `(target, targetHandle)` pair is enforced by the canvas
  connection validator. Importing files that violate this is tolerated —
  the engine will use the first edge found and ignore duplicates.

---

## `blockVersions` (future — W8)

Reserved for deterministic replay. When W8 ships, every save will record
the semver of each block type that appears in the graph:

```jsonc
"blockVersions": {
  "add":    "1.0.0",
  "slider": "1.2.0",
  "fft":    "2.0.0"
}
```

Readers that encounter a `blockVersions` entry for a type whose current
semver is incompatible (major bump) will warn the user before opening.

---

## Conflict detection

`saveProject()` in `src/lib/projects.ts` implements an optimistic-lock
protocol:

1. Before writing, read `projects.updated_at` from the DB.
2. If `DB.updated_at > knownUpdatedAt` → another session saved in the
   interim. Return `{ conflict: true, updatedAt: DB.updated_at }`.
3. The caller (CanvasPage) stores the server's `updatedAt` and shows a
   resolution banner:
   - **Keep mine (overwrite):** re-call `saveProject` with the server's
     `updatedAt` as `knownUpdatedAt`, which clears the guard.
   - **Reload from server:** `window.location.reload()` — discards local.

> W8+ will replace the read-then-write with an atomic Postgres RPC
> (`UPDATE … WHERE updated_at = $knownTs RETURNING updated_at`) to
> eliminate the TOCTOU race.

---

## Storage layout

```
Supabase Storage bucket: projects
  └── {userId}/
        └── {projectId}/
              └── project.json      ← canonical graph file
```

Access is controlled by RLS on the `projects` bucket:
- `foldername[1] = auth.uid()` for all operations.

The DB column `projects.storage_key` is stamped with the storage path
after every successful upload, which in turn updates `projects.updated_at`
via a DB trigger — making `updated_at` the single source of truth for the
optimistic lock.

---

## Import / Export

- **Export:** `loadProject(id)` → `JSON.stringify(pj, null, 2)` → download
  as `{name}.json`.
- **Import:** parse file → validate `schemaVersion` is 1, 2, or 3 → `importProject(json)`:
  - Creates a new DB row with a fresh `id` and `owner_id`.
  - Rebinds `project.id` in the JSON to the new row.
  - Resets `createdAt`/`updatedAt` to import time.
  - Writes `schemaVersion: 3` regardless of source version.
  - Preserves `graph` and `blockVersions` verbatim.
