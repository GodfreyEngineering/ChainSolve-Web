//! chainsolve-desktop — Tauri application library
//!
//! Provides:
//! - Native Tauri commands for offline graph evaluation (`eval_snapshot`, `eval_patch`)
//! - File system helpers (`open_project_file`, `save_project_file`)
//! - CUDA availability detection (`cuda_available`, `cuda_device_info`)
//! - App info commands (`app_version`, `platform_info`)
//!
//! The WASM engine is not used in the desktop app. Instead, `engine_core::run()`
//! is called directly on the native Rust binary, giving full CPU performance
//! and optional CUDA acceleration without a WebAssembly sandbox.

use tauri::{AppHandle, Manager};

// ---------------------------------------------------------------------------
// Engine evaluation commands
// ---------------------------------------------------------------------------

/// Evaluate a graph snapshot (full eval). Used when loading a project offline.
///
/// # Arguments
/// * `snapshot_json` — serialised `EngineSnapshotV1` JSON string
///
/// # Returns
/// Serialised `EvalResult` JSON, or an error string.
#[tauri::command]
fn eval_snapshot(snapshot_json: String) -> Result<String, String> {
    engine_core::run(&snapshot_json)
        .map(|result| serde_json::to_string(&result).unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Apply a JSON patch to an existing engine graph and return incremental results.
///
/// The engine graph state is stored in thread-local storage keyed by `session_id`.
#[tauri::command]
fn eval_patch(session_id: String, patch_json: String) -> Result<String, String> {
    SESSIONS.with(|sessions| {
        let mut map = sessions.borrow_mut();
        let graph = map
            .entry(session_id)
            .or_insert_with(engine_core::graph::EngineGraph::default);

        engine_core::run_patch(graph, &patch_json)
            .map(|result| serde_json::to_string(&result).unwrap_or_default())
            .map_err(|e| e.to_string())
    })
}

/// Load a snapshot into a session graph and perform a full evaluation.
#[tauri::command]
fn eval_load_snapshot(session_id: String, snapshot_json: String) -> Result<String, String> {
    SESSIONS.with(|sessions| {
        let mut map = sessions.borrow_mut();
        let graph = map
            .entry(session_id)
            .or_insert_with(engine_core::graph::EngineGraph::default);

        engine_core::run_load_snapshot(graph, &snapshot_json)
            .map(|result| serde_json::to_string(&result).unwrap_or_default())
            .map_err(|e| e.to_string())
    })
}

/// Release a session graph from memory.
#[tauri::command]
fn close_session(session_id: String) {
    SESSIONS.with(|sessions| {
        sessions.borrow_mut().remove(&session_id);
    });
}

// Thread-local session storage: session_id → EngineGraph
use std::cell::RefCell;
use std::collections::HashMap;

thread_local! {
    static SESSIONS: RefCell<HashMap<String, engine_core::graph::EngineGraph>> =
        RefCell::new(HashMap::new());
}

// ---------------------------------------------------------------------------
// CUDA commands
// ---------------------------------------------------------------------------

/// Returns `true` if a CUDA-capable GPU is available on this machine.
#[tauri::command]
fn cuda_available() -> bool {
    #[cfg(feature = "cuda")]
    {
        engine_core::cuda::is_cuda_available()
    }
    #[cfg(not(feature = "cuda"))]
    {
        false
    }
}

/// Returns device info for the first CUDA GPU, or null if not available.
#[tauri::command]
fn cuda_device_info() -> Option<serde_json::Value> {
    #[cfg(feature = "cuda")]
    {
        engine_core::cuda::device_info().ok().map(|info| {
            serde_json::json!({
                "name": info.name,
                "total_memory_mb": info.total_memory / 1_048_576,
                "compute_capability": format!("{}.{}", info.major, info.minor),
            })
        })
    }
    #[cfg(not(feature = "cuda"))]
    {
        None
    }
}

// ---------------------------------------------------------------------------
// App info commands
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
struct PlatformInfo {
    os: String,
    arch: String,
    version: String,
    cuda: bool,
}

#[tauri::command]
fn platform_info(_app: AppHandle) -> PlatformInfo {
    PlatformInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        cuda: cfg!(feature = "cuda"),
    }
}

// ---------------------------------------------------------------------------
// Tauri app setup
// ---------------------------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance is launched, focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            eval_snapshot,
            eval_patch,
            eval_load_snapshot,
            close_session,
            cuda_available,
            cuda_device_info,
            platform_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ChainSolve desktop");
}
