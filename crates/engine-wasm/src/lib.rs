//! WASM boundary wrapper for `engine-core`.
//!
//! All public functions are annotated with `#[wasm_bindgen]` and are
//! callable from JavaScript. The JSON string I/O contract means the TypeScript
//! side never touches Rust-allocated memory directly — it only passes and
//! receives `String` values across the boundary.
//!
//! # Thread model
//!
//! WASM is single-threaded. The persistent [`EngineGraph`] is stored in a
//! `thread_local!` `RefCell<Option<EngineGraph>>`. The `with_engine` helper
//! lazily initialises it on first use.
//!
//! # Startup
//!
//! [`init`] is marked `#[wasm_bindgen(start)]` and runs automatically when
//! the WASM module is instantiated. It installs `console_error_panic_hook`
//! so Rust panics appear as readable messages in the browser console.

use engine_core::graph::{EngineGraph, EvalSignal};
use engine_core::types::EvalOptions;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

thread_local! {
    static ENGINE: RefCell<Option<EngineGraph>> = RefCell::new(None);
}

fn with_engine<F, R>(f: F) -> R
where
    F: FnOnce(&mut EngineGraph) -> R,
{
    ENGINE.with(|cell| {
        let mut borrow = cell.borrow_mut();
        let graph = borrow.get_or_insert_with(EngineGraph::new);
        f(graph)
    })
}

