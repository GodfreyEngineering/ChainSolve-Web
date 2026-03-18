import { describe, it, expect, vi } from 'vitest'
import {
  GraphBuilder,
  parseSnapshot,
  applyParams,
  ResultAccessor,
  ChainSolveClient,
  ApiError,
  ValueTypeError,
  NodeNotFoundError,
} from './index.ts'
import type { EvalResult, GraphSnapshot } from './types.ts'

// ── GraphBuilder ──────────────────────────────────────────────────────────────

describe('GraphBuilder', () => {
  it('builds an empty snapshot', () => {
    const s = new GraphBuilder().build()
    expect(s.version).toBe(1)
    expect(s.nodes).toHaveLength(0)
    expect(s.edges).toHaveLength(0)
  })

  it('adds nodes', () => {
    const s = new GraphBuilder()
      .node('n1', 'number', { value: 5 })
      .node('n2', 'add', {})
      .build()
    expect(s.nodes).toHaveLength(2)
    expect(s.nodes[0]).toEqual({ id: 'n1', blockType: 'number', data: { value: 5 } })
  })

  it('adds edges with auto-incremented IDs', () => {
    const s = new GraphBuilder()
      .node('a', 'number', { value: 1 })
      .node('b', 'add', {})
      .edge('a', 'out', 'b', 'in_0')
      .build()
    expect(s.edges).toHaveLength(1)
    expect(s.edges[0].source).toBe('a')
    expect(s.edges[0].sourceHandle).toBe('out')
    expect(s.edges[0].target).toBe('b')
    expect(s.edges[0].targetHandle).toBe('in_0')
    expect(s.edges[0].id).toMatch(/^e\d+$/)
  })

  it('.number() convenience helper', () => {
    const s = new GraphBuilder().number('x', 42).build()
    expect(s.nodes[0]).toEqual({ id: 'x', blockType: 'number', data: { value: 42 } })
  })

  it('.text() convenience helper', () => {
    const s = new GraphBuilder().text('t', 'hello').build()
    expect(s.nodes[0].blockType).toBe('text_const')
    expect(s.nodes[0].data['value']).toBe('hello')
  })

  it('.op() wires inputs automatically', () => {
    const s = new GraphBuilder()
      .number('a', 3)
      .number('b', 4)
      .op('sum', 'add', { inputs: ['a', 'b'] })
      .build()
    expect(s.nodes).toHaveLength(3)
    expect(s.edges).toHaveLength(2)
    expect(s.edges[0].targetHandle).toBe('in_0')
    expect(s.edges[1].targetHandle).toBe('in_1')
  })

  it('.display() wires source to display block', () => {
    const s = new GraphBuilder()
      .number('n', 1)
      .display('d', 'n')
      .build()
    expect(s.nodes.find((n) => n.id === 'd')?.blockType).toBe('display')
    expect(s.edges[0]).toMatchObject({ source: 'n', target: 'd' })
  })

  it('throws on duplicate node ID', () => {
    const b = new GraphBuilder().node('x', 'number', {}).node('x', 'add', {})
    expect(() => b.build()).toThrow('Duplicate node id')
  })

  it('throws on edge referencing unknown source', () => {
    const b = new GraphBuilder()
      .node('a', 'number', {})
      .edge('missing', 'out', 'a', 'in_0')
    expect(() => b.build()).toThrow('unknown source node')
  })

  it('throws on edge referencing unknown target', () => {
    const b = new GraphBuilder()
      .node('a', 'number', {})
      .edge('a', 'out', 'missing', 'in_0')
    expect(() => b.build()).toThrow('unknown target node')
  })

  it('toJSON() produces valid JSON', () => {
    const json = new GraphBuilder().number('n', 99).toJSON()
    const parsed = JSON.parse(json) as GraphSnapshot
    expect(parsed.version).toBe(1)
    expect(parsed.nodes[0].data['value']).toBe(99)
  })

  it('nodeCount and edgeCount report before build()', () => {
    const b = new GraphBuilder().number('a', 1).number('b', 2)
    b.edge('a', 'out', 'b', 'in_0')
    expect(b.nodeCount).toBe(2)
    expect(b.edgeCount).toBe(1)
  })

  it('builds a large graph correctly', () => {
    const b = new GraphBuilder()
    for (let i = 0; i < 100; i++) b.number(`n${i}`, i)
    const s = b.build()
    expect(s.nodes).toHaveLength(100)
  })
})

