//! Property-based tests using proptest.
//!
//! These tests verify mathematical invariants hold across random inputs,
//! complementing the golden fixture tests which pin specific values.
//!
//! Note: values pass through JSON serialization in the engine pipeline,
//! so identity tests compare within the engine's domain (both sides
//! go through the same JSON round-trip).

use engine_core::types::{EdgeDef, EngineSnapshotV1, NodeDef, Value};
use proptest::prelude::*;
use std::collections::HashMap;

// ── Helpers ─────────────────────────────────────────────────────────

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

fn eval_snap(snap: &EngineSnapshotV1) -> HashMap<String, Value> {
    let json = serde_json::to_string(snap).unwrap();
    engine_core::run(&json).unwrap().values
}

/// Evaluate a binary op (a, b handles): a ⊕ b → result
fn eval_binary(op: &str, a: f64, b: f64) -> Value {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![num_node("a", a), num_node("b", b), op_node("op", op)],
        edges: vec![
            edge("e1", "a", "out", "op", "a"),
            edge("e2", "b", "out", "op", "b"),
        ],
    };
    eval_snap(&snap).remove("op").unwrap()
}

/// Evaluate a unary op: a → result
fn eval_unary(op: &str, a: f64) -> Value {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![num_node("a", a), op_node("op", op)],
        edges: vec![edge("e1", "a", "out", "op", "a")],
    };
    eval_snap(&snap).remove("op").unwrap()
}

/// Evaluate scalar + vector broadcast
fn eval_scalar_vec_binary(op: &str, s: f64, vec_vals: &[f64]) -> Value {
    let mut vec_data = HashMap::new();
    vec_data.insert("vectorData".to_string(), serde_json::json!(vec_vals));
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("s", s),
            NodeDef {
                id: "v".to_string(),
                block_type: "vectorInput".to_string(),
                data: vec_data,
            },
            op_node("op", op),
        ],
        edges: vec![
            edge("e1", "s", "out", "op", "a"),
            edge("e2", "v", "out", "op", "b"),
        ],
    };
    eval_snap(&snap).remove("op").unwrap()
}

/// Strategy: finite f64, excluding -0.0 (engine canonicalizes -0 → +0)
fn finite_f64() -> impl Strategy<Value = f64> {
    prop::num::f64::ANY
        .prop_filter("must be finite", |x| x.is_finite())
        .prop_map(|x| if x == 0.0 { 0.0 } else { x }) // canonicalize -0
}

/// Strategy: non-zero finite f64
fn nonzero_finite_f64() -> impl Strategy<Value = f64> {
    finite_f64().prop_filter("must be nonzero", |x| *x != 0.0)
}

/// Strategy: small vector of finite f64 (1..=8 elements)
fn finite_vec() -> impl Strategy<Value = Vec<f64>> {
    prop::collection::vec(finite_f64(), 1..=8)
}

/// Bitwise equality (catches NaN and -0 differences)
fn bits_eq(a: f64, b: f64) -> bool {
    a.to_bits() == b.to_bits()
}

/// Approximate equality within tolerance
fn approx_eq(a: f64, b: f64, tol: f64) -> bool {
    if a.is_nan() && b.is_nan() {
        return true;
    }
    if a.is_nan() || b.is_nan() {
        return false;
    }
    if a.is_infinite() && b.is_infinite() {
        return a.signum() == b.signum();
    }
    (a - b).abs() <= tol
}

