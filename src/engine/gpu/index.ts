/**
 * gpu/index.ts — Public GPU API + auto-offloading threshold (1.40).
 *
 * Exposes a unified `GpuAccelerator` that:
 *   - Initialises WebGPU lazily on first use
 *   - Checks whether a given matrix operation exceeds the auto-offload
 *     threshold (default 512×512 = 262 144 elements)
 *   - Delegates to the appropriate gpuOps function
 *   - Falls back silently to CPU helpers when GPU is unavailable
 *
 * Usage:
 *   const gpu = new GpuAccelerator()
 *   if (gpu.shouldOffload('gemm', M, K, N)) {
 *     result = await gpu.gemm(A, B, M, K, N)
 *   } else {
 *     // CPU path
 *   }
 */

export { initGpuDevice, getGpuDevice, destroyGpuDevice } from './gpuDevice.ts'
export { getPoolStats } from './gpuMemory.ts'
export { clearInMemoryCache } from './gpuCache.ts'
export {
  gpuGemm,
  gpuBatchGemm,
  gpuSpMV,
  gpuElementwise,
  gpuReduce,
  gpuFft,
  EWOP,
  REDOP,
} from './gpuOps.ts'
export type { CsrMatrix, EwOpCode, RedOpCode } from './gpuOps.ts'
export type { GpuDeviceHandle } from './gpuDevice.ts'

import { initGpuDevice, getGpuDevice } from './gpuDevice.ts'
import {
  gpuGemm,
  gpuBatchGemm,
  gpuSpMV,
  gpuElementwise,
  gpuReduce,
  gpuFft,
} from './gpuOps.ts'
import type { CsrMatrix, EwOpCode, RedOpCode } from './gpuOps.ts'

/**
 * Threshold for auto-offloading to GPU.
 *
 * If the total number of multiply-accumulate operations (MACs) for a matrix
 * op exceeds this value, it is dispatched to the GPU rather than CPU.
 * Default: 512 × 512 × 512 = ~134 million MACs (configurable at runtime).
 */
export const DEFAULT_OFFLOAD_THRESHOLD_MACS = 512 * 512 * 512

export class GpuAccelerator {
  private _ready = false
  private _offloadThresholdMacs: number

  constructor(offloadThresholdMacs = DEFAULT_OFFLOAD_THRESHOLD_MACS) {
    this._offloadThresholdMacs = offloadThresholdMacs
  }

  /** Returns true once the GPU device has been successfully initialised. */
  get isReady(): boolean {
    return this._ready && getGpuDevice() !== null
  }

  /**
   * Initialise the GPU device (idempotent — safe to call many times).
   * Returns true if GPU is available after init.
   */
  async init(): Promise<boolean> {
    const handle = await initGpuDevice()
    this._ready = handle !== null
    return this._ready
  }

  /**
   * Return true if the given matrix operation should be dispatched to GPU.
   * Operations below the threshold run faster on CPU due to transfer overhead.
   *
   * @param op       'gemm' | 'batchGemm' | 'spMV' | 'elementwise' | 'reduce' | 'fft'
   * @param sizes    Relevant dimension sizes:
   *                   gemm:        [M, K, N]
   *                   batchGemm:   [M, K, N, batch]
   *                   spMV:        [numRows, nnz]
   *                   elementwise: [len]
   *                   reduce:      [len]
   *                   fft:         [N]
   */
  shouldOffload(
    op: 'gemm' | 'batchGemm' | 'spMV' | 'elementwise' | 'reduce' | 'fft',
    ...sizes: number[]
  ): boolean {
    if (!this.isReady) return false
    let macs = 0
    switch (op) {
      case 'gemm':
        macs = (sizes[0] ?? 0) * (sizes[1] ?? 0) * (sizes[2] ?? 0)
        break
      case 'batchGemm':
        macs = (sizes[0] ?? 0) * (sizes[1] ?? 0) * (sizes[2] ?? 0) * (sizes[3] ?? 1)
        break
      case 'spMV':
        macs = sizes[1] ?? 0 // nnz is a good proxy for work
        break
      case 'elementwise':
      case 'reduce':
      case 'fft':
        macs = sizes[0] ?? 0
        break
    }
    return macs >= this._offloadThresholdMacs
  }

  // ── Wrappers that check availability before dispatching ───────────────────

  async gemm(A: Float32Array, B: Float32Array, M: number, K: number, N: number) {
    const h = getGpuDevice()
    if (!h) throw new Error('[GPU] not initialised')
    return gpuGemm(h, A, B, M, K, N)
  }

  async batchGemm(
    A: Float32Array,
    B: Float32Array,
    M: number,
    K: number,
    N: number,
    batch: number,
  ) {
    const h = getGpuDevice()
    if (!h) throw new Error('[GPU] not initialised')
    return gpuBatchGemm(h, A, B, M, K, N, batch)
  }

  async spMV(mat: CsrMatrix, x: Float32Array) {
    const h = getGpuDevice()
    if (!h) throw new Error('[GPU] not initialised')
    return gpuSpMV(h, mat, x)
  }

  async elementwise(A: Float32Array, opCode: EwOpCode, B?: Float32Array) {
    const h = getGpuDevice()
    if (!h) throw new Error('[GPU] not initialised')
    return gpuElementwise(h, A, opCode, B)
  }

  async reduce(input: Float32Array, opCode: RedOpCode) {
    const h = getGpuDevice()
    if (!h) throw new Error('[GPU] not initialised')
    return gpuReduce(h, input, opCode)
  }

  async fft(complexData: Float32Array) {
    const h = getGpuDevice()
    if (!h) throw new Error('[GPU] not initialised')
    return gpuFft(h, complexData)
  }
}

/** Singleton accelerator instance for use in the Web Worker. */
export const gpuAccelerator = new GpuAccelerator()
