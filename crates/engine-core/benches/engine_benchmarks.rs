//! Criterion benchmarks for engine-core.
//!
//! Run: `cargo bench --package engine-core`
//! HTML reports: `target/criterion/report/index.html`

use criterion::{criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion};
use engine_core::graph::{EngineGraph, PatchOp};
use engine_core::types::{EdgeDef, EngineSnapshotV1, NodeDef};
use std::collections::HashMap;

// ── Synthetic DAG builders ───────────────────────────────────────────

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

/// Fan-out: 1 number source → (n-1) add nodes, each wired source→a + source→b.
fn fanout_dag(n: usize) -> EngineSnapshotV1 {
    let mut nodes = Vec::with_capacity(n);
    let mut edges = Vec::with_capacity((n.saturating_sub(1)) * 2);

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
            block_type: "add".to_string(),
            data: HashMap::new(),
        });
        edges.push(EdgeDef {
            id: format!("e{i}a"),
            source: "n0".to_string(),
            source_handle: "out".to_string(),
            target: format!("n{i}"),
            target_handle: "a".to_string(),
        });
        edges.push(EdgeDef {
            id: format!("e{i}b"),
            source: "n0".to_string(),
            source_handle: "out".to_string(),
            target: format!("n{i}"),
            target_handle: "b".to_string(),
        });
    }

    EngineSnapshotV1 {
        version: 1,
        nodes,
        edges,
    }
}

// ── Benchmarks ───────────────────────────────────────────────────────

fn bench_full_eval(c: &mut Criterion) {
    let mut group = c.benchmark_group("full_eval");

    for size in [100, 1_000, 10_000] {
        let snap = chain_dag(size);
        let json = serde_json::to_string(&snap).unwrap();
        group.bench_with_input(BenchmarkId::new("chain", size), &json, |b, json| {
            b.iter(|| engine_core::run(json).unwrap())
        });
    }

    for size in [100, 1_000, 10_000] {
        let snap = fanout_dag(size);
        let json = serde_json::to_string(&snap).unwrap();
        group.bench_with_input(BenchmarkId::new("fanout", size), &json, |b, json| {
            b.iter(|| engine_core::run(json).unwrap())
        });
    }

    group.finish();
}

fn bench_incremental(c: &mut Criterion) {
    let mut group = c.benchmark_group("incremental");

    for size in [100, 1_000, 10_000] {
        let snap = chain_dag(size);
        group.bench_with_input(BenchmarkId::new("chain", size), &snap, |b, snap| {
            b.iter_batched(
                || {
                    let mut g = EngineGraph::new();
                    g.load_snapshot(snap.clone());
                    g.evaluate_dirty();
                    g
                },
                |mut g| {
                    g.set_input("n0", "value", 42.0);
                    g.evaluate_dirty()
                },
                BatchSize::SmallInput,
            );
        });
    }

    group.finish();
}

fn bench_dataset_ops(c: &mut Criterion) {
    let mut group = c.benchmark_group("dataset_ops");

    for size in [100_000, 1_000_000] {
        let data: Vec<f64> = (0..size).map(|i| i as f64).collect();

        group.bench_with_input(
            BenchmarkId::new("register", size),
            &data,
            |b, data| {
                b.iter_batched(
                    EngineGraph::new,
                    |mut g| g.register_dataset("ds".into(), data.clone()),
                    BatchSize::SmallInput,
                );
            },
        );

        group.bench_with_input(
            BenchmarkId::new("vectorSum_eval", size),
            &data,
            |b, data| {
                b.iter_batched(
                    || {
                        let mut g = EngineGraph::new();
                        g.register_dataset("ds_bench".to_string(), data.clone());
                        let mut vi_data = HashMap::new();
                        vi_data.insert(
                            "datasetRef".to_string(),
                            serde_json::json!("ds_bench"),
                        );
                        g.load_snapshot(EngineSnapshotV1 {
                            version: 1,
                            nodes: vec![
                                NodeDef {
                                    id: "vi".into(),
                                    block_type: "vectorInput".into(),
                                    data: vi_data,
                                },
                                NodeDef {
                                    id: "sum".into(),
                                    block_type: "vectorSum".into(),
                                    data: HashMap::new(),
                                },
                            ],
                            edges: vec![EdgeDef {
                                id: "e1".into(),
                                source: "vi".into(),
                                source_handle: "out".into(),
                                target: "sum".into(),
                                target_handle: "vec".into(),
                            }],
                        });
                        g
                    },
                    |mut g| g.evaluate_dirty(),
                    BatchSize::LargeInput,
                );
            },
        );
    }

    group.finish();
}

