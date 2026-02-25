use wasm_bindgen::prelude::*;

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
            format!(r#"{{"error":{{"code":"SERIALIZE_FAILED","message":"{}"}}}}"#, e)
        }),
        Err(err) => {
            format!(
                r#"{{"error":{{"code":"{}","message":"{}"}}}}"#,
                err.code, err.message
            )
        }
    }
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
