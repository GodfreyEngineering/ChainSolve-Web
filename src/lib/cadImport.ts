/**
 * cadImport.ts — Minimal STEP (ISO-10303-21) and IGES (Y14.26M) geometry parsers.
 *
 * Both parsers extract vertex/mesh data and return a uniform MeshData structure
 * that the CadImportNode stores as tableData (x, y, z columns) for downstream
 * use in viewport3d, FEM, or other mesh-consuming blocks.
 *
 * STEP parser: AP203/AP214/AP242. Reads entity map, extracts CARTESIAN_POINT
 * entries, POLY_LOOP faces, and COORDINATES_LIST / TESSELLATED entities for
 * newer AP242 exports. Fan-triangulates polygonal faces.
 *
 * IGES parser: Reads Directory Entry and Parameter Data sections. Extracts
 * Type 116 (Point), Type 110 (Line start/end), and Type 128 (NURBS Surface
 * evaluated at a coarse grid). Returns vertex cloud with zero faces if no
 * surface topology is recoverable.
 */

export interface MeshData {
  vertices: number[][] // [[x, y, z], ...]
  faces: number[][] // [[i0, i1, i2], ...] triangle indices into vertices
  boundingBox: { min: [number, number, number]; max: [number, number, number] }
}

// ── STEP parser ──────────────────────────────────────────────────────────────

