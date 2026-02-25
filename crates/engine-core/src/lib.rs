pub mod catalog;
pub mod error;
pub mod eval;
pub mod ops;
pub mod types;
pub mod validate;

use error::{EngineError, ErrorCode};
use types::{EngineSnapshotV1, EvalResult};

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