fn err_json(code: &str, message: &str) -> String {
    format!(r#"{{"error":{{"code":"{code}","message":"{message}"}}}}"#)
}

/// One-time setup: install better panic messages.
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

/// Evaluate a graph snapshot (JSON string in → JSON string out).
///
/// Input: `EngineSnapshotV1` as JSON.
/// Output: `EvalResult` as JSON (values + diagnostics + timing).
///
/// On fatal errors (bad JSON, wrong version) the returned JSON has
/// shape `{ "error": { "code": "...", "message": "..." } }`.
#[wasm_bindgen]
pub fn evaluate(snapshot_json: &str) -> String {
    match engine_core::run(snapshot_json) {
        Ok(result) => serde_json::to_string(&result).unwrap_or_else(|e| {
            err_json("SERIALIZE_FAILED", &e.to_string())
        }),
        Err(err) => err_json(&err.code.to_string(), &err.message),
    }
}

/// Load a full snapshot into the persistent engine graph.
/// Returns `EvalResult` JSON (full values for all nodes).
#[wasm_bindgen]
pub fn load_snapshot(snapshot_json: &str) -> String {
    with_engine(|graph| {
        match engine_core::run_load_snapshot(graph, snapshot_json) {
            Ok(result) => serde_json::to_string(&result).unwrap_or_else(|e| {
                err_json("SERIALIZE_FAILED", &e.to_string())
            }),
            Err(err) => err_json(&err.code.to_string(), &err.message),
        }
    })
}

/// Apply a JSON patch to the persistent engine graph.
/// Returns `IncrementalEvalResult` JSON (only changed values).
#[wasm_bindgen]
pub fn apply_patch(patch_json: &str) -> String {
    with_engine(|graph| {
        match engine_core::run_patch(graph, patch_json) {
            Ok(result) => serde_json::to_string(&result).unwrap_or_else(|e| {
                err_json("SERIALIZE_FAILED", &e.to_string())
            }),
            Err(err) => err_json(&err.code.to_string(), &err.message),
        }
    })
}

/// Load a snapshot with eval options (trace, time budget) and a JS progress callback.
/// The `progress_cb` is a JS function(evaluated, total) called after each node.
#[wasm_bindgen]
pub fn load_snapshot_with_options(
    snapshot_json: &str,
    options_json: &str,
    progress_cb: &js_sys::Function,
) -> String {
    let opts: EvalOptions = match serde_json::from_str(options_json) {
        Ok(o) => o,
        Err(e) => return err_json("INVALID_OPTIONS", &e.to_string()),
    };

    let start = js_sys::Date::now();
    let budget_ms = opts.time_budget_ms;
    let cb = progress_cb;

    with_engine(|graph| {
        let result = engine_core::run_load_snapshot_with_options(
            graph,
            snapshot_json,
            &opts,
            |evaluated, total| {
                // Check time budget.
                if budget_ms > 0 {
                    let elapsed = js_sys::Date::now() - start;
                    if elapsed >= budget_ms as f64 {
                        return EvalSignal::Abort;
                    }
                }
                // Call JS progress callback.
                let this = JsValue::NULL;
                let _ = cb.call2(
                    &this,
                    &JsValue::from(evaluated as f64),
                    &JsValue::from(total as f64),
                );
                EvalSignal::Continue
            },
        );

        match result {
            Ok(mut r) => {
                let elapsed_ms = js_sys::Date::now() - start;
                r.elapsed_us = (elapsed_ms * 1000.0) as u64;
                serde_json::to_string(&r).unwrap_or_else(|e| {
                    err_json("SERIALIZE_FAILED", &e.to_string())
                })
            }
            Err(err) => err_json(&err.code.to_string(), &err.message),
        }
    })
}

/// Apply a JSON patch with eval options (trace, time budget) and a JS progress callback.
/// The `progress_cb` is a JS function(evaluated, total) called after each node.
#[wasm_bindgen]
pub fn apply_patch_with_options(
    patch_json: &str,
    options_json: &str,
    progress_cb: &js_sys::Function,
) -> String {
    let opts: EvalOptions = match serde_json::from_str(options_json) {
        Ok(o) => o,
        Err(e) => return err_json("INVALID_OPTIONS", &e.to_string()),
    };

    let start = js_sys::Date::now();
    let budget_ms = opts.time_budget_ms;
    let cb = progress_cb;

    with_engine(|graph| {
        let result = engine_core::run_patch_with_options(
            graph,
            patch_json,
            &opts,
            |evaluated, total| {
                // Check time budget.
                if budget_ms > 0 {
                    let elapsed = js_sys::Date::now() - start;
                    if elapsed >= budget_ms as f64 {
                        return EvalSignal::Abort;
                    }
                }
                // Call JS progress callback.
                let this = JsValue::NULL;
                let _ = cb.call2(
                    &this,
                    &JsValue::from(evaluated as f64),
                    &JsValue::from(total as f64),
                );
                EvalSignal::Continue
            },
        );

        match result {
            Ok(mut r) => {
                let elapsed_ms = js_sys::Date::now() - start;
                r.elapsed_us = (elapsed_ms * 1000.0) as u64;
                serde_json::to_string(&r).unwrap_or_else(|e| {
                    err_json("SERIALIZE_FAILED", &e.to_string())
                })
            }
            Err(err) => err_json(&err.code.to_string(), &err.message),
        }
    })
}

/// Set a manual input value on a node port.
/// Returns `IncrementalEvalResult` JSON (only changed values).
#[wasm_bindgen]
pub fn set_input(node_id: &str, port_id: &str, value: f64) -> String {
    with_engine(|graph| {
        let result = engine_core::run_set_input(graph, node_id, port_id, value);
        serde_json::to_string(&result).unwrap_or_else(|e| {
            err_json("SERIALIZE_FAILED", &e.to_string())
        })
    })
}

/// Register a dataset (large numeric array) by id.
/// The data is stored in the engine graph for use by data blocks.
#[wasm_bindgen]
pub fn register_dataset(id: &str, data: &[f64]) {
    with_engine(|graph| {
        graph.register_dataset(id.to_string(), data.to_vec());
    })
}

/// Release (remove) a dataset from the engine graph.
#[wasm_bindgen]
pub fn release_dataset(id: &str) {
    with_engine(|graph| {
        graph.release_dataset(id);
    })
}

/// Return the ops catalog as a JSON array of CatalogEntry objects.
#[wasm_bindgen]
pub fn get_catalog() -> String {
    engine_core::catalog::catalog_json()
}

/// Return pre-computed constant values for zero-input source blocks.
/// JSON object: { opId: number, ... }.
#[wasm_bindgen]
pub fn get_constant_values() -> String {
    engine_core::catalog::constant_values_json()
}

/// Return the engine version string.
#[wasm_bindgen]
pub fn get_engine_version() -> String {
    engine_core::catalog::engine_version().to_string()
}

/// Return the engine contract version.
#[wasm_bindgen]
pub fn get_engine_contract_version() -> u32 {
    engine_core::catalog::engine_contract_version()
}

/// Return the number of registered datasets (dev diagnostics).
#[wasm_bindgen]
pub fn dataset_count() -> usize {
    with_engine(|graph| graph.dataset_count())
}

/// Return total bytes used by registered datasets (dev diagnostics).
#[wasm_bindgen]
pub fn dataset_total_bytes() -> usize {
    with_engine(|graph| graph.dataset_total_bytes())
}
