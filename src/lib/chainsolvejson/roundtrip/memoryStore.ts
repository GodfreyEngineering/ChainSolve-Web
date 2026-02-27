/**
 * memoryStore.ts — In-memory persistence harness for round-trip tests.
 *
 * Simulates the Supabase project/canvas/asset storage layer entirely in memory.
 * Used by golden tests to exercise the full import pipeline without a backend.
 *
 * @internal Test-only module.
 */

import type { CanvasJSON } from '../../canvasSchema'

// ── Stored types ─────────────────────────────────────────────────────────────

export interface StoredProject {
  id: string
  name: string
  activeCanvasId: string
  variables: Record<string, unknown>
}

export interface StoredCanvas {
  id: string
  projectId: string
  name: string
  position: number
  graph: CanvasJSON
}

export interface StoredAsset {
  projectId: string
  name: string
  mimeType: string
  bytes: Uint8Array
  sha256: string | null
  kind: string
}

// ── Memory store ─────────────────────────────────────────────────────────────

export interface MemoryStore {
  projects: Map<string, StoredProject>
  canvases: Map<string, StoredCanvas>
  assets: StoredAsset[]
}

export function createMemoryStore(): MemoryStore {
  return {
    projects: new Map(),
    canvases: new Map(),
    assets: [],
  }
}

// ── Operations ───────────────────────────────────────────────────────────────

export function storeProject(store: MemoryStore, project: StoredProject): void {
  store.projects.set(project.id, project)
}

export function storeCanvas(store: MemoryStore, canvas: StoredCanvas): void {
  store.canvases.set(canvas.id, canvas)
}

export function storeAsset(store: MemoryStore, asset: StoredAsset): void {
  store.assets.push(asset)
}

/** Get all canvases for a project, sorted by position. */
export function getProjectCanvases(store: MemoryStore, projectId: string): StoredCanvas[] {
  return Array.from(store.canvases.values())
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.position - b.position)
}

/** Get all assets for a project. */
export function getProjectAssets(store: MemoryStore, projectId: string): StoredAsset[] {
  return store.assets.filter((a) => a.projectId === projectId)
}
