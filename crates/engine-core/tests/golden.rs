//! Golden fixture tests — load JSON fixtures, evaluate, compare outputs.
//!
//! Default: compare and fail on mismatch (CI mode).
//! `GOLDEN_UPDATE=1 cargo test -p engine-core --test golden` to regenerate.

use engine_core::types::{DiagLevel, EdgeDef, EngineSnapshotV1, NodeDef, Value};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// ── Fixture schema ───────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedDiagnostic {
    code: String,
    level: DiagLevel,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenFixture {
    name: String,
    description: String,
    contract_version: u32,
    snapshot: EngineSnapshotV1,
    expected: HashMap<String, Value>,
    #[serde(default)]
    diagnostics: Vec<ExpectedDiagnostic>,
    #[serde(default)]
    tolerance: Option<f64>,
}

// ── Comparison helpers ───────────────────────────────────────────────

fn scalars_match(a: f64, b: f64, tol: Option<f64>) -> bool {
    match tol {
        Some(t) => {
            // Both NaN → match
            if a.is_nan() && b.is_nan() {
                return true;
            }
            // One NaN → mismatch
            if a.is_nan() || b.is_nan() {
                return false;
            }
            // Both infinite with same sign → match
            if a.is_infinite() && b.is_infinite() {
                return a.signum() == b.signum();
            }
            (a - b).abs() <= t
        }
        None => a.to_bits() == b.to_bits(),
    }
}

fn assert_value_eq(name: &str, node_id: &str, actual: &Value, expected: &Value, tol: Option<f64>) {
    match (actual, expected) {
        (Value::Scalar { value: a }, Value::Scalar { value: e }) => {
            assert!(
                scalars_match(*a, *e, tol),
                "[{name}] node {node_id}: expected scalar {e}, got {a} (tol={tol:?})"
            );
        }
        (Value::Vector { value: a }, Value::Vector { value: e }) => {
            assert_eq!(
                a.len(),
                e.len(),
                "[{name}] node {node_id}: vector length mismatch: got {}, expected {}",
                a.len(),
                e.len()
            );
            for (i, (av, ev)) in a.iter().zip(e.iter()).enumerate() {
                assert!(
                    scalars_match(*av, *ev, tol),
                    "[{name}] node {node_id}[{i}]: expected {ev}, got {av}"
                );
            }
        }
        (
            Value::Table {
                columns: ac,
                rows: ar,
            },
            Value::Table {
                columns: ec,
                rows: er,
            },
        ) => {
            assert_eq!(ac, ec, "[{name}] node {node_id}: column mismatch");
            assert_eq!(
                ar.len(),
                er.len(),
                "[{name}] node {node_id}: row count mismatch"
            );
            for (ri, (arow, erow)) in ar.iter().zip(er.iter()).enumerate() {
                assert_eq!(
                    arow.len(),
                    erow.len(),
                    "[{name}] node {node_id} row {ri}: col count mismatch"
                );
                for (ci, (av, ev)) in arow.iter().zip(erow.iter()).enumerate() {
                    assert!(
                        scalars_match(*av, *ev, tol),
                        "[{name}] node {node_id} row {ri} col {ci}: expected {ev}, got {av}"
                    );
                }
            }
        }
        (Value::Error { message: a }, Value::Error { message: e }) => {
            assert!(
                a.contains(e.as_str()) || e.contains(a.as_str()),
                "[{name}] node {node_id}: error message mismatch: got '{a}', expected '{e}'"
            );
        }
        _ => {
            panic!(
                "[{name}] node {node_id}: value kind mismatch: got {:?}, expected {:?}",
                std::mem::discriminant(actual),
                std::mem::discriminant(expected)
            );
        }
    }
}

