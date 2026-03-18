/**
 * gpuOps.ts — GPU-accelerated operation dispatch (1.39).
 *
 * High-level API for running GPU compute shaders.  Each function:
 *   1. Acquires / allocates GPU buffers
 *   2. Uploads input data (CPU → GPU)
 *   3. Creates bind group + encodes compute pass
 *   4. Submits to device.queue
 *   5. Reads back result (GPU → CPU)
 *   6. Returns a plain Float32Array
 *
 * All operations return CPU arrays; callers handle GPU/CPU routing.
 */

import type { GpuDeviceHandle } from './gpuDevice.ts'
import {
  SHADER_GEMM,
  SHADER_BATCH_GEMM,
  SHADER_SPMV_CSR,
  SHADER_ELEMENTWISE,
  SHADER_REDUCE,
  SHADER_FFT_STAGE,
} from './shaders.ts'
import { getOrCreatePipeline } from './gpuCache.ts'
import {
  allocBuffer,
  freeBuffer,
  createUniform,
  uploadBuffer,
  readbackBuffer,
} from './gpuMemory.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function ceilDiv(a: number, b: number) {
  return Math.ceil(a / b)
}

function makeBindGroup(
  device: GPUDevice,
  pipeline: GPUComputePipeline,
  groupIdx: number,
  entries: Array<{ binding: number; resource: GPUBindingResource }>,
): GPUBindGroup {
  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(groupIdx),
    entries,
  })
}

// ── Dense GEMM: C = A × B ────────────────────────────────────────────────────

/**
 * @param A  Row-major f32 array, shape [M × K]
 * @param B  Row-major f32 array, shape [K × N]
 * @param M  Rows of A (and C)
 * @param K  Inner dimension
 * @param N  Cols of B (and C)
 * @returns  Row-major f32 result, shape [M × N]
 */
export async function gpuGemm(
  handle: GpuDeviceHandle,
  A: Float32Array,
  B: Float32Array,
  M: number,
  K: number,
  N: number,
): Promise<Float32Array> {
  const { device } = handle
  const pipeline = await getOrCreatePipeline(device, SHADER_GEMM)

  const unifData = new Uint32Array([M, K, N, 0])
  const unifBuf = createUniform(device, unifData)

  const aBuf = allocBuffer(device, M * K)
  const bBuf = allocBuffer(device, K * N)
  const cBuf = allocBuffer(device, M * N)

  uploadBuffer(device, aBuf, A)
  uploadBuffer(device, bBuf, B)

  const bg = makeBindGroup(device, pipeline, 0, [
    { binding: 0, resource: { buffer: unifBuf } },
    { binding: 1, resource: { buffer: aBuf.buffer } },
    { binding: 2, resource: { buffer: bBuf.buffer } },
    { binding: 3, resource: { buffer: cBuf.buffer } },
  ])

  const cmd = device.createCommandEncoder()
  const pass = cmd.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bg)
  pass.dispatchWorkgroups(ceilDiv(N, 16), ceilDiv(M, 16))
  pass.end()
  device.queue.submit([cmd.finish()])

  const result = await readbackBuffer(device, cBuf)

  unifBuf.destroy()
  freeBuffer(device, aBuf)
  freeBuffer(device, bBuf)
  freeBuffer(device, cBuf)

  return result
}

// ── Batch GEMM ───────────────────────────────────────────────────────────────

