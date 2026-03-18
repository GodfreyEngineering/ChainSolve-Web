//! `wasm_abi` — C-compatible ABI for WASM plugin modules (10.2).
//!
//! When compiled for `wasm32` targets, include this module and call
//! [`export_blocks!`] macro to expose the four required exports that the
//! ChainSolve runtime uses to discover and evaluate custom blocks.
//!
//! # ABI contract
//!
//! The host (TypeScript) calls in this order:
//!
//! 1. `cs_block_count() -> i32`
//!    Returns the number of blocks exported by this WASM module.
//!
//! 2. `cs_block_metadata_json(idx: i32, out_len: *mut i32) -> *const u8`
//!    Returns a pointer to a UTF-8 JSON string containing [`BlockMetadata`]
//!    for block `idx`. The host must copy the bytes before calling any
//!    other export. The string is owned by static memory — do not free it.
//!
//! 3. `cs_evaluate_json(block_idx: i32,
//!                      inputs_ptr: *const u8, inputs_len: i32,
//!                      out_len: *mut i32) -> *const u8`
//!    `inputs_ptr/len` points to a JSON object `Record<string, Value>`.
//!    Returns a pointer to a UTF-8 JSON string containing a `Value`.
//!
//! 4. `cs_alloc(len: i32) -> *mut u8`
//!    Allocate `len` bytes for the host to write input data into.
//!    The plugin owns this memory; the host must call `cs_free` after use.
//!
//! 5. `cs_free(ptr: *mut u8, len: i32)`
//!    Free memory previously allocated by `cs_alloc`.
//!
//! # Memory isolation
//!
//! Each WASM module has its own linear memory — the host never shares its
//! memory with the plugin and vice versa, providing natural sandboxing.
//!
//! # Using the macro
//!
//! ```no_run
//! use chainsolve_block_sdk::{Block, BlockRegistry, wasm_abi};
//!
//! // Build a registry containing your blocks:
//! fn build_registry() -> BlockRegistry {
//!     let mut reg = BlockRegistry::new();
//!     // reg.register(Box::new(MyBlock));
//!     reg
//! }
//!
//! // Generate the five WASM exports:
//! wasm_abi::export_blocks!(build_registry);
//! ```

#[allow(unused_imports)]
use crate::{BlockContext, BlockRegistry};

