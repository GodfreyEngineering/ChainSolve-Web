//! Criterion benchmarks for engine-core.
//!
//! Run: `cargo bench --package engine-core`
//! HTML reports: `target/criterion/report/index.html`

use criterion::{criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion};
use engine_core::graph::EngineGraph;
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

criterion_group!(benches, bench_full_eval, bench_incremental, bench_dataset_ops);
criterion_main!(benches);
