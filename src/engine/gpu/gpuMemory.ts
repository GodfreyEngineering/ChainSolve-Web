/**
 * gpuMemory.ts — GPU buffer lifecycle management (1.42).
 *
 * Manages a pool of GPU storage buffers with:
 *   - Structure-of-arrays layout hints for coalesced memory access
 *   - LRU eviction when pool exceeds a size budget
 *   - Explicit buffer lifecycle (alloc / free / reuse)
 *   - Lazy CPU↔GPU transfer (only copy when actually needed)
 *
 * All buffers are f32 storage buffers (GPUBufferUsage.STORAGE).
 * Uniform buffers are created on-demand and not pooled (small, fast).
 */

export interface GpuBuffer {
  /** The underlying GPUBuffer (storage). */
  buffer: GPUBuffer
  /** Number of f32 elements. */
  length: number
  /** Byte size of the buffer. */
  byteSize: number
  /** Whether the CPU copy is current (true until a GPU write happens). */
  cpuDirty: boolean
  /** A CPU-side Float32Array mirror, or null if not yet read back. */
  cpuMirror: Float32Array | null
}

interface PoolEntry {
  buf: GpuBuffer
  lastUsed: number
}

const pool: Map<string, PoolEntry[]> = new Map()
let poolTotalBytes = 0
const POOL_MAX_BYTES = 128 * 1024 * 1024 // 128 MB

function poolKey(length: number): string {
  return String(length)
}

function evictLru(_device: GPUDevice) {
  if (poolTotalBytes <= POOL_MAX_BYTES) return
  // Collect all entries, sort by lastUsed ascending
  const all: Array<{ key: string; entry: PoolEntry; idx: number }> = []
  for (const [key, entries] of pool) {
    entries.forEach((e, idx) => all.push({ key, entry: e, idx }))
  }
  all.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed)
  for (const { key, entry } of all) {
    if (poolTotalBytes <= POOL_MAX_BYTES) break
    const arr = pool.get(key)
    if (!arr) continue
    const i = arr.indexOf(entry)
    if (i !== -1) arr.splice(i, 1)
    entry.buf.buffer.destroy()
    poolTotalBytes -= entry.buf.byteSize
  }
}

/**
 * Allocate a GPU storage buffer for `length` f32 elements.
 * Returns a pooled buffer if one is available; otherwise creates a new one.
 */
export function allocBuffer(device: GPUDevice, length: number): GpuBuffer {
  evictLru(device)
  const key = poolKey(length)
  const entries = pool.get(key) ?? []
  const pooled = entries.pop()
  if (pooled) {
    pool.set(key, entries)
    poolTotalBytes -= pooled.buf.byteSize
    pooled.buf.cpuDirty = true
    pooled.buf.cpuMirror = null
    return pooled.buf
  }

  const byteSize = length * 4
  const buffer = device.createBuffer({
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  })
  return { buffer, length, byteSize, cpuDirty: true, cpuMirror: null }
}

/**
 * Return a GPU buffer to the pool for reuse.
 * The buffer is NOT destroyed — it stays alive in the pool.
 */
export function freeBuffer(device: GPUDevice, buf: GpuBuffer) {
  evictLru(device)
  const key = poolKey(buf.length)
  const entries = pool.get(key) ?? []
  entries.push({ buf, lastUsed: performance.now() })
  pool.set(key, entries)
  poolTotalBytes += buf.byteSize
}

/**
 * Create a uniform buffer (small, not pooled).
 * `data` must be a Uint32Array or Float32Array whose byteLength is 16-aligned.
 */
export function createUniform(
  device: GPUDevice,
  data: Uint32Array | Float32Array,
): GPUBuffer {
  const buf = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  })
  if (data instanceof Uint32Array) {
    new Uint32Array(buf.getMappedRange()).set(data)
  } else {
    new Float32Array(buf.getMappedRange()).set(data)
  }
  buf.unmap()
  return buf
}

/**
 * Upload a Float32Array to a GpuBuffer (CPU → GPU).
 * Uses `writeBuffer` which is faster than `mapAsync` for small arrays.
 */
export function uploadBuffer(device: GPUDevice, dst: GpuBuffer, src: Float32Array) {
  device.queue.writeBuffer(dst.buffer, 0, src.buffer, src.byteOffset, src.byteLength)
  dst.cpuMirror = src
  dst.cpuDirty = false
}

/**
 * Read back a GpuBuffer to CPU (GPU → CPU, async).
 * Returns a new Float32Array with the data.
 */
export async function readbackBuffer(device: GPUDevice, src: GpuBuffer): Promise<Float32Array> {
  const staging = device.createBuffer({
    size: src.byteSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })
  const cmd = device.createCommandEncoder()
  cmd.copyBufferToBuffer(src.buffer, 0, staging, 0, src.byteSize)
  device.queue.submit([cmd.finish()])
  await staging.mapAsync(GPUMapMode.READ)
  const result = new Float32Array(staging.getMappedRange().slice(0))
  staging.unmap()
  staging.destroy()
  src.cpuMirror = result
  src.cpuDirty = false
  return result
}

/** Return pool statistics for diagnostics. */
export function getPoolStats(): { totalBytes: number; bufferCount: number } {
  let bufferCount = 0
  for (const entries of pool.values()) bufferCount += entries.length
  return { totalBytes: poolTotalBytes, bufferCount }
}
