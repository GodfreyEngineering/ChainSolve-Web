# .chainsolvejson Format (W14c.1)

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

## Limitations

- v1 does not include evaluated values or diagnostics (use PDF/Excel for audit data).
- Assets are currently empty (no project_assets table yet).
- Very large projects with many canvases may produce large JSON files.
- Import (.chainsolvejson) is not yet implemented (planned for W14c.2).