// ── parseSnapshot / applyParams ───────────────────────────────────────────────

describe('parseSnapshot', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify({ version: 1, nodes: [], edges: [] })
    const s = parseSnapshot(json)
    expect(s.version).toBe(1)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseSnapshot('not json')).toThrow('Invalid JSON')
  })

  it('throws on wrong version', () => {
    const json = JSON.stringify({ version: 2, nodes: [], edges: [] })
    expect(() => parseSnapshot(json)).toThrow('version must be 1')
  })
})

describe('applyParams', () => {
  it('returns same snapshot when params is empty', () => {
    const s = new GraphBuilder().number('x', 5).build()
    expect(applyParams(s, {})).toBe(s)
  })

  it('overrides node data.value', () => {
    const s = new GraphBuilder().number('x', 0).build()
    const patched = applyParams(s, { x: 99 })
    expect(patched.nodes[0].data['value']).toBe(99)
    // original unchanged
    expect(s.nodes[0].data['value']).toBe(0)
  })

  it('does not mutate unrelated nodes', () => {
    const s = new GraphBuilder()
      .number('a', 1)
      .number('b', 2)
      .build()
    const patched = applyParams(s, { a: 10 })
    expect(patched.nodes[1].data['value']).toBe(2)
  })
})

// ── ResultAccessor ────────────────────────────────────────────────────────────

function makeResult(values: EvalResult['values']): EvalResult {
  return { values, diagnostics: [], elapsedUs: 0 }
}

describe('ResultAccessor', () => {
  it('scalar() extracts f64 value', () => {
    const r = new ResultAccessor(makeResult({ n: { kind: 'scalar', value: 7 } }))
    expect(r.scalar('n')).toBe(7)
  })

  it('vector() extracts array', () => {
    const r = new ResultAccessor(makeResult({ v: { kind: 'vector', value: [1, 2, 3] } }))
    expect(r.vector('v')).toEqual([1, 2, 3])
  })

  it('matrix() extracts rows/cols/data', () => {
    const r = new ResultAccessor(
      makeResult({ m: { kind: 'matrix', rows: 2, cols: 2, data: [1, 2, 3, 4] } }),
    )
    expect(r.matrix('m')).toEqual({ rows: 2, cols: 2, data: [1, 2, 3, 4] })
  })

  it('text() extracts string', () => {
    const r = new ResultAccessor(makeResult({ t: { kind: 'text', value: 'hello' } }))
    expect(r.text('t')).toBe('hello')
  })

  it('complex() extracts re/im', () => {
    const r = new ResultAccessor(makeResult({ c: { kind: 'complex', re: 1, im: -2 } }))
    expect(r.complex('c')).toEqual({ re: 1, im: -2 })
  })

  it('table() extracts columns/rows', () => {
    const r = new ResultAccessor(
      makeResult({ tbl: { kind: 'table', columns: ['x', 'y'], rows: [[1, 2], [3, 4]] } }),
    )
    expect(r.table('tbl').columns).toEqual(['x', 'y'])
  })

  it('throws NodeNotFoundError for missing node', () => {
    const r = new ResultAccessor(makeResult({}))
    expect(() => r.scalar('x')).toThrow(NodeNotFoundError)
  })

  it('throws ValueTypeError on kind mismatch', () => {
    const r = new ResultAccessor(makeResult({ v: { kind: 'vector', value: [1] } }))
    expect(() => r.scalar('v')).toThrow(ValueTypeError)
  })

  it('throws Error on EvalError value', () => {
    const r = new ResultAccessor(makeResult({ e: { kind: 'error', message: 'divide by zero' } }))
    expect(() => r.scalar('e')).toThrow('[EVAL_ERROR]')
  })

  it('hasError() detects error values', () => {
    const r = new ResultAccessor(
      makeResult({
        ok: { kind: 'scalar', value: 1 },
        bad: { kind: 'error', message: 'oops' },
      }),
    )
    expect(r.hasError('ok')).toBe(false)
    expect(r.hasError('bad')).toBe(true)
    expect(r.hasError('missing')).toBe(false)
  })

  it('errorMessage() returns message or undefined', () => {
    const r = new ResultAccessor(
      makeResult({ n: { kind: 'error', message: 'oops' } }),
    )
    expect(r.errorMessage('n')).toBe('oops')
    expect(r.errorMessage('other')).toBeUndefined()
  })

  it('nodeIds returns all keys', () => {
    const r = new ResultAccessor(
      makeResult({ a: { kind: 'scalar', value: 1 }, b: { kind: 'scalar', value: 2 } }),
    )
    expect(r.nodeIds.sort()).toEqual(['a', 'b'])
  })

  it('raw() returns Value or undefined', () => {
    const r = new ResultAccessor(makeResult({ n: { kind: 'scalar', value: 5 } }))
    expect(r.raw('n')).toEqual({ kind: 'scalar', value: 5 })
    expect(r.raw('missing')).toBeUndefined()
  })

  it('values getter is read-only proxy of underlying map', () => {
    const r = new ResultAccessor(makeResult({ n: { kind: 'scalar', value: 9 } }))
    expect(r.values['n']).toEqual({ kind: 'scalar', value: 9 })
  })

  it('elapsedUs reports eval time', () => {
    const r = new ResultAccessor({ values: {}, diagnostics: [], elapsedUs: 1234 })
    expect(r.elapsedUs).toBe(1234)
  })
})

