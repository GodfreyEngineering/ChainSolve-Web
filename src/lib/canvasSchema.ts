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
 *
 * A.1: Uses a `seen` WeakSet to detect circular references and replace them
 * with `null` instead of infinitely recursing. Groups with parent-child
 * relationships in React Flow can create circular refs in internal state.
 */
export function sanitizeJsonNumbers(value: unknown, seen?: WeakSet<object>): unknown {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (value === null || value === undefined || typeof value !== 'object') {
    return value
  }

  // Circular reference detection
  const visited = seen ?? new WeakSet<object>()
  if (visited.has(value as object)) {
    return null
  }
  visited.add(value as object)

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonNumbers(item, visited))
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = sanitizeJsonNumbers(v, visited)
  }
  return out
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
 * Sanitizes NaN/Infinity and circular references in node and edge data
 * before serialisation so that no non-finite numbers or circular structures
 * are ever persisted to storage.
 *
 * A.1: Strips React Flow internal properties (internals, measured) that
 * can contain circular references and are not needed for persistence.
 */
export function buildCanvasJsonFromGraph(
  canvasId: string,
  projectId: string,
  nodes: unknown[],
  edges: unknown[],
): CanvasJSON {
  // Strip React Flow internal properties before sanitization to avoid
  // circular refs and reduce payload size for large projects.
  const cleanNodes = nodes.map((node) => {
    if (node === null || typeof node !== 'object') return node
    const n = node as Record<string, unknown>
    const { internals: _internals, measured: _measured, ...rest } = n
    return rest
  })
  const cleanEdges = edges.map((edge) => {
    if (edge === null || typeof edge !== 'object') return edge
    const e = edge as Record<string, unknown>
    const { internals: _internals, ...rest } = e
    return rest
  })

  return {
    schemaVersion: 4,
    canvasId,
    projectId,
    nodes: sanitizeJsonNumbers(cleanNodes) as unknown[],
    edges: sanitizeJsonNumbers(cleanEdges) as unknown[],
    datasetRefs: [],
  }
}

// ── Node/Edge validation & repair ────────────────────────────────────────────

/**
 * Validate that a node object has the minimum required shape:
 * must be a non-null object with `id` (non-empty string) and `type` (non-empty string).
 */
function isValidNode(node: unknown): boolean {
  if (node === null || typeof node !== 'object') return false
  const n = node as Record<string, unknown>
  return (
    typeof n.id === 'string' && n.id.length > 0 && typeof n.type === 'string' && n.type.length > 0
  )
}

/**
 * Validate that an edge object has the minimum required shape:
 * must be a non-null object with `id`, `source`, and `target` (all non-empty strings).
 */
function isValidEdge(edge: unknown): boolean {
  if (edge === null || typeof edge !== 'object') return false
  const e = edge as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.source === 'string' &&
    e.source.length > 0 &&
    typeof e.target === 'string' &&
    e.target.length > 0
  )
}

export interface RepairResult {
  canvas: CanvasJSON
  removedNodes: number
  removedEdges: number
  details: string[]
}

/**
 * Strip invalid nodes and edges from a CanvasJSON, returning a clean copy.
 *
 * Removes:
 *   - Nodes missing `id` or `type`
 *   - Edges missing `id`, `source`, or `target`
 *   - Edges referencing nodes that don't exist in the (cleaned) node set
 *
 * Logs what was removed in the `details` array so callers can surface
 * the information without the repair silently eating data.
 */
