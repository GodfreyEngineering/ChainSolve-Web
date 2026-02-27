//! Domain error message consistency tests (P034).
//!
//! These tests pin the *exact* error strings for common domain failure modes,
//! ensuring the "OpName: constraint" format is preserved across refactors.
//!
//! Patterns covered:
//!   - "OpName: var = 0"            (division-by-zero guard)
//!   - "OpName: d_inner > d_outer"  (geometric constraint)
//!   - "OpName: empty vector"        (empty-collection guard)
//!   - "OpName: zero variance in X"  (statistical degenerate case)
//!   - "OpName: n = 0"              (finance period guard)

use engine_core::types::{EdgeDef, EngineSnapshotV1, NodeDef, Value};
use std::collections::HashMap;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

fn run_snap(snap: EngineSnapshotV1) -> HashMap<String, Value> {
    let json = serde_json::to_string(&snap).unwrap();
    engine_core::run(&json).unwrap().values
}

fn assert_error_exact(values: &HashMap<String, Value>, node_id: &str, expected_msg: &str) {
    match values.get(node_id) {
        Some(Value::Error { message }) => {
            assert_eq!(
                message, expected_msg,
                "node {node_id}: expected error message {:?}, got {:?}",
                expected_msg, message
            );
        }
        other => panic!("node {node_id}: expected Error, got {:?}", other),
    }
}

// ── "OpName: var = 0" pattern ────────────────────────────────────────────────

/// eng.mechanics.power_work_time: Power = W / t  →  "Power: t = 0"
#[test]
fn power_zero_time_exact_message() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("w", 100.0),
            num_node("t", 0.0),
            op_node("op", "eng.mechanics.power_work_time"),
        ],
        edges: vec![
            edge("e1", "w", "out", "op", "W"),
            edge("e2", "t", "out", "op", "t"),
        ],
    };
    let values = run_snap(snap);
    assert_error_exact(&values, "op", "Power: t = 0");
}

/// eng.sections.bending_stress: σ = M·y / I  →  "Bending stress: I = 0"
#[test]
fn bending_stress_zero_moment_of_inertia_exact_message() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("m", 100.0),
            num_node("y", 0.5),
            num_node("i", 0.0),
            op_node("op", "eng.sections.bending_stress"),
        ],
        edges: vec![
            edge("e1", "m", "out", "op", "M"),
            edge("e2", "y", "out", "op", "y"),
            edge("e3", "i", "out", "op", "I"),
        ],
    };
    let values = run_snap(snap);
    assert_error_exact(&values, "op", "Bending stress: I = 0");
}

/// eng.fluids.reynolds: Re = ρ·v·D / μ  →  "Reynolds: μ = 0"
#[test]
fn reynolds_zero_viscosity_exact_message() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("rho", 1000.0),
            num_node("v", 1.0),
            num_node("d", 0.05),
            num_node("mu", 0.0),
            op_node("op", "eng.fluids.reynolds"),
        ],
        edges: vec![
            edge("e1", "rho", "out", "op", "rho"),
            edge("e2", "v", "out", "op", "v"),
            edge("e3", "d", "out", "op", "D"),
            edge("e4", "mu", "out", "op", "mu"),
        ],
    };
    let values = run_snap(snap);
    assert_error_exact(&values, "op", "Reynolds: \u{03bc} = 0");
}

// ── "OpName: constraint" pattern ─────────────────────────────────────────────

/// eng.sections.area_annulus: d_inner > d_outer  →  "Annulus: d_inner > d_outer"
#[test]
fn area_annulus_inner_larger_exact_message() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("di", 0.2),
            num_node("do_", 0.1),
            op_node("op", "eng.sections.area_annulus"),
        ],
        edges: vec![
            edge("e1", "di", "out", "op", "d_inner"),
            edge("e2", "do_", "out", "op", "d_outer"),
        ],
    };
    let values = run_snap(snap);
    assert_error_exact(&values, "op", "Annulus: d_inner > d_outer");
}

// ── "OpName: var = 0" pattern (finance) ──────────────────────────────────────

/// fin.tvm.rule_of_72 with r=0  →  "Rule of 72: r = 0"
#[test]
fn rule_of_72_zero_rate_exact_message() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![num_node("r", 0.0), op_node("op", "fin.tvm.rule_of_72")],
        edges: vec![edge("e1", "r", "out", "op", "r")],
    };
    let values = run_snap(snap);
    assert_error_exact(&values, "op", "Rule of 72: r = 0");
}

// ── "OpName: zero variance" pattern ──────────────────────────────────────────

/// stats.rel.linreg_slope with all-identical x values  →  "LinReg slope: zero variance in X"
#[test]
fn linreg_slope_zero_variance_exact_message() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("c3", 3.0),
            num_node("x1", 5.0),
            num_node("x2", 5.0),
            num_node("x3", 5.0),
            num_node("y1", 1.0),
            num_node("y2", 2.0),
            num_node("y3", 3.0),
            op_node("op", "stats.rel.linreg_slope"),
        ],
        edges: vec![
            edge("e1", "c3", "out", "op", "c"),
            edge("e2", "x1", "out", "op", "x1"),
            edge("e3", "x2", "out", "op", "x2"),
            edge("e4", "x3", "out", "op", "x3"),
            edge("e5", "y1", "out", "op", "y1"),
            edge("e6", "y2", "out", "op", "y2"),
            edge("e7", "y3", "out", "op", "y3"),
        ],
    };
    let values = run_snap(snap);
    assert_error_exact(&values, "op", "LinReg slope: zero variance in X");
}

// ── Finance period guard ──────────────────────────────────────────────────────

/// fin.tvm.compound_fv with n=0  →  "Compound FV: n = 0"
#[test]
fn compound_fv_zero_periods_exact_message() {
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("pv", 1000.0),
            num_node("r", 0.05),
            num_node("n", 0.0),
            num_node("t", 1.0),
            op_node("op", "fin.tvm.compound_fv"),
        ],
        edges: vec![
            edge("e1", "pv", "out", "op", "PV"),
            edge("e2", "r", "out", "op", "r"),
            edge("e3", "n", "out", "op", "n"),
            edge("e4", "t", "out", "op", "t"),
        ],
    };
    let values = run_snap(snap);
    assert_error_exact(&values, "op", "Compound FV: n = 0");
}
