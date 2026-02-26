//! Performance smoke tests — catch catastrophic regressions.
//!
//! These use generous budgets (10–50× expected) so they only fail if
//! something is seriously wrong. They run in `cargo test` (native only,
//! not wasm32).

use engine_core::graph::EngineGraph;
use engine_core::types::{EdgeDef, EngineSnapshotV1, NodeDef};
use std::collections::HashMap;
use std::time::Instant;

// ── Shared helpers ─────────────────────────────────────────────────────────

fn num_node(id: &str, value: f64) -> NodeDef {
    let mut data = HashMap::new();
    data.insert("value".to_string(), serde_json::json!(value));
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

fn make_edge(id: &str, source: &str, src_handle: &str, target: &str, tgt_handle: &str) -> EdgeDef {
    EdgeDef {
        id: id.to_string(),
        source: source.to_string(),
        source_handle: src_handle.to_string(),
        target: target.to_string(),
        target_handle: tgt_handle.to_string(),
    }
}

fn single_edge(id: &str, source: &str, target: &str) -> EdgeDef {
    make_edge(id, source, "out", target, "a")
}

/// Fan-out DAG: one number source → n negate leaves.
fn fan_out_dag(n: usize) -> EngineSnapshotV1 {
    let mut nodes = Vec::with_capacity(n);
    let mut edges = Vec::with_capacity(n.saturating_sub(1));

    nodes.push(num_node("n0", 1.0));

    for i in 1..n {
        nodes.push(op_node(&format!("n{i}"), "negate"));
        edges.push(single_edge(&format!("e{i}"), "n0", &format!("n{i}")));
    }

    EngineSnapshotV1 { version: 1, nodes, edges }
}

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

// ── New W9.9 tests ─────────────────────────────────────────────────────────

/// Full eval of a 10 000-node chain.
/// Budget: 8 000 ms — generous CI allowance for slow Codespace hardware.
#[test]
fn perf_smoke_10k_chain_under_8000ms() {
    let snap = chain_dag(10_000);
    let start = Instant::now();
    let mut g = EngineGraph::new();
    g.load_snapshot(snap);
    g.evaluate_dirty();
    let elapsed = start.elapsed();
    assert!(
        elapsed.as_millis() < 8_000,
        "10k-node full eval took {}ms (budget: 8000ms)",
        elapsed.as_millis()
    );
}

/// Fan-out: one number source → 1 000 negate leaves (full eval).
/// Budget: 500 ms.
#[test]
fn perf_smoke_fanout_1k_under_500ms() {
    let snap = fan_out_dag(1_000);
    let start = Instant::now();
    let mut g = EngineGraph::new();
    g.load_snapshot(snap);
    g.evaluate_dirty();
    let elapsed = start.elapsed();
    assert!(
        elapsed.as_millis() < 500,
        "1k fan-out full eval took {}ms (budget: 500ms)",
        elapsed.as_millis()
    );
}

/// Incremental eval when the input value is unchanged.
/// The dirty-set propagation should prune downstream nodes that haven't changed.
/// Budget: 50 ms.
#[test]
fn perf_smoke_incremental_unchanged_under_50ms() {
    let snap = chain_dag(1_000);
    let mut g = EngineGraph::new();
    g.load_snapshot(snap);
    g.evaluate_dirty();

    // Set input to the SAME value — downstream should be pruned.
    g.set_input("n0", "value", 1.0);

    let start = Instant::now();
    g.evaluate_dirty();
    let elapsed = start.elapsed();
    assert!(
        elapsed.as_millis() < 50,
        "incremental (unchanged value) eval took {}ms (budget: 50ms)",
        elapsed.as_millis()
    );
}

/// Register a 1M-element dataset and compute vectorSum over it.
/// Budget: 2 000 ms.
#[test]
fn perf_smoke_dataset_1m_under_2000ms() {
    let mut g = EngineGraph::new();

    // Register a 1M-element dataset.
    let data: Vec<f64> = (0..1_000_000).map(|i| i as f64).collect();
    g.register_dataset("ds1m".to_string(), data);

    // vectorInput node with datasetRef → vectorSum node.
    let mut vi_data = HashMap::new();
    vi_data.insert("blockType".to_string(), serde_json::json!("vectorInput"));
    vi_data.insert("datasetRef".to_string(), serde_json::json!("ds1m"));

    g.load_snapshot(EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            NodeDef {
                id: "vi".to_string(),
                block_type: "vectorInput".to_string(),
                data: vi_data,
            },
            op_node("vsum", "vectorSum"),
        ],
        edges: vec![make_edge("e1", "vi", "out", "vsum", "vec")],
    });

    let start = Instant::now();
    g.evaluate_dirty();
    let elapsed = start.elapsed();

    assert!(
        elapsed.as_millis() < 2_000,
        "1M-element dataset + vectorSum took {}ms (budget: 2000ms)",
        elapsed.as_millis()
    );
}
