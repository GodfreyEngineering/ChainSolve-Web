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

// ── Validation ──────────────────────────────────────────────────────────────

export interface CanvasValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Validate that `raw` conforms to the schemaVersion 4 CanvasJSON shape.
 *
 * Checks:
 *   - Plain object (not null, not array)
 *   - schemaVersion === 4
 *   - canvasId: non-empty string
 *   - projectId: non-empty string
 *   - nodes: array
 *   - edges: array
 */
export function validateCanvasShape(raw: unknown): CanvasValidationResult {
  const errors: string[] = []

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['canvas JSON must be a plain object'] }
  }

  const obj = raw as Record<string, unknown>

  if (obj.schemaVersion !== 4) {
    errors.push(`schemaVersion must be 4 (got ${String(obj.schemaVersion)})`)
  }

  if (typeof obj.canvasId !== 'string' || obj.canvasId.length === 0) {
    errors.push('canvasId must be a non-empty string')
  }

  if (typeof obj.projectId !== 'string' || obj.projectId.length === 0) {
    errors.push('projectId must be a non-empty string')
  }

  if (!Array.isArray(obj.nodes)) {
    errors.push('nodes must be an array')
  }

  if (!Array.isArray(obj.edges)) {
    errors.push('edges must be an array')
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Recursively replace non-finite numbers (NaN, Infinity, -Infinity) with
 * `null` so they can safely round-trip through JSON.stringify.
 *
 * ReactFlow node and edge data can contain arbitrary nested objects; this
 * guard ensures we never persist a value that would silently become `null`
 * or cause a JSON.parse error depending on the serialiser.
 */
export function sanitizeJsonNumbers(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonNumbers)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeJsonNumbers(v)
    }
    return out
  }
  return value
}

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

/** Build a CanvasJSON from existing nodes/edges.
 *
 * Sanitizes NaN/Infinity in node and edge data before serialisation so that
 * no non-finite numbers are ever persisted to storage.
 */
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
    nodes: sanitizeJsonNumbers(nodes) as unknown[],
    edges: sanitizeJsonNumbers(edges) as unknown[],
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
 *
 * - Returns an empty canvas if `raw` is null/undefined (file missing).
 * - Migrates V1–V3 transparently.
 * - For V4: validates shape; on failure logs errors and returns an empty
 *   canvas (no crash) so the caller can show an error report without
 *   overwriting the original storage file.
 */
export function parseCanvasJson(raw: unknown, canvasId: string, projectId: string): CanvasJSON {
  if (raw === null || raw === undefined) {
    return buildCanvasJson(canvasId, projectId)
  }

  const obj = raw as Record<string, unknown>

  if (obj.schemaVersion === 4) {
    const result = validateCanvasShape(raw)
    if (!result.ok) {
      console.warn('[canvas] Invalid V4 canvas JSON — using empty canvas. Errors:', result.errors)
      return buildCanvasJson(canvasId, projectId)
    }
    return obj as unknown as CanvasJSON
  }

  // Legacy format encountered in storage — migrate transparently
  return migrateV3toV4(raw, canvasId, projectId)
}
