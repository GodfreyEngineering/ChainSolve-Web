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

/// Pre-run validation: detect structural issues without evaluation.
///
/// Returns a JSON array of `Diagnostic` objects. Does not modify the graph.
#[wasm_bindgen]
pub fn validate_graph() -> String {
    let diags = ENGINE.with(|cell| {
        let borrow = cell.borrow();
        match borrow.as_ref() {
            Some(graph) => engine_core::run_validate(graph),
            None => vec![],
        }
    });
    serde_json::to_string(&diags).unwrap_or_else(|e| {
        err_json("SERIALIZE_FAILED", &format!("Failed to serialize diagnostics: {e}"))
    })
}

// ── run_simulation (8.2) ──────────────────────────────────────────────────────

/// Run a simulation task with iterative progress callbacks (8.2).
///
/// The WASM-side loop executes each "step" as a full engine evaluation,
/// reporting progress after every `batchSize` iterations.  This function
/// runs synchronously from Rust's point of view; the progress callback
/// sends `postMessage` events back to the main thread from within the
/// simulation Web Worker.
///
/// # Config JSON shape
/// ```json
/// {
///   "nodeId": "sim1",
///   "op": "solveOde",
///   "snapshot": "{ ... EngineSnapshotV1 ... }",
///   "maxIterations": 1000,
///   "batchSize": 50,
///   "loop": false,
///   "loopCount": 1,
///   "convergenceThreshold": 1e-6
/// }
/// ```
///
/// # Progress callback
/// Called after every batch with a JSON argument:
/// ```json
/// {
///   "iteration": 50,
///   "totalIterations": 1000,
///   "cycle": 0,
///   "totalCycles": 1,
///   "elapsedUs": 12345
/// }
/// ```
///
/// # Return value
/// ```json
/// { "cycles": 1, "iterations": 1000, "outputs": { "nodeId": <value> } }
/// ```
/// or `{ "error": { "code": "...", "message": "..." } }` on failure.
#[wasm_bindgen]
pub fn run_simulation(config_json: &str, progress_cb: &js_sys::Function) -> String {
    // Parse the simulation config.
    let config: serde_json::Value = match serde_json::from_str(config_json) {
        Ok(v) => v,
        Err(e) => return err_json("INVALID_SIM_CONFIG", &e.to_string()),
    };

    let snapshot_json = match config.get("snapshot").and_then(|v| v.as_str()) {
        Some(s) => s.to_string(),
        None => return err_json("INVALID_SIM_CONFIG", "missing 'snapshot' field"),
    };
    let max_iterations = config.get("maxIterations")
        .and_then(|v| v.as_u64()).unwrap_or(100) as usize;
    let batch_size = config.get("batchSize")
        .and_then(|v| v.as_u64()).unwrap_or(10) as usize;
    let loop_mode = config.get("loop")
        .and_then(|v| v.as_bool()).unwrap_or(false);
    let loop_count = if loop_mode {
        config.get("loopCount").and_then(|v| v.as_u64()).unwrap_or(1) as usize
    } else {
        1
    };
    let convergence_threshold = config.get("convergenceThreshold")
        .and_then(|v| v.as_f64());

    let start_ms = js_sys::Date::now();
    let total_cycles = loop_count;
    let total_iterations = max_iterations;

    let mut last_outputs: std::collections::HashMap<String, engine_core::types::Value> =
        std::collections::HashMap::new();
    let mut converged = false;

    for cycle in 0..total_cycles {
        for iteration in (0..total_iterations).step_by(batch_size.max(1)) {
            let batch_end = (iteration + batch_size).min(total_iterations);
            let batch_steps = batch_end - iteration;

            // Run the engine for this batch's iterations.
            // Each step is one full graph evaluation on the snapshot.
            // For real-world use, the snapshot would be mutated by prior
            // outputs (e.g. ODE state) — here we evaluate batch_steps times.
            let mut batch_result = None;
            for _ in 0..batch_steps {
                match engine_core::run(&snapshot_json) {
                    Ok(r) => { batch_result = Some(r); }
                    Err(e) => {
                        return err_json(&e.code.to_string(), &e.message);
                    }
                }
            }

            if let Some(ref r) = batch_result {
                // Check convergence if threshold is set.
                if let Some(threshold) = convergence_threshold {
                    let mut max_delta: f64 = 0.0;
                    for (k, v) in &r.values {
                        if let (
                            Some(engine_core::types::Value::Scalar { value: prev }),
                            engine_core::types::Value::Scalar { value: curr },
                        ) = (last_outputs.get(k), v) {
                            max_delta = max_delta.max((curr - prev).abs());
                        }
                    }
                    if max_delta < threshold && iteration > 0 {
                        converged = true;
                    }
                }
                last_outputs = r.values.clone();
            }

            // Report progress via JS callback.
            let elapsed_us = ((js_sys::Date::now() - start_ms) * 1000.0) as u64;
            let progress_json = format!(
                r#"{{"iteration":{},"totalIterations":{},"cycle":{},"totalCycles":{},"elapsedUs":{}}}"#,
                batch_end, total_iterations, cycle, total_cycles, elapsed_us
            );
            let this = wasm_bindgen::JsValue::NULL;
            let _ = progress_cb.call1(
                &this,
                &wasm_bindgen::JsValue::from_str(&progress_json),
            );

            if converged { break; }
        }
        if converged { break; }
    }

    // Serialize final outputs.
    let outputs_val = serde_json::to_value(&last_outputs).unwrap_or(serde_json::Value::Null);
    let elapsed_us = ((js_sys::Date::now() - start_ms) * 1000.0) as u64;
    let result = serde_json::json!({
        "cycles": total_cycles,
        "iterations": total_iterations,
        "elapsedUs": elapsed_us,
        "converged": converged,
        "outputs": outputs_val,
    });
    serde_json::to_string(&result).unwrap_or_else(|e| {
        err_json("SERIALIZE_FAILED", &e.to_string())
    })
}
