# Plotting (W6)

> Scientific-grade chart rendering via Vega-Lite / Vega.

---

## Supported Chart Types

| Chart Type | Block | Input | Description |
|---|---|---|---|
| Line | XY Plot | Vector or Table | Continuous line connecting data points |
| Scatter | XY Plot | Vector or Table | Individual data point markers |
| Histogram | Histogram | Vector | Frequency distribution with configurable bin count |
| Bar | Bar Chart | Table | Categorical bar chart (x = nominal, y = quantitative) |
| Heatmap | Heatmap | Table | 2D color-encoded density/value matrix |

All plot blocks are **Pro-only** (requires `trialing` or `pro` plan).

---

## Input Requirements

- **Vector**: `{ kind: 'vector', value: number[] }` — used for XY plots (index as x, value as y) and histograms.
- **Table**: `{ kind: 'table', columns: string[], rows: number[][] }` — used for all chart types. Column selectors appear in the inspector when a Table is connected.

---

## Configuration (Inspector Panel)

When a plot node is selected, the Inspector shows:

| Setting | Options | Default |
|---|---|---|
| Chart Type | Line, Scatter, Histogram, Bar, Heatmap | Per block |
| Theme Preset | Paper (single/double col), Presentation 16:9, Report A4 | Paper (single) |
| Title / Subtitle | Free text | Empty |
| X / Y Label | Free text | Empty |
| X / Y Scale | Linear, Log | Linear |
| Show Grid | On/Off | On |
| Show Legend | On/Off + position (Right/Bottom) | Off |
| Max Points | 100–10,000 slider (Line/Scatter only) | 2000 |
| Bin Count | 5–100 slider (Histogram only) | 30 |
| X Column | Dropdown (Table input only) | First column |
| Y Column(s) | Dropdown (Table input only) | Second column |

---

## Theme Presets

| Preset | Dimensions | Font Size | Use Case |
|---|---|---|---|
| Paper (single col) | 360 × 240 | 10pt | Journal articles, single-column figures |
| Paper (double col) | 720 × 360 | 12pt | Journal articles, double-column figures |
| Presentation 16:9 | 960 × 540 | 16pt | Slide decks, talks |
| Report (A4) | 680 × 480 | 11pt | Technical reports, theses |

---

## Export

From the expanded plot modal, export in these formats:

| Format | Method | Notes |
|---|---|---|
| **SVG** | Vector graphics file | Best for publication — scales to any size |
| **PNG** | Rasterized image | Scale factor selector: 1×, 2×, 4× |
| **CSV** | Raw data extract | Always full (un-downsampled) data |
| **Open in Tab** | SVG in new browser tab | Right-click → Save As, or print to PDF |

**Recommended publication workflow**: Export SVG → open in Inkscape/Illustrator for final layout, or open SVG in tab → print to PDF.

File naming convention: `<label>_<timestamp>.<ext>`

---

## Performance: Downsampling

For large datasets (> `maxPoints` threshold), the rendering pipeline applies **LTTB (Largest-Triangle-Three-Buckets)** downsampling. This algorithm preserves the visual shape of the data while reducing point count for smooth rendering.

- Downsampling applies only to **rendering** (node preview + modal chart)
- **CSV export always uses full un-downsampled data**
- A "Downsampled" badge appears on the node when active
- Adjust the Max Points slider (100–10,000) in the inspector to control the threshold

---

## CSP Compliance

ChainSolve enforces `script-src 'self'` (no `unsafe-eval`). Vega normally uses `new Function()` for expression evaluation, which violates CSP.

**Solution**: The `vega-interpreter` package provides an AST-based expression evaluator:

1. `vega.parse(spec, null, { ast: true })` — parse with AST expressions
2. `new vega.View(runtime, { expr: expressionInterpreter })` — evaluate via interpreter

This eliminates all `eval`/`Function` usage while maintaining full Vega functionality.

---

## Lazy Loading

Vega libraries (~400KB gzipped) are loaded on demand via dynamic `import()`:

```
src/lib/vega-loader.ts → Promise.all([
  import('vega'),
  import('vega-lite'),
  import('vega-interpreter')
])
```

The loader is a singleton — one load per session, cached in a module-level promise. Vite automatically code-splits these into a separate async chunk, keeping the main bundle unchanged.

---

## Architecture

### New Files

| File | Purpose |
|---|---|
| `src/blocks/plot-blocks.ts` | 4 plot block definitions (xyPlot, histogram, barChart, heatmap) |
| `src/lib/vega-loader.ts` | Lazy Vega/Vega-Lite/vega-interpreter loader |
| `src/lib/plot-spec.ts` | Pure Vega-Lite spec generation (inline + full-size) |
| `src/lib/plot-export.ts` | SVG/PNG/CSV export + open-in-tab |
| `src/lib/downsample.ts` | LTTB downsampling algorithm |
| `src/components/canvas/nodes/PlotNode.tsx` | React Flow node component |
| `src/components/canvas/PlotInspector.tsx` | Inspector sub-panel for plot config |
| `src/components/canvas/PlotExpandModal.tsx` | Full-size modal with export buttons |
| `src/vega-interpreter.d.ts` | TypeScript declaration for vega-interpreter |

### Render Pipeline

```
Input Value → extractPlotData() → LTTB downsample → buildSpec()
  → vegaLite.compile() → vega.parse(spec, null, {ast:true})
  → new vega.View(runtime, {expr: interpreter, renderer:'svg'})
  → DOM render
```

### Entitlement Gating

Plot blocks use `isBlockEntitled(def, ent)` from `src/lib/entitlements.ts`. The `canUsePlots` flag gates:
- Block Library: locked with lock icon for free users
- Quick Add Palette: blocked with upgrade prompt
- Canvas drop: prevented with UpgradeModal
- Plot node: renders with "Pro required" overlay for free users viewing shared projects
