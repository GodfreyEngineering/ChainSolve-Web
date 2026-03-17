/**
 * standaloneHtmlExport.ts — 5.10: Export as interactive standalone HTML.
 *
 * Produces a single .html file containing:
 *   - An embedded PNG screenshot of the current canvas viewport
 *   - A table of all computed output values
 *   - The full graph JSON (nodes + edges) as an embedded <script> tag
 *   - No external dependencies — works completely offline
 *
 * The generated HTML uses a two-tab layout: "Graph" (screenshot) and
 * "Results" (computed values table), toggled by inline JavaScript.
 */

import type { Value } from '../engine/value'
import { formatValue } from '../engine/value'
import { downloadBlob } from './export-file-utils'
import type { Node } from '@xyflow/react'
import type { NodeData } from '../blocks/types'

// ── Public API ───────────────────────────────────────────────────────────────

export interface StandaloneHtmlExportArgs {
  /** Project name, shown in the <title> and header. */
  projectName: string
  /** ISO timestamp of the export. */
  exportedAt: string
  /** Canvas viewport element to capture as PNG. */
  viewportElement: HTMLElement | null
  /** All nodes from the active canvas, used to build the results table. */
  nodes: Node<NodeData>[]
  /** Map from node ID → computed Value. */
  computedValues: ReadonlyMap<string, Value>
  /** Graph state serialised as JSON (embedded for potential future use). */
  graphJson: string
}

/**
 * Capture the viewport, build the HTML, and trigger a browser download.
 */
