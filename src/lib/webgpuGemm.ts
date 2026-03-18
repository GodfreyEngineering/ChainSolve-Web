/**
 * webgpuGemm.ts — GPU-accelerated matrix multiplication via WebGPU (7.8).
 *
 * Implements C = A × B for float32 matrices using a 16×16 tile-based WGSL
 * compute shader. A 1000×1000 GEMM completes in <10ms on modern GPUs.
 *
 * Public API:
 *   gpuGemm(A, B, M, K, N) → Float32Array of M×N result
 *   benchmarkGpuGemm()     → { ms: number, gflops: number, supported: boolean }
 *
 * Falls back gracefully if WebGPU is not available (returns null).
 */

// ── WGSL tile-based matrix multiply ──────────────────────────────────────────

const TILE_WGSL = /* wgsl */ `
const TILE: u32 = 16u;

@group(0) @binding(0) var<storage, read>       matA: array<f32>;
@group(0) @binding(1) var<storage, read>       matB: array<f32>;
@group(0) @binding(2) var<storage, read_write> matC: array<f32>;

struct Dims { M: u32, K: u32, N: u32, _pad: u32 }
@group(0) @binding(3) var<uniform> dims: Dims;

var<workgroup> tileA: array<array<f32, 16>, 16>;
var<workgroup> tileB: array<array<f32, 16>, 16>;

@compute @workgroup_size(16, 16, 1)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let row = gid.y;
  let col = gid.x;
  let M   = dims.M;
  let K   = dims.K;
  let N   = dims.N;

  var acc: f32 = 0.0;
  let nTiles = (K + 15u) / 16u;

  for (var t = 0u; t < nTiles; t++) {
    let aCol = t * 16u + lid.x;
    let bRow = t * 16u + lid.y;

    tileA[lid.y][lid.x] = select(0.0, matA[row * K + aCol], row < M && aCol < K);
    tileB[lid.y][lid.x] = select(0.0, matB[bRow * N + col], bRow < K && col < N);
    workgroupBarrier();

    for (var k = 0u; k < 16u; k++) {
      acc += tileA[lid.y][k] * tileB[k][lid.x];
    }
    workgroupBarrier();
  }

  if row < M && col < N {
    matC[row * N + col] = acc;
  }
}
`

// ── Device singleton ──────────────────────────────────────────────────────────

let _device: GPUDevice | null = null
let _devicePromise: Promise<GPUDevice | null> | null = null

async function getDevice(): Promise<GPUDevice | null> {
  if (_device) return _device
  if (_devicePromise) return _devicePromise

  _devicePromise = (async () => {
    if (!navigator.gpu) return null
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
      if (!adapter) return null
      const device = await adapter.requestDevice()
      device.addEventListener('uncapturederror', () => {
        _device = null
        _devicePromise = null
      })
      _device = device
      return device
    } catch {
      return null
    }
  })()

  return _devicePromise
}

// ── Pipeline cache ────────────────────────────────────────────────────────────

let _pipeline: GPUComputePipeline | null = null

function getPipeline(device: GPUDevice): GPUComputePipeline {
  if (_pipeline) return _pipeline
  const module = device.createShaderModule({ code: TILE_WGSL })
  _pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  })
  return _pipeline
}

// ── GEMM implementation ───────────────────────────────────────────────────────

/**
 * GPU matrix multiply: C = A (M×K) × B (K×N) → C (M×N).
 *
 * @returns Result as Float32Array, or null if WebGPU is not available.
 */
export async function gpuGemm(
  A: Float32Array,
  B: Float32Array,
  M: number,
  K: number,
  N: number,
): Promise<Float32Array | null> {
  const device = await getDevice()
  if (!device) return null

  const byteSize = (n: number) => n * 4 // f32 = 4 bytes

  // Upload A and B
  const bufA = device.createBuffer({
    size: byteSize(M * K),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  const bufB = device.createBuffer({
    size: byteSize(K * N),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  const bufC = device.createBuffer({
    size: byteSize(M * N),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })

  device.queue.writeBuffer(bufA, 0, A.buffer as ArrayBuffer, A.byteOffset, A.byteLength)
  device.queue.writeBuffer(bufB, 0, B.buffer as ArrayBuffer, B.byteOffset, B.byteLength)

  // Uniform dims buffer: M, K, N, pad
  const dimsData = new Uint32Array([M, K, N, 0])
  const bufDims = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(bufDims, 0, dimsData)

  const pipeline = getPipeline(device)
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: bufA } },
      { binding: 1, resource: { buffer: bufB } },
      { binding: 2, resource: { buffer: bufC } },
      { binding: 3, resource: { buffer: bufDims } },
    ],
  })

  const enc = device.createCommandEncoder()
  const pass = enc.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(Math.ceil(N / 16), Math.ceil(M / 16), 1)
  pass.end()

  // Readback
  const bufRead = device.createBuffer({
    size: byteSize(M * N),
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })
  enc.copyBufferToBuffer(bufC, 0, bufRead, 0, byteSize(M * N))
  device.queue.submit([enc.finish()])

  await bufRead.mapAsync(GPUMapMode.READ)
  const result = new Float32Array(bufRead.getMappedRange().slice(0))
  bufRead.unmap()

  bufA.destroy()
  bufB.destroy()
  bufC.destroy()
  bufDims.destroy()
  bufRead.destroy()

  return result
}

// ── Benchmark ─────────────────────────────────────────────────────────────────

export interface GemmBenchmarkResult {
  supported: boolean
  ms: number | null
  gflops: number | null
  passed: boolean // true if ms < 10
  error?: string
}

/**
 * Run a 1000×1000 GEMM benchmark.
 * Returns timing + GFLOPS. `passed` = true if <10ms.
 */
export async function benchmarkGpuGemm(): Promise<GemmBenchmarkResult> {
  const device = await getDevice()
  if (!device) {
    return {
      supported: false,
      ms: null,
      gflops: null,
      passed: false,
      error: 'WebGPU not available',
    }
  }

  const M = 1000
  const K = 1000
  const N = 1000

  // Random matrices
  const A = new Float32Array(M * K)
  const B = new Float32Array(K * N)
  for (let i = 0; i < A.length; i++) A[i] = Math.random()
  for (let i = 0; i < B.length; i++) B[i] = Math.random()

  try {
    // Warm-up run (pipeline compilation)
    await gpuGemm(A, B, M, K, N)

    // Timed run
    const t0 = performance.now()
    await gpuGemm(A, B, M, K, N)
    const ms = performance.now() - t0

    const flops = 2 * M * K * N // 2 FLOPs per multiply-add
    const gflops = flops / (ms * 1e6)

    return { supported: true, ms, gflops, passed: ms < 10 }
  } catch (err) {
    return {
      supported: true,
      ms: null,
      gflops: null,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Check if WebGPU is available in the current environment. */
export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}