export async function gpuBatchGemm(
  handle: GpuDeviceHandle,
  A: Float32Array,
  B: Float32Array,
  M: number,
  K: number,
  N: number,
  batch: number,
): Promise<Float32Array> {
  const { device } = handle
  const pipeline = await getOrCreatePipeline(device, SHADER_BATCH_GEMM)

  const unifBuf = createUniform(device, new Uint32Array([M, K, N, batch]))
  const aBuf = allocBuffer(device, batch * M * K)
  const bBuf = allocBuffer(device, batch * K * N)
  const cBuf = allocBuffer(device, batch * M * N)

  uploadBuffer(device, aBuf, A)
  uploadBuffer(device, bBuf, B)

  const bg = makeBindGroup(device, pipeline, 0, [
    { binding: 0, resource: { buffer: unifBuf } },
    { binding: 1, resource: { buffer: aBuf.buffer } },
    { binding: 2, resource: { buffer: bBuf.buffer } },
    { binding: 3, resource: { buffer: cBuf.buffer } },
  ])

  const cmd = device.createCommandEncoder()
  const pass = cmd.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bg)
  pass.dispatchWorkgroups(ceilDiv(N, 16), ceilDiv(M, 16), batch)
  pass.end()
  device.queue.submit([cmd.finish()])

  const result = await readbackBuffer(device, cBuf)
  unifBuf.destroy()
  freeBuffer(device, aBuf)
  freeBuffer(device, bBuf)
  freeBuffer(device, cBuf)
  return result
}

// ── Sparse SpMV (CSR) ────────────────────────────────────────────────────────

export interface CsrMatrix {
  rowPtr: Uint32Array  // length = numRows + 1
  colIdx: Uint32Array  // length = nnz
  values: Float32Array // length = nnz
  numRows: number
  numCols: number
}

export async function gpuSpMV(
  handle: GpuDeviceHandle,
  mat: CsrMatrix,
  x: Float32Array,
): Promise<Float32Array> {
  const { device } = handle
  const pipeline = await getOrCreatePipeline(device, SHADER_SPMV_CSR)

  const nnz = mat.values.length
  const unifBuf = createUniform(device, new Uint32Array([mat.numRows, 0, 0, 0]))

  const rowPtrBuf = device.createBuffer({
    size: mat.rowPtr.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  })
  new Uint32Array(rowPtrBuf.getMappedRange()).set(mat.rowPtr)
  rowPtrBuf.unmap()

  const colIdxBuf = device.createBuffer({
    size: mat.colIdx.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  })
  new Uint32Array(colIdxBuf.getMappedRange()).set(mat.colIdx)
  colIdxBuf.unmap()

  const valsBuf = allocBuffer(device, nnz)
  uploadBuffer(device, valsBuf, mat.values)
  const xBuf = allocBuffer(device, mat.numCols)
  uploadBuffer(device, xBuf, x)
  const yBuf = allocBuffer(device, mat.numRows)

  const bg = makeBindGroup(device, pipeline, 0, [
    { binding: 0, resource: { buffer: unifBuf } },
    { binding: 1, resource: { buffer: rowPtrBuf } },
    { binding: 2, resource: { buffer: colIdxBuf } },
    { binding: 3, resource: { buffer: valsBuf.buffer } },
    { binding: 4, resource: { buffer: xBuf.buffer } },
    { binding: 5, resource: { buffer: yBuf.buffer } },
  ])

  const cmd = device.createCommandEncoder()
  const pass = cmd.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bg)
  pass.dispatchWorkgroups(ceilDiv(mat.numRows, 64))
  pass.end()
  device.queue.submit([cmd.finish()])

  const result = await readbackBuffer(device, yBuf)
  unifBuf.destroy()
  rowPtrBuf.destroy()
  colIdxBuf.destroy()
  freeBuffer(device, valsBuf)
  freeBuffer(device, xBuf)
  freeBuffer(device, yBuf)
  return result
}

// ── Element-wise ops ─────────────────────────────────────────────────────────

export const EWOP = {
  ADD: 0, MUL: 1, SUB: 2, DIV: 3,
  EXP: 4, SIN: 5, COS: 6, SQRT: 7, ABS: 8, NEG: 9,
} as const

export type EwOpCode = (typeof EWOP)[keyof typeof EWOP]

