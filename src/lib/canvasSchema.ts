/**
 * canvasSchema.ts — Canvas-level graph JSON format (schemaVersion 4).
 *
 * V4 is the per-canvas graph format used with multi-canvas "Sheets".
 * Each canvas JSON is stored independently in Supabase Storage at:
 *   {userId}/{projectId}/canvases/{canvasId}.json
 *
 * The legacy project.json (V1-V3) stored the graph directly on the project.
 * V4 moves the graph into per-canvas files, with the project-level metadata
 * (canvas list, active canvas) tracked in the DB `canvases` table.
 *
 * Migration from V3 → V4 is handled by `migrateV3toV4()`.
 */

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Per-canvas graph JSON stored in Supabase Storage.
 */
export interface CanvasJSON {
  schemaVersion: 4
  canvasId: string
  projectId: string
  nodes: unknown[]
  edges: unknown[]
  /** Dataset references for future use (e.g. linked CSVs). */
  datasetRefs: string[]
}

// ── Builders ────────────────────────────────────────────────────────────────

/** Build a new empty CanvasJSON. */
export function buildCanvasJson(canvasId: string, projectId: string): CanvasJSON {
  return {
    schemaVersion: 4,
    canvasId,
    projectId,
    nodes: [],
    edges: [],
    datasetRefs: [],
  }
}

/** Build a CanvasJSON from existing nodes/edges. */
export function buildCanvasJsonFromGraph(
  canvasId: string,
  projectId: string,
  nodes: unknown[],
  edges: unknown[],
): CanvasJSON {
  return {
    schemaVersion: 4,
    canvasId,
    projectId,
    nodes,
    edges,
    datasetRefs: [],
  }
}

// ── V3 → V4 Migration ──────────────────────────────────────────────────────

/**
 * Pure, idempotent migration from a V3 (or earlier) project.json graph
 * to a V4 per-canvas JSON.
 *
 * - If the input already has `schemaVersion: 4`, returns it unchanged.
 * - If V1/V2/V3, wraps the graph into a V4 CanvasJSON using the provided
 *   canvasId and projectId.
 *
 * @param json     The raw parsed JSON (could be V1-V4)
 * @param canvasId The UUID to assign to the migrated canvas
 * @param projectId The project UUID
 * @returns A valid CanvasJSON (schemaVersion 4)
 */
export function migrateV3toV4(json: unknown, canvasId: string, projectId: string): CanvasJSON {
  const obj = json as Record<string, unknown>

  // Already V4 — return unchanged
  if (obj?.schemaVersion === 4) {
    return obj as unknown as CanvasJSON
  }

  // V1/V2/V3 — extract graph from legacy format
  const graph = (obj?.graph as { nodes?: unknown[]; edges?: unknown[] }) ?? {}
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph.edges) ? graph.edges : []

  return buildCanvasJsonFromGraph(canvasId, projectId, nodes, edges)
}

/**
 * Parse and validate a raw canvas JSON download.
 * Returns a valid CanvasJSON or throws on unsupported versions.
 * Returns an empty canvas if `raw` is null (file missing).
 */
export function parseCanvasJson(raw: unknown, canvasId: string, projectId: string): CanvasJSON {
  if (raw === null || raw === undefined) {
    return buildCanvasJson(canvasId, projectId)
  }

  const obj = raw as Record<string, unknown>

  if (obj.schemaVersion === 4) {
    return obj as unknown as CanvasJSON
  }

  // Legacy format encountered in storage — migrate transparently
  return migrateV3toV4(raw, canvasId, projectId)
}
