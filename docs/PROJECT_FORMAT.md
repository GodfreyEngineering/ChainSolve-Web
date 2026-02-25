# ChainSolve Project Format

`project.json` is the canonical serialisation of a ChainSolve graph.
It lives at `projects/{userId}/{projectId}/project.json` in Supabase Storage.

---

## JSON Schema (schemaVersion 1)

```jsonc
{
  // ── Versioning ──────────────────────────────────────────────────────────
  "schemaVersion": 1,         // integer — ONLY bumped for breaking changes
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
- Current readers **MUST** reject any file where `schemaVersion !== 1`.
- Future migration stubs in `loadProject()` will transform older schemas
  before returning to callers (see `src/lib/projects.ts`).

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
  "type":     "csSource",          // "csSource" | "csOperation" | "csDisplay"
  "position": { "x": 80, "y": 120 },
  "data": {
    "blockType": "number",         // must exist in BLOCK_REGISTRY
    "label":     "Number",
    "value":     3,                // source nodes only
    "manualValues":   { "a": 5 }, // operation nodes — inline overrides
    "portOverrides":  { "a": true }
  },
  // Optional React Flow fields preserved verbatim:
  "selected":  false,
  "draggable": false              // false = locked position (🔒)
}
```

### Node types

| `type`        | Blocks                                | Inputs | Output |
|---------------|---------------------------------------|--------|--------|
| `csSource`    | `number`, `slider`, `pi`, `e`, …      | 0      | 1      |
| `csOperation` | `add`, `multiply`, `sin`, `if`, …     | 1–N    | 1      |
| `csDisplay`   | `display`                             | 1      | 0      |

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
- **Import:** parse file → validate `schemaVersion === 1` → `importProject(json)`:
  - Creates a new DB row with a fresh `id` and `owner_id`.
  - Rebinds `project.id` in the JSON to the new row.
  - Resets `createdAt`/`updatedAt` to import time.
  - Preserves `graph` and `blockVersions` verbatim.
