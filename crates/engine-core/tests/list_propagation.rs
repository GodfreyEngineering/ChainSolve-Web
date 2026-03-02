//! Integration tests for list (vector) propagation rules (H2-2).
//!
//! Verifies that function blocks correctly handle:
//! - Scalar + list broadcasting
//! - Same-length list element-wise operations
//! - Different-length lists with NaN padding
//! - Chains of operations with mixed list lengths

use engine_core::types::{EdgeDef, EngineSnapshotV1, NodeDef, Value};
use std::collections::HashMap;

fn num_node(id: &str, val: f64) -> NodeDef {
    let mut data = HashMap::new();
    data.insert("value".to_string(), serde_json::json!(val));
    NodeDef {
        id: id.to_string(),
        block_type: "number".to_string(),
        data,
    }
}

fn vec_node(id: &str, vals: &[f64]) -> NodeDef {
    let mut data = HashMap::new();
    data.insert("vectorData".to_string(), serde_json::json!(vals));
    NodeDef {
        id: id.to_string(),
        block_type: "vectorInput".to_string(),
        data,
    }
}

fn op_node(id: &str, op: &str) -> NodeDef {
    NodeDef {
        id: id.to_string(),
        block_type: op.to_string(),
        data: HashMap::new(),
    }
}

fn edge(id: &str, src: &str, src_h: &str, tgt: &str, tgt_h: &str) -> EdgeDef {
    EdgeDef {
        id: id.to_string(),
        source: src.to_string(),
        source_handle: src_h.to_string(),
        target: tgt.to_string(),
        target_handle: tgt_h.to_string(),
    }
}

fn run_snap(snap: EngineSnapshotV1) -> HashMap<String, Value> {
    let json = serde_json::to_string(&snap).unwrap();
    engine_core::run(&json).unwrap().values
}

fn assert_vec(val: &Value, expected: &[f64]) {
    match val {
        Value::Vector { value } => {
            assert_eq!(
                value.len(),
                expected.len(),
                "vector length: got {} expected {}",
                value.len(),
                expected.len()
            );
            for (i, (got, exp)) in value.iter().zip(expected.iter()).enumerate() {
                if exp.is_nan() {
                    assert!(got.is_nan(), "index {}: expected NaN, got {}", i, got);
                } else {
                    assert!(
                        (got - exp).abs() < 1e-10,
                        "index {}: got {} expected {}",
                        i,
                        got,
                        exp
                    );
                }
            }
        }
        other => panic!("expected Vector, got {:?}", other),
    }
}

/// Scalar + list = element-wise broadcast (existing behavior, sanity check).
#[test]
fn scalar_plus_list_broadcasts() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("s", 10.0),
            vec_node("v", &[1.0, 2.0, 3.0]),
            op_node("add", "add"),
        ],
        edges: vec![
            edge("e1", "s", "out", "add", "a"),
            edge("e2", "v", "out", "add", "b"),
        ],
    };
    let vals = run_snap(snap);
    assert_vec(&vals["add"], &[11.0, 12.0, 13.0]);
}

/// Same-length lists = element-wise (existing behavior, sanity check).
#[test]
fn same_length_lists_elementwise() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            vec_node("a", &[1.0, 2.0, 3.0]),
            vec_node("b", &[10.0, 20.0, 30.0]),
            op_node("add", "add"),
        ],
        edges: vec![
            edge("e1", "a", "out", "add", "a"),
            edge("e2", "b", "out", "add", "b"),
        ],
    };
    let vals = run_snap(snap);
    assert_vec(&vals["add"], &[11.0, 22.0, 33.0]);
}

/// Different-length lists: shorter padded with NaN (H2-2).
#[test]
fn different_length_lists_pad_nan() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            vec_node("short", &[1.0, 2.0]),
            vec_node("long", &[10.0, 20.0, 30.0]),
            op_node("add", "add"),
        ],
        edges: vec![
            edge("e1", "short", "out", "add", "a"),
            edge("e2", "long", "out", "add", "b"),
        ],
    };
    let vals = run_snap(snap);
    assert_vec(&vals["add"], &[11.0, 22.0, f64::NAN]);
}

/// Chain: list(3) + list(2) → padded(3) → multiply by scalar → still 3 elements.
#[test]
fn chain_list_mismatch_then_scalar() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            vec_node("a", &[1.0, 2.0, 3.0]),
            vec_node("b", &[10.0, 20.0]),
            op_node("add", "add"),
            num_node("s", 2.0),
            op_node("mul", "multiply"),
        ],
        edges: vec![
            edge("e1", "a", "out", "add", "a"),
            edge("e2", "b", "out", "add", "b"),
            edge("e3", "add", "out", "mul", "a"),
            edge("e4", "s", "out", "mul", "b"),
        ],
    };
    let vals = run_snap(snap);
    // add: [11, 22, NaN], then mul by 2: [22, 44, NaN]
    assert_vec(&vals["mul"], &[22.0, 44.0, f64::NAN]);
}

/// Two mismatched lists through multiply: NaN propagates.
#[test]
fn multiply_different_lengths() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            vec_node("a", &[2.0, 3.0, 4.0, 5.0]),
            vec_node("b", &[10.0, 10.0]),
            op_node("mul", "multiply"),
        ],
        edges: vec![
            edge("e1", "a", "out", "mul", "a"),
            edge("e2", "b", "out", "mul", "b"),
        ],
    };
    let vals = run_snap(snap);
    assert_vec(&vals["mul"], &[20.0, 30.0, f64::NAN, f64::NAN]);
}

/// Empty list + non-empty list: all NaN output.
#[test]
fn empty_list_plus_nonempty() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            vec_node("empty", &[]),
            vec_node("vals", &[1.0, 2.0]),
            op_node("add", "add"),
        ],
        edges: vec![
            edge("e1", "empty", "out", "add", "a"),
            edge("e2", "vals", "out", "add", "b"),
        ],
    };
    let vals = run_snap(snap);
    assert_vec(&vals["add"], &[f64::NAN, f64::NAN]);
}

/// Unary ops on lists still work (sin of a list).
#[test]
fn unary_op_on_list() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            vec_node("v", &[0.0, std::f64::consts::FRAC_PI_2]),
            op_node("sin", "sin"),
        ],
        edges: vec![edge("e1", "v", "out", "sin", "a")],
    };
    let vals = run_snap(snap);
    assert_vec(&vals["sin"], &[0.0, 1.0]);
}

/// List through a chain of unary ops: negate then abs.
#[test]
fn list_through_unary_chain() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            vec_node("v", &[-3.0, 5.0, -7.0]),
            op_node("neg", "negate"),
            op_node("abs", "abs"),
        ],
        edges: vec![
            edge("e1", "v", "out", "neg", "a"),
            edge("e2", "neg", "out", "abs", "a"),
        ],
    };
    let vals = run_snap(snap);
    // negate: [3, -5, 7], abs: [3, 5, 7]
    assert_vec(&vals["abs"], &[3.0, 5.0, 7.0]);
}
