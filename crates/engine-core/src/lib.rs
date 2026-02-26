//! `engine-core` — pure Rust compute engine.
//!
//! No WASM, no JS, no I/O. All inputs and outputs are plain Rust types
//! (serialisable to JSON via serde for the WASM boundary in `engine-wasm`).
//!
//! # Modules
//!
//! - [`catalog`]  — ops catalog: metadata for every block type, version constants
//! - [`types`]    — shared data types: `Value`, `EngineSnapshotV1`, eval results
//! - [`ops`]      — per-node evaluation dispatch (~60 block types)
//! - [`graph`]    — persistent `EngineGraph` with dirty-tracking and `PatchOp` protocol
//! - [`eval`]     — stateless full-graph evaluation (Kahn's topological sort)
//! - [`validate`] — graph validation (version check, dangling edges)
//! - [`error`]    — error types (`EngineError`, `ErrorCode`)
//!
//! # Entry points (called by `engine-wasm`)
//!
//! - [`run`]                       — one-shot snapshot evaluation
//! - [`run_load_snapshot`]         — load snapshot into persistent `EngineGraph`, full eval
//! - [`run_patch`]                 — apply `PatchOp[]` to persistent graph, incremental eval
//! - [`run_set_input`]             — override one node input, incremental eval
//! - [`run_load_snapshot_with_options`] — load with eval options + progress callback
//! - [`run_patch_with_options`]    — patch with eval options + progress callback

pub mod catalog;
pub mod error;
pub mod eval;
pub mod graph;
pub mod ops;
pub mod types;
pub mod validate;

use error::{EngineError, ErrorCode};
use graph::{EvalSignal, PatchOp};
use types::{EngineSnapshotV1, EvalOptions, EvalResult, IncrementalEvalResult};

/// Top-level public API: validate + evaluate a JSON snapshot.
///
/// Returns a structured `EvalResult` with values, diagnostics, and timing.
/// Returns `Err` only for fatal issues (bad version, invalid JSON).
pub fn run(snapshot_json: &str) -> Result<EvalResult, EngineError> {
    let snapshot: EngineSnapshotV1 = serde_json::from_str(snapshot_json).map_err(|e| {
        EngineError::new(
            ErrorCode::InvalidSnapshot,
            format!("Failed to parse snapshot: {}", e),
        )
    })?;

    let mut diags = validate::validate(&snapshot)?;
    let mut result = eval::evaluate(&snapshot);
    result.diagnostics.append(&mut diags);

    Ok(result)
}

/// Load a snapshot into an EngineGraph and perform a full evaluation.
/// Returns an EvalResult with all values.
pub fn run_load_snapshot(
    graph: &mut graph::EngineGraph,
    snapshot_json: &str,
) -> Result<EvalResult, EngineError> {
    let snapshot: EngineSnapshotV1 = serde_json::from_str(snapshot_json).map_err(|e| {
        EngineError::new(
            ErrorCode::InvalidSnapshot,
            format!("Failed to parse snapshot: {}", e),
        )
    })?;

    validate::validate(&snapshot)?;
    graph.load_snapshot(snapshot);
    let inc = graph.evaluate_dirty();

    Ok(EvalResult {
        values: inc.changed_values,
        diagnostics: inc.diagnostics,
        elapsed_us: inc.elapsed_us,
        trace: inc.trace,
        partial: inc.partial,
    })
}

/// Apply a JSON patch to an existing EngineGraph and return incremental results.
pub fn run_patch(
    graph: &mut graph::EngineGraph,
    patch_json: &str,
) -> Result<IncrementalEvalResult, EngineError> {
    let ops: Vec<PatchOp> = serde_json::from_str(patch_json).map_err(|e| {
        EngineError::new(
            ErrorCode::InvalidSnapshot,
            format!("Failed to parse patch: {}", e),
        )
    })?;

    graph.apply_patch(ops);
    Ok(graph.evaluate_dirty())
}

/// Set a manual input on a node and return incremental results.
pub fn run_set_input(
    graph: &mut graph::EngineGraph,
    node_id: &str,
    port_id: &str,
    value: f64,
) -> IncrementalEvalResult {
    graph.set_input(node_id, port_id, value);
    graph.evaluate_dirty()
}

/// Load a snapshot with eval options and a progress callback.
pub fn run_load_snapshot_with_options<F>(
    graph: &mut graph::EngineGraph,
    snapshot_json: &str,
    opts: &EvalOptions,
    on_progress: F,
) -> Result<EvalResult, EngineError>
where
    F: FnMut(usize, usize) -> EvalSignal,
{
    let snapshot: EngineSnapshotV1 = serde_json::from_str(snapshot_json).map_err(|e| {
        EngineError::new(
            ErrorCode::InvalidSnapshot,
            format!("Failed to parse snapshot: {}", e),
        )
    })?;

    validate::validate(&snapshot)?;
    graph.load_snapshot(snapshot);
    let inc = graph.evaluate_dirty_with_callback(opts, on_progress);

    Ok(EvalResult {
        values: inc.changed_values,
        diagnostics: inc.diagnostics,
        elapsed_us: inc.elapsed_us,
        trace: inc.trace,
        partial: inc.partial,
    })
}

/// Apply a JSON patch with eval options and a progress callback.
pub fn run_patch_with_options<F>(
    graph: &mut graph::EngineGraph,
    patch_json: &str,
    opts: &EvalOptions,
    on_progress: F,
) -> Result<IncrementalEvalResult, EngineError>
where
    F: FnMut(usize, usize) -> EvalSignal,
{
    let ops: Vec<PatchOp> = serde_json::from_str(patch_json).map_err(|e| {
        EngineError::new(
            ErrorCode::InvalidSnapshot,
            format!("Failed to parse patch: {}", e),
        )
    })?;

    graph.apply_patch(ops);
    Ok(graph.evaluate_dirty_with_callback(opts, on_progress))
}
