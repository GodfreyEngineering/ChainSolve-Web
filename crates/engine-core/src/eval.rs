use crate::ops::evaluate_node;
use crate::types::{Diagnostic, DiagLevel, EngineSnapshotV1, EvalResult, Value};
use std::collections::{HashMap, VecDeque};

/// Evaluate a validated snapshot.
///
/// Uses Kahn's topological sort to determine evaluation order.
/// Nodes in cycles are skipped and reported as diagnostics.
///
/// `elapsed_us` is set by the caller (the WASM wrapper uses
/// `performance.now()` on the JS side; native tests use `Instant`).
/// Here we set it to 0 — the caller may overwrite it.
pub fn evaluate(snapshot: &EngineSnapshotV1) -> EvalResult {
    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    // Build adjacency structures.
    // in_edges: target_node_id → [(source_node_id, source_handle, target_handle)]
    // in_degree: node_id → count of incoming edges
    let mut in_edges: HashMap<&str, Vec<(&str, &str, &str)>> = HashMap::new();
    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    let mut out_adj: HashMap<&str, Vec<&str>> = HashMap::new();

    for node in &snapshot.nodes {
        in_degree.entry(node.id.as_str()).or_insert(0);
        out_adj.entry(node.id.as_str()).or_default();
    }

    for edge in &snapshot.edges {
        in_edges
            .entry(edge.target.as_str())
            .or_default()
            .push((
                edge.source.as_str(),
                edge.source_handle.as_str(),
                edge.target_handle.as_str(),
            ));
        *in_degree.entry(edge.target.as_str()).or_insert(0) += 1;
        out_adj
            .entry(edge.source.as_str())
            .or_default()
            .push(edge.target.as_str());
    }

    // Kahn's algorithm.
    let mut queue: VecDeque<&str> = VecDeque::new();
    for (id, &deg) in &in_degree {
        if deg == 0 {
            queue.push_back(id);
        }
    }

    let mut topo_order: Vec<&str> = Vec::with_capacity(snapshot.nodes.len());
    let mut remaining_degree = in_degree.clone();

    while let Some(id) = queue.pop_front() {
        topo_order.push(id);
        if let Some(neighbors) = out_adj.get(id) {
            for &neighbor in neighbors {
                if let Some(deg) = remaining_degree.get_mut(neighbor) {
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push_back(neighbor);
                    }
                }
            }
        }
    }

    // Nodes not in topo_order are in cycles.
    if topo_order.len() < snapshot.nodes.len() {
        let in_topo: std::collections::HashSet<&str> = topo_order.iter().copied().collect();
        for node in &snapshot.nodes {
            if !in_topo.contains(node.id.as_str()) {
                diagnostics.push(Diagnostic {
                    node_id: Some(node.id.clone()),
                    level: DiagLevel::Error,
                    code: "CYCLE_DETECTED".to_string(),
                    message: format!("Node '{}' is part of a cycle", node.id),
                });
            }
        }
    }

    // Build node lookup.
    let node_map: HashMap<&str, &crate::types::NodeDef> =
        snapshot.nodes.iter().map(|n| (n.id.as_str(), n)).collect();

    // Evaluate in topological order.
    let mut values: HashMap<String, Value> = HashMap::new();

    for &node_id in &topo_order {
        let node = match node_map.get(node_id) {
            Some(n) => n,
            None => continue,
        };

        // Gather input values for this node.
        let mut node_inputs: HashMap<String, Value> = HashMap::new();
        if let Some(edges) = in_edges.get(node_id) {
            for &(src_id, _src_handle, tgt_handle) in edges {
                if let Some(val) = values.get(src_id) {
                    node_inputs.insert(tgt_handle.to_string(), val.clone());
                }
            }
        }

        let result = evaluate_node(&node.block_type, &node_inputs, &node.data);

        // Report unknown blocks.
        if let Value::Error { ref message } = result {
            if message.starts_with("Unknown block type") {
                diagnostics.push(Diagnostic {
                    node_id: Some(node_id.to_string()),
                    level: DiagLevel::Warning,
                    code: "UNKNOWN_BLOCK".to_string(),
                    message: message.clone(),
                });
            }
        }

        values.insert(node_id.to_string(), result);
    }

    EvalResult {
        values,
        diagnostics,
        elapsed_us: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{EdgeDef, NodeDef};

    fn num_node(id: &str, val: f64) -> NodeDef {
        let mut data = HashMap::new();
        data.insert("value".to_string(), serde_json::json!(val));
        NodeDef { id: id.to_string(), block_type: "number".to_string(), data }
    }

    fn op_node(id: &str, block_type: &str) -> NodeDef {
        NodeDef { id: id.to_string(), block_type: block_type.to_string(), data: HashMap::new() }
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

    #[test]
    fn hello_evaluation_3_plus_4() {
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("n1", 3.0),
                num_node("n2", 4.0),
                op_node("n3", "add"),
            ],
            edges: vec![
                edge("e1", "n1", "out", "n3", "a"),
                edge("e2", "n2", "out", "n3", "b"),
            ],
        };

        let result = evaluate(&snap);
        assert!(result.diagnostics.is_empty());
        assert_eq!(result.values.get("n1").unwrap().as_scalar(), Some(3.0));
        assert_eq!(result.values.get("n2").unwrap().as_scalar(), Some(4.0));
        assert_eq!(result.values.get("n3").unwrap().as_scalar(), Some(7.0));
    }

    #[test]
    fn chain_evaluation() {
        // (3 + 4) * 2 = 14
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("n1", 3.0),
                num_node("n2", 4.0),
                op_node("n3", "add"),
                num_node("n4", 2.0),
                op_node("n5", "multiply"),
            ],
            edges: vec![
                edge("e1", "n1", "out", "n3", "a"),
                edge("e2", "n2", "out", "n3", "b"),
                edge("e3", "n3", "out", "n5", "a"),
                edge("e4", "n4", "out", "n5", "b"),
            ],
        };

        let result = evaluate(&snap);
        assert!(result.diagnostics.is_empty());
        assert_eq!(result.values.get("n5").unwrap().as_scalar(), Some(14.0));
    }

    #[test]
    fn cycle_detected() {
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                op_node("a", "add"),
                op_node("b", "add"),
            ],
            edges: vec![
                edge("e1", "a", "out", "b", "a"),
                edge("e2", "b", "out", "a", "a"),
            ],
        };

        let result = evaluate(&snap);
        assert!(result.diagnostics.iter().any(|d| d.code == "CYCLE_DETECTED"));
        // Cyclic nodes should not have values.
        assert!(result.values.is_empty());
    }

    #[test]
    fn unknown_block_produces_warning() {
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                NodeDef { id: "x".into(), block_type: "bogus".into(), data: HashMap::new() },
            ],
            edges: vec![],
        };

        let result = evaluate(&snap);
        assert!(result.diagnostics.iter().any(|d| d.code == "UNKNOWN_BLOCK"));
    }

    #[test]
    fn display_passthrough() {
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("n1", 42.0),
                op_node("d", "display"),
            ],
            edges: vec![
                edge("e1", "n1", "out", "d", "in"),
            ],
        };

        let result = evaluate(&snap);
        assert_eq!(result.values.get("d").unwrap().as_scalar(), Some(42.0));
    }
}
