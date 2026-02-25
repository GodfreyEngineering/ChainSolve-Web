//! Performance smoke tests — catch catastrophic regressions.
//!
//! These use generous budgets (10–50× expected) so they only fail if
//! something is seriously wrong. They run in `cargo test` (native only,
//! not wasm32).

use engine_core::graph::EngineGraph;
use engine_core::types::{EdgeDef, EngineSnapshotV1, NodeDef};
use std::collections::HashMap;
use std::time::Instant;

/// Linear chain: number(1) → negate → negate → ... (n nodes total).
fn chain_dag(n: usize) -> EngineSnapshotV1 {
    let mut nodes = Vec::with_capacity(n);
    let mut edges = Vec::with_capacity(n.saturating_sub(1));

    let mut data = HashMap::new();
    data.insert("value".to_string(), serde_json::json!(1.0));
    nodes.push(NodeDef {
        id: "n0".to_string(),
        block_type: "number".to_string(),
        data,
    });

    for i in 1..n {
        nodes.push(NodeDef {
            id: format!("n{i}"),
            block_type: "negate".to_string(),
            data: HashMap::new(),
        });
        edges.push(EdgeDef {
            id: format!("e{i}"),
            source: format!("n{}", i - 1),
            source_handle: "out".to_string(),
            target: format!("n{i}"),
            target_handle: "a".to_string(),
        });
    }

    EngineSnapshotV1 {
        version: 1,
        nodes,
        edges,
    }
}

#[test]
fn perf_smoke_1k_chain_under_500ms() {
    let snap = chain_dag(1_000);
    let start = Instant::now();
    let mut g = EngineGraph::new();
    g.load_snapshot(snap);
    g.evaluate_dirty();
    let elapsed = start.elapsed();
    assert!(
        elapsed.as_millis() < 500,
        "1k-node full eval took {}ms (budget: 500ms)",
        elapsed.as_millis()
    );
}

#[test]
fn perf_smoke_incremental_1k_under_200ms() {
    let snap = chain_dag(1_000);
    let mut g = EngineGraph::new();
    g.load_snapshot(snap);
    g.evaluate_dirty();

    let start = Instant::now();
    g.set_input("n0", "value", 42.0);
    g.evaluate_dirty();
    let elapsed = start.elapsed();
    assert!(
        elapsed.as_millis() < 200,
        "1k-node incremental eval took {}ms (budget: 200ms)",
        elapsed.as_millis()
    );
}
