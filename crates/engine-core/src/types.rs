use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Graph snapshot (versioned, deterministic) ──────────────────────

/// Stable, versioned engine input format.
/// The web app converts its React Flow graph into this structure
/// before sending it to the engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineSnapshotV1 {
    /// Must be `1`.
    pub version: u32,
    pub nodes: Vec<NodeDef>,
    pub edges: Vec<EdgeDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeDef {
    pub id: String,
    pub block_type: String,
    /// Opaque per-node data (e.g. `{ "value": 3.0 }` for a number block).
    #[serde(default)]
    pub data: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeDef {
    pub id: String,
    pub source: String,
    pub source_handle: String,
    pub target: String,
    pub target_handle: String,
}

// ── Value type (mirrors TS Value discriminated union) ──────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Value {
    Scalar { value: f64 },
    Vector { value: Vec<f64> },
    Table { columns: Vec<String>, rows: Vec<Vec<f64>> },
    Error { message: String },
}

impl Value {
    pub fn scalar(v: f64) -> Self {
        Value::Scalar { value: v }
    }

    pub fn error(msg: impl Into<String>) -> Self {
        Value::Error { message: msg.into() }
    }

    pub fn as_scalar(&self) -> Option<f64> {
        match self {
            Value::Scalar { value } => Some(*value),
            _ => None,
        }
    }
}

// ── Evaluation result ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvalResult {
    /// Computed value per node id.
    pub values: HashMap<String, Value>,
    /// Structured diagnostics.
    pub diagnostics: Vec<Diagnostic>,
    /// Wall-clock evaluation time in microseconds.
    pub elapsed_us: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    /// Node id this diagnostic relates to, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    pub level: DiagLevel,
    /// Machine-readable error code (e.g. "CYCLE_DETECTED", "UNKNOWN_BLOCK").
    pub code: String,
    /// Human-friendly message.
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagLevel {
    Info,
    Warning,
    Error,
}
