# .chainsolvejson Format (W14c.1 + W14c.2)

Single-file JSON project archive containing all project data, canvases, and assets.

## Overview

The `.chainsolvejson` format packages an entire ChainSolve project into one
portable JSON file. It includes project metadata, variables, all canvas graphs
(schemaVersion 4), and optionally embedded or referenced assets.

**File extension:** `.chainsolvejson`
**MIME type:** `application/json`
**Encoding:** UTF-8

## Format structure (v1)

```text
{
  format          "chainsolvejson"
  version         1
  exportedAt      ISO 8601 timestamp
  exporter        build metadata (version, SHA, time, env, engine)
  hashes          integrity hashes (project, per-canvas, per-asset)
  project         project metadata + variables
  canvases[]      ordered canvas entries with full graph JSON
  assets[]        embedded (base64) or referenced (storageRef) assets
}
```

### Top-level fields

| Field      | Type   | Description                                  |
|------------|--------|----------------------------------------------|
| format     | string | Always "chainsolvejson"                      |
| version    | number | Format version, currently 1                  |
| exportedAt | string | ISO 8601 export timestamp                   |
| exporter   | object | Build and engine metadata                    |
| hashes     | object | SHA-256 integrity hashes                     |
| project    | object | Project identity, variables, timestamps      |
| canvases   | array  | Canvas entries sorted by position            |
| assets     | array  | Embedded or referenced project assets        |

### exporter

| Field                  | Type   | Description                     |
|------------------------|--------|---------------------------------|
| appVersion             | string | Build version string            |
| buildSha               | string | Git commit SHA                  |
| buildTime              | string | Build timestamp                 |
| buildEnv               | string | Build environment (dev/prod)    |
| engineVersion          | string | WASM engine version             |
| engineContractVersion  | number | Engine contract version number  |

### hashes

| Field       | Type   | Description                                |
|-------------|--------|--------------------------------------------|
| projectHash | string | SHA-256 of canonical project representation|
| canvases    | array  | Per-canvas hashes: { id, hash }            |
| assets      | array  | Per-asset hashes: { pathOrName, sha256, bytes } |

### project

| Field          | Type        | Description                          |
|----------------|-------------|--------------------------------------|
| id             | string/null | Project UUID or null for scratch     |
| name           | string      | Project display name                 |
| description    | string      | Project description (currently "")   |
| activeCanvasId | string/null | UUID of the active canvas            |
| variables      | object      | VariablesMap (varId to ProjectVariable) |
| created_at     | string/null | ISO timestamp of project creation    |
| updated_at     | string/null | ISO timestamp of last update         |

### canvases[]

| Field    | Type   | Description                              |
|----------|--------|------------------------------------------|
| id       | string | Canvas UUID                              |
| name     | string | Canvas display name                      |
| position | number | Sort position (0-based)                  |
| graph    | object | Full CanvasJSON (schemaVersion 4)        |

Each canvas graph contains:
- `schemaVersion`: always 4
- `canvasId`: canvas UUID
- `projectId`: project UUID
- `nodes`: React Flow node array
- `edges`: React Flow edge array
- `datasetRefs`: dataset reference strings

### assets[]

Assets are either embedded (base64) or referenced (storageRef).

**Embedded asset** (size <= 10 MB):

| Field     | Type   | Description                  |
|-----------|--------|------------------------------|
| name      | string | Asset filename               |
| mimeType  | string | MIME type                    |
| sizeBytes | number | Size in bytes                |
| encoding  | string | "base64"                     |
| data      | string | Base64-encoded content       |
| sha256    | string | SHA-256 hex of raw bytes     |

**Referenced asset** (size > 10 MB):

| Field       | Type        | Description                |
|-------------|-------------|----------------------------|
| name        | string      | Asset filename             |
| mimeType    | string      | MIME type                  |
| sizeBytes   | number      | Size in bytes              |
| encoding    | string      | "storageRef"               |
| storagePath | string      | Storage bucket path        |
| sha256      | string/null | SHA-256 hex or null        |

## Determinism rules

The export is deterministic for identical project state (except the explicit
`exportedAt` timestamp). This is achieved by:

1. **Stable serialization**: All hash inputs use `stableStringify()` which
   sorts object keys alphabetically before serialization.

2. **Per-canvas hash**: `sha256(stableStringify({ nodes, edges, variables }))`

