# ADR-0018: WebGPU Acceleration Strategy

**Status:** Accepted
**Date:** 2026-03-17

---

## Context

ChainSolve's Rust/WASM compute engine performs well for small-to-medium block graphs, but a class of blocks — large matrix multiplications, covariance computations, FFT-based signal processing, and neural-network-style operations — exhibit O(n²) or O(n³) CPU scaling that becomes a bottleneck for inputs above a few hundred elements. A 1024×1024 matrix multiply on the CPU-side WASM engine takes approximately 3.8 seconds in Chrome on a modern laptop, far exceeding the 50 ms reactive evaluation budget.

WebGPU became available unflagged in Chrome 113 (May 2023) and Safari 18 (September 2024). It exposes compute shaders that can execute massively parallel workloads on the GPU, with significantly lower API overhead than WebGL. For matrix-heavy workloads, GPU execution offers 20-100× throughput improvements over single-threaded WASM on typical developer hardware.

The `wgpu` crate is a Rust-native WebGPU/Metal/Vulkan/DX12 abstraction layer that compiles to WASM and targets the WebGPU API in browser environments. Using `wgpu` keeps GPU logic inside the Rust engine codebase, avoids JavaScript-side shader management, and allows the same Rust code to target native GPU APIs during server-side or desktop builds.

Key constraints: (1) WebGPU is not universally available — Firefox support is behind a flag as of this writing, and many older/mobile GPUs expose no WebGPU adapter; (2) shader compilation is expensive (~100-400 ms for a non-trivial WGSL shader on first load) and must not occur in the hot path; (3) GPU acceleration must be transparent to block authors — a `MatMul` block should not require a "use GPU" checkbox.

---

## Decision

We adopt a **threshold-gated, auto-fallback GPU acceleration strategy** using the `wgpu` crate with WGSL compute shaders, behind the `webgpu` Cargo feature flag.

**Threshold:** GPU offloading is activated automatically when a matrix operation's input dimensions exceed **512×512 elements** (262,144 elements). Below this threshold, the CPU WASM path is faster after accounting for GPU dispatch overhead and data transfer costs. The threshold was determined empirically by benchmarking matrix multiply on three representative GPU tiers (integrated Intel, mid-range NVIDIA, M-series Apple Silicon) and selecting the crossover point where GPU wins on all three.

**Automatic CPU fallback:** At engine initialization, `wgpu::Instance::request_adapter()` is called. If no WebGPU adapter is available (unsupported browser, no GPU, or user opted out), the engine sets `gpu_available = false` and all operations route to the CPU path permanently for the session. No error is surfaced to the user. If a WebGPU adapter is available, the engine initializes a `wgpu::Device` and `wgpu::Queue` and marks `gpu_available = true`.

**WGSL compute shaders** implement the following operations in the initial release:
- General matrix multiply (GEMM) — tiled 16×16 workgroup layout
- Batch matrix multiply
- Element-wise operations (add, multiply, ReLU, sigmoid) for large vectors
- Reduction operations (sum, max, softmax) along an axis

Shaders are written in WGSL and compiled at runtime via `wgpu::Device::create_shader_module()`. The compiled `wgpu::ShaderModule` objects are cached in a `HashMap<ShaderKey, Arc<ShaderModule>>` within the engine, keyed by a hash of the WGSL source. This in-memory cache prevents recompilation across evaluations within a session.

**Persistent shader cache via IndexedDB:** WGSL compilation is expensive on first load. Compiled pipeline state objects are serialized and stored in IndexedDB under the key `chainsolve-shader-cache-v{VERSION}`. On engine initialization, the cache is read and pipeline state is restored if the stored version matches the current shader source hash. Cache invalidation occurs on version mismatch or when the user clears site data.

**Data transfer management:** Input tensors above the GPU threshold are written to GPU buffers via `wgpu::Queue::write_buffer()`. For streaming simulation data, output is kept resident on the GPU between simulation steps and only transferred to CPU when a UI visualization frame is due, minimising round-trip costs.

---

## Consequences

**Positive:**
- Matrix operations above 512×512 are 20-80× faster on GPU, bringing 1024×1024 multiply from ~3.8 s to ~55 ms.
- Automatic fallback means WebGPU unavailability is invisible to users — the engine degrades gracefully.
- Shader compilation cache in IndexedDB eliminates the ~300 ms first-compile penalty on repeat sessions.
- All GPU logic lives in the Rust engine codebase. Block authors write pure Rust tensor operations; GPU dispatch is a transparent implementation detail.
- The `wgpu` abstraction supports native targets (Vulkan, Metal, DX12) for future CLI or desktop builds without shader rewrites.

**Negative / risks:**
- IndexedDB pipeline cache serialization format may change across `wgpu` versions. Upgrading `wgpu` may invalidate cached pipelines, forcing cold-start recompile for all users on the next session. The version key mitigates this but cannot prevent the cold-start cost.
- The 512×512 threshold is hardware-agnostic. On very low-end integrated GPUs, the crossover may be higher. A runtime benchmark at initialization to calibrate per-device thresholds would be more accurate but adds ~200 ms to startup time.
- GPU buffer reuse by shape assumes tensor shapes are stable across evaluations. Reactive evaluation of graphs where matrix dimensions change frequently will trigger buffer reallocation on each evaluation.
- WebGPU is not available in Firefox without a flag (as of this decision date). Firefox users silently receive CPU-only computation.
- WGSL is a newer shading language with a smaller ecosystem than GLSL/HLSL. Debugging GPU compute shaders requires browser-specific tooling and is significantly harder than debugging CPU Rust code.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| WebGL2 compute (GPGPU via fragment shaders) | WebGL2 has no native compute shader support; GPGPU via fragment shaders is fragile, limited to 2D data layouts, and substantially slower than WebGPU compute for reduction operations. |
| WASM SIMD (128-bit fixed-width) | SIMD provides 4-8× speedup for element-wise operations but does not approach GPU parallelism for large matrix multiply. Complementary to WebGPU, not a replacement. |
| TensorFlow.js / ONNX Runtime Web | Large runtime dependencies (~2-8 MB additional JS), opinionated tensor abstractions that don't map cleanly to ChainSolve's block model, and no way to call from within the WASM engine without crossing the JS boundary. |
| Server-side GPU via Supabase Edge Functions | Acceptable latency only for batch workloads; interactive reactive evaluation (50 ms budget) cannot tolerate a network round-trip. Server GPU remains a future option for offline batch export. |
| cudarc (CUDA, native only) | CUDA is NVIDIA-only and does not compile to WASM. Appropriate only for a future server-side or desktop-native execution path behind a separate feature flag. |