export async function gpuElementwise(
  handle: GpuDeviceHandle,
  A: Float32Array,
  opCode: EwOpCode,
  B?: Float32Array,
): Promise<Float32Array> {
  const { device } = handle
  const len = A.length
  const pipeline = await getOrCreatePipeline(device, SHADER_ELEMENTWISE)

  const unifBuf = createUniform(device, new Uint32Array([len, opCode, 0, 0]))
  const aBuf = allocBuffer(device, len)
  uploadBuffer(device, aBuf, A)

  // For unary ops, bind B to A (unused but must be bound)
  const bData = B ?? A
  const bBuf = allocBuffer(device, bData.length)
  uploadBuffer(device, bBuf, bData)

  const outBuf = allocBuffer(device, len)

  const bg = makeBindGroup(device, pipeline, 0, [
    { binding: 0, resource: { buffer: unifBuf } },
    { binding: 1, resource: { buffer: aBuf.buffer } },
    { binding: 2, resource: { buffer: bBuf.buffer } },
    { binding: 3, resource: { buffer: outBuf.buffer } },
  ])

  const cmd = device.createCommandEncoder()
  const pass = cmd.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bg)
  pass.dispatchWorkgroups(ceilDiv(len, 256))
  pass.end()
  device.queue.submit([cmd.finish()])

  const result = await readbackBuffer(device, outBuf)
  unifBuf.destroy()
  freeBuffer(device, aBuf)
  if (B) freeBuffer(device, bBuf)
  freeBuffer(device, outBuf)
  return result
}

// ── Reduction ────────────────────────────────────────────────────────────────

export const REDOP = { SUM: 0, MAX: 1, MIN: 2 } as const
export type RedOpCode = (typeof REDOP)[keyof typeof REDOP]

export async function gpuReduce(
  handle: GpuDeviceHandle,
  input: Float32Array,
  opCode: RedOpCode,
): Promise<number> {
  const { device } = handle
  const WG = 256
  const pipeline = await getOrCreatePipeline(device, SHADER_REDUCE)

  let current = input
  while (current.length > 1) {
    const numWg = ceilDiv(current.length, WG)
    const unifBuf = createUniform(device, new Uint32Array([current.length, opCode, 0, 0]))
    const inBuf = allocBuffer(device, current.length)
    uploadBuffer(device, inBuf, current)
    const outBuf = allocBuffer(device, numWg)

    const bg = makeBindGroup(device, pipeline, 0, [
      { binding: 0, resource: { buffer: unifBuf } },
      { binding: 1, resource: { buffer: inBuf.buffer } },
      { binding: 2, resource: { buffer: outBuf.buffer } },
    ])

    const cmd = device.createCommandEncoder()
    const pass = cmd.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bg)
    pass.dispatchWorkgroups(numWg)
    pass.end()
    device.queue.submit([cmd.finish()])

    current = await readbackBuffer(device, outBuf)
    unifBuf.destroy()
    freeBuffer(device, inBuf)
    freeBuffer(device, outBuf)
  }
  return current[0]
}

// ── FFT (radix-2 Cooley-Tukey DIT) ──────────────────────────────────────────

/**
 * Compute FFT of complex input.
 * Input: interleaved [re0, im0, re1, im1, ...], length must be power of 2.
 * Returns: same interleaved format.
 */
export async function gpuFft(
  handle: GpuDeviceHandle,
  complexData: Float32Array,
): Promise<Float32Array> {
  const { device } = handle
  const N = complexData.length / 2
  if ((N & (N - 1)) !== 0) throw new Error('[GPU] FFT input length must be a power of 2')

  const pipeline = await getOrCreatePipeline(device, SHADER_FFT_STAGE)
  const dataBuf = allocBuffer(device, complexData.length)
  uploadBuffer(device, dataBuf, complexData)

  const numStages = Math.log2(N)
  for (let stage = 0; stage < numStages; stage++) {
    const unifBuf = createUniform(device, new Uint32Array([N, stage, 0, 0]))
    const bg = makeBindGroup(device, pipeline, 0, [
      { binding: 0, resource: { buffer: unifBuf } },
      { binding: 1, resource: { buffer: dataBuf.buffer } },
    ])
    const cmd = device.createCommandEncoder()
    const pass = cmd.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bg)
    pass.dispatchWorkgroups(ceilDiv(N / 2, 64))
    pass.end()
    device.queue.submit([cmd.finish()])
    await device.queue.onSubmittedWorkDone()
    unifBuf.destroy()
  }

  const result = await readbackBuffer(device, dataBuf)
  freeBuffer(device, dataBuf)
  return result
}