/// Generate the five C-ABI exports required by the ChainSolve plugin runtime.
///
/// Pass the name of a function that returns a populated `BlockRegistry`.
#[macro_export]
macro_rules! export_blocks {
    ($registry_fn:ident) => {
        mod __cs_plugin_abi {
            use super::$registry_fn;
            use std::collections::HashMap;
            use std::sync::OnceLock;
            use $crate::{BlockContext, BlockRegistry, Value};

            // ── Lazy registry singleton ──────────────────────────────────────
            static REGISTRY: OnceLock<BlockRegistry> = OnceLock::new();

            fn registry() -> &'static BlockRegistry {
                REGISTRY.get_or_init(|| $registry_fn())
            }

            // ── String cache: keyed by (block_idx, "metadata" | eval_result) ──
            // We store the last JSON result in a static so the host can copy it.
            static LAST_JSON: OnceLock<std::sync::Mutex<Vec<u8>>> = OnceLock::new();

            fn set_last_json(s: String) -> (*const u8, i32) {
                let bytes = s.into_bytes();
                let len = bytes.len() as i32;
                let mut guard = LAST_JSON
                    .get_or_init(|| std::sync::Mutex::new(Vec::new()))
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                *guard = bytes;
                (guard.as_ptr(), len)
            }

            // ── Block index helpers ──────────────────────────────────────────
            fn block_ids() -> Vec<String> {
                registry().ids().map(|s| s.to_string()).collect()
            }

            // ── Exports ─────────────────────────────────────────────────────

            #[no_mangle]
            pub extern "C" fn cs_block_count() -> i32 {
                registry().ids().count() as i32
            }

            /// # Safety
            /// `out_len` must be a valid writable i32 pointer.
            #[no_mangle]
            pub unsafe extern "C" fn cs_block_metadata_json(
                idx: i32,
                out_len: *mut i32,
            ) -> *const u8 {
                let ids = block_ids();
                let Some(id) = ids.get(idx as usize) else {
                    *out_len = 0;
                    return std::ptr::null();
                };
                let Some(block) = registry().get(id) else {
                    *out_len = 0;
                    return std::ptr::null();
                };
                let meta = block.metadata();
                let json = serde_json::to_string(&meta).unwrap_or_default();
                let (ptr, len) = set_last_json(json);
                *out_len = len;
                ptr
            }

            /// # Safety
            /// `inputs_ptr` must point to `inputs_len` valid UTF-8 bytes.
            /// `out_len` must be a valid writable i32 pointer.
            #[no_mangle]
            pub unsafe extern "C" fn cs_evaluate_json(
                block_idx: i32,
                inputs_ptr: *const u8,
                inputs_len: i32,
                out_len: *mut i32,
            ) -> *const u8 {
                let ids = block_ids();
                let Some(id) = ids.get(block_idx as usize) else {
                    let (ptr, len) = set_last_json(
                        r#"{"kind":"error","message":"[PLUGIN_ABI] block index out of range"}"#
                            .to_string(),
                    );
                    *out_len = len;
                    return ptr;
                };
                let Some(block) = registry().get(id) else {
                    let (ptr, len) = set_last_json(
                        r#"{"kind":"error","message":"[PLUGIN_ABI] block not found"}"#.to_string(),
                    );
                    *out_len = len;
                    return ptr;
                };

                // Deserialise inputs from JSON
                let inputs_bytes =
                    unsafe { std::slice::from_raw_parts(inputs_ptr, inputs_len as usize) };
                let inputs_json = match std::str::from_utf8(inputs_bytes) {
                    Ok(s) => s,
                    Err(_) => {
                        let (ptr, len) = set_last_json(
                            r#"{"kind":"error","message":"[PLUGIN_ABI] inputs not valid UTF-8"}"#
                                .to_string(),
                        );
                        *out_len = len;
                        return ptr;
                    }
                };
                let inputs: HashMap<String, Value> =
                    match serde_json::from_str(inputs_json) {
                        Ok(v) => v,
                        Err(e) => {
                            let (ptr, len) = set_last_json(format!(
                                r#"{{"kind":"error","message":"[PLUGIN_ABI] inputs parse error: {}"}}"#,
                                e
                            ));
                            *out_len = len;
                            return ptr;
                        }
                    };

                let data = HashMap::new();
                let ctx = BlockContext::new(&inputs, &data);
                let result = block.evaluate(&ctx);
                let json = serde_json::to_string(&result).unwrap_or_else(|e| {
                    format!(r#"{{"kind":"error","message":"[PLUGIN_ABI] serialize error: {}"}}"#, e)
                });
                let (ptr, len) = set_last_json(json);
                *out_len = len;
                ptr
            }

            /// # Safety
            /// Returns a pointer to a heap-allocated buffer of `len` bytes.
            /// Caller must pass the pointer back to `cs_free`.
            #[no_mangle]
            pub unsafe extern "C" fn cs_alloc(len: i32) -> *mut u8 {
                let mut v: Vec<u8> = Vec::with_capacity(len as usize);
                let ptr = v.as_mut_ptr();
                std::mem::forget(v);
                ptr
            }

            /// # Safety
            /// `ptr` must have been returned by `cs_alloc` with the same `len`.
            #[no_mangle]
            pub unsafe extern "C" fn cs_free(ptr: *mut u8, len: i32) {
                if !ptr.is_null() {
                    drop(unsafe { Vec::from_raw_parts(ptr, 0, len as usize) });
                }
            }
        }
    };
}