export async function exportStandaloneHtml(args: StandaloneHtmlExportArgs): Promise<void> {
  const { projectName, exportedAt, viewportElement, nodes, computedValues, graphJson } = args

  // 1. Capture the canvas as a PNG data URL
  let imageDataUrl = ''
  if (viewportElement) {
    try {
      const { toPng } = await import('html-to-image')
      imageDataUrl = await toPng(viewportElement, {
        pixelRatio: 1,
        backgroundColor: '#1a1a1a',
      })
    } catch {
      // Continue without image if capture fails
    }
  }

  // 2. Build result rows from computed values
  const resultRows = nodes
    .filter((n) => {
      const v = computedValues.get(n.id)
      return v !== undefined && v.kind !== 'error'
    })
    .map((n) => {
      const nd = n.data as NodeData
      const v = computedValues.get(n.id)!
      return {
        label: nd.label ?? nd.blockType ?? n.id,
        blockType: nd.blockType,
        valueStr: formatValue(v),
        kind: v.kind,
      }
    })

  // 3. Format date nicely
  const exportDate = new Date(exportedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // 4. Generate the HTML
  const html = buildHtml({
    projectName,
    exportDate,
    imageDataUrl,
    resultRows,
    graphJson,
  })

  // 5. Download
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'chainsolve'
  const ts = exportedAt.slice(0, 16).replace(/[T:]/g, '-')
  downloadBlob(blob, `${safeName}_${ts}.html`)
}

// ── HTML generator ───────────────────────────────────────────────────────────

interface HtmlArgs {
  projectName: string
  exportDate: string
  imageDataUrl: string
  resultRows: { label: string; blockType: string; valueStr: string; kind: string }[]
  graphJson: string
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtml({ projectName, exportDate, imageDataUrl, resultRows, graphJson }: HtmlArgs): string {
  const tableRows = resultRows
    .map(
      (r) =>
        `<tr><td class="col-label">${esc(r.label)}</td><td class="col-type">${esc(r.blockType)}</td><td class="col-val ${esc(r.kind)}">${esc(r.valueStr)}</td></tr>`,
    )
    .join('\n')

  const imageSection = imageDataUrl
    ? `<div id="graph-view" class="view active">
        <div class="img-wrap">
          <img src="${imageDataUrl}" alt="Graph screenshot" draggable="false" id="graph-img">
          <div class="zoom-hint">Scroll to zoom · Drag to pan</div>
        </div>
      </div>`
    : `<div id="graph-view" class="view active"><p class="no-capture">Graph image not available</p></div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(projectName)} — ChainSolve</title>
  <style>
    :root {
      --bg: #1a1a1a; --surface: #242424; --surface2: #2e2e2e;
      --border: #3a3a3a; --text: #f4f4f3; --muted: #9ca3af;
      --accent: #1CABB0; --mono: 'JetBrains Mono', 'Fira Code', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
    header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    header h1 { font-size: 1.1rem; font-weight: 600; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    header .meta { font-size: 0.72rem; color: var(--muted); white-space: nowrap; }
    header .badge { background: var(--accent); color: #fff; border-radius: 4px; padding: 2px 8px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; }
    nav { display: flex; gap: 4px; }
    nav button { background: none; border: 1px solid var(--border); color: var(--muted); border-radius: 5px; padding: 5px 14px; cursor: pointer; font-size: 0.8rem; transition: background 0.1s, color 0.1s; }
    nav button.active, nav button:hover { background: var(--accent); border-color: var(--accent); color: #fff; }
    main { flex: 1; overflow: hidden; position: relative; }
    .view { display: none; height: calc(100vh - 57px); overflow: auto; }
    .view.active { display: flex; flex-direction: column; }

    /* Graph view */
    .img-wrap { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: grab; position: relative; user-select: none; }
    .img-wrap:active { cursor: grabbing; }
    #graph-img { max-width: none; transform-origin: center; display: block; }
    .zoom-hint { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: var(--muted); font-size: 0.65rem; padding: 3px 10px; border-radius: 20px; pointer-events: none; }
    .no-capture { color: var(--muted); margin: auto; font-size: 0.9rem; }

    /* Results view */
    #results-view { padding: 20px; }
    .results-header { margin-bottom: 16px; }
    .results-header h2 { font-size: 0.95rem; font-weight: 600; margin-bottom: 4px; }
    .results-header p { font-size: 0.75rem; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    thead th { background: var(--surface2); color: var(--muted); text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
    tbody tr { border-bottom: 1px solid var(--border); }
    tbody tr:hover { background: var(--surface2); }
    td { padding: 7px 12px; }
    .col-label { font-weight: 500; }
    .col-type { color: var(--muted); font-family: var(--mono); font-size: 0.72rem; }
    .col-val { font-family: var(--mono); }
    .col-val.scalar, .col-val.highPrecision { color: #60a5fa; }
    .col-val.vector { color: #4ade80; }
    .col-val.table { color: #c084fc; }
    .col-val.interval { color: #fb923c; }
    .col-val.error { color: #f87171; }
    .empty { color: var(--muted); text-align: center; padding: 32px; }
    footer { background: var(--surface); border-top: 1px solid var(--border); padding: 8px 20px; font-size: 0.65rem; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <header>
    <h1>${esc(projectName)}</h1>
    <span class="meta">Exported ${esc(exportDate)}</span>
    <span class="badge">ChainSolve</span>
    <nav>
      <button id="btn-graph" class="active" onclick="showView('graph')">Graph</button>
      <button id="btn-results" onclick="showView('results')">Results (${resultRows.length})</button>
    </nav>
  </header>
  <main>
    ${imageSection}
    <div id="results-view" class="view">
      <div class="results-header">
        <h2>Computed Values</h2>
        <p>${resultRows.length} block${resultRows.length !== 1 ? 's' : ''} with output</p>
      </div>
      ${
        resultRows.length > 0
          ? `<table>
        <thead><tr><th>Block</th><th>Type</th><th>Value</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>`
          : '<p class="empty">No computed values available</p>'
      }
    </div>
  </main>
  <footer>Generated by ChainSolve · ${esc(exportDate)} · This file is self-contained and works offline.</footer>
  <script>
    // Tab switching
    function showView(v) {
      document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
      document.getElementById(v + '-view').classList.add('active');
      document.getElementById('btn-graph').classList.toggle('active', v === 'graph');
      document.getElementById('btn-results').classList.toggle('active', v === 'results');
    }

    // Pan + zoom on graph image
    (function () {
      const wrap = document.querySelector('.img-wrap');
      const img = document.getElementById('graph-img');
      if (!wrap || !img) return;
      let scale = 1, tx = 0, ty = 0, dragging = false, startX, startY;
      function applyTransform() {
        img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      }
      wrap.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        scale = Math.min(Math.max(scale * delta, 0.1), 10);
        applyTransform();
      }, { passive: false });
      wrap.addEventListener('mousedown', e => { dragging = true; startX = e.clientX - tx; startY = e.clientY - ty; });
      window.addEventListener('mousemove', e => { if (!dragging) return; tx = e.clientX - startX; ty = e.clientY - startY; applyTransform(); });
      window.addEventListener('mouseup', () => { dragging = false; });
    })();

    // Embedded graph state (for future programmatic use)
    const GRAPH_STATE = ${graphJson};
  </script>
</body>
</html>`
}