// ── Arithmetic identity properties ──────────────────────────────────
//
// Identity tests compare op(x, identity_element) against the number node's
// own output. Both sides go through JSON serialization, so we test the
// property within the engine's domain.

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn add_commutative(a in finite_f64(), b in finite_f64()) {
        let ab = eval_binary("add", a, b).as_scalar().unwrap();
        let ba = eval_binary("add", b, a).as_scalar().unwrap();
        prop_assert!(bits_eq(ab, ba),
            "add({a}, {b}) = {ab} but add({b}, {a}) = {ba}");
    }

    #[test]
    fn mul_commutative(a in finite_f64(), b in finite_f64()) {
        let ab = eval_binary("multiply", a, b).as_scalar().unwrap();
        let ba = eval_binary("multiply", b, a).as_scalar().unwrap();
        prop_assert!(bits_eq(ab, ba),
            "mul({a}, {b}) = {ab} but mul({b}, {a}) = {ba}");
    }

    #[test]
    fn add_identity(x in finite_f64()) {
        // x + 0 should equal x (within engine's JSON domain)
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("x", x),
                num_node("zero", 0.0),
                op_node("op", "add"),
            ],
            edges: vec![
                edge("e1", "x", "out", "op", "a"),
                edge("e2", "zero", "out", "op", "b"),
            ],
        };
        let vals = eval_snap(&snap);
        let input = vals["x"].as_scalar().unwrap();
        let result = vals["op"].as_scalar().unwrap();
        prop_assert!(bits_eq(result, input),
            "add({input}, 0) = {result}, expected {input}");
    }

    #[test]
    fn mul_identity(x in finite_f64()) {
        // x × 1 should equal x (within engine's JSON domain)
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("x", x),
                num_node("one", 1.0),
                op_node("op", "multiply"),
            ],
            edges: vec![
                edge("e1", "x", "out", "op", "a"),
                edge("e2", "one", "out", "op", "b"),
            ],
        };
        let vals = eval_snap(&snap);
        let input = vals["x"].as_scalar().unwrap();
        let result = vals["op"].as_scalar().unwrap();
        prop_assert!(bits_eq(result, input),
            "mul({input}, 1) = {result}, expected {input}");
    }

    #[test]
    fn power_identity(x in nonzero_finite_f64()) {
        // x^1 should equal x (within engine's JSON domain)
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("x", x),
                num_node("one", 1.0),
                op_node("op", "power"),
            ],
            edges: vec![
                edge("e1", "x", "out", "op", "base"),
                edge("e2", "one", "out", "op", "exp"),
            ],
        };
        let vals = eval_snap(&snap);
        let input = vals["x"].as_scalar().unwrap();
        let result = vals["op"].as_scalar().unwrap();
        prop_assert!(bits_eq(result, input),
            "pow({input}, 1) = {result}, expected {input}");
    }

    #[test]
    fn negate_involution(x in finite_f64()) {
        // negate(negate(x)) should equal x (within engine's JSON domain)
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("x", x),
                op_node("neg1", "negate"),
                op_node("neg2", "negate"),
            ],
            edges: vec![
                edge("e1", "x", "out", "neg1", "a"),
                edge("e2", "neg1", "out", "neg2", "a"),
            ],
        };
        let vals = eval_snap(&snap);
        let input = vals["x"].as_scalar().unwrap();
        let result = vals["neg2"].as_scalar().unwrap();
        prop_assert!(bits_eq(result, input),
            "negate(negate({input})) = {result}, expected {input}");
    }

    #[test]
    fn abs_non_negative(x in finite_f64()) {
        let result = eval_unary("abs", x).as_scalar().unwrap();
        prop_assert!(result >= 0.0,
            "abs({x}) = {result}, expected >= 0");
    }

    #[test]
    fn abs_symmetric(x in finite_f64()) {
        let pos = eval_unary("abs", x).as_scalar().unwrap();
        let neg = eval_unary("abs", -x).as_scalar().unwrap();
        prop_assert!(bits_eq(pos, neg),
            "abs({x}) = {pos} but abs({}) = {neg}", -x);
    }

    #[test]
    fn subtract_self_is_zero(x in finite_f64()) {
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("x", x),
                op_node("op", "subtract"),
            ],
            edges: vec![
                edge("e1", "x", "out", "op", "a"),
                edge("e2", "x", "out", "op", "b"),
            ],
        };
        let vals = eval_snap(&snap);
        let result = vals["op"].as_scalar().unwrap();
        // x - x should be +0.0 (canonicalized)
        prop_assert!(result == 0.0 && result.to_bits() == 0u64,
            "subtract(x, x) = {result} (bits={}), expected +0.0", result.to_bits());
    }

    #[test]
    fn divide_self_is_one(x in nonzero_finite_f64()) {
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("x", x),
                op_node("op", "divide"),
            ],
            edges: vec![
                edge("e1", "x", "out", "op", "a"),
                edge("e2", "x", "out", "op", "b"),
            ],
        };
        let vals = eval_snap(&snap);
        let result = vals["op"].as_scalar().unwrap();
        prop_assert!(result == 1.0,
            "divide(x, x) = {result}, expected 1.0");
    }
}

