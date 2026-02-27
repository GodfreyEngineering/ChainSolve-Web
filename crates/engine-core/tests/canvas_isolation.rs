//! Cross-canvas isolation proof (P038).
//!
//! Canvases are isolated by design: each canvas is a separate EngineSnapshotV1
//! evaluated independently.  These tests prove two isolation guarantees:
//!
//! 1. **Stateless isolation**: `run()` is a pure function — two calls with
//!    different snapshots always give independent results (no global state).
//!
//! 2. **Persistent-graph isolation**: `load_snapshot()` on an `EngineGraph`
//!    replaces ALL prior state.  After loading canvas B, no node IDs from
//!    canvas A appear in the output.
//!
//! # Invariants documented
//! - `engine_core::run()` has no module-level mutable state.
//! - `EngineGraph::load_snapshot()` fully replaces the previous graph.
//! - Node IDs are not shared across canvas evaluations.

use engine_core::{
    graph::EngineGraph,
    run, run_load_snapshot,
    types::{EdgeDef, EngineSnapshotV1, NodeDef, Value},
};
use std::collections::HashMap;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn num_node(id: &str, val: f64) -> NodeDef {
    let mut data = HashMap::new();
    data.insert("value".to_string(), serde_json::json!(val));
    NodeDef {
        id: id.to_string(),
        block_type: "number".to_string(),
        data,
    }
}

fn add_node(id: &str) -> NodeDef {
    NodeDef {
        id: id.to_string(),
        block_type: "add".to_string(),
        data: HashMap::new(),
    }
}

fn edge(id: &str, src: &str, src_h: &str, tgt: &str, tgt_h: &str) -> EdgeDef {
    EdgeDef {
        id: id.into(),
        source: src.into(),
        source_handle: src_h.into(),
        target: tgt.into(),
        target_handle: tgt_h.into(),
    }
}

/// Build a simple "a + b = result" snapshot.
fn add_snap(snap_id: &str, a: f64, b: f64) -> EngineSnapshotV1 {
    let na = format!("{snap_id}_a");
    let nb = format!("{snap_id}_b");
    let nop = format!("{snap_id}_op");
    EngineSnapshotV1 {
        version: 1,
        nodes: vec![num_node(&na, a), num_node(&nb, b), add_node(&nop)],
        edges: vec![
            edge(&format!("{snap_id}_e1"), &na, "out", &nop, "a"),
            edge(&format!("{snap_id}_e2"), &nb, "out", &nop, "b"),
        ],
    }
}

fn scalar_value(vals: &HashMap<String, Value>, node_id: &str) -> f64 {
    match vals.get(node_id) {
        Some(Value::Scalar { value: v }) => *v,
        other => panic!("expected scalar at {node_id}, got {other:?}"),
    }
}

// ── Stateless isolation ───────────────────────────────────────────────────────

/// `run()` has no global mutable state: evaluating canvas A then canvas B
/// gives results that are entirely independent of each other.
#[test]
fn stateless_run_independent_results() {
    let snap_a = add_snap("canvas_a", 10.0, 20.0); // expects 30
    let snap_b = add_snap("canvas_b", 1.0, 2.0); // expects 3

    let json_a = serde_json::to_string(&snap_a).unwrap();
    let json_b = serde_json::to_string(&snap_b).unwrap();

    let result_a = run(&json_a).unwrap();
    let result_b = run(&json_b).unwrap();

    // Canvas A: 10 + 20 = 30
    assert_eq!(scalar_value(&result_a.values, "canvas_a_op"), 30.0);
    // Canvas B: 1 + 2 = 3
    assert_eq!(scalar_value(&result_b.values, "canvas_b_op"), 3.0);

    // No cross-contamination: canvas A result has no canvas B node IDs
    assert!(
        !result_a.values.contains_key("canvas_b_op"),
        "canvas A result must not contain canvas B nodes"
    );
    assert!(
        !result_b.values.contains_key("canvas_a_op"),
        "canvas B result must not contain canvas A nodes"
    );
}

/// Evaluating canvas A twice with different inputs gives independent results.
/// Proves there is no cached global state leaking between calls.
#[test]
fn stateless_run_no_value_leakage_between_calls() {
    let snap1 = add_snap("cv", 100.0, 200.0); // 300
    let snap2 = add_snap("cv", 1.0, 1.0); // 2 — same IDs, different values

    let r1 = run(&serde_json::to_string(&snap1).unwrap()).unwrap();
    let r2 = run(&serde_json::to_string(&snap2).unwrap()).unwrap();

    assert_eq!(scalar_value(&r1.values, "cv_op"), 300.0);
    assert_eq!(scalar_value(&r2.values, "cv_op"), 2.0);
}

// ── Persistent-graph isolation ────────────────────────────────────────────────

/// `EngineGraph::load_snapshot()` replaces the entire prior graph state.
/// After loading canvas B, no node IDs from canvas A appear in any result.
#[test]
fn load_snapshot_replaces_all_prior_state() {
    let mut graph = EngineGraph::new();

    // Load canvas A: node ids "ca_a", "ca_b", "ca_op"
    let snap_a = add_snap("ca", 5.0, 7.0); // expects 12
    let json_a = serde_json::to_string(&snap_a).unwrap();
    let result_a = run_load_snapshot(&mut graph, &json_a).unwrap();
    assert_eq!(scalar_value(&result_a.values, "ca_op"), 12.0);

    // Load canvas B: completely different node IDs "cb_a", "cb_b", "cb_op"
    let snap_b = add_snap("cb", 3.0, 4.0); // expects 7
    let json_b = serde_json::to_string(&snap_b).unwrap();
    let result_b = run_load_snapshot(&mut graph, &json_b).unwrap();

    // Canvas B evaluates correctly
    assert_eq!(scalar_value(&result_b.values, "cb_op"), 7.0);

    // Canvas A's node IDs are gone — the graph has been fully replaced
    assert!(
        !result_b.values.contains_key("ca_op"),
        "After loading canvas B, canvas A node IDs must not appear in results"
    );
}

/// `load_snapshot()` with the same node IDs but different values fully replaces
/// cached values from the previous evaluation.
#[test]
fn load_snapshot_replaces_cached_values_for_same_node_ids() {
    let mut graph = EngineGraph::new();

    let snap1 = add_snap("n", 10.0, 20.0); // n_op = 30
    run_load_snapshot(&mut graph, &serde_json::to_string(&snap1).unwrap()).unwrap();

    let snap2 = add_snap("n", 1.0, 1.0); // n_op = 2
    let result2 = run_load_snapshot(&mut graph, &serde_json::to_string(&snap2).unwrap()).unwrap();

    // Must reflect the NEW snapshot's values, not the old cached result
    assert_eq!(
        scalar_value(&result2.values, "n_op"),
        2.0,
        "load_snapshot must replace cached values, not return stale results"
    );
}
