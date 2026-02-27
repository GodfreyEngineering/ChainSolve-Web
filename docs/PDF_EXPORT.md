# PDF Export (W14a.1 + W14a.2)

Audit-ready PDF export for the **active canvas sheet** (v1) or
**all sheets with Table of Contents** (v2).

## What's included

| Section              | Content                                                                 |
|----------------------|-------------------------------------------------------------------------|
| Cover / meta         | Project name, ID, export timestamp, build version/SHA/time/env,         |
|                      | engine version, contract version, node and edge counts.                 |
| Snapshot hash        | SHA-256 hex digest of a stable-stringified `{ nodes, edges, variables}` |
|                      | object. Proves the graph state at export time.                          |
| Graph health summary | Output of `computeGraphHealth` + `formatHealthReport`.                  |
| Evaluation summary   | Elapsed ms, partial flag, diagnostic counts (info/warning/error).       |
| Diagnostics table    | Per-diagnostic: nodeId, level, code, message.                           |
| Node value table     | Per eval node: nodeId, label, blockType, compact value, full-precision. |
| Graph image          | 2x PNG snapshot of the ReactFlow viewport (fit-to-view).               |

## Determinism

For the same graph + inputs the PDF is **byte-identical** except for the
`exportTimestamp` field. The snapshot hash is deterministic because:

1. `stableStringify` sorts object keys recursively (array order preserved).
2. `sha256Hex` uses `crypto.subtle.digest` (Web Crypto API).
3. Node positions, data, edge connections, and variables are all included
   in the hash input.

## Lazy loading

`pdf-lib` and `html-to-image` are loaded via dynamic `import()` on first
use (see `src/lib/pdf-loader.ts`). The initial bundle size is unchanged.

## CSP safety

- No `unsafe-eval` — pdf-lib uses only standard fonts and raw PDF ops.
- No inline scripts — html-to-image renders to a canvas, not via script injection.
- The export runs entirely on the client; no data leaves the browser.

## Secret hygiene

The PDF includes only:
- Project name and ID (user-visible metadata).
- Build metadata (version, SHA, time, env).
- Graph structure and computed values.

It does **not** include:
- Auth tokens or session data.
- Supabase keys or connection strings.
- User email addresses.

## All Sheets export (W14a.2)

When the user picks **File > Export PDF > All sheets**, a project-level PDF
is generated that wraps every canvas into a single document.

### Additional sections

| Section             | Content                                                                    |
|---------------------|----------------------------------------------------------------------------|
| Cover (project)     | Same meta as v1, plus total canvases, total nodes/edges across all sheets. |
| Project hash        | SHA-256 of the ordered per-canvas snapshot hashes.                         |
| Table of Contents   | Numbered list of canvas names with page numbers and dot leaders.           |
| Per-canvas sections | Each canvas gets its own header, hash, health, eval, diagnostics, node     |
|                     | values, and graph image — identical to the v1 single-canvas layout.        |

### Canvas data loading

- The **active canvas** uses the live in-memory graph.
- **Non-active canvases** are loaded from Supabase Storage via
  `loadCanvasGraph()` — no UI switching occurs.
- Graph images are only captured for the active canvas (DOM capture
  requires the viewport to be rendered). Non-active canvases show
  "Graph image unavailable (non-active canvas)".

### UI

`File > Export PDF` is now a submenu:

- **Active sheet** — single-canvas export (v1 behaviour).
- **All sheets** — project-level export (disabled for scratch projects).

## Known limitations

- Graph image capture may fail in some browsers or if the viewport is
  hidden; the PDF will include a "Graph image unavailable" notice.
- Very large graphs (>500 nodes) may produce multi-page node value tables
  with simple line wrapping (no column auto-sizing).
- Non-active canvas images are not captured (requires DOM rendering).

## File naming

```
# Single-canvas (v1)
{projectName}_{YYYYMMDDTHHM}_audit.pdf

# All sheets (v2)
{projectName}_{YYYYMMDDTHHM}_project_audit.pdf
```

Non-alphanumeric characters in the project name are replaced with `_`.