// ── Fixture loader ───────────────────────────────────────────────────

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn load_fixtures() -> Vec<(PathBuf, GoldenFixture)> {
    let dir = fixtures_dir();
    let mut fixtures: Vec<(PathBuf, GoldenFixture)> = fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("Cannot read fixtures dir {}: {e}", dir.display()))
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.extension().map_or(true, |ext| ext != "json") {
                return None;
            }
            let name = path.file_name()?.to_str()?;
            if !name.ends_with(".fixture.json") {
                return None;
            }
            let content = fs::read_to_string(&path)
                .unwrap_or_else(|e| panic!("Cannot read {}: {e}", path.display()));
            let fixture: GoldenFixture = serde_json::from_str(&content)
                .unwrap_or_else(|e| panic!("Cannot parse {}: {e}", path.display()));
            Some((path, fixture))
        })
        .collect();
    fixtures.sort_by(|a, b| a.1.name.cmp(&b.1.name));
    fixtures
}

// ── Golden update mode ───────────────────────────────────────────────

fn update_fixture(path: &PathBuf, fixture: &mut GoldenFixture) {
    let json = serde_json::to_string(&fixture.snapshot).unwrap();
    let result = engine_core::run(&json).unwrap();

    // Update expected values (only for nodes already listed in expected)
    for (node_id, _) in fixture.expected.clone() {
        if let Some(val) = result.values.get(&node_id) {
            fixture.expected.insert(node_id, val.clone());
        }
    }

    // Update diagnostics
    fixture.diagnostics = result
        .diagnostics
        .iter()
        .map(|d| ExpectedDiagnostic {
            code: d.code.clone(),
            level: d.level,
        })
        .collect();

    let out = serde_json::to_string_pretty(fixture).unwrap();
    fs::write(path, out + "\n").unwrap_or_else(|e| panic!("Cannot write {}: {e}", path.display()));
}

// ── Main test ────────────────────────────────────────────────────────

#[test]
fn golden_fixtures() {
    let is_update = std::env::var("GOLDEN_UPDATE").map_or(false, |v| v == "1");
    let fixtures = load_fixtures();
    assert!(!fixtures.is_empty(), "No fixtures found in tests/fixtures/");

    let mut updated = 0;
    let mut passed = 0;

    for (path, mut fixture) in fixtures {
        let name = fixture.name.clone();

        if is_update {
            update_fixture(&path, &mut fixture);
            updated += 1;
            eprintln!("  updated: {name}");
            continue;
        }

        // Evaluate
        let json = serde_json::to_string(&fixture.snapshot).unwrap();
        let result = engine_core::run(&json).unwrap();

        // Compare expected values
        for (node_id, expected_val) in &fixture.expected {
            let actual = result
                .values
                .get(node_id)
                .unwrap_or_else(|| panic!("[{name}] missing node {node_id} in result"));
            assert_value_eq(&name, node_id, actual, expected_val, fixture.tolerance);
        }

        // Compare diagnostics (code + level only)
        let actual_diags: Vec<(&str, DiagLevel)> = result
            .diagnostics
            .iter()
            .map(|d| (d.code.as_str(), d.level))
            .collect();
        let expected_diags: Vec<(&str, DiagLevel)> = fixture
            .diagnostics
            .iter()
            .map(|d| (d.code.as_str(), d.level))
            .collect();

        for ed in &expected_diags {
            assert!(
                actual_diags.contains(ed),
                "[{name}] missing expected diagnostic: {:?}",
                ed
            );
        }

        // Determinism check: run 2 more times and verify identical results
        for run in 1..=2 {
            let result2 = engine_core::run(&json).unwrap();
            for (node_id, expected_val) in &fixture.expected {
                let actual2 = result2.values.get(node_id).unwrap_or_else(|| {
                    panic!("[{name}] determinism run {run}: missing node {node_id}")
                });
                assert_value_eq(
                    &format!("{name}:determinism_run_{run}"),
                    node_id,
                    actual2,
                    expected_val,
                    fixture.tolerance,
                );
            }
        }

        passed += 1;
    }

    if is_update {
        eprintln!("\n  Golden update: {updated} fixtures regenerated");
    } else {
        eprintln!("\n  Golden tests: {passed} fixtures passed (3× determinism each)");
    }
}

// ── Programmatic tests for special floats (NaN/Inf can't be JSON) ────

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

