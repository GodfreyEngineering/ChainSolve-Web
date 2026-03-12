//! Property-based tests for engine-core using proptest.
//!
//! # Properties tested
//!
//! 1. **Determinism** — identical snapshots always yield bit-identical results.
//! 2. **Incremental consistency** — incremental eval (patch after initial eval)
//!    matches a full fresh eval with the patched value.
//! 3. **No panics** — arbitrary sequences of PatchOps on an empty graph never
//!    panic (the engine must degrade gracefully on malformed input).

use proptest::prelude::*;
use std::collections::HashMap;

use crate::graph::{EngineGraph, PatchOp};
use crate::types::{EdgeDef, EngineSnapshotV1, NodeDef, Value};

// ── Helper: build a linear chain snapshot ─────────────────────────────────

/// Builds a linear chain of `n` nodes:
///
/// ```text
/// n0 (number, value=source_value) → n1 (negate) → n2 (negate) → … → n{n-1} (negate)
/// ```
///
/// Edges connect each node's `out` handle to the next node's `a` handle.
fn chain_snapshot(n: usize, source_value: f64) -> EngineSnapshotV1 {
    assert!(n >= 1, "chain must have at least 1 node");

    let mut nodes = Vec::with_capacity(n);
    let mut edges = Vec::with_capacity(n.saturating_sub(1));

    // Source node: number block
    let mut src_data = HashMap::new();
    src_data.insert("value".to_string(), serde_json::json!(source_value));
    nodes.push(NodeDef {
        id: "n0".to_string(),
        block_type: "number".to_string(),
        data: src_data,
    });

    // Subsequent nodes: negate blocks
    for i in 1..n {
        nodes.push(NodeDef {
            id: format!("n{}", i),
            block_type: "negate".to_string(),
            data: HashMap::new(),
        });
        edges.push(EdgeDef {
            id: format!("e{}", i - 1),
            source: format!("n{}", i - 1),
            source_handle: "out".to_string(),
            target: format!("n{}", i),
            target_handle: "a".to_string(),
        });
    }

    EngineSnapshotV1 {
        version: 1,
        nodes,
        edges,
    }
}

// ── Strategy: random PatchOp ──────────────────────────────────────────────

/// Generates a random node id from the pool "n0".."n9".
fn node_id_strategy() -> impl Strategy<Value = String> {
    (0usize..10).prop_map(|i| format!("n{}", i))
}

/// Generates a random edge id from the pool "e0".."e19".
fn edge_id_strategy() -> impl Strategy<Value = String> {
    (0usize..20).prop_map(|i| format!("e{}", i))
}

/// Generates a random block type from the set of simple unary/binary ops.
fn block_type_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("number".to_string()),
        Just("add".to_string()),
        Just("negate".to_string()),
        Just("sin".to_string()),
    ]
}

/// Generates a random [`PatchOp`].
pub fn random_patch_op() -> impl Strategy<Value = PatchOp> {
    prop_oneof![
        // AddNode
        (node_id_strategy(), block_type_strategy()).prop_map(|(id, bt)| {
            let mut data = HashMap::new();
            if bt == "number" {
                data.insert("value".to_string(), serde_json::json!(0.0));
            }
            PatchOp::AddNode {
                node: NodeDef {
                    id,
                    block_type: bt,
                    data,
                },
            }
        }),
        // RemoveNode
        node_id_strategy().prop_map(|id| PatchOp::RemoveNode { node_id: id }),
        // UpdateNodeData
        (node_id_strategy(), -1000.0f64..1000.0f64).prop_map(|(id, v)| {
            let mut data = HashMap::new();
            data.insert("value".to_string(), serde_json::json!(v));
            PatchOp::UpdateNodeData {
                node_id: id,
                data,
            }
        }),
        // AddEdge  (source "out" → target "a")
        (node_id_strategy(), node_id_strategy(), edge_id_strategy()).prop_map(
            |(src, tgt, eid)| PatchOp::AddEdge {
                edge: EdgeDef {
                    id: eid,
                    source: src,
                    source_handle: "out".to_string(),
                    target: tgt,
                    target_handle: "a".to_string(),
                },
            }
        ),
        // RemoveEdge
        edge_id_strategy().prop_map(|eid| PatchOp::RemoveEdge { edge_id: eid }),
    ]
}

