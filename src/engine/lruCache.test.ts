import { describe, it, expect, vi } from 'vitest'
import { LruCache, BlockResultCache } from './lruCache.ts'

// ── LruCache ──────────────────────────────────────────────────────────────────

describe('LruCache', () => {
  it('stores and retrieves values', () => {
    const c = new LruCache<string, number>(10)
    c.set('a', 1)
    expect(c.get('a')).toBe(1)
  })

  it('returns undefined for missing keys', () => {
    const c = new LruCache<string, number>(10)
    expect(c.get('x')).toBeUndefined()
  })

  it('reports correct size', () => {
    const c = new LruCache<string, number>(10)
    c.set('a', 1)
    c.set('b', 2)
    expect(c.size).toBe(2)
  })

  it('has() does not refresh recency', () => {
    const c = new LruCache<string, number>(2)
    c.set('a', 1)
    c.set('b', 2)
    c.has('a') // should NOT promote 'a'
    c.set('c', 3) // evicts LRU = 'a' (has() didn't refresh it)
    expect(c.has('a')).toBe(false)
    expect(c.has('b')).toBe(true)
    expect(c.has('c')).toBe(true)
  })

  it('peek does not refresh recency', () => {
    const c = new LruCache<string, number>(2)
    c.set('a', 1)
    c.set('b', 2)
    c.peek('a') // should NOT promote 'a'
    c.set('c', 3) // evicts LRU = 'a'
    expect(c.has('a')).toBe(false)
  })

  it('get refreshes recency (promotes to MRU)', () => {
    const c = new LruCache<string, number>(2)
    c.set('a', 1)
    c.set('b', 2)
    c.get('a') // promotes 'a' to MRU; 'b' is now LRU
    c.set('c', 3) // evicts LRU = 'b'
    expect(c.has('a')).toBe(true)
    expect(c.has('b')).toBe(false)
    expect(c.has('c')).toBe(true)
  })

  it('evicts LRU when capacity exceeded', () => {
    const evicted: string[] = []
    const c = new LruCache<string, number>(3, (k) => evicted.push(k))
    c.set('a', 1)
    c.set('b', 2)
    c.set('c', 3)
    c.set('d', 4) // evicts 'a' (oldest)
    expect(c.has('a')).toBe(false)
    expect(evicted).toEqual(['a'])
    expect(c.size).toBe(3)
  })

  it('updating existing key does not evict', () => {
    const evicted: string[] = []
    const c = new LruCache<string, number>(2, (k) => evicted.push(k))
    c.set('a', 1)
    c.set('b', 2)
    c.set('a', 99) // update existing key — no eviction
    expect(evicted).toHaveLength(0)
    expect(c.get('a')).toBe(99)
    expect(c.size).toBe(2)
  })

  it('delete removes key', () => {
    const c = new LruCache<string, number>(10)
    c.set('a', 1)
    expect(c.delete('a')).toBe(true)
    expect(c.has('a')).toBe(false)
    expect(c.delete('missing')).toBe(false)
  })

  it('clear removes all entries', () => {
    const c = new LruCache<string, number>(10)
    c.set('a', 1)
    c.set('b', 2)
    c.clear()
    expect(c.size).toBe(0)
    expect(c.has('a')).toBe(false)
  })

  it('evictUntil trims to target size', () => {
    const c = new LruCache<string, number>(10)
    for (let i = 0; i < 8; i++) c.set(`k${i}`, i)
    c.evictUntil(4)
    expect(c.size).toBe(4)
  })

  it('evictUntil evicts LRU entries first', () => {
    const c = new LruCache<string, number>(10)
    c.set('a', 1) // LRU
    c.set('b', 2)
    c.set('c', 3) // MRU
    c.evictUntil(1)
    expect(c.has('c')).toBe(true) // MRU survives
    expect(c.has('a')).toBe(false)
    expect(c.has('b')).toBe(false)
  })

  it('evictToMemoryBudgetBytes evicts entries over budget', () => {
    const c = new LruCache<string, Uint8Array>(10)
    c.set('a', new Uint8Array(100)) // LRU
    c.set('b', new Uint8Array(100))
    c.set('c', new Uint8Array(100)) // MRU
    // Budget: 150 bytes → evict 2 of 3 entries (each 100 bytes)
    c.evictToMemoryBudgetBytes((v) => v.byteLength, 150)
    expect(c.size).toBe(1)
    expect(c.has('c')).toBe(true) // MRU survives
  })

  it('onEvict callback fires for each eviction', () => {
    const evicted: Array<[string, number]> = []
    const c = new LruCache<string, number>(2, (k, v) => evicted.push([k, v]))
    c.set('a', 10)
    c.set('b', 20)
    c.set('c', 30) // evicts 'a'
    c.set('d', 40) // evicts 'b'
    expect(evicted).toEqual([['a', 10], ['b', 20]])
  })

  it('rejects maxEntries < 1', () => {
    expect(() => new LruCache(0)).toThrow(RangeError)
    expect(() => new LruCache(-1)).toThrow(RangeError)
  })

  it('maxEntries of 1 works', () => {
    const c = new LruCache<string, number>(1)
    c.set('a', 1)
    c.set('b', 2)
    expect(c.size).toBe(1)
    expect(c.has('a')).toBe(false)
    expect(c.get('b')).toBe(2)
  })

  it('keys() returns in LRU→MRU order', () => {
    const c = new LruCache<string, number>(10)
    c.set('a', 1)
    c.set('b', 2)
    c.set('c', 3)
    expect([...c.keys()]).toEqual(['a', 'b', 'c'])
    c.get('a') // promote 'a' to MRU
    expect([...c.keys()]).toEqual(['b', 'c', 'a'])
  })
})

