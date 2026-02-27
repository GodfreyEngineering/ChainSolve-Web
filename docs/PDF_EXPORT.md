# PDF Export (W14a.1 + W14a.2 + W14a.3)

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
  `loadCanvasGraph()`.
- Image capture uses the **CanvasPage orchestrator** pattern (W14a.3):
  the export loop programmatically switches each canvas, waits for
  ReactFlow to remount (300 ms settle), then captures the viewport.

### UI

`File > Export PDF` is now a submenu:

- **Active sheet** — single-canvas export (v1 behaviour).
- **All sheets** — project-level export (disabled for scratch projects).

## Image capture hardening (W14a.3)

### Fallback ladder

Image capture uses `html-to-image` `toBlob` (not `toPng`) to avoid
base64 data URL overhead. A fallback ladder is applied per canvas:

1. **pixelRatio = 2** — if output fits under `MAX_CAPTURE_PIXELS` (16 MP).
2. **pixelRatio = 1** — standard resolution.
3. **pixelRatio = 1 + downscale** — ratio < 1, clamped so output < 16 MP.
4. **Skip** — returns `null` with an error message.

The pure function `computeSafePixelRatio(w, h, desired, maxPixels)` computes
the effective ratio. It is fully unit-tested.

### toBlob optimization

`toBlob` returns a `Blob` which is converted to `Uint8Array` and passed
directly to `pdf-lib`'s `embedPng()`. This skips the base64 encoding round-trip
that `toPng` would require, halving peak memory for large images.

### Values-only mode

Users can toggle **"Images: skip (values only)"** in the Export PDF submenu.
When disabled, no viewport capture is performed — the export is significantly
faster and the PDF omits graph snapshots. The setting persists in
`localStorage('cs:pdfExportIncludeImages')`.

### Export progress + cancel

All-sheets export shows per-canvas progress toasts ("Sheet 1/5…") and
supports cancellation via `AbortController`. The cancel button appears in
the Export PDF submenu during an active export.

### Autosave suppression

During the export canvas-switching loop, `handleGraphChange` is suppressed
via `exportingRef.current` to prevent spurious dirty/autosave triggers.
The DB active-canvas pointer is NOT updated during export (only the local
Zustand store changes); the original canvas is restored in `finally`.

## Known limitations

- Graph image capture may fail in some browsers or if the viewport is
  hidden; the PDF will include a "Graph image unavailable" notice.
- Very large graphs (>500 nodes) may produce multi-page node value tables
  with simple line wrapping (no column auto-sizing).
- Canvas switching during export briefly shows each sheet. The original
  canvas is restored after export completes or is cancelled.

## File naming

```
# Single-canvas (v1)
{projectName}_{YYYYMMDDTHHM}_audit.pdf

# All sheets (v2)
{projectName}_{YYYYMMDDTHHM}_project_audit.pdf
```

Non-alphanumeric characters in the project name are replaced with `_`.
