/**
 * gpuDevice.ts — WebGPU device initialisation (1.38).
 *
 * Acquires a WebGPU adapter+device and exposes a singleton accessor.
 * If WebGPU is unavailable (old browser, no GPU, or CSP-blocked) the
 * module degrades silently and all GPU ops fall back to CPU.
 *
 * Usage (inside a Web Worker or main thread):
 *   await initGpuDevice()      // once on startup
 *   const dev = getGpuDevice() // null if unavailable
 */

export interface GpuDeviceHandle {
  device: GPUDevice
  adapter: GPUAdapter
  /** True if the adapter is a software fallback (no dedicated GPU). */
  isSoftware: boolean
  /** Preferred float storage format (f32 universally supported in WebGPU). */
  floatFormat: GPUTextureFormat
  /** Max workgroup storage size in bytes. */
  maxWorkgroupStorageSize: number
  /** Max invocations per workgroup dimension. */
  maxWorkgroupSizeX: number
}

let _handle: GpuDeviceHandle | null = null

/**
 * Initialise the WebGPU device.
 *
 * Safe to call multiple times — re-uses the existing device after the first
 * successful initialisation. Returns null and logs a warning if WebGPU is
 * not supported or the request fails.
 */
export async function initGpuDevice(): Promise<GpuDeviceHandle | null> {
  if (_handle) return _handle
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    console.warn('[GPU] WebGPU not available in this environment')
    return null
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    })
    if (!adapter) {
      console.warn('[GPU] No WebGPU adapter found')
      return null
    }

    const device = await adapter.requestDevice({
      requiredFeatures: [],
      requiredLimits: {
        maxStorageBufferBindingSize: Math.min(
          adapter.limits.maxStorageBufferBindingSize,
          256 * 1024 * 1024, // 256 MB ceiling
        ),
        maxBufferSize: Math.min(
          adapter.limits.maxBufferSize,
          256 * 1024 * 1024,
        ),
      },
    })

    device.lost.then((info) => {
      console.warn('[GPU] Device lost:', info.reason, info.message)
      _handle = null
    })

    const adapterInfo = (adapter as GPUAdapter & { info?: { architecture?: string } }).info
    const isSoftware =
      adapterInfo?.architecture === 'swiftshader' ||
      adapterInfo?.architecture?.includes('software') ||
      false

    _handle = {
      device,
      adapter,
      isSoftware,
      floatFormat: 'rgba32float',
      maxWorkgroupStorageSize: device.limits.maxComputeWorkgroupStorageSize,
      maxWorkgroupSizeX: device.limits.maxComputeWorkgroupSizeX,
    }

    console.info(
      `[GPU] WebGPU ready — ${isSoftware ? 'software fallback' : 'hardware accelerated'}`,
    )
    return _handle
  } catch (err) {
    console.warn('[GPU] WebGPU initialisation failed:', err)
    return null
  }
}

/** Return the previously initialised device handle, or null. */
export function getGpuDevice(): GpuDeviceHandle | null {
  return _handle
}

/** Destroy the device and clear the singleton (for testing). */
export function destroyGpuDevice(): void {
  _handle?.device.destroy()
  _handle = null
}