3. **Project hash**: `sha256(stableStringify({ project, canvases, assetsManifest }))`
   where:
   - `project` = `{ id, name, variables, activeCanvasId }`
   - `canvases` = sorted by position, each with `{ id, name, position, graph: { nodes, edges, datasetRefs } }`
   - `assetsManifest` = `[{ name, mimeType, sizeBytes, encoding, storagePath?, sha256 }]`

4. **Asset ordering**: sorted by `(name, storagePath)` lexicographically.

5. **Canvas ordering**: sorted by `position` ascending.

## Asset embedding policy

| Size        | Action                                              |
|-------------|-----------------------------------------------------|
| <= 10 MB    | Download bytes, base64-embed, compute SHA-256       |
| > 10 MB     | Reference by storagePath, SHA-256 if available      |

The 10 MB threshold is defined as `EMBED_SIZE_LIMIT` in `model.ts`.

## Privacy and security

The exported file includes ONLY:
- Project metadata (name, ID, timestamps)
- Canvas graph data (nodes, edges)
- Project-level variables
- Build metadata (version, SHA, time, env)

It does NOT include:
- Auth tokens or session data
- Supabase keys or connection strings
- User email addresses
- Signed storage URLs

The export function validates that no forbidden fields appear in the output
before triggering download.

## File naming

```text
{safeName}_{YYYYMMDDTHHM}.chainsolvejson
```

Non-alphanumeric characters in the project name are replaced with `_`.
Maximum 80 characters for the name portion.

## Data flow

```text
CanvasPage.handleExportChainsolveJson()
  -> for each canvas: loadCanvasGraph() or getSnapshot()
  -> buildChainsolveJsonExport()     (model.ts - pure builder)
  -> stableStringify() + pretty-print
  -> validateNoSecrets()
  -> downloadBlob()                  (triggers browser download)
```

No DOM switching needed. All canvas data is loaded from storage or memory.

## Import behavior (W14c.2)

Importing a `.chainsolvejson` file creates a NEW project. It never overwrites
an existing project. The import flow is:

```text
User: File → Import Project (.chainsolvejson)
  → file picker (accept=".chainsolvejson")
  → parse + deep validate (parse.ts + validate.ts)
  → show summary dialog (ImportProjectDialog)
  → user confirms
  → create project row (Supabase)
  → for each canvas: remap IDs, normalize graph, upload JSON, insert row
  → for each embedded asset: decode base64, verify SHA-256, upload, insert row
  → save legacy project.json (schemaVersion 3)
  → navigate to new project
```

### ID remapping

All canvas IDs are regenerated as new UUIDs on import. A remap table
(`oldId → newId`) is recorded in the import report. Graph JSON fields
`canvasId` and `projectId` are rewritten to match the new identifiers.

### Validation checks

| Check                  | Severity | Description                                    |
|------------------------|----------|------------------------------------------------|
| Secrets scan           | Error    | Forbidden fields (auth tokens, keys, emails)   |
| Numeric safety         | Error    | No NaN or Infinity in variables or graph data  |
| Schema version         | Error    | All canvases must be schemaVersion 4           |
| Duplicate canvas IDs   | Error    | No duplicate canvas IDs in input               |
| Embedded asset size    | Error    | Must not exceed 10 MB (EMBED_SIZE_LIMIT)       |
| Hash integrity         | Error    | Per-canvas and project hashes re-verified      |
| Canvas ID consistency  | Warning  | graph.canvasId mismatch (auto-normalized)      |

### Error handling

On failure, the orchestrator performs cleanup:

1. Delete uploaded canvas graph files from storage
2. Delete created canvas rows from DB
3. Delete the project row (cascades to project_assets)
4. Download an import report (JSON) with details

### StorageRef assets

Assets with `encoding: "storageRef"` cannot be restored from a file export
(the storage path is specific to the original account). These are recorded
as unrestorable in the import report.

## Asset integration (W14c.3)

CSV files uploaded via the CsvPicker are stored in the `uploads` bucket and
recorded in the `project_assets` table (with `sha256` integrity hash). On
export, assets <= 10 MB are base64-embedded; larger assets are referenced by
`storagePath`. On import, embedded assets are verified against their SHA-256
digest, uploaded to the new project's storage, and re-linked in `project_assets`.

## Limitations

- v1 does not include evaluated values or diagnostics (use PDF/Excel for audit data).
- Very large projects with many canvases may produce large JSON files.
- StorageRef assets cannot be restored during import (logged in report).
