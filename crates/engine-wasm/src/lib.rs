use engine_core::graph::EngineGraph;
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

/// Return the engine version string.
#[wasm_bindgen]
pub fn get_engine_version() -> String {
    engine_core::catalog::engine_version().to_string()
}
