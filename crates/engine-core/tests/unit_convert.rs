//! Integration tests for the generic unit_convert block (H1-3).

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

fn convert_node(id: &str, factor: f64) -> NodeDef {
    let mut data = HashMap::new();
    data.insert("convFactor".to_string(), serde_json::json!(factor));
    NodeDef {
        id: id.to_string(),
        block_type: "unit_convert".to_string(),
        data,
    }
}

fn edge(id: &str, src: &str, tgt: &str, tgt_handle: &str) -> EdgeDef {
    EdgeDef {
        id: id.into(),
        source: src.into(),
        source_handle: "out".into(),
        target: tgt.into(),
        target_handle: tgt_handle.into(),
    }
}

fn run_snap(snap: EngineSnapshotV1) -> HashMap<String, Value> {
    let json = serde_json::to_string(&snap).unwrap();
    engine_core::run(&json).unwrap().values
}

#[test]
fn scalar_conversion_mm_to_m() {
    // 1500 mm * 0.001 = 1.5 m
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![num_node("src", 1500.0), convert_node("conv", 0.001)],
        edges: vec![edge("e1", "src", "conv", "value")],
    };
    let vals = run_snap(snap);
    match vals.get("conv") {
        Some(Value::Scalar { value }) => {
            assert!(
                (*value - 1.5).abs() < 1e-10,
                "expected 1.5, got {}",
                value
            );
        }
        other => panic!("expected Scalar, got {:?}", other),
    }
}

#[test]
fn scalar_conversion_default_factor() {
    // No convFactor set — default is 1.0 (identity)
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("src", 42.0),
            NodeDef {
                id: "conv".into(),
                block_type: "unit_convert".into(),
                data: HashMap::new(),
            },
        ],
        edges: vec![edge("e1", "src", "conv", "value")],
    };
    let vals = run_snap(snap);
    match vals.get("conv") {
        Some(Value::Scalar { value }) => {
            assert!(
                (*value - 42.0).abs() < 1e-10,
                "expected 42.0, got {}",
                value
            );
        }
        other => panic!("expected Scalar, got {:?}", other),
    }
}

#[test]
fn vector_conversion_psi_to_pa() {
    // factor for psi->Pa: 6894.757
    let factor = 6894.757;
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            vec_node("src", &[10.0, 20.0, 30.0]),
            convert_node("conv", factor),
        ],
        edges: vec![edge("e1", "src", "conv", "value")],
    };
    let vals = run_snap(snap);
    match vals.get("conv") {
        Some(Value::Vector { value }) => {
            assert_eq!(value.len(), 3);
            assert!((value[0] - 68947.57).abs() < 0.01);
            assert!((value[1] - 137895.14).abs() < 0.01);
            assert!((value[2] - 206842.71).abs() < 0.01);
        }
        other => panic!("expected Vector, got {:?}", other),
    }
}

#[test]
fn chained_conversions() {
    // km -> m (factor 1000) -> cm (factor 100)
    // 2.5 km -> 2500 m -> 250000 cm
    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            num_node("src", 2.5),
            convert_node("c1", 1000.0),
            convert_node("c2", 100.0),
        ],
        edges: vec![
            edge("e1", "src", "c1", "value"),
            edge("e2", "c1", "c2", "value"),
        ],
    };
    let vals = run_snap(snap);
    match vals.get("c2") {
        Some(Value::Scalar { value }) => {
            assert!(
                (*value - 250000.0).abs() < 1e-6,
                "expected 250000.0, got {}",
                value
            );
        }
        other => panic!("expected Scalar, got {:?}", other),
    }
}
