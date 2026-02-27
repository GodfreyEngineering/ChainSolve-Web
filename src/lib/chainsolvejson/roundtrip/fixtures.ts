/**
 * fixtures.ts — Deterministic golden fixtures for round-trip tests.
 *
 * Each fixture is built programmatically (no external files). All fields are
 * stable so that exported hashes remain deterministic across runs.
 *
 * @internal Test-only module.
 */

import type { BuildChainsolveJsonArgs, ExportAsset } from '../model'
import { buildEmbeddedAsset } from '../model'
import type { VariablesMap } from '../../variables'

// ── Fixture A: Two canvases, basic math ──────────────────────────────────────

const fixtureAVariables: VariablesMap = {
  rate: { id: 'rate', name: 'rate', value: 0.05, description: 'Interest rate' },
  periods: { id: 'periods', name: 'periods', value: 12 },
}

export function buildFixtureA(): BuildChainsolveJsonArgs {
  return {
    exportedAt: '2026-02-27T12:00:00.000Z',
    appVersion: '1.0.0',
    buildSha: 'golden-a',
    buildTime: '2026-02-27T00:00:00Z',
    buildEnv: 'test',
    engineVersion: '0.1.0',
    engineContractVersion: 1,
    projectId: 'proj-a',
    projectName: 'Fixture A: Two Canvases',
    activeCanvasId: 'ca-0',
    variables: fixtureAVariables,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-27T11:00:00Z',
    canvases: [
      {
        id: 'ca-0',
        name: 'Sheet 1',
        position: 0,
        graph: {
          schemaVersion: 4,
          canvasId: 'ca-0',
          projectId: 'proj-a',
          nodes: [
            { id: 'n1', type: 'number', position: { x: 0, y: 0 }, data: { value: 10 } },
            { id: 'n2', type: 'number', position: { x: 0, y: 100 }, data: { value: 20 } },
            { id: 'n3', type: 'add', position: { x: 200, y: 50 }, data: {} },
          ],
          edges: [
            { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n3', targetHandle: 'a' },
            { id: 'e2', source: 'n2', sourceHandle: 'out', target: 'n3', targetHandle: 'b' },
          ],
          datasetRefs: [],
        },
      },
      {
        id: 'ca-1',
        name: 'Sheet 2',
        position: 1,
        graph: {
          schemaVersion: 4,
          canvasId: 'ca-1',
          projectId: 'proj-a',
          nodes: [
            { id: 'n4', type: 'number', position: { x: 0, y: 0 }, data: { value: 100 } },
            { id: 'n5', type: 'negate', position: { x: 200, y: 0 }, data: {} },
          ],
          edges: [
            { id: 'e3', source: 'n4', sourceHandle: 'out', target: 'n5', targetHandle: 'in' },
          ],
          datasetRefs: [],
        },
      },
    ],
    assets: [],
  }
}

// ── Fixture B: Division by zero (produces diagnostics) ───────────────────────

export function buildFixtureB(): BuildChainsolveJsonArgs {
  return {
    exportedAt: '2026-02-27T12:00:00.000Z',
    appVersion: '1.0.0',
    buildSha: 'golden-b',
    buildTime: '2026-02-27T00:00:00Z',
    buildEnv: 'test',
    engineVersion: '0.1.0',
    engineContractVersion: 1,
    projectId: 'proj-b',
    projectName: 'Fixture B: Division By Zero',
    activeCanvasId: 'cb-0',
    variables: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-27T11:00:00Z',
    canvases: [
      {
        id: 'cb-0',
        name: 'Health Check',
        position: 0,
        graph: {
          schemaVersion: 4,
          canvasId: 'cb-0',
          projectId: 'proj-b',
          nodes: [
            { id: 'n1', type: 'number', position: { x: 0, y: 0 }, data: { value: 42 } },
            { id: 'n2', type: 'number', position: { x: 0, y: 100 }, data: { value: 0 } },
            { id: 'n3', type: 'divide', position: { x: 200, y: 50 }, data: {} },
          ],
          edges: [
            { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n3', targetHandle: 'a' },
            { id: 'e2', source: 'n2', sourceHandle: 'out', target: 'n3', targetHandle: 'b' },
          ],
          datasetRefs: [],
        },
      },
    ],
    assets: [],
  }
}

// ── Fixture C: Embedded CSV asset ──────────────────────────────────────────

const CSV_CONTENT = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n'

export async function buildFixtureC(): Promise<BuildChainsolveJsonArgs> {
  const csvBytes = new TextEncoder().encode(CSV_CONTENT)
  const embeddedAsset = await buildEmbeddedAsset('data.csv', 'text/csv', csvBytes)
  const assets: ExportAsset[] = [embeddedAsset]

  return {
    exportedAt: '2026-02-27T12:00:00.000Z',
    appVersion: '1.0.0',
    buildSha: 'golden-c',
    buildTime: '2026-02-27T00:00:00Z',
    buildEnv: 'test',
    engineVersion: '0.1.0',
    engineContractVersion: 1,
    projectId: 'proj-c',
    projectName: 'Fixture C: Asset Round-Trip',
    activeCanvasId: 'cc-0',
    variables: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-27T11:00:00Z',
    canvases: [
      {
        id: 'cc-0',
        name: 'Data Sheet',
        position: 0,
        graph: {
          schemaVersion: 4,
          canvasId: 'cc-0',
          projectId: 'proj-c',
          nodes: [{ id: 'n1', type: 'constant', position: { x: 0, y: 0 }, data: { value: 1 } }],
          edges: [],
          datasetRefs: [],
        },
      },
    ],
    assets,
  }
}
