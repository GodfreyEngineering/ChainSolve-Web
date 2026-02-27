# Excel Export (W14b.1 + W14b.2)

Audit-ready Excel (.xlsx) export for **active canvas** or **all sheets (project-level)**.

## Export modes

### Active sheet (W14b.1)

Exports 5 worksheets for the currently visible canvas.

### All sheets (W14b.2)

Exports the entire project — all canvases combined — into a single .xlsx workbook
with 6+ worksheets plus optional table worksheets.

## Worksheet layout

### Active sheet mode

| Worksheet      | Content                                                                |
|----------------|------------------------------------------------------------------------|
| Summary        | Project name, ID, export timestamp, build/engine metadata,             |
|                | node/edge counts, snapshot hash, eval elapsed, diagnostic counts.      |
| Variables      | All project-level variables: ID, name, value, description.             |
| Node Values    | Per eval node: nodeId, label, blockType, compact value, full-precision.|
| Diagnostics    | Per-diagnostic: nodeId, level, code, message.                          |
| Graph Health   | Output of `computeGraphHealth` + `formatHealthReport`.                 |

### All sheets mode

| Worksheet        | Content                                                              |
|------------------|----------------------------------------------------------------------|
| Summary          | Project-level metadata: scope, total canvases, project hash, etc.    |
| Canvases         | TOC: position, name, ID, node count, edge count, snapshot hash.      |
| Variables        | Same as active-sheet mode.                                           |
| Node Values      | Combined across all canvases (Canvas #, Canvas Name prefix columns). |
| Diagnostics      | Combined across all canvases (Canvas #, Canvas Name prefix columns). |
| Graph Health     | Combined across all canvases (Canvas #, Canvas Name prefix columns). |
| T_{pos}_{label}  | One worksheet per table value (when "Tables: included" is toggled).  |

## Architecture

### Lazy loading

`write-excel-file/browser` is loaded via dynamic `import()` on first use
(see `src/lib/xlsx-loader.ts`). The initial bundle size is unchanged.

### CSP safety

- No `unsafe-eval` — `write-excel-file` uses `fflate` for ZIP compression
  (pure JavaScript, no eval).
- The export runs entirely on the client; no data leaves the browser.

### Data flow (active sheet)

```text
CanvasArea.exportXlsxAuditActive()
  → buildAuditModel()          (reuses PDF audit model)
  → buildAuditWorkbook()       (xlsxModel.ts — pure adapter)
  → writeXlsxFile()            (lazy-loaded, triggers download)
```

### Data flow (all sheets)

```text
CanvasPage.handleExportAllSheetsExcel()
  → for each canvas:
      loadCanvasGraph() → evaluateGraph() → extract tables → buildCanvasAuditSection()
  → buildProjectAuditModel()
  → exportAuditXlsxProject()
      → buildProjectWorkbook()  (xlsxModel.ts — pure adapter)
      → writeXlsxFile()         (lazy-loaded, triggers download)
```

No DOM switching is needed (unlike PDF all-sheets) because Excel has no images.

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

## Excel constraints and truncation

| Constraint            | Limit             | Handling                                    |
|-----------------------|-------------------|---------------------------------------------|
| Sheet name length     | 31 chars          | sanitizeSheetName() truncates.              |
| Forbidden sheet chars | 7 chars, see note | Stripped by sanitizeSheetName().            |
| Duplicate sheet names | N/A               | dedupeSheetNames() appends " (2)" etc.      |
| Max rows per sheet    | 1,048,576         | SAFE_MAX_TABLE_ROWS = 200,000.              |
| Max columns per sheet | 16,384            | SAFE_MAX_TABLE_COLS = 512.                  |
| Max cell characters   | 32,767            | capCell() truncates.                        |

Forbidden sheet name characters: backslash, forward slash, asterisk,
open bracket, close bracket, colon, question mark.

Constants are defined in `src/lib/xlsx/constants.ts`.

When a table is truncated, a bold note row is prepended:
`"Truncated: {originalRows} rows × {originalCols} cols → {rows} rows × {cols} cols"`.

## Table worksheets

Engine table values (`kind === 'table'`) are extracted during the orchestration
loop and passed to `buildTableSheet()`. Each table gets its own worksheet named
`T_{canvasPosition}_{nodeLabel}`, sanitized and deduplicated.

Table data uses `Number` type cells. The source info row identifies the
canvas and node that produced the table.

## Styling

- Header rows use bold white text on teal (#1CABB0) background.
- Row 1 is frozen (sticky) across all worksheets.
- Key-value fields in the Summary sheet use bold field names.
- Column widths are tuned for readability in each sheet.

## UI

**File > Export Excel** is a submenu:

- **Active sheet** — exports current canvas (5 worksheets).
- **All sheets** — exports all canvases (6+ worksheets). Disabled if no project.
- **Tables: included / skip** — toggle for table worksheet inclusion (persisted in localStorage).
- **Cancel export** — shown while export is in progress.

## File naming

```text
Active:   {projectName}_{YYYYMMDDTHHM}_audit.xlsx
Project:  {projectName}_{YYYYMMDDTHHM}_project_audit.xlsx
```

Non-alphanumeric characters in the project name are replaced with `_`.

## Known limitations

- Very large graphs (>500 nodes) may produce long Node Values sheets.
- No chart/image embedding — use PDF export for graph snapshots.
- Tables with >200,000 rows are truncated (not split across sheets).
