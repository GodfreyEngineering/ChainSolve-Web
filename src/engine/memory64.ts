/**
 * memory64.ts — WebAssembly Memory64 proposal feature detection (1.52).
 *
 * The Memory64 proposal allows WebAssembly modules to use 64-bit memory
 * indices, enabling more than 4 GB of addressable memory.  This is valuable
 * for very large datasets or meshes that exceed the 32-bit address space
 * limit of standard WASM.
 *
 * Browser support status (as of 2025):
 *   - Chrome/Edge 120+: behind flag (chrome://flags/#enable-experimental-webassembly-features)
 *   - Chrome 124+: enabled by default
 *   - Firefox: planned
 *   - Safari: planned
 *
 * Usage:
 *   const info = await detectMemory64Support()
 *   if (info.supported) {
 *     // Can allocate WebAssembly.Memory with index: 'i64'
 *   }
 */

export interface Memory64Info {
  /** True if the current JavaScript engine supports Memory64. */
  supported: boolean
  /** True if the runtime can actually allocate a Memory64 instance (requires OS support for large address space). */
  allocatable: boolean
  /** Max addressable bytes via Memory64 (theoretical, 2^64 bytes; practical limit is OS/hardware). */
  maxBytes: bigint | null
}

let _cached: Memory64Info | null = null

/**
 * Detect WebAssembly Memory64 support.
 *
 * Uses a tiny hand-crafted WASM binary that declares a 64-bit memory.
 * If `WebAssembly.instantiate` succeeds, Memory64 is supported.
 * If it throws, the feature is not available.
 *
 * The probe binary is 36 bytes and is created inline — no network request.
 */
export async function detectMemory64Support(): Promise<Memory64Info> {
  if (_cached) return _cached

  // Minimal WASM binary declaring one Memory64 (64-bit indices).
  // (module (memory i64 1))  — 36 bytes
  // Assembled from WAT:
  //   0000: 00 61 73 6d  - magic
  //   0004: 01 00 00 00  - version 1
  //   0008: 05           - memory section id
  //   0009: 04           - section length 4
  //   000a: 01           - 1 memory
  //   000b: 04           - memory64 flag (bit 2 set) + no maximum
  //   000c: 01           - initial pages = 1 (64KiB)
  //   000d: (end)
  const memory64Probe = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // magic
    0x01, 0x00, 0x00, 0x00, // version
    0x05,                   // memory section
    0x04,                   // section size
    0x01,                   // memory count: 1
    0x04,                   // memory type: memory64 (flags = 4 = i64)
    0x01,                   // min pages: 1
    0x00,                   // end
  ])

  let supported = false
  let allocatable = false

  try {
    const mod = await WebAssembly.compile(memory64Probe)
    supported = true
    // Attempt to instantiate — fails if allocator can't handle 64-bit addresses.
    try {
      await WebAssembly.instantiate(mod, {})
      allocatable = true
    } catch {
      allocatable = false
    }
  } catch {
    supported = false
  }

  _cached = {
    supported,
    allocatable,
    maxBytes: supported ? BigInt('0xFFFFFFFFFFFFFFFF') : null,
  }

  if (supported) {
    console.info(
      `[Memory64] WebAssembly Memory64 supported — allocatable: ${allocatable}`,
    )
  } else {
    console.info('[Memory64] WebAssembly Memory64 not supported in this browser')
  }

  return _cached
}

/** Clear the cached result (for testing). */
export function resetMemory64Cache(): void {
  _cached = null
}