#[test]
fn nan_propagation() {
    // NaN + 5 = NaN, NaN × 0 = NaN (per correctness contract)
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("zero", 0.0),
            op_node("div", "divide"), // 0/0 = NaN
            num_node("five", 5.0),
            op_node("add_nan", "add"), // NaN + 5 = NaN
            num_node("zero2", 0.0),
            op_node("mul_nan", "multiply"), // NaN × 0 = NaN
        ],
        edges: vec![
            edge("e1", "zero", "out", "div", "a"),
            edge("e2", "zero", "out", "div", "b"),
            edge("e3", "div", "out", "add_nan", "a"),
            edge("e4", "five", "out", "add_nan", "b"),
            edge("e5", "div", "out", "mul_nan", "a"),
            edge("e6", "zero2", "out", "mul_nan", "b"),
        ],
    };
    let vals = eval_snap(&snap);

    let div_val = vals["div"].as_scalar().unwrap();
    assert!(div_val.is_nan(), "0/0 should be NaN, got {div_val}");

    let add_val = vals["add_nan"].as_scalar().unwrap();
    assert!(add_val.is_nan(), "NaN + 5 should be NaN, got {add_val}");

    let mul_val = vals["mul_nan"].as_scalar().unwrap();
    assert!(mul_val.is_nan(), "NaN × 0 should be NaN, got {mul_val}");

    // Verify canonical NaN bit pattern (all NaNs identical)
    assert_eq!(
        div_val.to_bits(),
        f64::NAN.to_bits(),
        "NaN should be canonical"
    );
    assert_eq!(
        add_val.to_bits(),
        f64::NAN.to_bits(),
        "NaN should be canonical"
    );
    assert_eq!(
        mul_val.to_bits(),
        f64::NAN.to_bits(),
        "NaN should be canonical"
    );
}

#[test]
fn infinity_division() {
    // 1/0 = +Inf, -1/0 = -Inf
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("one", 1.0),
            num_node("neg1", -1.0),
            num_node("zero", 0.0),
            op_node("pos_inf", "divide"),
            op_node("neg_inf", "divide"),
        ],
        edges: vec![
            edge("e1", "one", "out", "pos_inf", "a"),
            edge("e2", "zero", "out", "pos_inf", "b"),
            edge("e3", "neg1", "out", "neg_inf", "a"),
            edge("e4", "zero", "out", "neg_inf", "b"),
        ],
    };
    let vals = eval_snap(&snap);

    let pos = vals["pos_inf"].as_scalar().unwrap();
    assert!(pos.is_infinite() && pos > 0.0, "1/0 should be +Inf");

    let neg = vals["neg_inf"].as_scalar().unwrap();
    assert!(neg.is_infinite() && neg < 0.0, "-1/0 should be -Inf");
}

#[test]
fn determinism_100_node_chain() {
    // Build a 100-node chain and verify 3 runs produce identical bitwise results
    let n = 100;
    let mut nodes = Vec::with_capacity(n);
    let mut edges = Vec::with_capacity(n - 1);

    let mut data = HashMap::new();
    data.insert("value".to_string(), serde_json::json!(1.0));
    nodes.push(NodeDef {
        id: "n0".to_string(),
        block_type: "number".to_string(),
        data,
    });

    for i in 1..n {
        nodes.push(op_node(&format!("n{i}"), "negate"));
        edges.push(edge(
            &format!("e{i}"),
            &format!("n{}", i - 1),
            "out",
            &format!("n{i}"),
            "a",
        ));
    }

    let snap = EngineSnapshotV1 {
        version: 1,
        nodes,
        edges,
    };
    let json = serde_json::to_string(&snap).unwrap();

    let baseline = engine_core::run(&json).unwrap();
    assert_eq!(baseline.values.len(), n);

    for run in 1..=2 {
        let result = engine_core::run(&json).unwrap();
        for (id, val) in &baseline.values {
            let actual = &result.values[id];
            let a = val.as_scalar().unwrap();
            let b = actual.as_scalar().unwrap();
            assert_eq!(
                a.to_bits(),
                b.to_bits(),
                "Determinism run {run}: node {id} mismatch"
            );
        }
    }
}