// ── ENG-10: Additional large-graph DAG builders ───────────────────

/// Diamond-ish fan-out/fan-in: 1 source → 500 negate nodes → 250 add nodes
/// (each add takes two consecutive negate outputs). Total: 1 + 500 + 250 = 751
/// nodes with a genuine fan-out/fan-in topology.
fn diamond_dag() -> EngineSnapshotV1 {
    const FAN: usize = 500;
    const PAIRS: usize = FAN / 2; // 250

    let total_nodes = 1 + FAN + PAIRS;
    let mut nodes = Vec::with_capacity(total_nodes);
    let mut edges = Vec::with_capacity(FAN + PAIRS * 2);

    // Source number block.
    let mut src_data = HashMap::new();
    src_data.insert("value".to_string(), serde_json::json!(1.0));
    nodes.push(NodeDef {
        id: "src".to_string(),
        block_type: "number".to_string(),
        data: src_data,
    });

    // 500 negate nodes fanning out from source.
    for i in 0..FAN {
        nodes.push(NodeDef {
            id: format!("neg{i}"),
            block_type: "negate".to_string(),
            data: HashMap::new(),
        });
        edges.push(EdgeDef {
            id: format!("e_src_neg{i}"),
            source: "src".to_string(),
            source_handle: "out".to_string(),
            target: format!("neg{i}"),
            target_handle: "a".to_string(),
        });
    }

    // 250 add nodes fanning in: add_k takes neg_{2k} and neg_{2k+1}.
    for k in 0..PAIRS {
        nodes.push(NodeDef {
            id: format!("add{k}"),
            block_type: "add".to_string(),
            data: HashMap::new(),
        });
        edges.push(EdgeDef {
            id: format!("e_neg{}_add{k}", 2 * k),
            source: format!("neg{}", 2 * k),
            source_handle: "out".to_string(),
            target: format!("add{k}"),
            target_handle: "a".to_string(),
        });
        edges.push(EdgeDef {
            id: format!("e_neg{}_add{k}", 2 * k + 1),
            source: format!("neg{}", 2 * k + 1),
            source_handle: "out".to_string(),
            target: format!("add{k}"),
            target_handle: "b".to_string(),
        });
    }

    EngineSnapshotV1 {
        version: 1,
        nodes,
        edges,
    }
}

/// Merge N independent chain_dag snapshots into one disconnected snapshot.
/// Useful for multi-sheet simulations.
fn multi_sheet_dag(sheets: usize, nodes_per_sheet: usize) -> EngineSnapshotV1 {
    let mut all_nodes = Vec::with_capacity(sheets * nodes_per_sheet);
    let mut all_edges = Vec::with_capacity(sheets * nodes_per_sheet.saturating_sub(1));

    for sheet in 0..sheets {
        let prefix = format!("s{sheet}_");

        // Source node for this sheet.
        let mut data = HashMap::new();
        data.insert("value".to_string(), serde_json::json!(sheet as f64));
        all_nodes.push(NodeDef {
            id: format!("{prefix}n0"),
            block_type: "number".to_string(),
            data,
        });

        for i in 1..nodes_per_sheet {
            all_nodes.push(NodeDef {
                id: format!("{prefix}n{i}"),
                block_type: "negate".to_string(),
                data: HashMap::new(),
            });
            all_edges.push(EdgeDef {
                id: format!("{prefix}e{i}"),
                source: format!("{prefix}n{}", i - 1),
                source_handle: "out".to_string(),
                target: format!("{prefix}n{i}"),
                target_handle: "a".to_string(),
            });
        }
    }

    EngineSnapshotV1 {
        version: 1,
        nodes: all_nodes,
        edges: all_edges,
    }
}

// ── ENG-10: New benchmarks ────────────────────────────────────────

/// Dedicated 1000-node linear chain benchmark (standalone, not grouped).
fn bench_1000_node_linear_chain(c: &mut Criterion) {
    let snap = chain_dag(1000);
    let json = serde_json::to_string(&snap).unwrap();
    c.bench_function("bench_1000_node_linear_chain", |b| {
        b.iter(|| engine_core::run(&json).unwrap())
    });
}