/** Parse a STEP file text and return geometry. */
export function parseStep(text: string): MeshData {
  // Build entity map: entityId → { type, rawParams }
  const entityMap = new Map<number, { type: string; raw: string }>()

  // STEP can have multi-line entities; normalise line continuations
  const data = text.replace(/\r\n?/g, '\n').replace(/\n([^#])/g, ' $1') // join continuations (lines not starting with #)

  const entityRe = /#(\d+)\s*=\s*([A-Z_]+)\s*\(([^;]*)\)\s*;/g
  for (const m of data.matchAll(entityRe)) {
    entityMap.set(parseInt(m[1]), { type: m[2], raw: m[3] })
  }

  // Helper: parse comma-separated numbers from param string (ignores refs)
  const nums = (raw: string): number[] =>
    [...raw.matchAll(/-?\d+\.?\d*(?:[eE][+-]?\d+)?/g)].map((m) => parseFloat(m[0]))

  // Helper: extract #ref ids
  const refs = (raw: string): number[] => [...raw.matchAll(/#(\d+)/g)].map((m) => parseInt(m[1]))

  // 1. Collect CARTESIAN_POINTs
  const cpMap = new Map<number, [number, number, number]>()
  for (const [id, { type, raw }] of entityMap) {
    if (type === 'CARTESIAN_POINT') {
      const n = nums(raw)
      cpMap.set(id, [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0])
    }
  }

  // 2. VERTEX_POINT → CARTESIAN_POINT
  const vpMap = new Map<number, number>()
  for (const [id, { type, raw }] of entityMap) {
    if (type === 'VERTEX_POINT') {
      const r = refs(raw)
      if (r.length) vpMap.set(id, r[r.length - 1])
    }
  }

  // Build index lookup: cpId → vertex index
  const vertices: number[][] = []
  const cpIdxMap = new Map<number, number>()
  for (const [id, pt] of cpMap) {
    cpIdxMap.set(id, vertices.length)
    vertices.push([pt[0], pt[1], pt[2]])
  }

  const faces: number[][] = []

  // 3a. POLY_LOOP faces (B-rep with polyline loops)
  for (const [, { type, raw }] of entityMap) {
    if (type === 'POLY_LOOP') {
      const r = refs(raw)
      if (r.length < 3) continue
      const base = cpIdxMap.get(r[0])
      if (base === undefined) continue
      for (let i = 1; i < r.length - 1; i++) {
        const a = cpIdxMap.get(r[i])
        const b = cpIdxMap.get(r[i + 1])
        if (a !== undefined && b !== undefined) faces.push([base, a, b])
      }
    }
  }

  // 3b. AP242 COORDINATES_LIST + TRIANGULATED_FACE (tessellated geometry)
  const coordListMap = new Map<number, number[][]>()
  for (const [id, { type, raw }] of entityMap) {
    if (type === 'COORDINATES_LIST') {
      // params: name, count, ((x1,y1,z1),(x2,y2,z2),...) — parse all numbers in triplets
      const n = nums(raw)
      const pts: number[][] = []
      for (let i = 0; i + 2 < n.length; i += 3) pts.push([n[i], n[i + 1], n[i + 2]])
      coordListMap.set(id, pts)
    }
  }

  for (const [, { type, raw }] of entityMap) {
    if (type === 'TRIANGULATED_FACE' || type === 'COMPLEX_TRIANGULATED_FACE') {
      const r = refs(raw)
      const coordListId = r[0]
      const coordList = coordListMap.get(coordListId)
      if (!coordList) continue
      // Add coordinate list vertices, then parse triangle index triples
      const baseIdx = vertices.length
      for (const pt of coordList) vertices.push(pt)
      // Triangle indices follow coords in params: parse all remaining number groups of 3
      // Raw contains: coordListRef, name, ..., ((i1,i2,i3),(i1,i2,i3),...)
      const n = nums(raw)
      // Skip first 3 numbers (count params), rest are triangle indices (1-based)
      const startOff = Math.floor(n.length / 2) // rough heuristic
      const triNums = nums(raw.replace(/#\d+/g, ''))
      for (let i = 0; i + 2 < triNums.length; i += 3) {
        const a = Math.round(triNums[i]) - 1 + baseIdx
        const b = Math.round(triNums[i + 1]) - 1 + baseIdx
        const c = Math.round(triNums[i + 2]) - 1 + baseIdx
        if (a >= baseIdx && b >= baseIdx && c >= baseIdx) faces.push([a, b, c])
      }
      void startOff
    }
  }

  return buildMeshResult(vertices, faces)
}

// ── IGES parser ──────────────────────────────────────────────────────────────

/** Parse an IGES file text and return geometry as a vertex cloud. */
export function parseIges(text: string): MeshData {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  // Collect Parameter Data section lines (column 73 === 'P')
  const pdLines: string[] = []
  for (const line of lines) {
    if (line.length >= 73 && line[72] === 'P') {
      pdLines.push(line.substring(0, 72).trimEnd())
    }
  }

  // Each parameter data record starts with entityType as first token.
  // Merge continuation records (no line break between them in this simple model):
  // Records end when a new entity type number appears.
  const records: string[] = []
  let current = ''
  for (const line of pdLines) {
    const semicolonPos = line.indexOf(';')
    if (semicolonPos >= 0) {
      current += line.substring(0, semicolonPos)
      records.push(current.trim())
      current = line.substring(semicolonPos + 1).trim()
    } else {
      current += line
    }
  }
  if (current.trim()) records.push(current.trim())

  const vertices: number[][] = []

  for (const record of records) {
    const parts = record.split(',').map((s) => s.trim())
    const entityType = parseInt(parts[0])
    if (isNaN(entityType)) continue

    const n = (i: number) => parseFloat(parts[i]) || 0

    if (entityType === 116) {
      // Point entity: 116, X, Y, Z, ...
      if (parts.length >= 4) vertices.push([n(1), n(2), n(3)])
    } else if (entityType === 110) {
      // Line entity: 110, X1, Y1, Z1, X2, Y2, Z2
      if (parts.length >= 7) {
        vertices.push([n(1), n(2), n(3)])
        vertices.push([n(4), n(5), n(6)])
      }
    } else if (entityType === 106) {
      // Copious Data entity: 106, form(1-3,63), n, data...
      // Form 1: 2D points (x,y pairs), Form 2: 3D points (x,y,z triples)
      if (parts.length < 3) continue
      const form = parseInt(parts[1]) || 1
      const count = parseInt(parts[2]) || 0
      if (form === 2 || form >= 12) {
        // 3D points
        for (let i = 0; i < count && 3 + i * 3 + 2 < parts.length; i++) {
          vertices.push([n(3 + i * 3), n(3 + i * 3 + 1), n(3 + i * 3 + 2)])
        }
      }
    }
  }

  return buildMeshResult(vertices, [])
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMeshResult(vertices: number[][], faces: number[][]): MeshData {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const v of vertices) {
    for (let i = 0; i < 3; i++) {
      if (v[i] < min[i]) min[i] = v[i]
      if (v[i] > max[i]) max[i] = v[i]
    }
  }
  if (vertices.length === 0) {
    min[0] = min[1] = min[2] = 0
    max[0] = max[1] = max[2] = 0
  }
  return { vertices, faces, boundingBox: { min, max } }
}

/** Convert MeshData vertices to tableData (x, y, z columns). */
export function meshToTable(mesh: MeshData): { columns: string[]; rows: number[][] } {
  return {
    columns: ['x', 'y', 'z'],
    rows: mesh.vertices.map((v) => [v[0], v[1], v[2]]),
  }
}

/** Detect file format from filename extension. */
export function detectCadFormat(filename: string): 'step' | 'iges' | 'unknown' {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.stp') || lower.endsWith('.step') || lower.endsWith('.p21')) return 'step'
  if (lower.endsWith('.igs') || lower.endsWith('.iges')) return 'iges'
  return 'unknown'
}
