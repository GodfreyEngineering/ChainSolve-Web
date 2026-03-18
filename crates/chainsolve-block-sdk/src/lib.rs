//! `chainsolve-block-sdk` — SDK for authoring custom ChainSolve blocks.
//!
//! # Overview
//!
//! This crate provides the [`Block`] trait and supporting types that let
//! third-party authors write custom computation blocks compilable to both
//! native Rust and WebAssembly.
//!
//! A block is a stateless, pure function from a map of named input [`Value`]s
//! to a single output [`Value`]. Authors implement three methods:
//!
//! - [`Block::metadata`] — returns the block's display name, category, port
//!   schema, and description. This is used by the UI to register the block in
//!   the palette.
//! - [`Block::validate`] — optional pre-eval schema check; returns a list of
//!   [`Diagnostic`]s (may be empty if valid).
//! - [`Block::evaluate`] — pure computation; receives resolved inputs, returns
//!   the output [`Value`].
//!
//! # Quick start
//!
//! ```rust
//! use chainsolve_block_sdk::{Block, BlockMetadata, BlockContext, PortDef, Value};
//! use std::collections::HashMap;
//!
//! struct DoubleBlock;
//!
//! impl Block for DoubleBlock {
//!     fn metadata(&self) -> BlockMetadata {
//!         BlockMetadata {
//!             id: "my_double".into(),
//!             label: "Double".into(),
//!             category: "math".into(),
//!             inputs: vec![PortDef { id: "x".into(), label: "x".into() }],
//!             description: "Multiply input by 2".into(),
//!         }
//!     }
//!
//!     fn evaluate(&self, ctx: &BlockContext) -> Value {
//!         let x = ctx.scalar("x").unwrap_or(0.0);
//!         Value::Scalar { value: x * 2.0 }
//!     }
//! }
//! ```
//!
//! # Compiling to WASM
//!
//! Add `wasm-bindgen` to your block crate and wrap the block with the
//! `#[wasm_block]` proc-macro (coming in a future SDK version). The SDK
//! itself has no dependency on `wasm-bindgen` so it can be used from
//! both native tests and browser contexts.

pub use engine_core::types::Value;

pub mod wasm_abi;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Port definitions ──────────────────────────────────────────────────────────

/// Schema definition for one input or output port.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortDef {
    /// Stable port identifier (e.g. `"x"`, `"in_0"`).
    pub id: String,
    /// Human-readable label shown in the UI.
    pub label: String,
}

// ── Block metadata ────────────────────────────────────────────────────────────

/// Static metadata returned by [`Block::metadata`].
///
/// This structure is used by the ChainSolve UI to register the block in the
/// block palette and to validate wired graphs before evaluation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockMetadata {
    /// Globally unique, stable identifier for this block type.
    /// Use reverse-domain notation: `"com.example.my_block"`.
    pub id: String,
    /// Display name shown in the block palette and on the canvas.
    pub label: String,
    /// Palette category (e.g. `"math"`, `"signal"`, `"data"`).
    pub category: String,
    /// Ordered list of input port definitions.
    pub inputs: Vec<PortDef>,
    /// Short description for the block palette tooltip.
    pub description: String,
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

/// Severity of a validation diagnostic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

/// A single validation message returned by [`Block::validate`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub severity: Severity,
    /// The port ID this diagnostic refers to, or `None` for node-level issues.
    pub port: Option<String>,
    /// Human-readable message.
    pub message: String,
}

impl Diagnostic {
    pub fn error(message: impl Into<String>) -> Self {
        Diagnostic { severity: Severity::Error, port: None, message: message.into() }
    }
    pub fn warning(message: impl Into<String>) -> Self {
        Diagnostic { severity: Severity::Warning, port: None, message: message.into() }
    }
    pub fn port_error(port: impl Into<String>, message: impl Into<String>) -> Self {
        Diagnostic {
            severity: Severity::Error,
            port: Some(port.into()),
            message: message.into(),
        }
    }
}

// ── Evaluation context ────────────────────────────────────────────────────────

/// Resolved inputs and node data passed to [`Block::evaluate`].
///
/// The `BlockContext` is provided by the ChainSolve engine for each
/// evaluation call. It gives type-safe access to:
/// - Input port values (resolved by the engine from upstream nodes)
/// - Node-level configuration data (`data` from the graph snapshot)
pub struct BlockContext<'a> {
    /// Resolved input values keyed by port ID.
    pub inputs: &'a HashMap<String, Value>,
    /// Node configuration data (from the `data` field in the snapshot).
    pub data: &'a HashMap<String, serde_json::Value>,
}

impl<'a> BlockContext<'a> {
    /// Create a new context (used by the engine, not typically by block authors).
    pub fn new(
        inputs: &'a HashMap<String, Value>,
        data: &'a HashMap<String, serde_json::Value>,
    ) -> Self {
        BlockContext { inputs, data }
    }

    /// Get the scalar value of an input port, or `None` if missing / wrong type.
    pub fn scalar(&self, port: &str) -> Option<f64> {
        match self.inputs.get(port)? {
            Value::Scalar { value } => Some(*value),
            _ => None,
        }
    }

    /// Get the vector value of an input port.
    pub fn vector(&self, port: &str) -> Option<&[f64]> {
        match self.inputs.get(port)? {
            Value::Vector { value } => Some(value),
            _ => None,
        }
    }

    /// Get a string config value from `data`.
    pub fn config_str(&self, key: &str) -> Option<&str> {
        self.data.get(key)?.as_str()
    }

    /// Get a numeric config value from `data`.
    pub fn config_f64(&self, key: &str) -> Option<f64> {
        self.data.get(key)?.as_f64()
    }