// ── BlockResultCache ──────────────────────────────────────────────────────────

describe('BlockResultCache', () => {
  it('stores and retrieves results', () => {
    const cache = new BlockResultCache(100)
    cache.set('nodeA', 'hash1', { value: 42 })
    expect(cache.get('nodeA', 'hash1')).toEqual({ value: 42 })
  })

  it('returns undefined on miss', () => {
    const cache = new BlockResultCache(100)
    expect(cache.get('nodeA', 'nonexistent')).toBeUndefined()
  })

  it('tracks hit rate', () => {
    const cache = new BlockResultCache(100)
    cache.set('n', 'h', 1)
    cache.get('n', 'h')   // hit
    cache.get('n', 'h')   // hit
    cache.get('n', 'x')   // miss
    expect(cache.hits).toBe(2)
    expect(cache.misses).toBe(1)
    expect(cache.hitRate).toBeCloseTo(2 / 3)
  })

  it('invalidateNode removes all entries for that node', () => {
    const cache = new BlockResultCache(100)
    cache.set('nodeA', 'h1', 1)
    cache.set('nodeA', 'h2', 2)
    cache.set('nodeB', 'h1', 3)
    cache.invalidateNode('nodeA')
    expect(cache.get('nodeA', 'h1')).toBeUndefined()
    expect(cache.get('nodeA', 'h2')).toBeUndefined()
    // nodeB hit — increment hits
    expect(cache.get('nodeB', 'h1')).toBe(3)
  })

  it('clear resets cache and stats', () => {
    const cache = new BlockResultCache(100)
    cache.set('n', 'h', 1)
    cache.get('n', 'h')
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.hits).toBe(0)
    expect(cache.misses).toBe(0)
  })

  it('respects maxEntries and evicts LRU', () => {
    const cache = new BlockResultCache(2)
    cache.set('a', 'h', 1)
    cache.set('b', 'h', 2)
    cache.set('c', 'h', 3) // evicts 'a:h'
    expect(cache.get('a', 'h')).toBeUndefined()
    expect(cache.get('b', 'h')).toBe(2)
    expect(cache.get('c', 'h')).toBe(3)
  })

  it('static key format is nodeId:inputHash', () => {
    expect(BlockResultCache.key('myNode', 'abc123')).toBe('myNode:abc123')
  })

  it('evictUntil delegates correctly', () => {
    const cache = new BlockResultCache(100)
    for (let i = 0; i < 10; i++) cache.set(`n${i}`, 'h', i)
    cache.evictUntil(5)
    expect(cache.size).toBe(5)
  })
})
