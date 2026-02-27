//! Incremental patch correctness tests (P039).
//!
//! Invariant: for any graph G and patch P, evaluating G⊕P incrementally via
//! `run_patch()` must give the same node outputs as evaluating G⊕P from
//! scratch via `run()`.
//!
//! Tests cover the four `PatchOp` variants:
//!   - `UpdateNodeData` — change a number node's value
//!   - `AddNode` + `AddEdge` — extend the graph
//!   - `RemoveNode`  — shrink the graph
//!   - `RemoveEdge`  — disconnect an edge (target loses its input)

use engine_core::{
    graph::{EngineGraph, PatchOp},
    run, run_load_snapshot, run_patch,
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

fn op_node(id: &str, block_type: &str) -> NodeDef {
    NodeDef {
        id: id.to_string(),
        block_type: block_type.to_string(),
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

fn scalar_value(vals: &HashMap<String, Value>, node_id: &str) -> f64 {
    match vals.get(node_id) {
        Some(Value::Scalar { value: v }) => *v,
        other => panic!("expected scalar at {node_id}, got {other:?}"),
    }
}

/// Build a + b = op snapshot.
fn add_snap(a: f64, b: f64) -> EngineSnapshotV1 {
    EngineSnapshotV1 {
        version: 1,
        nodes: vec![num_node("a", a), num_node("b", b), op_node("op", "add")],
        edges: vec![
            edge("e1", "a", "out", "op", "a"),
            edge("e2", "b", "out", "op", "b"),
        ],
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/// UpdateNodeData patch: change node 'a' from 3 to 10.
/// Incremental result must equal run() on the full updated snapshot.
#[test]
fn update_node_data_matches_full_eval() {
    let mut graph = EngineGraph::new();

    // Load initial: a=3, b=4 → op=7
    let initial = add_snap(3.0, 4.0);
    run_load_snapshot(&mut graph, &serde_json::to_string(&initial).unwrap()).unwrap();

    // Patch: change a → 10
    let mut new_data = HashMap::new();
    new_data.insert("value".to_string(), serde_json::json!(10.0));
    let patch = vec![PatchOp::UpdateNodeData {
        node_id: "a".to_string(),
        data: new_data,
    }];
    let patch_json = serde_json::to_string(&patch).unwrap();
    let inc = run_patch(&mut graph, &patch_json).unwrap();

    // Full eval of the updated snapshot: a=10, b=4 → 14
    let updated = add_snap(10.0, 4.0);
    let full = run(&serde_json::to_string(&updated).unwrap()).unwrap();

    let incremental_op = scalar_value(&inc.changed_values, "op");
    let full_op = scalar_value(&full.values, "op");

    assert_eq!(
        incremental_op, full_op,
        "incremental result (op={incremental_op}) must match full eval (op={full_op})"
    );
    assert_eq!(incremental_op, 14.0);
}

/// AddNode + AddEdge: add a multiply node 'c = op * 2'.
/// Incremental result for 'c' must match full eval.
#[test]
fn add_node_and_edge_matches_full_eval() {
    let mut graph = EngineGraph::new();

    // Load initial: a=5, b=3 → op=8
    let initial = add_snap(5.0, 3.0);
    run_load_snapshot(&mut graph, &serde_json::to_string(&initial).unwrap()).unwrap();

    // Patch: add constant node 'k=2' and multiply node 'c = op * k'
    let k_node = num_node("k", 2.0);
    let c_node = op_node("c", "multiply");
    let e3 = edge("e3", "op", "out", "c", "a");
    let e4 = edge("e4", "k", "out", "c", "b");

    let patch = vec![
        PatchOp::AddNode { node: k_node },
        PatchOp::AddNode { node: c_node },
        PatchOp::AddEdge { edge: e3 },
        PatchOp::AddEdge { edge: e4 },
    ];
    let inc = run_patch(&mut graph, &serde_json::to_string(&patch).unwrap()).unwrap();

    // Full eval of the complete 5-node graph
    let full_snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("a", 5.0),
            num_node("b", 3.0),
            op_node("op", "add"),
            num_node("k", 2.0),
            op_node("c", "multiply"),
        ],
        edges: vec![
            edge("e1", "a", "out", "op", "a"),
            edge("e2", "b", "out", "op", "b"),
            edge("e3", "op", "out", "c", "a"),
            edge("e4", "k", "out", "c", "b"),
        ],
    };
    let full = run(&serde_json::to_string(&full_snap).unwrap()).unwrap();

    // c = (5+3) * 2 = 16
    assert_eq!(scalar_value(&inc.changed_values, "c"), 16.0);
    assert_eq!(scalar_value(&full.values, "c"), 16.0);
}

/// RemoveNode: remove 'op'.
/// After patch, 'op' must not appear in changed_values.
#[test]
fn remove_node_clears_result() {
    let mut graph = EngineGraph::new();

    let initial = add_snap(3.0, 4.0);
    run_load_snapshot(&mut graph, &serde_json::to_string(&initial).unwrap()).unwrap();

    // Patch: remove the add node
    let patch = vec![PatchOp::RemoveNode {
        node_id: "op".to_string(),
    }];
    let inc = run_patch(&mut graph, &serde_json::to_string(&patch).unwrap()).unwrap();

    // 'op' is gone — it should not appear in the updated values
    assert!(
        !inc.changed_values.contains_key("op"),
        "removed node 'op' must not appear in incremental results"
    );

    // Full eval of the remaining graph (just two disconnected number nodes)
    let remaining = EngineSnapshotV1 {
        version: 1,
        nodes: vec![num_node("a", 3.0), num_node("b", 4.0)],
        edges: vec![],
    };
    let full = run(&serde_json::to_string(&remaining).unwrap()).unwrap();

    // a and b still evaluate as scalars
    assert_eq!(scalar_value(&full.values, "a"), 3.0);
    assert_eq!(scalar_value(&full.values, "b"), 4.0);
}

/// RemoveEdge: disconnect the 'a' input from 'op'.
/// After patch, 'op' has no 'a' input — it should not produce the same result.
#[test]
fn remove_edge_changes_result() {
    let mut graph = EngineGraph::new();

    // Initial: a=10, b=5 → op=15
    let initial = add_snap(10.0, 5.0);
    run_load_snapshot(&mut graph, &serde_json::to_string(&initial).unwrap()).unwrap();

    // Patch: remove edge e1 (a → op.a)
    let patch = vec![PatchOp::RemoveEdge {
        edge_id: "e1".to_string(),
    }];
    let inc = run_patch(&mut graph, &serde_json::to_string(&patch).unwrap()).unwrap();

    // Without 'a' input, op receives 0 from the missing port + b=5 → op = 0+5 = 5
    // (default missing port = 0 in the engine)
    let full_after_remove = EngineSnapshotV1 {
        version: 1,
        nodes: vec![num_node("a", 10.0), num_node("b", 5.0), op_node("op", "add")],
        edges: vec![
            // e1 removed — only e2 remains
            edge("e2", "b", "out", "op", "b"),
        ],
    };
    let full = run(&serde_json::to_string(&full_after_remove).unwrap()).unwrap();

    let inc_op = scalar_value(&inc.changed_values, "op");
    let full_op = scalar_value(&full.values, "op");

    // Use bit-level comparison so that NaN == NaN (both sides go through
    // the same missing-port path and must produce bit-identical output).
    assert_eq!(
        inc_op.to_bits(),
        full_op.to_bits(),
        "incremental result after RemoveEdge must match full eval (inc={inc_op}, full={full_op})"
    );
    // Result must differ from the original 15.0 (a=10 is now disconnected).
    assert_ne!(
        inc_op, 15.0,
        "result must differ from original after edge removal"
    );
}
