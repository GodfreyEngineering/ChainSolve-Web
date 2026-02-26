//! Shared data types for the engine ↔ WASM boundary.
//!
//! # Value
//!
//! [`Value`] is the polymorphic output of every node evaluation:
//!
//! - `Scalar(f64)` — single number. NaN and ±Inf are valid (they propagate).
//! - `Vector(Vec<f64>)` — ordered list of numbers.
//! - `Table { columns, rows }` — typed column names + row data.
//! - `Error(String)` — propagates downstream; no further computation on this path.
//!
//! # Snapshot contract
//!
//! [`EngineSnapshotV1`] is the stable, versioned input format sent from the
//! TypeScript UI (via `src/engine/bridge.ts`) to the engine. `version` must
//! be `1`; breaking schema changes require a new version struct.

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

    pub fn as_vector(&self) -> Option<&Vec<f64>> {
        match self {
            Value::Vector { value } => Some(value),
            _ => None,
        }
    }

    pub fn as_table(&self) -> Option<(&Vec<String>, &Vec<Vec<f64>>)> {
        match self {
            Value::Table { columns, rows } => Some((columns, rows)),
            _ => None,
        }
    }

    pub fn is_error(&self) -> bool {
        matches!(self, Value::Error { .. })
    }

    /// Returns the kind tag as a string for error messages.
    pub fn kind_str(&self) -> &'static str {
        match self {
            Value::Scalar { .. } => "scalar",
            Value::Vector { .. } => "vector",
            Value::Table { .. } => "table",
            Value::Error { .. } => "error",
        }
    }

    /// Compact summary for trace serialization (large vectors/tables summarized).
    pub fn summarize(&self) -> ValueSummary {
        match self {
            Value::Scalar { value } => ValueSummary::Scalar { value: *value },
            Value::Vector { value } => ValueSummary::Vector {
                length: value.len(),
                sample: value.iter().take(5).copied().collect(),
            },
            Value::Table { columns, rows } => ValueSummary::Table {
                rows: rows.len(),
                columns: columns.len(),
            },
            Value::Error { message } => ValueSummary::Error {
                message: message.clone(),
            },
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
    /// Audit trace (only present when `options.trace = true`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<Vec<TraceEntry>>,
    /// True if evaluation was cut short by time budget.
    #[serde(default)]
    pub partial: bool,
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

// ── Incremental evaluation result ────────────────────────────────────

/// Result of an incremental (dirty-only) evaluation.
/// Contains only the values that changed, not the full graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncrementalEvalResult {
    /// Only nodes that were re-evaluated and produced a value.
    pub changed_values: HashMap<String, Value>,
    pub diagnostics: Vec<Diagnostic>,
    pub elapsed_us: u64,
    pub evaluated_count: usize,
    pub total_count: usize,
    /// Audit trace (only present when `options.trace = true`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<Vec<TraceEntry>>,
    /// True if evaluation was cut short by time budget.
    #[serde(default)]
    pub partial: bool,
}

// ── Evaluation options ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvalOptions {
    /// Enable audit trace collection.
    #[serde(default)]
    pub trace: bool,
    /// Max number of nodes to include in trace (default: unlimited).
    #[serde(default)]
    pub max_trace_nodes: Option<usize>,
    /// Time budget in milliseconds. 0 = no budget.
    #[serde(default)]
    pub time_budget_ms: u64,
}

impl Default for EvalOptions {
    fn default() -> Self {
        Self {
            trace: false,
            max_trace_nodes: None,
            time_budget_ms: 0,
        }
    }
}

// ── Audit trace ─────────────────────────────────────────────────────

/// Compact summary of a Value for trace serialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ValueSummary {
    Scalar { value: f64 },
    Vector { length: usize, sample: Vec<f64> },
    Table { rows: usize, columns: usize },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEntry {
    pub node_id: String,
    pub op_id: String,
    /// Input summaries: port_id → ValueSummary.
    pub inputs: HashMap<String, ValueSummary>,
    /// Output summary.
    pub output: ValueSummary,
    /// Node-level diagnostics (if any).
    pub diagnostics: Vec<Diagnostic>,
}