// ── ChainSolveClient ──────────────────────────────────────────────────────────

describe('ChainSolveClient', () => {
  const snapshot = new GraphBuilder().number('n', 3).build()
  const mockResult: EvalResult = {
    values: { n: { kind: 'scalar', value: 3 } },
    diagnostics: [],
    elapsedUs: 100,
  }

  it('executes a graph and returns ResultAccessor', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: mockResult }),
    })
    const client = new ChainSolveClient({
      baseUrl: 'http://localhost:8788/api',
      fetch: mockFetch,
    })
    const result = await client.execute(snapshot)
    expect(result.scalar('n')).toBe(3)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('sends Authorization header when accessToken provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: mockResult }),
    })
    const client = new ChainSolveClient({
      baseUrl: 'http://localhost:8788/api',
      accessToken: 'tok123',
      fetch: mockFetch,
    })
    await client.execute(snapshot)
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok123')
  })

  it('applies params overrides before sending', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: mockResult }),
    })
    const client = new ChainSolveClient({ baseUrl: 'http://x', fetch: mockFetch })
    await client.execute(snapshot, { params: { n: 99 } })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { snapshot: GraphSnapshot }
    expect(body.snapshot.nodes[0].data['value']).toBe(99)
  })

  it('throws ApiError on 4xx response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ code: 'VALIDATION_FAILED', message: 'bad graph' }),
    })
    const client = new ChainSolveClient({ baseUrl: 'http://x', fetch: mockFetch })
    await expect(client.execute(snapshot)).rejects.toThrow(ApiError)
  })

  it('ApiError carries status code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ code: 'INTERNAL_ERROR', message: 'boom' }),
    })
    const client = new ChainSolveClient({ baseUrl: 'http://x', fetch: mockFetch })
    try {
      await client.execute(snapshot)
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).statusCode).toBe(500)
      expect((e as ApiError).code).toBe('INTERNAL_ERROR')
    }
  })

  it('validate() calls /graph/validate endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ diagnostics: [] }),
    })
    const client = new ChainSolveClient({ baseUrl: 'http://x', fetch: mockFetch })
    const diags = await client.validate(snapshot)
    expect(diags).toEqual([])
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('/graph/validate')
  })
})
