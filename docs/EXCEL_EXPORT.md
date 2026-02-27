# Excel Export (W14b.1)

Audit-ready Excel (.xlsx) export for the **active canvas sheet**.

## What's included

| Worksheet      | Content                                                                |
|----------------|------------------------------------------------------------------------|
| Summary        | Project name, ID, export timestamp, build version/SHA/time/env,        |
|                | engine version, contract version, node and edge counts, snapshot hash, |
|                | evaluation elapsed ms, partial flag, diagnostic counts.                |
| Variables      | All project-level variables: ID, name, value, description.             |
| Node Values    | Per eval node: nodeId, label, blockType, compact value, full-precision.|
| Diagnostics    | Per-diagnostic: nodeId, level, code, message.                          |
| Graph Health   | Output of `computeGraphHealth` + `formatHealthReport`.                 |

## Architecture

### Lazy loading

`write-excel-file/browser` is loaded via dynamic `import()` on first use
(see `src/lib/xlsx-loader.ts`). The initial bundle size is unchanged.

### CSP safety

- No `unsafe-eval` — `write-excel-file` uses `fflate` for ZIP compression
  (pure JavaScript, no eval).
- The export runs entirely on the client; no data leaves the browser.

### Data flow

```
CanvasArea.exportXlsxAuditActive()
  → buildAuditModel()          (reuses PDF audit model)
  → buildAuditWorkbook()       (xlsxModel.ts — pure adapter)
  → writeXlsxFile()            (lazy-loaded, triggers download)
```

### Secret hygiene

The Excel file includes only:
- Project name and ID (user-visible metadata).
- Build metadata (version, SHA, time, env).
- Graph structure and computed values.
- Project-level variables (user-defined).

It does **not** include:
- Auth tokens or session data.
- Supabase keys or connection strings.
- User email addresses.

## Styling

- Header rows use bold white text on teal (#1CABB0) background.
- Row 1 is frozen (sticky) across all worksheets.
- Key-value fields in the Summary sheet use bold field names.
- Column widths are tuned for readability in each sheet.

## File naming

```
{projectName}_{YYYYMMDDTHHM}_audit.xlsx
```

Non-alphanumeric characters in the project name are replaced with `_`.

## Known limitations

- Very large graphs (>500 nodes) may produce long Node Values sheets.
- No chart/image embedding — use PDF export for graph snapshots.
- Currently supports single-canvas (active sheet) only. Multi-canvas
  export may be added in a future milestone.
