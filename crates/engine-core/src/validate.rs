use crate::error::{EngineError, ErrorCode};
use crate::types::{Diagnostic, DiagLevel, EngineSnapshotV1};
use std::collections::HashSet;

/// Validate an engine snapshot, returning diagnostics for any issues.
/// Returns `Err` only for fatal problems (wrong version).
/// Non-fatal issues (dangling edges) are reported as diagnostics.
pub fn validate(snapshot: &EngineSnapshotV1) -> Result<Vec<Diagnostic>, EngineError> {
    if snapshot.version != 1 {
        return Err(EngineError::new(
            ErrorCode::UnsupportedVersion,
            format!("Expected snapshot version 1, got {}", snapshot.version),
        ));
    }

    let mut diags = Vec::new();
    let node_ids: HashSet<&str> = snapshot.nodes.iter().map(|n| n.id.as_str()).collect();

    for edge in &snapshot.edges {
        if !node_ids.contains(edge.source.as_str()) {
            diags.push(Diagnostic {
                node_id: None,
                level: DiagLevel::Error,
                code: ErrorCode::DanglingEdge.to_string(),
                message: format!(
                    "Edge '{}' references missing source node '{}'",
                    edge.id, edge.source
                ),
            });
        }
        if !node_ids.contains(edge.target.as_str()) {
            diags.push(Diagnostic {
                node_id: None,
                level: DiagLevel::Error,
                code: ErrorCode::DanglingEdge.to_string(),
                message: format!(
                    "Edge '{}' references missing target node '{}'",
                    edge.id, edge.target
                ),
            });
        }
    }

    Ok(diags)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{EdgeDef, NodeDef};
    use std::collections::HashMap;

    fn num_node(id: &str, val: f64) -> NodeDef {
        let mut data = HashMap::new();
        data.insert("value".to_string(), serde_json::json!(val));
        NodeDef { id: id.to_string(), block_type: "number".to_string(), data }
    }

    #[test]
    fn valid_graph_no_diagnostics() {
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("n1", 3.0),
                num_node("n2", 4.0),
                NodeDef { id: "n3".into(), block_type: "add".into(), data: HashMap::new() },
            ],
            edges: vec![
                EdgeDef {
                    id: "e1".into(),
                    source: "n1".into(),
                    source_handle: "out".into(),
                    target: "n3".into(),
                    target_handle: "a".into(),
                },
                EdgeDef {
                    id: "e2".into(),
                    source: "n2".into(),
                    source_handle: "out".into(),
                    target: "n3".into(),
                    target_handle: "b".into(),
                },
            ],
        };
        let diags = validate(&snap).unwrap();
        assert!(diags.is_empty());
    }

    #[test]
    fn wrong_version() {
        let snap = EngineSnapshotV1 { version: 99, nodes: vec![], edges: vec![] };
        let err = validate(&snap).unwrap_err();
        assert_eq!(err.code, ErrorCode::UnsupportedVersion);
    }

    #[test]
    fn dangling_edge_detected() {
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![num_node("n1", 1.0)],
            edges: vec![EdgeDef {
                id: "e1".into(),
                source: "n1".into(),
                source_handle: "out".into(),
                target: "missing".into(),
                target_handle: "in".into(),
            }],
        };
        let diags = validate(&snap).unwrap();
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].code, "DANGLING_EDGE");
    }
}