// ── Property tests ────────────────────────────────────────────────────────

proptest! {
    // ── Property 1: Determinism ──────────────────────────────────────

    /// Same snapshot always produces bit-identical scalar results.
    ///
    /// Two independent EngineGraph instances loaded from the same snapshot
    /// must return the same Value for every node, without exception.
    #[test]
    fn prop_same_snapshot_same_results(
        n_nodes in 2usize..20,
        source_value in -1000.0f64..1000.0f64,
    ) {
        let snapshot = chain_snapshot(n_nodes, source_value);

        let mut g1 = EngineGraph::new();
        g1.load_snapshot(snapshot.clone());
        let r1 = g1.evaluate_dirty();

        let mut g2 = EngineGraph::new();
        g2.load_snapshot(snapshot);
        let r2 = g2.evaluate_dirty();

        // All scalar values must be bit-equal (same f64 result).
        for (k, _) in &r1.changed_values {
            if let (Some(Value::Scalar { value: s1 }), Some(Value::Scalar { value: s2 })) = (
                r1.changed_values.get(k.as_str()),
                r2.changed_values.get(k.as_str()),
            ) {
                prop_assert_eq!(
                    s1.to_bits(),
                    s2.to_bits(),
                    "Node {}: {} != {}",
                    k, s1, s2
                );
            }
        }
    }

    // ── Property 2: Incremental consistency ──────────────────────────

    /// Incremental eval (patch source value) must match a full fresh eval.
    ///
    /// Steps:
    /// 1. Load chain with `v1`, evaluate fully (initial state).
    /// 2. Apply a `UpdateNodeData` patch to change source to `v2`.
    /// 3. Call `evaluate_dirty()` (incremental).
    /// 4. Separately, build a fresh chain with `v2` and do a full eval.
    /// 5. Every scalar value in both results must agree within floating-point
    ///    tolerance (1e-10) — or both must be NaN.
    #[test]
    fn prop_incremental_equals_full_eval(
        n_nodes in 2usize..15,
        v1 in -100.0f64..100.0f64,
        v2 in -100.0f64..100.0f64,
    ) {
        let snapshot = chain_snapshot(n_nodes, v1);

        // Full fresh eval with v2.
        let snapshot2 = chain_snapshot(n_nodes, v2);
        let mut g_full = EngineGraph::new();
        g_full.load_snapshot(snapshot2.clone());
        let r_full = g_full.evaluate_dirty();

        // Incremental: load v1, evaluate, then patch source to v2.
        let mut g_incr = EngineGraph::new();
        g_incr.load_snapshot(snapshot);
        let _ = g_incr.evaluate_dirty(); // initial eval
        g_incr.apply_patch(vec![PatchOp::UpdateNodeData {
            node_id: "n0".to_string(),
            data: {
                let mut m = HashMap::new();
                m.insert("value".to_string(), serde_json::json!(v2));
                m
            },
        }]);
        let r_incr = g_incr.evaluate_dirty();

        // Final values must match.
        for (k, _) in &r_full.changed_values {
            let fv = r_full.changed_values.get(k.as_str()).and_then(|v| v.as_scalar());
            let iv = r_incr.changed_values.get(k.as_str()).and_then(|v| v.as_scalar());
            if let (Some(f), Some(i)) = (fv, iv) {
                prop_assert!(
                    (f - i).abs() < 1e-10 || (f.is_nan() && i.is_nan()),
                    "Node {k}: full={f} incr={i}"
                );
            }
        }
    }

    // ── Property 3: No panics on random ops ──────────────────────────

    /// Random PatchOp sequences on an empty graph must never panic.
    ///
    /// The engine should handle all malformed / nonsensical operations
    /// (adding edges between non-existent nodes, removing nodes that don't
    /// exist, etc.) without panicking. The result may be an error value
    /// but must be returned safely.
    #[test]
    fn prop_no_panic_on_random_ops(
        ops in prop::collection::vec(random_patch_op(), 0..50),
    ) {
        let mut g = EngineGraph::new();
        g.apply_patch(ops);
        let _ = g.evaluate_dirty(); // must not panic
    }
}