export function repairCanvas(canvas: CanvasJSON): RepairResult {
  const details: string[] = []

  // 1. Filter invalid nodes
  const validNodes = canvas.nodes.filter((node) => {
    if (isValidNode(node)) return true
    const id = (node as Record<string, unknown>)?.id ?? '(no id)'
    details.push(`Removed invalid node: ${String(id)}`)
    return false
  })
  const removedNodes = canvas.nodes.length - validNodes.length

  // 2. Build node ID set for edge validation
  const nodeIds = new Set(validNodes.map((n) => (n as Record<string, unknown>).id as string))

  // 3. Filter invalid edges + dangling references
  const validEdges = canvas.edges.filter((edge) => {
    if (!isValidEdge(edge)) {
      const id = (edge as Record<string, unknown>)?.id ?? '(no id)'
      details.push(`Removed invalid edge: ${String(id)}`)
      return false
    }
    const e = edge as Record<string, unknown>
    if (!nodeIds.has(e.source as string)) {
      details.push(`Removed edge ${String(e.id)}: source node ${String(e.source)} not found`)
      return false
    }
    if (!nodeIds.has(e.target as string)) {
      details.push(`Removed edge ${String(e.id)}: target node ${String(e.target)} not found`)
      return false
    }
    return true
  })
  const removedEdges = canvas.edges.length - validEdges.length

  return {
    canvas: { ...canvas, nodes: validNodes, edges: validEdges },
    removedNodes,
    removedEdges,
    details,
  }
}

// ── Node-level migrations (applied after V4 load) ───────────────────────────

/**
 * Migrate individual nodes within a V4 canvas:
 *
 * BUG-12: Old simple 'material' (csSource) → full material (csMaterial).
 *   Old nodes: type='csSource', data.blockType='material'
 *   New nodes: type='csMaterial', data.blockType='material'
 *   (Registry no longer has a csSource entry for blockType='material';
 *    'material' now maps to csMaterial from the renamed material_full block.)
 *
 * BUG-13: 'vectorInput' → 'tableInput' with a single 'Value' column.
 *   Old nodes: type='csData', data.blockType='vectorInput', data.vectorData=number[]
 *   New nodes: type='csData', data.blockType='tableInput',
 *              data.tableData={ columns:['Value'], rows:[[v], [v], ...] }
 *   Edges from the old 'out' handle are remapped to 'col_0'.
 */
function migrateCanvasNodes(canvas: CanvasJSON): CanvasJSON {
  const vectorInputIds = new Set<string>()
  let nodesMutated = false

  const nodes = canvas.nodes.map((node) => {
    const n = node as Record<string, unknown>
    const data = (n.data as Record<string, unknown>) ?? {}
    const blockType = data.blockType as string | undefined

    // BUG-12: simple material (csSource) → full material (csMaterial).
    // Also update blockType from 'material' to 'material_full' to match the Rust op.
    if (blockType === 'material' && n.type === 'csSource') {
      nodesMutated = true
      return { ...n, type: 'csMaterial', data: { ...data, blockType: 'material_full' } }
    }

    // BUG-13: vectorInput → tableInput (single-column)
    if (blockType === 'vectorInput') {
      nodesMutated = true
      const nodeId = n.id as string | undefined
      if (nodeId) vectorInputIds.add(nodeId)
      const vectorData = (data.vectorData as number[] | undefined) ?? []
      const { vectorData: _v, ...restData } = data
      void _v // intentionally unused
      return {
        ...n,
        type: 'csData',
        data: {
          ...restData,
          blockType: 'tableInput',
          label: (data.label as string | undefined) ?? 'Table',
          tableData: {
            columns: ['Value'],
            rows: vectorData.map((v) => [v]),
          },
        },
      }
    }

    return node
  })

  // BUG-13: remap edges from vectorInput's 'out' handle → tableInput's 'col_0'
  let edgesMutated = false
  const edges = canvas.edges.map((edge) => {
    const e = edge as Record<string, unknown>
    if (typeof e.source === 'string' && vectorInputIds.has(e.source) && e.sourceHandle === 'out') {
      edgesMutated = true
      return { ...e, sourceHandle: 'col_0' }
    }
    return edge
  })

  if (!nodesMutated && !edgesMutated) return canvas
  return { ...canvas, nodes, edges }
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
    return migrateCanvasNodes(obj as unknown as CanvasJSON)
  }

  // Legacy format encountered in storage — migrate transparently
  const v4 = migrateV3toV4(raw, canvasId, projectId)
  return migrateCanvasNodes(v4)
}