    /// Return `Value::Error` with a formatted message. Convenience for blocks.
    pub fn error(&self, msg: impl Into<String>) -> Value {
        Value::Error { message: msg.into() }
    }
}

// ── Block trait ───────────────────────────────────────────────────────────────

/// The core trait for ChainSolve computation blocks.
///
/// Implement this trait to create a custom block. The engine will call
/// `evaluate` during graph evaluation, passing resolved inputs in the
/// provided [`BlockContext`].
///
/// # Thread safety
///
/// In native multi-threaded contexts the engine may call `evaluate` from
/// multiple threads. Implement `Send + Sync` (the default for stateless
/// blocks). For stateful blocks, use interior mutability with appropriate
/// synchronisation.
pub trait Block: Send + Sync {
    /// Return static metadata describing this block's identity and ports.
    fn metadata(&self) -> BlockMetadata;

    /// Optional pre-evaluation validation.
    ///
    /// Called once before the graph is evaluated to detect structural
    /// errors (e.g. wrong input type, missing required config). Return
    /// an empty `Vec` if the block is valid.
    fn validate(&self, _ctx: &BlockContext<'_>) -> Vec<Diagnostic> {
        vec![]
    }

    /// Compute the block's output from resolved inputs.
    ///
    /// Return `Value::Error { message }` to propagate an error downstream.
    /// Never panic — panics in WASM blocks produce unhelpful error messages.
    fn evaluate(&self, ctx: &BlockContext<'_>) -> Value;
}

// ── Registry ──────────────────────────────────────────────────────────────────

/// A registry of custom blocks.
///
/// Pass a populated `BlockRegistry` to the ChainSolve engine to make
/// custom blocks available for evaluation.
///
/// ```rust
/// use chainsolve_block_sdk::BlockRegistry;
/// // let mut reg = BlockRegistry::new();
/// // reg.register(Box::new(MyBlock));
/// ```
#[derive(Default)]
pub struct BlockRegistry {
    blocks: HashMap<String, Box<dyn Block>>,
}

impl BlockRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a block. The block's `metadata().id` is used as the key.
    /// Overwrites any previously registered block with the same id.
    pub fn register(&mut self, block: Box<dyn Block>) {
        let id = block.metadata().id.clone();
        self.blocks.insert(id, block);
    }

    /// Look up a registered block by id.
    pub fn get(&self, id: &str) -> Option<&dyn Block> {
        self.blocks.get(id).map(|b| b.as_ref())
    }

    /// Return all registered block ids.
    pub fn ids(&self) -> impl Iterator<Item = &str> {
        self.blocks.keys().map(|s| s.as_str())
    }

    /// Return metadata for all registered blocks.
    pub fn catalog(&self) -> Vec<BlockMetadata> {
        self.blocks.values().map(|b| b.metadata()).collect()
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    struct AddBlock;

    impl Block for AddBlock {
        fn metadata(&self) -> BlockMetadata {
            BlockMetadata {
                id: "test.add".into(),
                label: "Add".into(),
                category: "math".into(),
                inputs: vec![
                    PortDef { id: "a".into(), label: "a".into() },
                    PortDef { id: "b".into(), label: "b".into() },
                ],
                description: "Add two scalars".into(),
            }
        }

        fn evaluate(&self, ctx: &BlockContext<'_>) -> Value {
            let a = ctx.scalar("a").unwrap_or(0.0);
            let b = ctx.scalar("b").unwrap_or(0.0);
            Value::Scalar { value: a + b }
        }
    }

    fn make_ctx<'a>(
        inputs: &'a HashMap<String, Value>,
        data: &'a HashMap<String, serde_json::Value>,
    ) -> BlockContext<'a> {
        BlockContext::new(inputs, data)
    }

    #[test]
    fn test_add_block_metadata() {
        let b = AddBlock;
        let meta = b.metadata();
        assert_eq!(meta.id, "test.add");
        assert_eq!(meta.inputs.len(), 2);
    }

    #[test]
    fn test_add_block_evaluate() {
        let b = AddBlock;
        let inputs: HashMap<String, Value> = [
            ("a".into(), Value::Scalar { value: 3.0 }),
            ("b".into(), Value::Scalar { value: 4.0 }),
        ]
        .into_iter()
        .collect();
        let data = HashMap::new();
        let ctx = make_ctx(&inputs, &data);
        let out = b.evaluate(&ctx);
        assert!(matches!(out, Value::Scalar { value } if (value - 7.0).abs() < 1e-12));
    }

    #[test]
    fn test_registry_register_and_lookup() {
        let mut reg = BlockRegistry::new();
        reg.register(Box::new(AddBlock));
        assert!(reg.get("test.add").is_some());
        assert!(reg.get("nonexistent").is_none());
    }

    #[test]
    fn test_registry_catalog() {
        let mut reg = BlockRegistry::new();
        reg.register(Box::new(AddBlock));
        let catalog = reg.catalog();
        assert_eq!(catalog.len(), 1);
        assert_eq!(catalog[0].id, "test.add");
    }

    #[test]
    fn test_block_context_scalar_missing_returns_default() {
        let b = AddBlock;
        let inputs: HashMap<String, Value> = [("a".into(), Value::Scalar { value: 5.0 })]
            .into_iter()
            .collect();
        let data = HashMap::new();
        let ctx = make_ctx(&inputs, &data);
        let out = b.evaluate(&ctx);
        // b is missing → defaults to 0
        assert!(matches!(out, Value::Scalar { value } if (value - 5.0).abs() < 1e-12));
    }

    #[test]
    fn test_diagnostic_constructors() {
        let d = Diagnostic::error("bad input");
        assert_eq!(d.severity, Severity::Error);
        assert!(d.port.is_none());

        let d2 = Diagnostic::port_error("x", "missing");
        assert_eq!(d2.port.as_deref(), Some("x"));
    }
}
