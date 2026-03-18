//! cuda.rs — Optional native CUDA path (1.43).
//!
//! Gated behind the `native-cuda` Cargo feature flag. When disabled (the
//! default, including all WASM builds) this module provides no-op stubs so
//! the rest of the engine can call into `cuda::` without `#[cfg]` noise at
//! every call-site.
//!
//! When `native-cuda` is enabled (server-side execution on NVIDIA hardware)
//! the stubs are replaced by real bindings to `cudarc` — see the `cuda-impl`
//! sub-module below. The cudarc crate is not included in WASM builds because:
//!   - it links against libcuda.so (NVIDIA driver) which is not available in
//!     a browser sandbox
//!   - the `native-cuda` feature is intentionally excluded from engine-wasm

// ── Public types ─────────────────────────────────────────────────────────────

/// Opaque handle to a CUDA device context.
/// On non-CUDA builds this is a zero-sized unit type.
#[derive(Debug)]
pub struct CudaContext(#[cfg(feature = "native-cuda")] CudaContextInner);

/// CUDA GEMM result; on non-CUDA builds always returns an error.
#[derive(Debug)]
pub enum CudaError {
    /// Native CUDA feature not compiled in.
    NotAvailable,
    /// CUDA runtime error (only produced on `native-cuda` builds).
    Runtime(String),
}

impl std::fmt::Display for CudaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CudaError::NotAvailable => write!(f, "CUDA not available (native-cuda feature disabled)"),
            CudaError::Runtime(msg) => write!(f, "CUDA runtime error: {msg}"),
        }
    }
}

// ── No-op stubs (all non-native-cuda builds, including WASM) ─────────────────

#[cfg(not(feature = "native-cuda"))]
impl CudaContext {
    /// Attempt to initialise CUDA — always fails when feature is disabled.
    pub fn new() -> Result<Self, CudaError> {
        Err(CudaError::NotAvailable)
    }

    /// Dense matrix multiply C = A × B.  Stub always returns NotAvailable.
    ///
    /// # Parameters
    /// - `a`: row-major f32 slice \[M × K\]
    /// - `b`: row-major f32 slice \[K × N\]
    /// - `m`, `k`, `n`: matrix dimensions
    pub fn gemm(
        &self,
        _a: &[f32],
        _b: &[f32],
        _m: usize,
        _k: usize,
        _n: usize,
    ) -> Result<Vec<f32>, CudaError> {
        Err(CudaError::NotAvailable)
    }

    /// Batch dense GEMM.  Stub always returns NotAvailable.
    pub fn batch_gemm(
        &self,
        _a: &[f32],
        _b: &[f32],
        _m: usize,
        _k: usize,
        _n: usize,
        _batch: usize,
    ) -> Result<Vec<f32>, CudaError> {
        Err(CudaError::NotAvailable)
    }

    /// Element-wise exponentiation of a vector.  Stub always returns NotAvailable.
    pub fn exp_vec(&self, _a: &[f32]) -> Result<Vec<f32>, CudaError> {
        Err(CudaError::NotAvailable)
    }

    /// Return true when a CUDA device is available (always false on stubs).
    pub fn is_available() -> bool {
        false
    }
}


// ── Real implementation (native-cuda feature) ─────────────────────────────────

#[cfg(feature = "native-cuda")]
struct CudaContextInner {
    // cudarc::CudaDevice is Send+Sync and manages the lifetime of the device.
    // Import deferred to avoid a compile-time dependency on cudarc when the
    // feature is off.
    device: std::sync::Arc<cudarc::driver::CudaDevice>,
}

#[cfg(feature = "native-cuda")]
impl CudaContext {
    pub fn new() -> Result<Self, CudaError> {
        use cudarc::driver::CudaDevice;
        let device = CudaDevice::new(0).map_err(|e| CudaError::Runtime(e.to_string()))?;
        Ok(CudaContext(CudaContextInner { device }))
    }

    pub fn gemm(
        &self,
        a: &[f32],
        b: &[f32],
        m: usize,
        k: usize,
        n: usize,
    ) -> Result<Vec<f32>, CudaError> {
        use cudarc::cublas::{CudaBlas, Gemm};
        let dev = &self.0.device;
        let a_dev = dev.htod_copy(a.to_vec()).map_err(|e| CudaError::Runtime(e.to_string()))?;
        let b_dev = dev.htod_copy(b.to_vec()).map_err(|e| CudaError::Runtime(e.to_string()))?;
        let mut c_dev = dev
            .alloc_zeros::<f32>(m * n)
            .map_err(|e| CudaError::Runtime(e.to_string()))?;
        let blas = CudaBlas::new(dev.clone()).map_err(|e| CudaError::Runtime(e.to_string()))?;
        unsafe {
            blas.gemm(
                cudarc::cublas::sys::cublasOperation_t::CUBLAS_OP_N,
                cudarc::cublas::sys::cublasOperation_t::CUBLAS_OP_N,
                n as i32, m as i32, k as i32,
                &1.0f32,
                &b_dev, n as i32,
                &a_dev, k as i32,
                &0.0f32,
                &mut c_dev, n as i32,
            ).map_err(|e| CudaError::Runtime(e.to_string()))?;
        }
        dev.dtoh_sync_copy(&c_dev).map_err(|e| CudaError::Runtime(e.to_string()))
    }

    pub fn batch_gemm(
        &self,
        a: &[f32],
        b: &[f32],
        m: usize,
        k: usize,
        n: usize,
        batch: usize,
    ) -> Result<Vec<f32>, CudaError> {
        // Placeholder: iterate over batches using single GEMM.
        // A real implementation would use cublasGemmStridedBatchedEx.
        let mut result = Vec::with_capacity(batch * m * n);
        for i in 0..batch {
            let a_b = &a[i * m * k..(i + 1) * m * k];
            let b_b = &b[i * k * n..(i + 1) * k * n];
            result.extend_from_slice(&self.gemm(a_b, b_b, m, k, n)?);
        }
        Ok(result)
    }

    pub fn exp_vec(&self, a: &[f32]) -> Result<Vec<f32>, CudaError> {
        // Placeholder — cuVEC / cuDNN element-wise exp.
        Ok(a.iter().map(|x| x.exp()).collect())
    }

    pub fn is_available() -> bool {
        true
    }
}