// ── Canonicalization properties ──────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(128))]

    #[test]
    fn nan_canonical_bits(a in finite_f64()) {
        // Produce NaN via graph (0/0), then propagate through add(NaN, a)
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("z1", 0.0),
                op_node("nan_src", "divide"),  // 0/0 = NaN
                num_node("x", a),
                op_node("result", "add"),       // NaN + a = NaN
            ],
            edges: vec![
                edge("e1", "z1", "out", "nan_src", "a"),
                edge("e2", "z1", "out", "nan_src", "b"),
                edge("e3", "nan_src", "out", "result", "a"),
                edge("e4", "x", "out", "result", "b"),
            ],
        };
        let vals = eval_snap(&snap);

        let nan_val = vals["nan_src"].as_scalar().unwrap();
        prop_assert!(nan_val.is_nan(), "0/0 should be NaN");

        let prop_val = vals["result"].as_scalar().unwrap();
        prop_assert!(prop_val.is_nan(), "NaN + {a} should be NaN, got {prop_val}");

        // Both NaN values should have identical bit patterns (canonical NaN)
        prop_assert!(bits_eq(nan_val, prop_val),
            "NaN bits differ: {} vs {}", nan_val.to_bits(), prop_val.to_bits());
    }

    #[test]
    fn neg_zero_canonical(_x in finite_f64()) {
        // -1 × 0 should yield +0.0 (not -0.0)
        let result = eval_binary("multiply", -1.0, 0.0).as_scalar().unwrap();
        prop_assert!(result == 0.0 && result.to_bits() == 0u64,
            "-1 × 0 = {result} (bits={}), expected +0.0", result.to_bits());
    }
}

// ── Trigonometric identities ─────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn sin_cos_pythagorean(x in -100.0f64..100.0f64) {
        // sin²(x) + cos²(x) ≈ 1
        let s = eval_unary("sin", x).as_scalar().unwrap();
        let c = eval_unary("cos", x).as_scalar().unwrap();
        let sum = s * s + c * c;
        prop_assert!(approx_eq(sum, 1.0, 1e-10),
            "sin²({x}) + cos²({x}) = {sum}, expected ≈ 1.0");
    }

    #[test]
    fn sin_negate_odd(x in -100.0f64..100.0f64) {
        // sin(-x) = -sin(x)  (odd function)
        let sin_x = eval_unary("sin", x).as_scalar().unwrap();
        let sin_neg_x = eval_unary("sin", -x).as_scalar().unwrap();
        prop_assert!(approx_eq(sin_neg_x, -sin_x, 1e-10),
            "sin(-{x}) = {sin_neg_x}, expected -{sin_x} = {}", -sin_x);
    }

    #[test]
    fn cos_even(x in -100.0f64..100.0f64) {
        // cos(-x) = cos(x)  (even function)
        let cos_x = eval_unary("cos", x).as_scalar().unwrap();
        let cos_neg_x = eval_unary("cos", -x).as_scalar().unwrap();
        prop_assert!(approx_eq(cos_neg_x, cos_x, 1e-10),
            "cos(-{x}) = {cos_neg_x}, expected {cos_x}");
    }
}

// ── Broadcasting invariants ──────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn scalar_plus_vector_elementwise(s in finite_f64(), v in finite_vec()) {
        let result = eval_scalar_vec_binary("add", s, &v);
        match result {
            Value::Vector { value: rv } => {
                prop_assert_eq!(rv.len(), v.len(),
                    "Result vector length {} != input length {}", rv.len(), v.len());
                for (i, (actual, &expected_elem)) in rv.iter().zip(v.iter()).enumerate() {
                    let expected = eval_binary("add", s, expected_elem).as_scalar().unwrap();
                    prop_assert!(bits_eq(*actual, expected),
                        "Element {i}: broadcast({s} + {expected_elem}) = {actual}, \
                         scalar({s} + {expected_elem}) = {expected}");
                }
            }
            other => prop_assert!(false, "Expected vector, got {:?}", other),
        }
    }

    #[test]
    fn scalar_times_vector_elementwise(s in finite_f64(), v in finite_vec()) {
        let result = eval_scalar_vec_binary("multiply", s, &v);
        match result {
            Value::Vector { value: rv } => {
                prop_assert_eq!(rv.len(), v.len());
                for (i, (actual, &expected_elem)) in rv.iter().zip(v.iter()).enumerate() {
                    let expected = eval_binary("multiply", s, expected_elem).as_scalar().unwrap();
                    prop_assert!(bits_eq(*actual, expected),
                        "Element {i}: broadcast({s} × {expected_elem}) = {actual}, \
                         scalar({s} × {expected_elem}) = {expected}");
                }
            }
            other => prop_assert!(false, "Expected vector, got {:?}", other),
        }
    }
}