/// 1000-node diamond DAG: fan-out to 500 negate nodes, fan-in to 250 add nodes.
fn bench_1000_node_diamond_dag(c: &mut Criterion) {
    let snap = diamond_dag();
    let json = serde_json::to_string(&snap).unwrap();
    c.bench_function("bench_1000_node_diamond_dag", |b| {
        b.iter(|| engine_core::run(&json).unwrap())
    });
}

/// Incremental patch latency on a 2000-node linear chain.
///
/// Setup: load a 2000-node chain and do a full evaluation.
/// Measured: apply a single `UpdateNodeData` patch to the source node
/// (changes value, triggers worst-case full cascade re-eval) + evaluate_dirty.
fn bench_incremental_patch_2000_node(c: &mut Criterion) {
    let snap = chain_dag(2000);

    c.bench_function("bench_incremental_patch_2000_node", |b| {
        b.iter_batched(
            || {
                let mut g = EngineGraph::new();
                g.load_snapshot(snap.clone());
                g.evaluate_dirty();
                g
            },
            |mut g| {
                let mut new_data = HashMap::new();
                new_data.insert("value".to_string(), serde_json::json!(42.0));
                g.apply_patch(vec![PatchOp::UpdateNodeData {
                    node_id: "n0".to_string(),
                    data: new_data,
                }]);
                g.evaluate_dirty()
            },
            BatchSize::SmallInput,
        );
    });
}

/// Large vector pipeline: vectorInput(10,000 elements) → vectorSum →
/// vectorMean → vectorMin → vectorMax.
fn bench_large_vector_eval(c: &mut Criterion) {
    // Build the 10,000-element vector inline in node data.
    let vec_data: Vec<serde_json::Value> = (0..10_000).map(|i| serde_json::json!(i as f64)).collect();

    let mut vi_data = HashMap::new();
    vi_data.insert("vectorData".to_string(), serde_json::Value::Array(vec_data));

    let snap = EngineSnapshotV1 {
        version: 1,
        nodes: vec![
            NodeDef {
                id: "vi".to_string(),
                block_type: "vectorInput".to_string(),
                data: vi_data,
            },
            NodeDef {
                id: "vsum".to_string(),
                block_type: "vectorSum".to_string(),
                data: HashMap::new(),
            },
            NodeDef {
                id: "vmean".to_string(),
                block_type: "vectorMean".to_string(),
                data: HashMap::new(),
            },
            NodeDef {
                id: "vmin".to_string(),
                block_type: "vectorMin".to_string(),
                data: HashMap::new(),
            },
            NodeDef {
                id: "vmax".to_string(),
                block_type: "vectorMax".to_string(),
                data: HashMap::new(),
            },
        ],
        edges: vec![
            EdgeDef {
                id: "e1".to_string(),
                source: "vi".to_string(),
                source_handle: "out".to_string(),
                target: "vsum".to_string(),
                target_handle: "vec".to_string(),
            },
            EdgeDef {
                id: "e2".to_string(),
                source: "vi".to_string(),
                source_handle: "out".to_string(),
                target: "vmean".to_string(),
                target_handle: "vec".to_string(),
            },
            EdgeDef {
                id: "e3".to_string(),
                source: "vi".to_string(),
                source_handle: "out".to_string(),
                target: "vmin".to_string(),
                target_handle: "vec".to_string(),
            },
            EdgeDef {
                id: "e4".to_string(),
                source: "vi".to_string(),
                source_handle: "out".to_string(),
                target: "vmax".to_string(),
                target_handle: "vec".to_string(),
            },
        ],
    };

    let json = serde_json::to_string(&snap).unwrap();
    c.bench_function("bench_large_vector_eval", |b| {
        b.iter(|| engine_core::run(&json).unwrap())
    });
}

/// 10-sheet project: 10 independent 200-node linear chains (2,000 nodes total),
/// loaded as a single disconnected snapshot. Benchmarks full evaluation of
/// a realistic multi-sheet workload.
fn bench_10_sheet_project(c: &mut Criterion) {
    let snap = multi_sheet_dag(10, 200);
    let json = serde_json::to_string(&snap).unwrap();
    c.bench_function("bench_10_sheet_project", |b| {
        b.iter(|| engine_core::run(&json).unwrap())
    });
}

criterion_group!(
    benches,
    bench_full_eval,
    bench_incremental,
    bench_dataset_ops,
    bench_1000_node_linear_chain,
    bench_1000_node_diamond_dag,
    bench_incremental_patch_2000_node,
    bench_large_vector_eval,
    bench_10_sheet_project,
);
criterion_main!(benches);