// ── Determinism property ─────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(32))]

    #[test]
    fn eval_deterministic(a in finite_f64(), b in finite_f64()) {
        // Same inputs → bitwise identical outputs, always
        let r1 = eval_binary("add", a, b).as_scalar().unwrap();
        let r2 = eval_binary("add", a, b).as_scalar().unwrap();
        let r3 = eval_binary("add", a, b).as_scalar().unwrap();
        prop_assert!(bits_eq(r1, r2) && bits_eq(r2, r3),
            "Non-deterministic: {}, {}, {}", r1, r2, r3);
    }
}

// ── Random DAG properties ─────────────────────────────────────────────
//
// Build random chains of binary ops by construction — node i only receives
// inputs from nodes j < i, guaranteeing acyclicity.  Tests verify:
//   1. No panics (engine.run() always returns Ok).
//   2. Determinism: identical JSON → bitwise identical scalar outputs.

/// Binary ops safe to chain (finite inputs → finite or NaN output, no panics).
const CHAIN_OPS: [&str; 3] = ["add", "subtract", "multiply"];

/// Build a chain snapshot: input nodes i0..iN, then a sequence of binary ops
/// each taking the previous result and the next input node.
fn build_chain_snap(inputs: &[f64], op_indices: &[usize]) -> EngineSnapshotV1 {
    let mut nodes: Vec<NodeDef> = inputs
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            let mut d = HashMap::new();
            d.insert("value".to_string(), serde_json::json!(v));
            NodeDef {
                id: format!("i{i}"),
                block_type: "number".to_string(),
                data: d,
            }
        })
        .collect();

    let mut edges: Vec<EdgeDef> = Vec::new();
    let mut prev = "i0".to_string();

    for (step, &idx) in op_indices.iter().enumerate() {
        let op = CHAIN_OPS[idx % CHAIN_OPS.len()];
        let op_id = format!("op{step}");
        nodes.push(op_node(&op_id, op));
        edges.push(edge(&format!("ea{step}"), &prev, "out", &op_id, "a"));
        // "b" always gets the next input (wrapping)
        let b_src = format!("i{}", (step + 1).min(inputs.len() - 1));
        edges.push(edge(&format!("eb{step}"), &b_src, "out", &op_id, "b"));
        prev = op_id;
    }

    EngineSnapshotV1 { version: 1, nodes, edges }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    /// Random chains never panic and always return Ok.
    #[test]
    fn random_chain_no_panic(
        inputs  in prop::collection::vec(finite_f64(), 2..=6),
        op_idxs in prop::collection::vec(0usize..3, 1..=5),
    ) {
        let snap = build_chain_snap(&inputs, &op_idxs);
        let json = serde_json::to_string(&snap).unwrap();
        let result = engine_core::run(&json);
        prop_assert!(result.is_ok(), "engine returned Err: {:?}", result.err());
    }

    /// Same random chain JSON → bitwise identical scalar outputs across two runs.
    #[test]
    fn random_chain_deterministic(
        inputs  in prop::collection::vec(finite_f64(), 2..=6),
        op_idxs in prop::collection::vec(0usize..3, 1..=5),
    ) {
        let snap = build_chain_snap(&inputs, &op_idxs);
        let json = serde_json::to_string(&snap).unwrap();
        let r1 = engine_core::run(&json).unwrap();
        let r2 = engine_core::run(&json).unwrap();

        for (id, v1) in &r1.values {
            if let (Value::Scalar { value: a }, Some(Value::Scalar { value: b })) =
                (v1, r2.values.get(id))
            {
                prop_assert!(
                    a.to_bits() == b.to_bits(),
                    "Determinism failed for node {id}: {a} vs {b}"
                );
            }
        }
    }
}
